import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

// Build 104-K: `npm run test:e2e` must run the suite THROUGH the results gate (scripts/logging/e2e-gated.sh), and that script must only ever
// produce full-run evidence. These run the real script (and the real npm script) against controlled specs in a temp dir.
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, "package.json"), "utf8"));

function runGated(files, { args = [], env = {}, viaNpm = false } = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "gated-"));
  try {
    fs.symlinkSync(path.join(ROOT, "node_modules"), path.join(dir, "node_modules"));
    for (const [name, src] of Object.entries(files)) fs.writeFileSync(path.join(dir, name), src);
    const cfg = path.join(dir, "playwright.config.mjs");
    fs.writeFileSync(cfg, 'export default { testDir: ".", testMatch: "*.spec.ts", workers: 1, retries: 0 };');
    const out = path.join(dir, "out");
    const cmd = viaNpm ? ["npm", ["run", "--silent", "test:e2e", "--", "--config", cfg, ...args]] : ["bash", [path.join(ROOT, "scripts/logging/e2e-gated.sh"), "--config", cfg, ...args]];
    const r = spawnSync(cmd[0], cmd[1], { cwd: ROOT, encoding: "utf8", env: { ...process.env, CI: "", CC_GATE_OUT: out, ...env } });
    return { exit: r.status, text: (r.stdout ?? "") + (r.stderr ?? "") };
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
}
const T = (body) => `import { test, expect } from "@playwright/test";\n${body}`;

test("package.json test:e2e runs the suite through the results gate", () => {
  assert.match(pkg.scripts["test:e2e"], /scripts\/logging\/e2e-gated\.sh/);
});

test("gated run, via the npm script: an honest pass is GREEN (exit 0)", () => {
  const r = runGated({ "a.spec.ts": T('test("works", async () => { expect(1).toBe(1); });') }, { viaNpm: true });
  assert.equal(r.exit, 0, r.text);
  assert.match(r.text, /GATE PASS/);
});

test("gated run, via the npm script: an expected-failing test is RED even though Playwright exits 0", () => {
  for (const body of ['test("d", async () => { test.fail(); throw new Error("x"); });', 'test("d", { annotation: { type: "fail" } }, async () => { throw new Error("x"); });']) {
    const r = runGated({ "a.spec.ts": T(body) }, { viaNpm: true });
    assert.notEqual(r.exit, 0, r.text);
    assert.match(r.text, /playwright exit=0/, "Playwright itself said success");
    assert.match(r.text, /GATE FAIL/);
  }
});

test("gated run: a skip is RED unless the file is on the allowlist; an allowlisted opt-in skip is GREEN", () => {
  const skipSrc = T('test("opt-in", async () => { test.skip(!process.env.NOPE_OPT_IN, "needs NOPE_OPT_IN"); });');
  const bad = runGated({ "a.spec.ts": skipSrc });
  assert.notEqual(bad.exit, 0, bad.text);
  assert.match(bad.text, /UNEXPECTED SKIP/);
  const good = runGated({ "vin-fallback.spec.ts": skipSrc }); // whole-file allowlist entry
  assert.equal(good.exit, 0, good.text);
  assert.match(good.text, /allowed skip/);
});

test("gated run: a plain failure is RED", () => {
  const r = runGated({ "a.spec.ts": T('test("broken", async () => { expect(1).toBe(2); });') });
  assert.notEqual(r.exit, 0);
});

test("gated run: a computed .only is refused by --forbid-only", () => {
  const r = runGated({ "a.spec.ts": T('const k = "only";\n(test as any)[k]("kept", async () => {});\ntest("dropped", async () => { throw new Error("x"); });') });
  assert.notEqual(r.exit, 0, r.text);
});

test("gated run: filtering flags and file arguments are refused (a filtered run is not evidence); an explicit override says so", () => {
  const spec = { "a.spec.ts": T('test("works", async () => {});') };
  for (const args of [["--grep", "works"], ["-g", "works"], ["--grep-invert", "x"], ["--shard=1/2"], ["--last-failed"], ["--retries=2"], ["--max-failures=1"], ["-x"], ["--project=chromium"], ["a.spec.ts"], ["--pass-with-no-tests"], ["--update-snapshots"], ["--only-changed"]]) {
    const r = runGated(spec, { args });
    assert.equal(r.exit, 2, `${args.join(" ")}: ${r.text}`);
    assert.match(r.text, /refus/i);
  }
  const o = runGated(spec, { args: ["--grep", "works"], env: { CC_GATE_ALLOW_FILTER: "1" } });
  assert.equal(o.exit, 0, o.text);
  assert.match(o.text, /FILTERED RUN: NOT RELEASE EVIDENCE/);
});
