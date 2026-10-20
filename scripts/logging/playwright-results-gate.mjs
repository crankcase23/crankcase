#!/usr/bin/env node
// Playwright JSON-results gate (Build 104-J).
//
// The source guard (tests/no-test-masking.test.mjs) reads SPEC FILES. This reads what Playwright actually REPORTED, so it also catches a
// masking form the scanner cannot see (a computed annotation, a fixture that calls test.fail(), a config that skips). A run passes only if
// every test ran and ended exactly as written:
//   * expectedStatus "failed"   test.fail() / { annotation: { type: "fail" } }: a throwing test is reported status "expected", ok:true.
//   * status "skipped" / expectedStatus "skipped"   test.skip / fixme / annotation skip, unless the test is on the allowlist
//   * status "unexpected"       a plain failure
//   * status "flaky" or any result with retry > 0   a red that passed on retry
//   * an annotation of type fail / fixme / skip on a test that did run (skip is still subject to the allowlist)
//   * a report with no tests    nothing ran
// The allowlist (playwright-skip-allowlist.json) names the legitimate opt-in skips (an environment-variable-gated suite): each entry needs a
// file, a title and a written reason. A skip that is not listed fails; a listed test that did NOT skip is fine (it ran).
//
// Usage:  playwright test --reporter=json > results.json ; node scripts/logging/playwright-results-gate.mjs results.json [allowlist.json]
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const DEFAULT_ALLOWLIST = path.join(HERE, "playwright-skip-allowlist.json");

/** Flatten the reporter's nested suites into one record per test. */
export function collect(report) {
  const out = [];
  const walk = (suite, trail) => {
    const here = suite.title && !/\.[cm]?[jt]sx?$/.test(suite.title) ? [...trail, suite.title] : trail;
    for (const spec of suite.specs ?? []) {
      for (const t of spec.tests ?? []) {
        out.push({
          file: spec.file ?? suite.file ?? "",
          title: [...here, spec.title].join(" > "),
          project: t.projectName ?? "",
          expectedStatus: t.expectedStatus,
          status: t.status,
          annotations: [...(t.annotations ?? []), ...(spec.annotations ?? [])],
          results: t.results ?? [],
        });
      }
    }
    for (const s of suite.suites ?? []) walk(s, here);
  };
  for (const s of report.suites ?? []) walk(s, []);
  return out;
}

export function validateAllowlist(list) {
  const problems = [];
  if (!Array.isArray(list)) return ["allowlist must be a JSON array"];
  list.forEach((e, i) => {
    for (const k of ["file", "title", "reason"]) if (typeof e?.[k] !== "string" || !e[k].trim()) problems.push(`allowlist[${i}] needs a non-empty "${k}"`);
  });
  return problems;
}

const normFile = (f) => String(f).replace(/\\/g, "/");
// title "*" allows every test in that one file (a whole-file, environment-gated suite such as the VIN-stub or ops-token specs).
const allowed = (allow, t) => allow.some((e) => normFile(t.file).endsWith(normFile(e.file)) && (e.title === "*" || t.title === e.title || t.title.endsWith(` > ${e.title}`)));

/** @returns {{ ok: boolean, failures: string[], tests: number, ran: number, allowedSkips: string[] }} */
export function gate(report, allowlist = []) {
  const failures = validateAllowlist(allowlist).map((p) => `ALLOWLIST: ${p}`);
  const tests = collect(report);
  const allowedSkips = [];
  if (tests.length === 0) failures.push("NO TESTS: the report contains no tests (nothing ran)");
  let ran = 0;
  for (const t of tests) {
    const id = `${t.file} :: ${t.title}${t.project ? ` [${t.project}]` : ""}`;
    const skipped = t.status === "skipped" || t.expectedStatus === "skipped";
    if (skipped) {
      if (allowed(allowlist, t)) allowedSkips.push(id);
      else failures.push(`UNEXPECTED SKIP: ${id} (skip / fixme is only allowed for tests on the allowlist, with a reason)`);
      continue;
    }
    ran++;
    if (t.expectedStatus === "failed") failures.push(`EXPECTED-FAIL: ${id} (test.fail / annotation fail: a failure is being reported as a pass)`);
    if (t.status === "unexpected") failures.push(`FAILED: ${id}`);
    if (t.status === "flaky") failures.push(`FLAKY: ${id} (failed, then passed on retry)`);
    if (t.results.some((r) => (r.retry ?? 0) > 0)) failures.push(`RETRIED: ${id} (a result with retry > 0)`);
    for (const a of t.annotations) {
      if (["fail", "fixme", "skip"].includes(String(a?.type))) failures.push(`ANNOTATION ${a.type}: ${id}`);
    }
  }
  const s = report.stats;
  if (s && (s.unexpected > 0 || s.flaky > 0)) failures.push(`STATS: unexpected=${s.unexpected} flaky=${s.flaky}`);
  return { ok: failures.length === 0, failures: [...new Set(failures)], tests: tests.length, ran, allowedSkips };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const [resultsPath, allowPath = DEFAULT_ALLOWLIST] = process.argv.slice(2);
  if (!resultsPath) { console.error("usage: playwright-results-gate.mjs <results.json> [allowlist.json]"); process.exit(2); }
  let report, allowlist;
  try { report = JSON.parse(fs.readFileSync(resultsPath, "utf8")); } catch (e) { console.error(`cannot read results: ${e.message}`); process.exit(2); }
  try { allowlist = fs.existsSync(allowPath) ? JSON.parse(fs.readFileSync(allowPath, "utf8")) : []; } catch (e) { console.error(`cannot read allowlist: ${e.message}`); process.exit(2); }
  const r = gate(report, allowlist);
  console.log(`playwright results gate: ${r.tests} tests, ${r.ran} ran, ${r.allowedSkips.length} allowlisted skips`);
  for (const s of r.allowedSkips) console.log(`  allowed skip: ${s}`);
  for (const f of r.failures) console.error(`  REJECT ${f}`);
  console.log(r.ok ? "GATE PASS" : "GATE FAIL");
  process.exit(r.ok ? 0 : 1);
}
