#!/bin/bash
# Run the Playwright suite and judge what it REPORTED, not just its exit code (Build 104-J; wired as `npm run test:e2e` in 104-K).
# Playwright exits 0 for a throwing test.fail() / { annotation: { type: "fail" } } test, for a skipped test, and for a test told to expect a
# timeout. The results gate rejects all of those, any flaky or retried test, a run-level error, and any skip that is not on the allowlist
# (scripts/logging/playwright-skip-allowlist.json). --forbid-only makes a (computed) .only fail the run instead of silently dropping tests.
# This script only produces FULL-RUN evidence: the gate cannot tell a filtered run from a complete one, so filtering flags (--grep, -g,
# --grep-invert, --shard, --project, --last-failed, --retries, --max-failures, -x, --update-snapshots, --only-changed, --pass-with-no-tests) and
# test-file arguments are refused (exit 2). For a debugging subset use `npx playwright test ...` directly, or set CC_GATE_ALLOW_FILTER=1 to run
# through the gate anyway; that run ends with "FILTERED RUN: NOT RELEASE EVIDENCE".
#   usage: scripts/logging/e2e-gated.sh [--config f] [--workers n] [--timeout ms] [--output dir] [--trace mode]
set -u
FILTERED=0
SKIP_NEXT=0
for a in "$@"; do
  if [ "$SKIP_NEXT" -eq 1 ]; then SKIP_NEXT=0; continue; fi
  case "$a" in
    --config|-c|--workers|-j|--timeout|--output|--trace) SKIP_NEXT=1 ;;
    --config=*|--workers=*|--timeout=*|--output=*|--trace=*|--headed|--debug=*) ;;
    -*|*) FILTERED=1; WHAT="$a" ;;
  esac
done
if [ "$FILTERED" -eq 1 ] && [ "${CC_GATE_ALLOW_FILTER:-}" != "1" ]; then
  echo "e2e-gated.sh: refusing '$WHAT': a filtered or option-changed run is not release evidence (use npx playwright test directly, or CC_GATE_ALLOW_FILTER=1)" >&2
  exit 2
fi
OUT="${CC_GATE_OUT:-$(mktemp -d)}"
mkdir -p "$OUT"
PLAYWRIGHT_JSON_OUTPUT_NAME="$OUT/results.json" npx playwright test --forbid-only "$@" --reporter=list,json
PW=$?
node "$(dirname "$0")/playwright-results-gate.mjs" "$OUT/results.json"
GATE=$?
echo "playwright exit=$PW  gate exit=$GATE  (results: $OUT/results.json)"
[ "$FILTERED" -eq 1 ] && echo "FILTERED RUN: NOT RELEASE EVIDENCE"
[ "$PW" -eq 0 ] && [ "$GATE" -eq 0 ]
