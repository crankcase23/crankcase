import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { failedTests, gate, RESOURCE_EXHAUSTION } from "../playwright-results-gate.mjs";

// Build 104-AO: the results gate labels failures that carry a resource-exhaustion error (disk full, out of memory, browser crash) as
// ENVIRONMENT-SUSPECT, so a run that ran out of disk is not read as product evidence. Found when a full production-mode run filled the sandbox disk
// and reported seven unrelated failures (ENOSPC, ERR_INSUFFICIENT_RESOURCES, "Target crashed").
// The label NEVER changes the verdict: these tests pin that a labelled failure still fails the gate, exactly like any other.
const HERE = path.dirname(fileURLToPath(import.meta.url));
const GATE = path.join(HERE, "..", "playwright-results-gate.mjs");

const passing = (title) => ({ title, file: "a.spec.ts", tests: [{ projectName: "p", expectedStatus: "passed", status: "expected", annotations: [], results: [{ status: "passed", retry: 0, errors: [] }] }] });
const failing = (title, message) => ({ title, file: "a.spec.ts", tests: [{ projectName: "p", expectedStatus: "passed", status: "unexpected", annotations: [], results: [{ status: "failed", retry: 0, errors: [{ message }] }] }] });
const failingMulti = (title, messages) => ({ title, file: "a.spec.ts", tests: [{ projectName: "p", expectedStatus: "passed", status: "unexpected", annotations: [], results: [{ status: "failed", retry: 0, errors: messages.map((message) => ({ message })) }] }] });
const report = (specs) => ({ suites: [{ title: "a.spec.ts", file: "a.spec.ts", specs }], errors: [], stats: { unexpected: specs.filter((s) => s.tests[0].status === "unexpected").length, flaky: 0 } });

test("ENV-1 each resource-exhaustion shape seen in the 104-AN run is recognised", () => {
  for (const msg of [
    "Error: browserContext.close: ENOSPC: no space left on device, write",
    "Error: page.reload: net::ERR_INSUFFICIENT_RESOURCES",
    "Error: locator.innerText: Target crashed",
    "Error: Target page, context or browser has been crashed",
    "EMFILE: too many open files",
    "FATAL ERROR: JavaScript heap out of memory",
  ]) assert.ok(RESOURCE_EXHAUSTION.test(msg), msg);
});

test("ENV-2 ordinary product and assertion failures are NOT labelled environment", () => {
  for (const msg of [
    "Error: expect(page).toHaveURL(expected) failed\nExpected pattern: /\\/garage$/\nReceived string: \"http://localhost:3100/login\"",
    "Error: a failed sign-in must not navigate to the garage",
    "Error: expect(locator).toBeVisible() failed\nLocator: getByRole('button', { name: /start wrench mode/i })",
    "Error: Test timeout of 60000ms exceeded.",
  ]) assert.equal(RESOURCE_EXHAUSTION.test(msg), false, msg);
});

test("ENV-3 failedTests splits environment-suspect failures from the rest, by test", () => {
  const r = report([
    passing("ok"),
    failing("disk", "Error: browserContext.close: ENOSPC: no space left on device, write"),
    failing("product", "Error: expect(page).toHaveURL(expected) failed"),
  ]);
  const f = failedTests(r);
  assert.deepEqual(f.map((x) => [x.id.split(" :: ")[1], x.environment, x.definite]), [["disk [p]", true, true], ["product [p]", false, false]]);
});

test("ENV-4 labelling never changes the verdict: a run with only environment failures still FAILS the gate", () => {
  const r = report([passing("ok"), failing("disk", "Error: ENOSPC: no space left on device")]);
  const g = gate(r, []);
  assert.equal(g.ok, false);
  assert.ok(g.failures.some((x) => x.startsWith("FAILED:")), "still reported as FAILED");
});

function runCli(rep) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "gate-env-"));
  const file = path.join(dir, "results.json");
  fs.writeFileSync(file, JSON.stringify(rep));
  const r = spawnSync(process.execPath, [GATE, file, path.join(dir, "no-allowlist.json")], { encoding: "utf8" });
  fs.rmSync(dir, { recursive: true, force: true });
  return { code: r.status, out: `${r.stdout}\n${r.stderr}` };
}

test("ENV-5 CLI: every failure environmental => exit 3 and an explicit ENVIRONMENT FAILURE line (not product evidence)", () => {
  const { code, out } = runCli(report([passing("ok"), failing("a", "Error: ENOSPC: no space left on device"), failing("b", "Error: browserContext.close: ENOSPC: no space left on device, write")]));
  assert.equal(code, 3);
  assert.match(out, /ENVIRONMENT FAILURE/);
  assert.match(out, /GATE FAIL/);
});

test("ENV-6 CLI: a mix of product and environment failures => exit 1, the product failure is not excused, and the note says so", () => {
  const { code, out } = runCli(report([failing("disk", "Error: Target crashed"), failing("product", "Error: expect(page).toHaveURL(expected) failed")]));
  assert.equal(code, 1);
  assert.doesNotMatch(out, /ENVIRONMENT FAILURE/);
  assert.match(out, /1 of 2 failing tests carry a resource-exhaustion error; the other 1 are not explained by it/);
});

test("ENV-7 CLI: a plain product failure => exit 1 and no environment wording at all", () => {
  const { code, out } = runCli(report([failing("product", "Error: expect(page).toHaveURL(expected) failed")]));
  assert.equal(code, 1);
  assert.doesNotMatch(out, /ENVIRONMENT/);
});

test("ENV-8 CLI: a clean run still exits 0 with GATE PASS", () => {
  const { code, out } = runCli(report([passing("ok")]));
  assert.equal(code, 0);
  assert.match(out, /GATE PASS/);
});

test("ENV-9 (review) one real assertion error next to a teardown ENOSPC is a PRODUCT failure, not an environment one", () => {
  const rep = report([failingMulti("mixed", ["Error: expect(page).toHaveURL failed: a failed sign-in must not navigate", "Error: browserContext.close: ENOSPC: no space left on device"])]);
  assert.deepEqual(failedTests(rep).map((x) => x.environment), [false]);
  const { code, out } = runCli(rep);
  assert.equal(code, 1);
  assert.doesNotMatch(out, /ENVIRONMENT FAILURE/);
});

test("ENV-10 (review) an ENOSPC failure next to a run-level error or an unexpected skip is NOT an environment failure (exit 1)", () => {
  const enospc = failing("disk", "Error: ENOSPC: no space left on device");
  const withRunError = { ...report([passing("ok"), enospc]), errors: [{ message: "globalTeardown threw: boom" }] };
  const a = runCli(withRunError);
  assert.equal(a.code, 1, a.out);
  assert.doesNotMatch(a.out, /ENVIRONMENT FAILURE/);
  const skipped = { title: "skipme", file: "a.spec.ts", tests: [{ projectName: "p", expectedStatus: "skipped", status: "skipped", annotations: [], results: [{ status: "skipped", retry: 0, errors: [] }] }] };
  const b = runCli(report([passing("ok"), enospc, skipped]));
  assert.equal(b.code, 1, b.out);
  assert.doesNotMatch(b.out, /ENVIRONMENT FAILURE/);
});

test("ENV-11 (review) ambiguous messages alone (a request storm, a render crash) are labelled but NEVER make an environment failure", () => {
  for (const msg of ["Error: page.goto: net::ERR_INSUFFICIENT_RESOURCES at /garage", "Error: locator.innerText: Target crashed", "Error: page.waitForTimeout: Page crashed"]) {
    const rep = report([failing("storm", msg)]);
    assert.deepEqual(failedTests(rep).map((x) => [x.environment, x.definite]), [[true, false]], msg);
    const { code, out } = runCli(rep);
    assert.equal(code, 1, msg);
    assert.doesNotMatch(out, /ENVIRONMENT FAILURE/);
  }
});

test("ENV-12 (review) a page crash together with the ENOSPC that caused it IS an environment failure (exit 3)", () => {
  const { code, out } = runCli(report([failingMulti("crash", ["Error: page.waitForTimeout: Page crashed", "Error: browserContext._wrapApiCall: ENOSPC: no space left on device, write"])]));
  assert.equal(code, 3, out);
  assert.match(out, /ENVIRONMENT FAILURE/);
});

test("ENV-13 (review 2) free text that merely mentions a resource word, or sits in the stack's code frame, is NOT an environment failure", () => {
  const quoted = failing("quoted", 'Error: expect(received).toBe(expected)\nReceived: "Error: ENOSPC while saving vehicle"');
  const inStack = { title: "stack", file: "a.spec.ts", tests: [{ projectName: "p", expectedStatus: "passed", status: "unexpected", annotations: [], results: [{ status: "failed", retry: 0, errors: [{ message: "Error: toHaveText failed", stack: "  12 | // regression: server hit ENOMEM once\n> 13 | await expect(x).toHaveText(/y/)" }] }] }] };
  assert.deepEqual(failedTests(report([inStack])).map((x) => x.environment), [false], "the stack's code frame is never searched");
  for (const rep of [report([quoted]), report([inStack])]) {
    assert.deepEqual(failedTests(rep).map((x) => x.definite), [false]);
    const { code, out } = runCli(rep);
    assert.equal(code, 1, out);
    assert.doesNotMatch(out, /ENVIRONMENT FAILURE/);
  }
});

test("ENV-14 (review 2) EMFILE, ENOMEM and heap-out-of-memory are labelled but never definite: a leak in the product looks the same", () => {
  for (const msg of ["Error: EMFILE: too many open files", "Error: spawn ENOMEM", "FATAL ERROR: JavaScript heap out of memory"]) {
    const rep = report([failing("leak", msg)]);
    assert.deepEqual(failedTests(rep).map((x) => [x.environment, x.definite]), [[true, false]], msg);
    assert.equal(runCli(rep).code, 1, msg);
  }
});
