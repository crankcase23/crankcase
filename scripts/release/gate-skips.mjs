// Pure helper for scripts/release-gate.mjs: which skipped tests in a full Playwright report are NOT acceptable.
// A skip is acceptable only if
//   - it is on the allowlist of titles (needs tokens that are not set in the rehearsal environment), or it is ops-snapshot, or
//   - it is in the flag-gated NHTSA-fallback spec AND a second report (the flag-ON leg, scripts/vin/run-fallback-e2e.sh)
//     proves every one of those tests passed with none skipped. A skip with no such proof is still a failure.
export const FALLBACK_FILE = /(^|\/)vin-fallback\.spec\.ts$/;

export function unexpectedSkips(rows, { allowedTitles = [], fallbackLegRows = null } = {}) {
  const legOk =
    Array.isArray(fallbackLegRows) &&
    fallbackLegRows.filter((x) => FALLBACK_FILE.test(x.file)).length > 0 &&
    fallbackLegRows.filter((x) => FALLBACK_FILE.test(x.file)).every((x) => x.status === "expected");
  const skippedFallback = rows.filter((x) => x.status === "skipped" && FALLBACK_FILE.test(x.file));
  const legCoversAll = legOk && skippedFallback.every((s) => fallbackLegRows.some((l) => FALLBACK_FILE.test(l.file) && l.title === s.title && l.status === "expected"));
  return rows.filter(
    (x) =>
      x.status === "skipped" &&
      !allowedTitles.some((re) => re.test(x.title) || re.test(x.title.split(" › ")[0] ?? "")) &&
      !/ops-snapshot/.test(x.file) &&
      !(FALLBACK_FILE.test(x.file) && legCoversAll),
  );
}
