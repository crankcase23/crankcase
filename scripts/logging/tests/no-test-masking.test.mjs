import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

// A failing browser test must stay a FAILING test (Build 104-H). Nothing in tests/e2e may turn a red into a green by annotation:
//   * test.fail(...)  "expected to fail": passes while the defect exists, so the defect is invisible in the results
//   * test.fixme(...) / describe.fixme   parked tests
//   * .only(...)      silently drops every other test
//   * an UNCONDITIONAL skip (test.skip() / test.skip(true ...)). A skip with a real condition (an environment variable, a configured
//     token) is how the opt-in outage / fault-injection suites work and is allowed
//   * retries above 0 in playwright.config.ts: a red that passes on a retry is reported as "flaky" instead of failed
// Known defects are kept as ordinary red tests (or as a written finding), never as annotated passes.
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..");

const stripComments = (src) =>
  src.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " ")).split("\n").map((l) => (/^\s*\/\//.test(l) ? "" : l)).join("\n");

const RULES = [
  [/\btest\.fail\s*\(/, "test.fail(...) marks a failure as expected"],
  [/\b(?:test|describe)\.fixme\s*\(|\.fixme\s*\(/, "fixme parks a test"],
  [/\b(?:test|describe)\.only\s*\(|\.only\s*\(/, ".only drops every other test"],
  [/\b(?:test|describe)\.skip\s*\(\s*\)/, "unconditional skip"],
  [/\b(?:test|describe)\.skip\s*\(\s*(?:true|1)\s*[,)]/, "unconditional skip"],
  [/\btest\.fail\.only|\btest\.describe\.configure\s*\(\s*\{[^}]*retries\s*:\s*[1-9]/, "retries/fail annotations"],
];

export function findMasking(dir) {
  const found = [];
  const walk = (d) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) { if (e.name !== "node_modules" && e.name !== "fixtures") walk(p); continue; }
      if (!/\.(ts|tsx|js|mjs)$/.test(e.name)) continue;
      stripComments(fs.readFileSync(p, "utf8")).split("\n").forEach((line, i) => {
        for (const [re, why] of RULES) if (re.test(line)) found.push(`${path.relative(dir, p)}:${i + 1}: ${why}: ${line.trim().slice(0, 100)}`);
      });
    }
  };
  walk(dir);
  return found;
}

export function retriesIn(configSource) {
  const m = stripComments(configSource).match(/\bretries\s*:\s*([^,}\n]+)/);
  return m ? m[1].trim() : null;
}

test("the scanner itself: every masking form is caught, every honest form is not", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "mask-"));
  try {
    const bad = {
      "a.spec.ts": 'test.fail(process.env.X !== "1", "known defect");',
      "b.spec.ts": 'test.fixme("later", async () => {});',
      "c.spec.ts": 'test.describe.fixme("suite", () => {});',
      "d.spec.ts": 'test.only("just this", async () => {});',
      "e.spec.ts": 'test.skip();',
      "f.spec.ts": 'test.skip(true, "never");',
      "g.spec.ts": 'test.describe.only("suite", () => {});',
      "h.spec.ts": 'await go(); test.fail(true);',
    };
    const good = {
      "ok1.spec.ts": 'test.skip(!process.env.CC_DB_FAULT, "opt-in");',
      "ok2.spec.ts": 'test.skip(process.env.VIN_FALLBACK_E2E !== "on", "needs the stub");',
      "ok3.spec.ts": '// test.fail( is only mentioned in a comment\n/* test.fixme( and test.only( in a block comment */\ntest("works", async () => {});',
    };
    for (const [n, c] of Object.entries({ ...bad, ...good })) fs.writeFileSync(path.join(dir, n), c);
    const flagged = new Set(findMasking(dir).map((f) => f.split(":")[0]));
    for (const n of Object.keys(bad)) assert.ok(flagged.has(n), `${n} should have been flagged`);
    for (const n of Object.keys(good)) assert.ok(!flagged.has(n), `${n} should not have been flagged`);
    assert.equal(retriesIn("export default defineConfig({ retries: 0, x: 1 })"), "0");
    assert.equal(retriesIn("export default defineConfig({ retries: process.env.CI ? 2 : 0 })"), "process.env.CI ? 2 : 0");
    assert.equal(retriesIn("export default defineConfig({ x: 1 })"), null);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test("tests/e2e contains no expected-fail, fixme, only or unconditional skip", () => {
  const found = findMasking(path.join(ROOT, "tests", "e2e"));
  assert.deepEqual(found, [], `a failure is being hidden by annotation:\n${found.join("\n")}`);
});

test("playwright.config.ts does not retry (a red that passes on retry would be reported as flaky, not failed)", () => {
  const r = retriesIn(fs.readFileSync(path.join(ROOT, "playwright.config.ts"), "utf8"));
  assert.ok(r === null || r === "0", `retries is "${r}"`);
});
