// Pure judging helpers for scripts/release-gate.mjs (Build 104-K).
// Playwright reports a throwing test.fail() / { annotation: { type: "fail" } } test, and a hanging test told to expect a timeout, as status
// "expected" (ok:true, exit 0). The release gate used to treat "expected" as success, so such a test could be "release evidence". A row now only
// counts when it expected to pass AND passed, with no fail / fixme / skip annotation; reports are also held to the 104-J results-gate standard.
import { integrityFailures } from "../logging/playwright-results-gate.mjs";

/** One row per test: file, leaf title, status, expectedStatus, the status of its last result, and its annotations. */
export function flat(report) {
  const rows = [];
  const walk = (s) => {
    for (const sp of s.specs ?? []) for (const t of sp.tests ?? []) {
      const last = (t.results ?? []).at(-1);
      rows.push({ file: sp.file, title: sp.title, status: t.status, expectedStatus: t.expectedStatus, resultStatus: last?.status, annotations: [...(t.annotations ?? []), ...(sp.annotations ?? [])] });
    }
    for (const c of s.suites ?? []) walk(c);
  };
  for (const s of report.suites ?? []) walk(s);
  return rows;
}

const MASKING = new Set(["fail", "fixme", "skip"]);
/** The test expected to pass, passed, and carries no annotation that hides a failure or a skip. */
export const rowPassed = (x) =>
  x.status === "expected" && x.expectedStatus === "passed" && x.resultStatus === "passed" && !(x.annotations ?? []).some((a) => MASKING.has(String(a?.type)));

/** [{ ok, msg }] one per required test: it must exist and every matching row must be a real pass. */
export function isolationVerdicts(report, required) {
  const rows = flat(report);
  return required.map((q) => {
    const hit = rows.filter((x) => x.file.endsWith(q.file) && x.title.startsWith(q.title));
    return { ok: hit.length >= 1 && hit.every(rowPassed), msg: `isolation: ${q.file}: ${q.title}${hit.length ? "" : "  (NOT FOUND)"}` };
  });
}

/** Reasons a full-run (or leg) report is not release evidence, apart from skips (those are judged by gate-skips.mjs). */
export const fullRunProblems = (report) => integrityFailures(report);
