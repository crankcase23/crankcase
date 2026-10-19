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

// Rules run over the WHOLE comment-stripped file (not line by line), so a call split across lines is still seen.
const RULES = [
  [/\btest\s*\.\s*fail\b/g, "test.fail marks a failure as expected"],
  [/\.\s*fixme\b/g, "fixme parks a test"],
  [/\.\s*only\b/g, ".only drops every other test"],
  // skip with no condition, a literal condition, a title-first form (which skips unconditionally) or a function returning a constant
  [/\.\s*skip\s*\(\s*(?:\)|true\b|false\b|\d|["'`]|\(\s*\)\s*=>)/g, "unconditional skip (a skip needs a real condition: an environment variable, a configured token)"],
  // aliases and bracket access that would dodge the name checks above
  [/=\s*test\s*[;,)]|\{[^}]*\b(?:fail|fixme|skip|only)\b[^}]*\}\s*=\s*test\b|\btest\s*\[\s*["'`]/g, "alias or bracket access to test"],
  [/\bconfigure\s*\(\s*\{[^}]*\bretries\s*:\s*[1-9]/g, "retries above 0"],
];
const SPEC_FILE = /\.[cm]?[jt]sx?$/;

const lineOf = (text, index) => text.slice(0, index).split("\n").length;

export function findMasking(dir) {
  const found = [];
  const walk = (d) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) { if (e.name !== "node_modules") walk(p); continue; }
      if (!SPEC_FILE.test(e.name)) continue;
      const text = stripComments(fs.readFileSync(p, "utf8"));
      for (const [re, why] of RULES) {
        for (const m of text.matchAll(re)) found.push(`${path.relative(dir, p)}:${lineOf(text, m.index)}: ${why}: ${m[0].replace(/\s+/g, " ").slice(0, 60)}`);
      }
    }
  };
  walk(dir);
  return found;
}

/** Every `retries:` value in a config file (a project can set its own); each must be 0. */
export function retriesIn(configSource) {
  return [...stripComments(configSource).matchAll(/\bretries\s*:\s*([^,}\n]+)/g)].map((m) => m[1].trim());
}

/** Config settings that remove tests from a run or stop it early. */
export function hidingSettingsIn(configSource) {
  return [...stripComments(configSource).matchAll(/\b(grepInvert|testIgnore|maxFailures)\s*:/g)].map((m) => m[1]);
}

/** Playwright CLI flags that do the same from package.json scripts. */
export function hidingFlagsIn(scripts) {
  return Object.entries(scripts ?? {}).filter(([, v]) => /--(?:retries|grep-invert|max-failures)\b/.test(v)).map(([k]) => k);
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
      // review findings (Build 104-H): each of these used to slip through
      "i.spec.ts": 'test.skip("parked test", async () => {});',
      "j.spec.ts": 'test.describe.skip("parked suite", () => {});',
      "k.spec.mts": 'test.fail(true);',
      "l.spec.cjs": 'test.fixme(true);',
      "m.spec.jsx": 'test.only("x", () => {});',
      "n.spec.ts": 'const t = test;\nt.fail(true);',
      "o.spec.ts": 'const { fail } = test;\nfail(true);',
      "p.spec.ts": 'test["fail"](true);',
      "q.spec.ts": 'test\n  .fail(true);',
      "r.spec.ts": 'test.skip(1 === 1, "x");',
      "s.spec.ts": 'test.skip(() => true);',
      "t.spec.ts": 'test.describe.configure({\n  retries: 3,\n});',
      "u.spec.ts": 'test.describe.parallel.skip("suite", () => {});',
      "fixtures/v.spec.ts": 'test.fail(true);',
    };
    const good = {
      "ok1.spec.ts": 'test.skip(!process.env.CC_DB_FAULT, "opt-in");',
      "ok2.spec.ts": 'test.skip(process.env.VIN_FALLBACK_E2E !== "on", "needs the stub");',
      "ok3.spec.ts": '// test.fail( is only mentioned in a comment\n/* test.fixme( and test.only( in a block comment */\ntest("works", async () => {});',
      "ok4.spec.ts": 'test.skip(!OPS || !ADMIN, "needs the ops token");',
      "ok5.spec.ts": 'const failures = []; const onlyOnce = 1; test("a test about failing", async () => {});',
    };
    fs.mkdirSync(path.join(dir, "fixtures"));
    for (const [n, c] of Object.entries({ ...bad, ...good })) fs.writeFileSync(path.join(dir, n), c);
    const flagged = new Set(findMasking(dir).map((f) => f.split(":")[0]));
    for (const n of Object.keys(bad)) assert.ok(flagged.has(n), `${n} should have been flagged`);
    for (const n of Object.keys(good)) assert.ok(!flagged.has(n), `${n} should not have been flagged`);
    assert.deepEqual(retriesIn("export default defineConfig({ retries: 0, x: 1 })"), ["0"]);
    assert.deepEqual(retriesIn("export default defineConfig({ retries: 0, projects: [{ name: 'a', retries: 3 }] })"), ["0", "3"]);
    assert.deepEqual(retriesIn("export default defineConfig({ retries: process.env.CI ? 2 : 0 })"), ["process.env.CI ? 2 : 0"]);
    assert.deepEqual(retriesIn("export default defineConfig({ x: 1 })"), []);
    assert.deepEqual(hidingSettingsIn("defineConfig({ grepInvert: /@slow/, testIgnore: 'a', maxFailures: 1, timeout: 5 })"), ["grepInvert", "testIgnore", "maxFailures"]);
    assert.deepEqual(hidingSettingsIn("defineConfig({ timeout: 5 })"), []);
    assert.deepEqual(hidingFlagsIn({ t: "playwright test --retries=2", u: "playwright test --grep-invert @x", v: "playwright test", w: "playwright test --max-failures 1" }), ["t", "u", "w"]);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test("tests/e2e contains no expected-fail, fixme, only, unconditional skip, alias or retry override (any test file extension)", () => {
  const found = findMasking(path.join(ROOT, "tests", "e2e"));
  assert.deepEqual(found, [], `a failure is being hidden by annotation:\n${found.join("\n")}`);
});

test("Playwright config does not retry, filter tests out or stop early, in any project or package.json script", () => {
  const cfg = fs.readFileSync(path.join(ROOT, "playwright.config.ts"), "utf8");
  const r = retriesIn(cfg);
  assert.ok(r.every((v) => v === "0"), `retries: ${JSON.stringify(r)} (a red that passes on retry is reported as flaky, not failed)`);
  assert.deepEqual(hidingSettingsIn(cfg), [], "grepInvert / testIgnore / maxFailures remove tests from the run");
  const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, "package.json"), "utf8"));
  assert.deepEqual(hidingFlagsIn(pkg.scripts), [], "a package.json script passes --retries / --grep-invert / --max-failures");
});
