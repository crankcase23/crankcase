import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

// A failing browser test must stay a FAILING test (Build 104-H). Nothing under tests/ may turn a red into a green by annotation:
//   * test.fail(...) / testInfo.fail(...) / test.info().fail(...)   "expected to fail": passes while the defect exists
//   * fixme(...)   parked tests            * .only(...)   silently drops every other test
//   * an UNCONDITIONAL skip: no condition, a constant condition (true, !0, null, () => true) or the title-first form (which skips always).
//     A skip with a real condition (an environment variable, a configured token) is how the opt-in outage / fault-injection suites work
//   * retries above 0 (config, any project, describe.configure, --retries), and anything that removes tests from a run or stops it early
//     (grepInvert, testIgnore, maxFailures, --grep, -x, --last-failed, --update-snapshots, "|| true" after a playwright command)
// Known defects are kept as ordinary red tests (or as a written finding), never as annotated passes.
//
// The scanner tokenizes (strings, template literals, regex literals and comments are blanked first) so a glob like "**/api/x/*" can never be
// mistaken for the start of a block comment and hide the rest of the file, and a word inside a string is never mistaken for code.
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..");

/** Blank comments, and (unless keepStrings) the CONTENT of string / template / regex literals. Newlines and offsets are preserved.
 *  keepWords keeps only single-word string bodies ("fail", 'type', `skip`): enough to read object keys and annotation types, while a longer
 *  string that merely CONTAINS code-looking text is still blanked. */
export function blank(src, { keepStrings = false, keepWords = false } = {}) {
  let out = "";
  let i = 0;
  let lastSig = ""; // last significant (non-space, non-comment) character, to tell a regex literal from a division
  const n = src.length;
  const space = (s) => s.replace(/[^\n]/g, " ");
  while (i < n) {
    const c = src[i], d = src[i + 1];
    if (c === "/" && d === "/") { let j = i; while (j < n && src[j] !== "\n") j++; out += space(src.slice(i, j)); i = j; continue; }
    if (c === "/" && d === "*") { const j = src.indexOf("*/", i + 2); const e = j < 0 ? n : j + 2; out += space(src.slice(i, e)); i = e; continue; }
    if (c === '"' || c === "'" || c === "`") {
      let j = i + 1;
      while (j < n && src[j] !== c) { if (src[j] === "\\") j++; j++; }
      const body = src.slice(i + 1, j);
      out += keepStrings || (keepWords && /^\w+$/.test(body)) ? src.slice(i, j + 1) : c + space(body) + c;
      i = j + 1; lastSig = c; continue;
    }
    if (c === "/" && /[(,=:[!&|?{};]|^$/.test(lastSig)) { // regex literal
      let j = i + 1, inClass = false;
      while (j < n && src[j] !== "\n") {
        if (src[j] === "\\") { j += 2; continue; }
        if (src[j] === "[") inClass = true; else if (src[j] === "]") inClass = false; else if (src[j] === "/" && !inClass) break;
        j++;
      }
      if (j < n && src[j] === "/") { j++; while (j < n && /[a-z]/i.test(src[j])) j++; out += keepStrings ? src.slice(i, j) : "/" + space(src.slice(i + 1, j)); i = j; lastSig = "/"; continue; }
    }
    out += c;
    if (!/\s/.test(c)) lastSig = c;
    i++;
  }
  return out;
}

const SPEC_FILE = /\.[cm]?[jt]sx?$/;
const lineOf = (text, index) => text.slice(0, index).split("\n").length;
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Names that refer to Playwright's `test` in this file: `test` itself, `import { test as x }`, `const x = test` / `test.extend(...)`. */
function testNames(text) {
  const names = new Set(["test", "testInfo"]);
  for (const m of text.matchAll(/\btest\s+as\s+(\w+)/g)) names.add(m[1]);
  for (const m of text.matchAll(/\b(?:const|let|var)\s+(\w+)\s*=\s*(?:await\s+)?test\b/g)) names.add(m[1]);
  return [...names];
}

function rulesFor(names) {
  const recv = `(?:${names.map(esc).join("|")})(?:\\s*\\.\\s*\\w+)*|\\binfo\\s*\\(\\s*\\)`; // test, test.describe.parallel, testInfo, test.info()
  const R = `(?:${recv})`;
  const CONSTANT = `(?:\\)|!*\\s*\\(*\\s*(?:true|false|null|undefined|\\d+)\\s*\\)*\\s*[,)]|[^,)]*\\|\\|\\s*true\\s*[,)]|(?:async\\s*)?(?:\\([^)]*\\)|\\w+)\\s*=>\\s*\\(*\\s*(?:true|false|null|undefined|\\d)\\b|["'\`]\\s*["'\`]\\s*,\\s*(?:async\\b|\\(|function\\b|\\w+\\s*=>))`;
  return [
    [new RegExp(`${R}\\s*\\.\\s*fail\\b`, "g"), "fail marks a failure as expected"],
    [new RegExp(`${R}\\s*\\.\\s*fixme\\b`, "g"), "fixme parks a test"],
    [new RegExp(`${R}\\s*\\.\\s*only\\b`, "g"), ".only drops every other test"],
    [new RegExp(`${R}\\s*\\.\\s*skip\\s*\\(\\s*${CONSTANT}`, "g"), "unconditional skip (a skip needs a real condition: an environment variable, a configured token)"],
    [new RegExp(`${R}\\s*\\.\\s*skip\\s*\\(\\s*(\\d+)\\s*===?\\s*\\1\\s*[,)]`, "g"), "unconditional skip (a literal compared with itself)"],
    [/\{[^}]*\b(?:fail|fixme|skip|only)\b[^}]*\}\s*=\s*test\b|\btest\s*\[\s*["'`]/g, "destructured or bracket access to test"],
    [/\bconfigure\s*\(\s*\{[^;]*?\bretries\s*:\s*(?!0\b)[^\s,}]/g, "retries above 0"],
  ];
}

// Build 104-J: the details-object annotation form. Playwright 1.63 treats { annotation: { type: "fail" } } exactly like test.fail() (a throwing
// test reports status "expected", ok:true) and type "skip" / "fixme" like test.skip() / test.fixme() -- with no `.fail(` / `.skip(` call for the
// rules above to see. The type is flagged wherever it is written as a literal; an annotation whose value is not a literal (a variable, a shorthand
// property) is flagged too because its type cannot be read. Anything this misses is caught by the results gate (scripts/logging/playwright-results-gate.mjs).
const ANNOTATION_TYPE = /(?:["'`]type["'`]|\btype)\s*:\s*["'`](?:fail|skip|fixme)["'`]/g;
const OPAQUE_ANNOTATION = /(?:["'`]annotation["'`]|\bannotation)\s*:\s*(?![\[{\s])|[{,]\s*annotation\s*[,}]|(?:["'`]annotation["'`]|\bannotation)\s*:\s*[\[{]?\s*\.\.\./g;
export function annotationMasking(src) {
  const t = blank(src, { keepWords: true });
  const out = [];
  for (const m of t.matchAll(ANNOTATION_TYPE)) out.push([m.index, "annotation type fail/skip/fixme masks a failure or skips the test", m[0]]);
  for (const m of t.matchAll(OPAQUE_ANNOTATION)) out.push([m.index, "annotation whose type cannot be read (use a literal object)", m[0]]);
  return out.map(([i, why, text]) => ({ line: lineOf(t, i), why, text }));
}

export function findMasking(dir) {
  const found = [];
  const walk = (d) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      const isDir = e.isDirectory() || (e.isSymbolicLink() && fs.statSync(p).isDirectory());
      if (isDir) { if (e.name !== "node_modules") walk(p); continue; }
      if (!SPEC_FILE.test(e.name)) continue;
      const text = blank(fs.readFileSync(p, "utf8"));
      for (const [re, why] of rulesFor(testNames(text))) {
        for (const m of text.matchAll(re)) found.push(`${path.relative(dir, p)}:${lineOf(text, m.index)}: ${why}: ${m[0].replace(/\s+/g, " ").slice(0, 60)}`);
      }
      for (const a of annotationMasking(fs.readFileSync(p, "utf8"))) found.push(`${path.relative(dir, p)}:${a.line}: ${a.why}: ${a.text.replace(/\s+/g, " ").slice(0, 60)}`);
    }
  };
  walk(dir);
  return found;
}

/** Every `retries:` value in a config file (a project can set its own, quoted keys too); each must be 0. */
export function retriesIn(configSource) {
  return [...blank(configSource, { keepStrings: true }).matchAll(/["']?\bretries["']?\s*:\s*([^,}\n]+)/g)].map((m) => m[1].trim());
}

/** Config settings that remove tests from a run, stop it early, or make a failing comparison pass. */
export function hidingSettingsIn(configSource) {
  const t = blank(configSource, { keepStrings: true });
  const found = [...t.matchAll(/["']?\b(grepInvert|grep|testIgnore|maxFailures)["']?\s*:/g)].map((m) => m[1]);
  if (/["']?\bupdateSnapshots["']?\s*:\s*["'](?:all|changed)["']/.test(t)) found.push("updateSnapshots");
  if (/["']?\bignoreSnapshots["']?\s*:\s*true\b/.test(t)) found.push("ignoreSnapshots");
  return found;
}

/** Playwright CLI flags / shell tricks in scripts that do the same. `--retries=0` is the safe setting and is allowed. */
export function hidingFlagsIn(scripts) {
  const bad = /--retries(?:=|\s+)(?!0\b)|--grep-invert\b|--grep\b|\s-g\s|\s-x\b|--max-failures\b|--last-failed\b|--update-snapshots\b|\s-u\b|--pass-with-no-tests\b|--shard\b|\|\|\s*true\b|;\s*exit\s+0\b/;
  return Object.entries(scripts ?? {}).filter(([, v]) => /playwright/.test(v) && bad.test(v)).map(([k]) => k);
}

const configsUnder = (dir) => {
  const out = [];
  const walk = (d) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) { if (e.name !== "node_modules" && e.name !== ".next" && e.name !== ".git") walk(p); continue; }
      if (/^playwright.*\.config\.[cm]?[jt]s$/.test(e.name)) out.push(p);
    }
  };
  walk(dir);
  return out;
};

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
      // second review (Build 104-H)
      "w.spec.ts": 'await page.route("**/api/x/*", h);\ntest.fail(true);\nawait page.route("**/vpic/**", h);', // a glob must not open a "comment"
      "x.spec.ts": 'test("a", async ({}, testInfo) => { testInfo.fail(true); });',
      "y.spec.ts": 'test("a", async () => { test.info().fail(); });',
      "z.spec.ts": 'import { test as base } from "@playwright/test";\nbase.fail(true);',
      "aa.spec.ts": 'const t = test.extend({});\nt.fail(true);',
      "ab.spec.ts": 'const t = test as any\nt.fixme(true);',
      "ac.spec.ts": 'test.skip(!0, "x");',
      "ad.spec.ts": 'test.skip(!!1, "x");',
      "ae.spec.ts": 'test.skip(null);',
      "af.spec.ts": 'test.skip((true), "x");',
      "ag.spec.ts": 'test.skip(({ browserName }) => true);',
      "ah.spec.ts": 'test.skip(async () => true, "x");',
      "ai.spec.ts": 'test.describe.configure({ mode: "x", nested: f({ a: 1 }), retries: 2 });',
      "aj.spec.ts": 'test.describe.configure({ retries: n });',
      // Build 104-J: the details-object annotation form. Verified against Playwright 1.63: { annotation: { type: "fail" } } makes a throwing
      // test report status "expected" / ok:true (same as test.fail), and type "skip" / "fixme" skips it. None of these call test.fail().
      "ak.spec.ts": 'test("a", { annotation: { type: "fail", description: "known" } }, async () => {});',
      "al.spec.ts": 'test("a", { annotation: { type: "skip" } }, async () => {});',
      "am.spec.ts": 'test("a", { annotation: { type: "fixme", description: "later" } }, async () => {});',
      "an.spec.ts": 'test("a", { annotation: [{ type: "issue", description: "x" }, { type: "fail" }] }, async () => {});',
      "ao.spec.ts": 'test.describe("s", { annotation: { type: \'fixme\' } }, () => {});',
      "ap.spec.ts": 'test("a", { "annotation": { "type": "fail" } }, async () => {});',
      "aq.spec.ts": 'test("a", {\n  annotation: {\n    description: "known",\n    type: `skip`,\n  },\n}, async () => {});',
      "ar.spec.ts": 'const a = { type: "fail", description: "x" };\ntest("a", { annotation: a }, async () => {});',
      "at.spec.ts": 'test("a", { annotation: makeAnn() }, async () => {});',
      "au.spec.ts": 'const annotation = load();\ntest("a", { annotation }, async () => {});',
      "av.spec.ts": 'test("a", { tag: "@x", annotation: pick("k") }, async () => {});',
      "aw.spec.ts": 'test("a", { annotation: [...shared] }, async () => {});',
      "as.spec.ts": 'const ann = [{ type: "fixme" }];\ntest("a", { annotation: ann }, async () => {});',
    };
    const good = {
      "ok1.spec.ts": 'test.skip(!process.env.CC_DB_FAULT, "opt-in");',
      "ok2.spec.ts": 'test.skip(process.env.VIN_FALLBACK_E2E !== "on", "needs the stub");',
      "ok3.spec.ts": '// test.fail( is only mentioned in a comment\n/* test.fixme( and test.only( in a block comment */\ntest("works", async () => {});',
      "ok4.spec.ts": 'test.skip(!OPS || !ADMIN, "needs the ops token");',
      "ok5.spec.ts": 'const failures = []; const onlyOnce = 1; test("a test about failing", async () => {});',
      "ok6.spec.ts": 'list.skip(3); q.skip(0); opts.only = 1; const x = test;',
      "ok7.spec.ts": 'test.skip("CI" in process.env, "r"); test.skip(2 > n.length, "r"); test.skip(browserName === "webkit", "r");',
      "ok8.spec.ts": 'const msg = "Done. only for owners"; const re = /test\\.fail\\(/; x(); // test.fail(true) trailing comment\ntest("ok", async () => {});',
      "ok9.spec.ts": 'await page.route("**/api/garage/*/service", h);\nawait page.route("**/b/**", h);\ntest("ok", async () => { await Promise.resolve(1 / 2); });',
      "ok10.spec.ts": 'const base = test.extend({ a: 1 });\nbase("works", async () => {});\ntest.skip(({ browserName }) => browserName === "webkit", "r");',
      "ok11.spec.ts": 'test.describe.configure({ mode: "serial", retries: 0 });',
      "ok12.spec.ts": 'test("a", { annotation: { type: "issue", description: "https://example.test/1" } }, async () => {});',
      "ok13.spec.ts": 'test("a", { annotation: [{ type: "issue", description: "x" }, { type: "note", description: "fail soon" }] }, async () => {});',
      "ok14.spec.ts": 'test("a", { tag: "@slow" }, async () => { test.info().annotations.push({ type: "issue", description: "x" }); });',
      "ok15.spec.ts": '// { annotation: { type: "fail" } } in a comment\nconst s = "annotation: { type: \'skip\' }";\ntest("a", async () => {});',
    };
    fs.mkdirSync(path.join(dir, "fixtures"));
    for (const [n, c] of Object.entries({ ...bad, ...good })) fs.writeFileSync(path.join(dir, n), c);
    const flagged = new Set(findMasking(dir).map((f) => f.split(":")[0]));
    for (const n of Object.keys(bad)) assert.ok(flagged.has(n), `${n} should have been flagged`);
    for (const n of Object.keys(good)) assert.ok(!flagged.has(n), `${n} should not have been flagged`);
    assert.deepEqual(retriesIn("export default defineConfig({ retries: 0, x: 1 })"), ["0"]);
    assert.deepEqual(retriesIn("export default defineConfig({ retries: 0, projects: [{ name: 'a', retries: 3 }] })"), ["0", "3"]);
    assert.deepEqual(retriesIn('export default defineConfig({ "retries": 2 })'), ["2"]);
    assert.deepEqual(retriesIn("export default defineConfig({ retries: process.env.CI ? 2 : 0 })"), ["process.env.CI ? 2 : 0"]);
    assert.deepEqual(retriesIn("export default defineConfig({ retries: 0 // none\n})"), ["0"]);
    assert.deepEqual(retriesIn("export default defineConfig({ x: 1 })"), []);
    assert.deepEqual(hidingSettingsIn("defineConfig({ grepInvert: /@slow/, testIgnore: 'a', maxFailures: 1, timeout: 5 })"), ["grepInvert", "testIgnore", "maxFailures"]);
    assert.deepEqual(hidingSettingsIn('defineConfig({ "grepInvert": /@slow/, grep: /@x/, updateSnapshots: "all", ignoreSnapshots: true })'), ["grepInvert", "grep", "updateSnapshots", "ignoreSnapshots"]);
    assert.deepEqual(hidingSettingsIn("defineConfig({ timeout: 5, updateSnapshots: 'missing' })"), []);
    const flags = { t: "playwright test --retries=2", u: "playwright test --grep-invert @x", v: "playwright test", w: "playwright test --max-failures 1", x: "playwright test -x", y: "playwright test --grep @a", z: "playwright test -u", aa: "playwright test --last-failed", ab: "playwright test || true", ac: "playwright test; exit 0", ad: "playwright test --shard=1/2", ae: "playwright test --retries=0", af: "playwright test --workers=3 --reporter=list" };
    assert.deepEqual(hidingFlagsIn(flags), ["t", "u", "w", "x", "y", "z", "aa", "ab", "ac", "ad"]);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test("everything under tests/ (e2e and transition, any test file extension) contains no expected-fail, fixme, only, unconditional skip, alias or retry override", () => {
  const found = findMasking(path.join(ROOT, "tests"));
  assert.deepEqual(found, [], `a failure is being hidden by annotation:\n${found.join("\n")}`);
});

test("every Playwright config does not retry, filter tests out or stop early, and no script passes flags that do", () => {
  const configs = configsUnder(ROOT);
  assert.ok(configs.length >= 2, `expected the root and tests/transition configs, found ${configs.length}`);
  for (const f of configs) {
    const cfg = fs.readFileSync(f, "utf8");
    const r = retriesIn(cfg);
    assert.ok(r.every((v) => v === "0"), `${path.relative(ROOT, f)} retries: ${JSON.stringify(r)} (a red that passes on retry is reported as flaky, not failed)`);
    assert.deepEqual(hidingSettingsIn(cfg), [], `${path.relative(ROOT, f)}: a setting removes tests from the run or hides a failing comparison`);
  }
  const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, "package.json"), "utf8"));
  assert.deepEqual(hidingFlagsIn(pkg.scripts), [], "a package.json script passes flags that hide failures");
  const shellish = {};
  const walk = (d) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) { walk(p); continue; }
      if (!/\.(sh|mjs|js)$/.test(e.name) || p.endsWith("no-test-masking.test.mjs")) continue;
      for (const line of fs.readFileSync(p, "utf8").split("\n")) if (/playwright test/.test(line)) shellish[`${path.relative(ROOT, p)}: ${line.trim().slice(0, 60)}`] = line;
    }
  };
  walk(path.join(ROOT, "scripts"));
  assert.deepEqual(hidingFlagsIn(shellish), [], "a script under scripts/ runs playwright with flags that hide failures");
});
