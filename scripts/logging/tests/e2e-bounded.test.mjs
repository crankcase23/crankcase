import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

// scripts/logging/e2e-bounded.sh (Build 104-AO). The real e2e-gated.sh is replaced by a stub (CC_E2E_GATED) that records that it ran and writes fake
// failure artifacts, so these tests are fast, need no browser and cannot themselves fill a disk.
const SCRIPT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "e2e-bounded.sh");
const bash = process.platform === "win32" ? "bash" : "/bin/bash";

function sandbox({ failures = 0, rc = 0, results = '{"suites":[]}' } = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "bounded-"));
  const stub = path.join(dir, "stub-gated.sh");
  fs.writeFileSync(stub, `#!/bin/bash
echo "$@" > "${dir}/stub-args.txt"
echo ran > "${dir}/stub-ran.txt"
OUT="\${CC_GATE_OUT}"
mkdir -p "$OUT/pw"
cat > "$OUT/results.json" <<'JSON'
${results}
JSON
for i in $(seq 1 ${failures}); do
  mkdir -p "$OUT/pw/failure-$i"
  echo "error text $i" > "$OUT/pw/failure-$i/error-context.md"
  head -c 2048 /dev/zero > "$OUT/pw/failure-$i/trace.zip"
done
exit ${rc}
`);
  fs.chmodSync(stub, 0o755);
  return { dir, stub, out: path.join(dir, "out") };
}
const run = (sb, args = [], env = {}) =>
  spawnSync(bash, [SCRIPT, ...args], { encoding: "utf8", env: { ...process.env, CC_E2E_GATED: sb.stub, CC_GATE_OUT: sb.out, CC_MIN_FREE_MB: "1", ...env } });
const cleanup = (sb) => fs.rmSync(sb.dir, { recursive: true, force: true });

test("BND-1 refuses to start when too little disk is free: exit 4, the run never starts", () => {
  const sb = sandbox();
  const r = run(sb, [], { CC_MIN_FREE_MB: "999999999" });
  assert.equal(r.status, 4);
  assert.match(r.stderr, /refusing to start/);
  assert.equal(fs.existsSync(path.join(sb.dir, "stub-ran.txt")), false);
  cleanup(sb);
});

test("BND-2 refuses a trace for every test (--trace=on and --trace on): exit 2, never started", () => {
  for (const args of [["--trace=on"], ["--trace", "on"]]) {
    const sb = sandbox();
    const r = run(sb, args);
    assert.equal(r.status, 2, args.join(" "));
    assert.match(r.stderr, /refusing --trace/);
    assert.equal(fs.existsSync(path.join(sb.dir, "stub-ran.txt")), false);
    cleanup(sb);
  }
});

test("BND-3 retain-on-failure is allowed, and the gated run gets an --output inside the results dir", () => {
  const sb = sandbox();
  const r = run(sb, ["--trace=retain-on-failure", "--workers=2"]);
  assert.equal(r.status, 0);
  const args = fs.readFileSync(path.join(sb.dir, "stub-args.txt"), "utf8");
  assert.match(args, new RegExp(`--output ${sb.out}/pw`));
  assert.match(args, /--trace=retain-on-failure/);
  cleanup(sb);
});

test("BND-4 failure evidence is bounded: the first N keep their trace, the rest keep error-context.md, and results.json is untouched", () => {
  const sb = sandbox({ failures: 5, rc: 1 });
  const r = run(sb, [], { CC_KEEP_FAILURES: "2" });
  assert.equal(r.status, 1, "the verdict passes through");
  const traces = fs.readdirSync(path.join(sb.out, "pw")).filter((d) => fs.existsSync(path.join(sb.out, "pw", d, "trace.zip")));
  assert.equal(traces.length, 2);
  for (let i = 1; i <= 5; i++) assert.ok(fs.existsSync(path.join(sb.out, "pw", `failure-${i}`, "error-context.md")), `error text ${i} kept`);
  assert.equal(fs.readFileSync(path.join(sb.out, "TRIMMED.txt"), "utf8").trim().split("\n").length, 3);
  assert.equal(fs.readFileSync(path.join(sb.out, "results.json"), "utf8").trim(), '{"suites":[]}');
  cleanup(sb);
});

test("BND-5 nothing is trimmed when the failures fit the cap, and no TRIMMED.txt is left behind", () => {
  const sb = sandbox({ failures: 3, rc: 1 });
  run(sb, [], { CC_KEEP_FAILURES: "25" });
  assert.equal(fs.existsSync(path.join(sb.out, "TRIMMED.txt")), false);
  assert.equal(fs.readdirSync(path.join(sb.out, "pw")).filter((d) => fs.existsSync(path.join(sb.out, "pw", d, "trace.zip"))).length, 3);
  cleanup(sb);
});

test("BND-6 the verdict is the gated run's, exit code included (0, 1 and the results gate's 3)", () => {
  for (const rc of [0, 1, 3]) {
    const sb = sandbox({ rc });
    assert.equal(run(sb).status, rc);
    cleanup(sb);
  }
});

test("BND-7 CC_ALLOW_TRACE_ON=1 overrides the refusal on purpose", () => {
  const sb = sandbox();
  assert.equal(run(sb, ["--trace=on"], { CC_ALLOW_TRACE_ON: "1" }).status, 0);
  cleanup(sb);
});

const failReport = (messages) => JSON.stringify({ suites: [{ title: "a.spec.ts", file: "a.spec.ts", specs: [{ title: "t", file: "a.spec.ts", tests: [{ projectName: "p", expectedStatus: "passed", status: "unexpected", annotations: [], results: [{ status: "failed", retry: 0, errors: messages.map((message) => ({ message })) }] }] }] }], errors: [], stats: { unexpected: 1, flaky: 0 } });

test("BND-8 (review) a non-numeric CC_MIN_FREE_MB or CC_KEEP_FAILURES is refused (exit 2), never silently skipping the precheck or the trim", () => {
  for (const env of [{ CC_MIN_FREE_MB: "abc" }, { CC_KEEP_FAILURES: "abc" }, { CC_MIN_FREE_MB: "99999999999999999999" }]) {
    const sb = sandbox();
    const r = run(sb, [], env);
    assert.equal(r.status, 2, JSON.stringify(env));
    assert.match(r.stderr, /must be a whole number/);
    assert.equal(fs.existsSync(path.join(sb.dir, "stub-ran.txt")), false);
    cleanup(sb);
  }
});

test("BND-9 (review) a caller's own --output is refused: it would win over the wrapper's and bypass trimming and the size report", () => {
  for (const args of [["--output", "/x"], ["--output=/x"]]) {
    const sb = sandbox();
    const r = run(sb, args);
    assert.equal(r.status, 2, args.join(" "));
    assert.match(r.stderr, /refusing --output/);
    assert.equal(fs.existsSync(path.join(sb.dir, "stub-ran.txt")), false);
    cleanup(sb);
  }
});

test("BND-10 (review) a failed run whose every failure is a definite resource exhaustion returns 3; a product failure, a mix, and a pass are untouched", () => {
  const cases = [
    [1, failReport(["Error: ENOSPC: no space left on device, write"]), 3],
    [1, failReport(["Error: expect(page).toHaveURL failed"]), 1],
    [1, failReport(["Error: expect(page).toHaveURL failed", "Error: ENOSPC: no space left on device"]), 1],
    [1, failReport(["Error: locator.innerText: Target crashed"]), 1],
    [0, failReport(["Error: ENOSPC: no space left on device"]), 0],
  ];
  for (const [rc, results, want] of cases) {
    const sb = sandbox({ rc, results });
    assert.equal(run(sb).status, want, results.slice(0, 160));
    cleanup(sb);
  }
});

test("BND-11 (review 2) a results.json left by an EARLIER run is never judged as this run's (no exit 3 from a stale all-ENOSPC file)", () => {
  const sb = sandbox({ rc: 1 });
  // the stub below writes nothing, so the only results.json is the stale one planted here
  fs.writeFileSync(sb.stub, `#!/bin/bash\nexit 1\n`);
  fs.mkdirSync(sb.out, { recursive: true });
  fs.writeFileSync(path.join(sb.out, "results.json"), failReport(["Error: ENOSPC: no space left on device, write"]));
  assert.equal(run(sb).status, 1);
  cleanup(sb);
});
