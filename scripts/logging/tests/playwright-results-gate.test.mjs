import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { gate, collect, validateAllowlist } from "../playwright-results-gate.mjs";

// The JSON-results gate (Build 104-J) is tested against REAL Playwright output from controlled samples, not hand-written JSON: each sample is a
// tiny spec run through the project's own Playwright with --reporter=json. That is the only way to know the gate matches what Playwright
// actually reports (e.g. that test.fail() on a throwing test is status "expected", ok:true, and would sail through a "no failures" check).
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const PW = path.join(ROOT, "node_modules", ".bin", "playwright");

const SAMPLES = {
  pass: 'import { test, expect } from "@playwright/test";\ntest("works", async () => { expect(1).toBe(1); });',
  plainFail: 'import { test, expect } from "@playwright/test";\ntest("broken", async () => { expect(1).toBe(2); });',
  testFail: 'import { test } from "@playwright/test";\ntest("known defect", async () => { test.fail(); throw new Error("the defect"); });',
  annotationFail: 'import { test } from "@playwright/test";\ntest("known defect", { annotation: { type: "fail", description: "x" } }, async () => { throw new Error("the defect"); });',
  testFailButPasses: 'import { test } from "@playwright/test";\ntest("fixed already", async () => { test.fail(); });',
  testSkip: 'import { test } from "@playwright/test";\ntest("parked", async () => { test.skip(); });',
  annotationSkip: 'import { test } from "@playwright/test";\ntest("parked", { annotation: { type: "skip" } }, async () => { throw new Error("never runs"); });',
  annotationFixme: 'import { test } from "@playwright/test";\ntest("parked", { annotation: { type: "fixme" } }, async () => { throw new Error("never runs"); });',
  fixme: 'import { test } from "@playwright/test";\ntest.fixme("parked", async () => {});',
  optIn: 'import { test } from "@playwright/test";\ntest("opt-in suite", async () => { test.skip(!process.env.OPT_IN_SUITE, "needs OPT_IN_SUITE"); });',
  flaky: 'import { test, expect } from "@playwright/test";\ntest("flaky", async ({}, info) => { expect(info.retry).toBeGreaterThan(0); });',
  describeSkip: 'import { test } from "@playwright/test";\ntest.describe("group", () => { test.skip(true, "later"); test("inner", async () => {}); });',
  empty: 'import { test } from "@playwright/test";\nvoid test;',
};

function runSample(name, { retries = 0, env = {} } = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "gate-"));
  try {
    fs.symlinkSync(path.join(ROOT, "node_modules"), path.join(dir, "node_modules"));
    fs.writeFileSync(path.join(dir, `${name}.spec.ts`), SAMPLES[name]);
    fs.writeFileSync(path.join(dir, "playwright.config.mjs"), `export default { testDir: ".", testMatch: "*.spec.ts", reporter: "json", workers: 1, retries: ${retries} };`);
    const r = spawnSync(PW, ["test", "--config", path.join(dir, "playwright.config.mjs")], { cwd: dir, encoding: "utf8", env: { ...process.env, ...env, CI: "" } });
    const report = JSON.parse(r.stdout);
    return { report, exit: r.status };
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
}

const reasons = (res) => res.failures.map((f) => f.split(":")[0]);

test("gate: an honest passing run passes", () => {
  const { report, exit } = runSample("pass");
  assert.equal(exit, 0);
  const r = gate(report, []);
  assert.deepEqual(r.failures, []);
  assert.equal(r.ok, true);
  assert.equal(r.ran, 1);
});

test("gate: a plain failure is rejected", () => {
  const { report, exit } = runSample("plainFail");
  assert.notEqual(exit, 0);
  assert.ok(reasons(gate(report, [])).includes("FAILED"));
});

test("gate: test.fail() on a throwing test (Playwright exits 0 and says ok) is rejected as EXPECTED-FAIL", () => {
  const { report, exit } = runSample("testFail");
  assert.equal(exit, 0, "this is the bypass: Playwright itself reports success");
  const t = collect(report)[0];
  assert.equal(t.expectedStatus, "failed");
  assert.equal(t.status, "expected");
  const r = gate(report, []);
  assert.equal(r.ok, false);
  assert.ok(reasons(r).includes("EXPECTED-FAIL"), r.failures.join("\n"));
});

test("gate: { annotation: { type: 'fail' } } on a throwing test is rejected as EXPECTED-FAIL (the 104-J bypass)", () => {
  const { report, exit } = runSample("annotationFail");
  assert.equal(exit, 0, "Playwright reports success for this too");
  const r = gate(report, []);
  assert.equal(r.ok, false);
  assert.ok(reasons(r).includes("EXPECTED-FAIL"), r.failures.join("\n"));
});

test("gate: a test.fail() test that passes (an 'unexpected pass') is rejected", () => {
  const { report, exit } = runSample("testFailButPasses");
  assert.notEqual(exit, 0);
  assert.equal(gate(report, []).ok, false);
});

for (const name of ["testSkip", "annotationSkip", "annotationFixme", "fixme", "describeSkip"]) {
  test(`gate: ${name} is rejected as an unexpected skip when it is not on the allowlist`, () => {
    const { report, exit } = runSample(name);
    assert.equal(exit, 0, "Playwright reports a skipped run as success");
    const r = gate(report, []);
    assert.equal(r.ok, false, `${name} should be rejected`);
    assert.ok(reasons(r).includes("UNEXPECTED SKIP"), r.failures.join("\n"));
  });
}

test("gate: a legitimate opt-in skip passes only when it is on the allowlist, and runs (not skips) when opted in", () => {
  const allow = [{ file: "optIn.spec.ts", title: "opt-in suite", reason: "needs OPT_IN_SUITE=1, an opt-in suite" }];
  const skipped = runSample("optIn");
  assert.equal(gate(skipped.report, []).ok, false, "unlisted skip is rejected");
  const listed = gate(skipped.report, allow);
  assert.equal(listed.ok, true, listed.failures.join("\n"));
  assert.equal(listed.allowedSkips.length, 1);
  const ran = gate(runSample("optIn", { env: { OPT_IN_SUITE: "1" } }).report, allow);
  assert.equal(ran.ok, true);
  assert.equal(ran.allowedSkips.length, 0);
  assert.equal(ran.ran, 1);
});

test("gate: the allowlist cannot be used to allow a skip with a different title, a different file, or no reason", () => {
  const { report } = runSample("optIn");
  const wrongTitle = [{ file: "optIn.spec.ts", title: "something else", reason: "r" }];
  const wrongFile = [{ file: "other.spec.ts", title: "opt-in suite", reason: "r" }];
  const noReason = [{ file: "optIn.spec.ts", title: "opt-in suite", reason: "  " }];
  assert.equal(gate(report, wrongTitle).ok, false);
  assert.equal(gate(report, wrongFile).ok, false);
  const nr = gate(report, noReason);
  assert.equal(nr.ok, false);
  assert.ok(nr.failures.some((f) => f.startsWith("ALLOWLIST")));
  assert.deepEqual(validateAllowlist({}), ["allowlist must be a JSON array"]);
});

test('gate: title "*" allows every skipped test in that one file and nothing in another file', () => {
  const { report } = runSample("optIn");
  assert.equal(gate(report, [{ file: "optIn.spec.ts", title: "*", reason: "whole-file env-gated suite" }]).ok, true);
  assert.equal(gate(report, [{ file: "other.spec.ts", title: "*", reason: "x" }]).ok, false);
});

test("gate: the allowlist may spell the file from the repo root while Playwright reports it relative to testDir", () => {
  const { report } = runSample("optIn");
  assert.equal(gate(report, [{ file: "tests/e2e/optIn.spec.ts", title: "opt-in suite", reason: "env-gated" }]).ok, true);
  assert.equal(gate(report, [{ file: "tests/e2e/otherIn.spec.ts", title: "opt-in suite", reason: "env-gated" }]).ok, false);
  assert.equal(gate(report, [{ file: "tests/e2e/xoptIn.spec.ts", title: "opt-in suite", reason: "env-gated" }]).ok, false, "a different file that merely ends the same way does not match");
});

test("gate: a flaky test (failed, passed on retry) is rejected even though Playwright exits 0", () => {
  const { report, exit } = runSample("flaky", { retries: 1 });
  assert.equal(exit, 0, "Playwright reports a flaky pass as success");
  const r = gate(report, []);
  assert.equal(r.ok, false);
  assert.ok(reasons(r).includes("FLAKY") || reasons(r).includes("RETRIED"), r.failures.join("\n"));
});

test("gate: a report with no tests is rejected", () => {
  const { report } = runSample("empty");
  const r = gate(report, []);
  assert.equal(r.ok, false);
  assert.ok(reasons(r).includes("NO TESTS"));
  assert.equal(gate({}, []).ok, false);
});

test("gate: the CLI exits 0 on a pass, 1 on a rejection, 2 on unreadable input", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "gate-cli-"));
  try {
    const cli = path.join(ROOT, "scripts", "logging", "playwright-results-gate.mjs");
    const ok = path.join(dir, "ok.json"), bad = path.join(dir, "bad.json"), none = path.join(dir, "allow.json");
    fs.writeFileSync(ok, JSON.stringify(runSample("pass").report));
    fs.writeFileSync(bad, JSON.stringify(runSample("testFail").report));
    fs.writeFileSync(none, "[]");
    assert.equal(spawnSync("node", [cli, ok, none]).status, 0);
    const rej = spawnSync("node", [cli, bad, none], { encoding: "utf8" });
    assert.equal(rej.status, 1);
    assert.match(rej.stderr, /EXPECTED-FAIL/);
    assert.equal(spawnSync("node", [cli, path.join(dir, "missing.json"), none]).status, 2);
    assert.equal(spawnSync("node", [cli]).status, 2);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});
