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
//   * any expectedStatus other than "passed" (also "timedOut" / "interrupted": a hanging test told to expect it is reported ok), an unknown or
//     missing status, and a non-empty report.errors (a throwing globalTeardown / global error leaves every test green and exit code 1)
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
// title "*" allows every test in that one file (a whole-file, environment-gated suite such as the VIN-stub or ops-token specs). Otherwise the
// entry's title must equal the test's FULL title (describe blocks joined with " > "): a leaf title never matches a test in another describe.
// Playwright reports spec.file relative to testDir ("signup-prehydration.spec.ts"); the allowlist may spell it from the repo root ("tests/e2e/...").
const sameFile = (entry, reported) => { const a = normFile(entry), b = normFile(reported); return a === b || a.endsWith(`/${b}`) || b.endsWith(`/${a}`); };
const allowed = (allow, t) => allow.some((e) => sameFile(e.file, t.file) && (e.title === "*" || t.title === e.title));
const PARKING = new Set(["fixme", "fail"]); // never an opt-in: a parked or expected-fail test is hiding something, whatever the allowlist says

const isSkipped = (t) => t.status === "skipped" || t.expectedStatus === "skipped";
const idOf = (t) => `${t.file} :: ${t.title}${t.project ? ` [${t.project}]` : ""}`;

/** Everything except skip handling: a test that RAN must have ended exactly as written. Also run-level errors, stats and an empty report.
 *  Exported so scripts/release-gate.mjs can apply the same standard to the reports it accepts as release evidence. */
export function integrityFailures(report, tests = collect(report)) {
  const failures = [];
  if (tests.length === 0) failures.push("NO TESTS: the report contains no tests (nothing ran)");
  for (const t of tests) {
    if (isSkipped(t)) continue;
    const id = idOf(t);
    if (t.expectedStatus === "failed") failures.push(`EXPECTED-FAIL: ${id} (test.fail / annotation fail: a failure is being reported as a pass)`);
    else if (t.expectedStatus !== "passed") failures.push(`EXPECTED-STATUS: ${id} (expectedStatus ${JSON.stringify(t.expectedStatus)}: only "passed" is allowed; a test told to expect a timeout or interruption is reported ok)`);
    if (!["expected", "unexpected", "flaky"].includes(t.status)) failures.push(`UNKNOWN STATUS: ${id} (status ${JSON.stringify(t.status)})`);
    if (t.status === "unexpected") failures.push(`FAILED: ${id}`);
    if (t.status === "flaky") failures.push(`FLAKY: ${id} (failed, then passed on retry)`);
    if (t.results.some((r) => (r.retry ?? 0) > 0)) failures.push(`RETRIED: ${id} (a result with retry > 0)`);
    // an afterEach hook can rewrite testInfo.status / testInfo.errors after the body threw: the test is then reported "expected"/"passed" with
    // empty errors, so only the per-result record (a ran test has exactly status "passed" and no errors) is still honest
    if (t.results.length === 0) failures.push(`RESULT-STATUS: ${id} (no result recorded)`);
    for (const r of t.results) {
      if (r.status !== "passed") failures.push(`RESULT-STATUS: ${id} (result status ${JSON.stringify(r.status)}, only "passed" is allowed)`);
      if ((Array.isArray(r.errors) ? r.errors.length : 0) > 0 || r.error) failures.push(`RESULT-ERRORS: ${id} (a result carries errors)`);
    }
    for (const a of t.annotations) {
      if (["fail", "fixme", "skip"].includes(String(a?.type))) failures.push(`ANNOTATION ${a.type}: ${id}`);
    }
  }
  for (const e of Array.isArray(report?.errors) ? report.errors : []) failures.push(`RUN ERROR: ${String(e?.message ?? e).split("\n")[0].slice(0, 160)} (a run-level error: global setup/teardown or a load error)`);
  const s = report?.stats;
  if (s && (s.unexpected > 0 || s.flaky > 0)) failures.push(`STATS: unexpected=${s.unexpected} flaky=${s.flaky}`);
  return failures;
}

/** @returns {{ ok: boolean, failures: string[], tests: number, ran: number, allowedSkips: string[] }} */
export function gate(report, allowlist = []) {
  const tests = collect(report);
  const failures = [...validateAllowlist(allowlist).map((p) => `ALLOWLIST: ${p}`), ...integrityFailures(report, tests)];
  const allowedSkips = [];
  let ran = 0;
  for (const t of tests) {
    const id = idOf(t);
    if (!isSkipped(t)) { ran++; continue; }
    const parked = t.annotations.find((a) => PARKING.has(String(a?.type)));
    if (parked) failures.push(`PARKED: ${id} (${parked.type} annotation: not allowed even on the allowlist)`);
    else if (allowed(allowlist, t)) allowedSkips.push(id);
    else failures.push(`UNEXPECTED SKIP: ${id} (skip is only allowed for tests on the allowlist, with a reason)`);
  }
  return { ok: failures.length === 0, failures: [...new Set(failures)], tests: tests.length, ran, allowedSkips };
}

// ENVIRONMENT vs PRODUCT (Build 104-AO). A run whose disk or memory ran out reports a pile of unrelated failures (ENOSPC while a trace is written,
// ERR_INSUFFICIENT_RESOURCES, "Target crashed"). Those are not evidence about the product either way, and reading them as product failures (or
// waving them through as "just the sandbox") both mislead. This only LABELS: it never turns a failure into a pass, and the gate verdict is unchanged.
// DEFINITE: the exact errno line Node prints when the disk is full ("ENOSPC: no space left on device, write"). Free text that merely mentions the word
// (an assertion that received "ENOSPC while saving", a comment in the test) does not match. Only the error MESSAGE is searched, never the stack, whose
// code frame quotes the test source.
export const RESOURCE_DEFINITE = /\bENOSPC: no space left on device/i;
// AMBIGUOUS: can be the machine running out of something, but also a product bug (a request storm gives ERR_INSUFFICIENT_RESOURCES, a runaway render
// or a leak gives a crash, a descriptor or memory leak gives EMFILE / ENOMEM / heap out of memory). Labelled, never trusted on its own.
export const RESOURCE_AMBIGUOUS = /ERR_INSUFFICIENT_RESOURCES|Target (?:page, context or browser has been )?crashed|Page crashed|\bENOSPC\b|no space left on device|\bEMFILE\b|\bENOMEM\b|JavaScript heap out of memory/i;
export const RESOURCE_EXHAUSTION = new RegExp(`${RESOURCE_DEFINITE.source}|${RESOURCE_AMBIGUOUS.source}`, "i");
const errorMessages = (r) => [...(Array.isArray(r?.errors) ? r.errors : []), ...(r?.error ? [r.error] : [])].map((e) => `${e?.message ?? ""}`);

/**
 * Tests that ran and did not end as written. `environment` is true only when EVERY error the test reported is a resource-exhaustion message (one real
 * assertion error next to a teardown ENOSPC makes it a product failure). `definite` additionally needs at least one message that cannot be a product bug.
 */
export function failedTests(report, tests = collect(report)) {
  return tests
    .filter((t) => !isSkipped(t) && (t.status !== "expected" || t.results.some((r) => r.status !== "passed")))
    .map((t) => {
      const msgs = t.results.flatMap(errorMessages);
      const environment = msgs.length > 0 && msgs.every((m) => RESOURCE_EXHAUSTION.test(m));
      const definite = environment && msgs.some((m) => RESOURCE_DEFINITE.test(m));
      const m = environment ? msgs.map((x) => RESOURCE_EXHAUSTION.exec(x)?.[0]).find(Boolean) : null;
      return { id: idOf(t), environment, definite, match: m ?? null };
    });
}

// Compare real paths: `file://${argv[1]}` is neither URL-encoded nor realpath'd, so a path with a space, a symlinked directory or a Windows drive
// letter made this block silently not run and the process exit 0.
const isMain = (() => { try { return fs.realpathSync(fileURLToPath(import.meta.url)) === fs.realpathSync(path.resolve(process.argv[1] ?? "")); } catch { return false; } })();
if (isMain) {
  const [resultsPath, allowPath = DEFAULT_ALLOWLIST] = process.argv.slice(2);
  if (!resultsPath) { console.error("usage: playwright-results-gate.mjs <results.json> [allowlist.json]"); process.exit(2); }
  let report, allowlist;
  try { report = JSON.parse(fs.readFileSync(resultsPath, "utf8")); } catch (e) { console.error(`cannot read results: ${e.message}`); process.exit(2); }
  try { allowlist = fs.existsSync(allowPath) ? JSON.parse(fs.readFileSync(allowPath, "utf8")) : []; } catch (e) { console.error(`cannot read allowlist: ${e.message}`); process.exit(2); }
  const r = gate(report, allowlist);
  console.log(`playwright results gate: ${r.tests} tests, ${r.ran} ran, ${r.allowedSkips.length} allowlisted skips`);
  for (const s of r.allowedSkips) console.log(`  allowed skip: ${s}`);
  for (const f of r.failures) console.error(`  REJECT ${f}`);
  const failed = failedTests(report);
  const env = failed.filter((f) => f.environment);
  for (const f of env) console.error(`  ENVIRONMENT-SUSPECT: ${f.id} (reported "${f.match}")`);
  if (env.length > 0 && env.length < failed.length) console.error(`  NOTE: ${env.length} of ${failed.length} failing tests carry a resource-exhaustion error; the other ${failed.length - env.length} are not explained by it`);
  // Exit 3 / the ENVIRONMENT FAILURE banner need ALL of: failures exist, every failing test is definitely a resource exhaustion, and the gate has no
  // other reason to fail (a run-level error, an unexpected skip or a bad stat is a product or harness finding, never "the sandbox").
  const onlyTestFailures = r.failures.every((x) => /^(FAILED|RESULT-STATUS|RESULT-ERRORS|STATS):/.test(x));
  const allEnv = failed.length > 0 && failed.every((f) => f.definite) && onlyTestFailures;
  if (allEnv) console.error("  ENVIRONMENT FAILURE: every failing test reported a resource-exhaustion error that cannot be a product bug (disk full, out of memory). This run is NOT product evidence either way: free the resource and rerun the full gate.");
  else if (env.length > 0) console.error("  NOTE: environment-looking errors do not make this an environment failure here (a real failure, a run-level problem or an ambiguous crash is also present). Treat every failure above as real until proven otherwise.");
  console.log(r.ok ? "GATE PASS" : "GATE FAIL");
  process.exit(r.ok ? 0 : allEnv ? 3 : 1);
}
