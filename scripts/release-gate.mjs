// MANDATORY release gate: admin cross-account isolation. Run against a built app on :3100 and a migrated DB named cc_test
// (see docs/release/README.md). Fails unless every required test RAN and PASSED; a skipped, filtered-out or missing test is a FAIL.
//   npm run release:gate
import { spawnSync } from "node:child_process";

const REQUIRED = [
  { file: "keys-admin-gifts.spec.ts", title: "same VIN in two accounts: a gift unlocks only the account it was given to" },
  { file: "keys-entitlements.spec.ts", title: "ISOLATION: another account holding the same VIN" },
  { file: "vin-required.spec.ts", title: "the answer never depends on whether another account holds the VIN" },
];

const r = spawnSync("npx", ["playwright", "test", "--reporter=json", "--workers=1",
  ...REQUIRED.map((q) => `tests/e2e/${q.file}`)], { encoding: "utf8", maxBuffer: 1 << 28, env: { ...process.env, PW_TEST_HTML_REPORT_OPEN: "never" } });
let report;
try { report = JSON.parse(r.stdout); } catch { console.error("GATE FAIL: no JSON report from Playwright.\n" + (r.stderr || "").slice(-2000)); process.exit(2); }

const results = [];
const walk = (s) => { for (const sp of s.specs ?? []) for (const t of sp.tests ?? []) results.push({ file: sp.file, title: sp.title, status: t.status, results: t.results?.map((x) => x.status) });
  for (const c of s.suites ?? []) walk(c); };
for (const s of report.suites ?? []) walk(s);

let bad = 0;
for (const q of REQUIRED) {
  const hit = results.filter((x) => x.file.endsWith(q.file) && x.title.startsWith(q.title));
  const ok = hit.length >= 1 && hit.every((x) => x.status === "expected");
  console.log(`${ok ? "PASS" : "FAIL"}  ${q.file}: ${q.title}${hit.length ? "" : "  (NOT FOUND)"}`);
  if (!ok) bad++;
}
const skipped = results.filter((x) => x.status === "skipped").length;
if (skipped) { console.log(`FAIL  ${skipped} test(s) skipped in the gate files`); bad++; }
console.log(bad ? "\nRELEASE GATE: FAIL. Do not migrate or deploy." : "\nRELEASE GATE: PASS");
process.exit(bad ? 1 : 0);
