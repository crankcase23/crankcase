// MANDATORY release gate. It FAILS unless every check below ran and passed. A skipped, filtered-out, missing or unrunnable
// check is a FAIL, never a pass. Run against a built app on :3100 and a migrated scratch DB named cc_test (docs/release/README.md):
//   run `npm run release:gate` with DATABASE_URL pointing at a local scratch database (127.0.0.1)
//   ... -- --full-report path/to/playwright-full-run.json [--fallback-report path/to/fallback-leg.json]
//       (also validate a full `--reporter=json` run: 0 failed, no unexpected skips; the flag-gated vin-fallback.spec skips need the fallback-leg report proving they passed)
//
//   1. DATABASE_URL must be set and LOCAL. Without it the database-backed suites skip themselves silently.
//   2. keys unit suite (incl. legacy-holds, checkout eligibility, payment settlement): 0 fail, 0 skipped, >= MIN tests.
//   3. admin cross-account isolation specs (Playwright): each must have RUN and PASSED.
//   4. optional: a full Playwright JSON report: 0 failed, and every skipped test is on the known-unrelated allowlist.
import { spawnSync } from "node:child_process";
import { readFileSync, readdirSync } from "node:fs";
import { unexpectedSkips } from "./release/gate-skips.mjs";
import { flat, isolationVerdicts, fullRunProblems } from "./release/gate-report.mjs";

const MIN_KEYS_TESTS = 35;       // keys:test as of the Option B contract-rollback fix (30 + 3 contract tests); raise when tests are added, never lower
const MIN_LEGACY_HOLDS_TESTS = 12;
const ALLOWED_SKIPS = [/^ops snapshot bridge/i]; // needs tokens that are not set in the rehearsal environment
const REQUIRED = [
  { file: "keys-admin-gifts.spec.ts", title: "same VIN in two accounts: a gift unlocks only the account it was given to" },
  { file: "keys-entitlements.spec.ts", title: "ISOLATION: another account holding the same VIN" },
  { file: "vin-required.spec.ts", title: "the answer never depends on whether another account holds the VIN" },
];

let bad = 0;
const pass = (m) => console.log(`PASS  ${m}`);
const fail = (m) => { console.log(`FAIL  ${m}`); bad++; };

// 1. environment
const dbUrl = process.env.DATABASE_URL ?? "";
if (!/^postgres(ql)?:\/\/[^/@]*@?(127\.0\.0\.1|localhost)(:\d+)?\//.test(dbUrl)) {
  fail("DATABASE_URL is missing or not a local scratch database: the database-backed tests would be SKIPPED, which is not a pass");
  console.log("\nRELEASE GATE: FAIL. Do not migrate or deploy.");
  process.exit(1);
}
pass("DATABASE_URL is set and local");

// 2. keys unit suite
function tapCount(out, key) { const m = out.match(new RegExp(`^# ${key} (\\d+)`, "m")); return m ? Number(m[1]) : NaN; }
function runUnit(files) {
  const r = spawnSync("node", ["--test", ...files], { encoding: "utf8", maxBuffer: 1 << 28, env: process.env });
  const out = r.stdout + r.stderr;
  return { tests: tapCount(out, "tests"), pass: tapCount(out, "pass"), fail: tapCount(out, "fail"), skipped: tapCount(out, "skipped"), out };
}
const keys = runUnit(readdirSync("scripts/keys/tests").filter((f) => f.endsWith(".test.mjs")).map((f) => `scripts/keys/tests/${f}`));
const keysOk = keys.fail === 0 && keys.skipped === 0 && keys.pass === keys.tests && keys.tests >= MIN_KEYS_TESTS;
(keysOk ? pass : fail)(`keys unit suite: ${keys.pass}/${keys.tests} passed, ${keys.fail} failed, ${keys.skipped} skipped (need 0 skipped and at least ${MIN_KEYS_TESTS} tests)`);
const holds = runUnit(["scripts/keys/tests/legacy-holds.test.mjs"]);
const holdsOk = holds.fail === 0 && holds.skipped === 0 && holds.pass >= MIN_LEGACY_HOLDS_TESTS;
(holdsOk ? pass : fail)(`legacy-holds suite ("historical paid access cannot disappear"): ${holds.pass} passed, ${holds.skipped} skipped (need at least ${MIN_LEGACY_HOLDS_TESTS}, 0 skipped)`);

// 3. admin cross-account isolation (Playwright)
const pw = spawnSync("npx", ["playwright", "test", "--reporter=json", "--workers=1", ...REQUIRED.map((q) => `tests/e2e/${q.file}`)],
  { encoding: "utf8", maxBuffer: 1 << 28, env: { ...process.env, PW_TEST_HTML_REPORT_OPEN: "never" } });
let rep;
try { rep = JSON.parse(pw.stdout); } catch { fail("no JSON report from Playwright (is the app up on :3100 against cc_test?)\n" + (pw.stderr || "").slice(-1500)); }
if (rep) {
  const rows = flat(rep);
  // a row counts only if it expected to pass AND passed: test.fail() / annotation fail / expect-timeout tests are status "expected" too
  for (const v of isolationVerdicts(rep, REQUIRED)) (v.ok ? pass : fail)(v.msg);
  const skipped = rows.filter((x) => x.status === "skipped").length;
  if (skipped) fail(`${skipped} test(s) skipped in the isolation spec files`);
  const iso = fullRunProblems(rep);
  (iso.length === 0 ? pass : fail)(`isolation report integrity: ${iso.length} problem(s)${iso.length ? " e.g. " + iso[0] : ""}`);
}

// 4. optional full-run report
const i = process.argv.indexOf("--full-report");
if (i > -1) {
  let full;
  try { full = JSON.parse(readFileSync(process.argv[i + 1], "utf8")); } catch { fail(`cannot read full report ${process.argv[i + 1]}`); }
  if (full) {
    const rows = flat(full);
    const failed = rows.filter((x) => x.status === "unexpected" || x.status === "flaky");
    // The NHTSA-fallback spec only runs against a flag-ON server (scripts/vin/run-fallback-e2e.sh), so it skips in the main run.
    // Its skips are accepted only with --fallback-report <json> from that leg showing every one of those tests passed.
    const j = process.argv.indexOf("--fallback-report");
    let legRows = null;
    if (j > -1) { try { legRows = flat(JSON.parse(readFileSync(process.argv[j + 1], "utf8"))); } catch { fail(`cannot read fallback report ${process.argv[j + 1]}`); } }
    const skippedBad = unexpectedSkips(rows, { allowedTitles: ALLOWED_SKIPS, fallbackLegRows: legRows });
    (failed.length === 0 ? pass : fail)(`full run: ${rows.length} tests, ${failed.length} failed/flaky`);
    const problems = fullRunProblems(full);
    (problems.length === 0 ? pass : fail)(`full run integrity: ${problems.length} problem(s) (expected-fail / fixme / annotations / retried / run-level errors)${problems.length ? " e.g. " + problems[0] : ""}`);
    if (legRows) { const lp = fullRunProblems(JSON.parse(readFileSync(process.argv[j + 1], "utf8"))); (lp.length === 0 ? pass : fail)(`fallback leg integrity: ${lp.length} problem(s)${lp.length ? " e.g. " + lp[0] : ""}`); }
    (skippedBad.length === 0 ? pass : fail)(`full run: ${skippedBad.length} unexpected skips${skippedBad.length ? " e.g. " + skippedBad[0].file : ""} (BMW admin guide specs skip when DATABASE_URL was not local)`);
  }
}

console.log(bad ? "\nRELEASE GATE: FAIL. Do not migrate or deploy." : "\nRELEASE GATE: PASS");
process.exit(bad ? 1 : 0);
