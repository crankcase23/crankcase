import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { flat, rowPassed, fullRunProblems, isolationVerdicts } from "../gate-report.mjs";
import { unexpectedSkips } from "../gate-skips.mjs";

// Build 104-K: scripts/release-gate.mjs counted Playwright status "expected" as success. Playwright reports a THROWING test.fail() /
// { annotation: { type: "fail" } } test as status "expected" (ok:true, exit 0), so a known-defective isolation spec, a full run, or the NHTSA
// fallback-leg report could be "release evidence" with the defect still in it. These tests run REAL Playwright samples through the judging code.
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const PW = path.join(ROOT, "node_modules", ".bin", "playwright");
const SAMPLES = {
  pass: 'import { test, expect } from "@playwright/test";\ntest("works", async () => { expect(1).toBe(1); });',
  testFail: 'import { test } from "@playwright/test";\ntest("works", async () => { test.fail(); throw new Error("the defect"); });',
  annotationFail: 'import { test } from "@playwright/test";\ntest("works", { annotation: { type: "fail" } }, async () => { throw new Error("the defect"); });',
  plainFail: 'import { test, expect } from "@playwright/test";\ntest("works", async () => { expect(1).toBe(2); });',
  skip: 'import { test } from "@playwright/test";\ntest("works", async () => { test.skip(true, "later"); });',
  hang: 'import { test } from "@playwright/test";\ntest("works", async () => { test.info().expectedStatus = "timedOut"; test.setTimeout(300); await new Promise(() => {}); });',
  teardown: 'import { test } from "@playwright/test";\ntest("works", async () => {});',
  flaky: 'import { test, expect } from "@playwright/test";\ntest("works", async ({}, info) => { expect(info.retry).toBeGreaterThan(0); });',
};
function run(name, { retries = 0, teardown = false } = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "rg-"));
  try {
    fs.symlinkSync(path.join(ROOT, "node_modules"), path.join(dir, "node_modules"));
    fs.writeFileSync(path.join(dir, "x.spec.ts"), SAMPLES[name]);
    if (teardown) fs.writeFileSync(path.join(dir, "td.mjs"), "export default async function () { throw new Error('teardown failed'); }");
    fs.writeFileSync(path.join(dir, "playwright.config.mjs"), `export default { testDir: ".", testMatch: "*.spec.ts", reporter: "json", workers: 1, retries: ${retries}${teardown ? ', globalTeardown: "./td.mjs"' : ""} };`);
    const r = spawnSync(PW, ["test", "--config", path.join(dir, "playwright.config.mjs")], { cwd: dir, encoding: "utf8", env: { ...process.env, CI: "" } });
    return { report: JSON.parse(r.stdout), exit: r.status };
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
}
const REQ = [{ file: "x.spec.ts", title: "works" }];

test("an honest pass is release evidence", () => {
  const { report } = run("pass");
  assert.equal(rowPassed(flat(report)[0]), true);
  assert.equal(isolationVerdicts(report, REQ).every((v) => v.ok), true);
  assert.deepEqual(fullRunProblems(report), []);
});

test("an expected-failing test (test.fail / annotation fail, Playwright exit 0, status 'expected') is NOT release evidence", () => {
  for (const name of ["testFail", "annotationFail", "hang"]) {
    const { report, exit } = run(name);
    assert.equal(exit, 0, `${name}: Playwright itself reports success`);
    assert.equal(flat(report)[0].status, "expected", `${name}: this is what the old gate accepted`);
    assert.equal(rowPassed(flat(report)[0]), false, name);
    assert.equal(isolationVerdicts(report, REQ).some((v) => v.ok), false, `${name}: isolation verdict`);
    assert.notEqual(fullRunProblems(report).length, 0, `${name}: full-run problems`);
  }
});

test("failed, skipped, flaky and run-level-error reports are not release evidence", () => {
  assert.equal(isolationVerdicts(run("plainFail").report, REQ).some((v) => v.ok), false);
  assert.equal(isolationVerdicts(run("skip").report, REQ).some((v) => v.ok), false);
  assert.notEqual(fullRunProblems(run("plainFail").report).length, 0);
  assert.notEqual(fullRunProblems(run("flaky", { retries: 2 }).report).length, 0);
  assert.notEqual(fullRunProblems(run("teardown", { teardown: true }).report).length, 0, "a throwing globalTeardown");
});

test("a missing required spec is a failed verdict", () => {
  const v = isolationVerdicts(run("pass").report, [{ file: "other.spec.ts", title: "nope" }]);
  assert.equal(v[0].ok, false);
  assert.match(v[0].msg, /NOT FOUND/);
});

test("the NHTSA fallback-leg report cannot vouch for skips if its tests were expected-fail", () => {
  const skipped = [{ file: "tests/e2e/vin-fallback.spec.ts", title: "works", status: "skipped" }];
  const honestLeg = [{ file: "tests/e2e/vin-fallback.spec.ts", title: "works", status: "expected", expectedStatus: "passed", resultStatus: "passed", annotations: [] }];
  const maskedLeg = [{ ...honestLeg[0], expectedStatus: "failed" }];
  assert.deepEqual(unexpectedSkips(skipped, { fallbackLegRows: honestLeg }), []);
  assert.equal(unexpectedSkips(skipped, { fallbackLegRows: maskedLeg }).length, 1);
});
