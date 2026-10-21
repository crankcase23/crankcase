import test from "node:test";
import assert from "node:assert/strict";
import { unexpectedSkips } from "../../release/gate-skips.mjs";

// rows as scripts/release/gate-report.mjs flat() builds them: a real pass is status "expected" AND expectedStatus "passed"
const fb = (status, n, extra = {}) => ({ file: "vin-fallback.spec.ts", title: `fallback ${n}`, status, ...(status === "expected" ? { expectedStatus: "passed", resultStatus: "passed", annotations: [] } : {}), ...extra });
const ops = { file: "ops-snapshot.spec.ts", title: "ops 1", status: "skipped" };
const other = { file: "garage.spec.ts", title: "g", status: "skipped" };

test("release gate: flag-gated fallback skips are accepted only when the flag-ON leg proves they all passed", () => {
  const main = [fb("skipped", 1), fb("skipped", 2), ops];
  assert.equal(unexpectedSkips(main, {}).length, 2, "no leg report: fallback skips are failures");
  assert.equal(unexpectedSkips(main, { fallbackLegRows: [fb("expected", 1), fb("expected", 2)] }).length, 0, "leg passed every one");
  assert.equal(unexpectedSkips(main, { fallbackLegRows: [fb("expected", 1), fb("unexpected", 2)] }).length, 2, "one failed in the leg");
  assert.equal(unexpectedSkips(main, { fallbackLegRows: [fb("expected", 1), fb("skipped", 2)] }).length, 2, "one skipped in the leg");
  assert.equal(unexpectedSkips(main, { fallbackLegRows: [fb("expected", 1)] }).length, 2, "leg is missing one of the skipped tests");
  assert.equal(unexpectedSkips(main, { fallbackLegRows: [] }).length, 2, "empty leg proves nothing");
});

test("release gate: the allowance covers only the fallback spec, never other skips", () => {
  const leg = [fb("expected", 1)];
  const bad = unexpectedSkips([fb("skipped", 1), other], { fallbackLegRows: leg });
  assert.deepEqual(bad.map((x) => x.file), ["garage.spec.ts"]);
});

test("release gate (104-K): a leg row that expected to FAIL (test.fail / annotation fail: status \"expected\" too) proves nothing", () => {
  const main = [fb("skipped", 1)];
  assert.equal(unexpectedSkips(main, { fallbackLegRows: [fb("expected", 1, { expectedStatus: "failed" })] }).length, 1, "expectedStatus failed");
  assert.equal(unexpectedSkips(main, { fallbackLegRows: [fb("expected", 1, { annotations: [{ type: "fail" }] })] }).length, 1, "fail annotation");
  assert.equal(unexpectedSkips(main, { fallbackLegRows: [fb("expected", 1, { resultStatus: "failed" })] }).length, 1, "result failed");
  assert.equal(unexpectedSkips(main, { fallbackLegRows: [{ file: "vin-fallback.spec.ts", title: "fallback 1", status: "expected" }] }).length, 1, "a row with no expectedStatus is not trusted");
});
