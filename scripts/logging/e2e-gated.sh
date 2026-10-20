#!/bin/bash
# Run the Playwright suite and judge what it REPORTED, not just its exit code (Build 104-J).
# Playwright exits 0 for a throwing test.fail() / { annotation: { type: "fail" } } test, for a skipped test, and for a test told to expect a
# timeout. The results gate rejects all of those, any flaky or retried test, a run-level error, and any skip that is not on the allowlist
# (scripts/logging/playwright-skip-allowlist.json). --forbid-only makes a (computed) .only fail the run instead of silently dropping tests. Pass any playwright arguments through; do NOT filter tests (--grep, --shard, --project):
# the gate cannot tell a filtered run from a complete one, and the scripts guard forbids those flags here.
#   usage: scripts/logging/e2e-gated.sh [playwright args...]
set -u
OUT="${CC_GATE_OUT:-$(mktemp -d)}"
mkdir -p "$OUT"
PLAYWRIGHT_JSON_OUTPUT_NAME="$OUT/results.json" npx playwright test --forbid-only "$@" --reporter=list,json
PW=$?
node "$(dirname "$0")/playwright-results-gate.mjs" "$OUT/results.json"
GATE=$?
echo "playwright exit=$PW  gate exit=$GATE  (results: $OUT/results.json)"
[ "$PW" -eq 0 ] && [ "$GATE" -eq 0 ]
