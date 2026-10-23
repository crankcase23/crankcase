#!/bin/bash
# Resource-bounded full e2e run (Build 104-AO): the same release-evidence run as e2e-gated.sh, with limits that make a disk-filling run unlikely and
# its evidence usable. It checks free space ONCE at the start and trims AFTER the run, so it cannot stop a disk that fills mid-run; what it does is refuse
# the known cause (a trace per test), refuse to start low, keep failure evidence small, and say so when every failure was the machine running out.
# Why: a full run with a trace for EVERY test filled the sandbox disk (ENOSPC, ERR_INSUFFICIENT_RESOURCES, browser crashes), and the resulting
# red tests were noise. What this adds, and nothing else:
#   1. refuses to start when less than CC_MIN_FREE_MB (default 1500) is free where results go            -> exit 4, nothing run
#   2. refuses --trace=on / --trace on (a trace per passing test is what filled the disk); the config already keeps traces on failure only
#      (override on purpose with CC_ALLOW_TRACE_ON=1)                                                    -> exit 2
#   3. after the run, keeps the full artifacts of the first CC_KEEP_FAILURES (default 25) failing tests and trims the rest to their small
#      error-context.md (the error text, page snapshot and test source), listing each trimmed test in TRIMMED.txt. results.json (every error
#      message) is never touched. A run with more failures than that is already telling you what it needs to tell you.
# The verdict is e2e-gated.sh's (0 or 1). e2e-gated.sh collapses the results gate's exit 3 ("every failure was DEFINITELY the machine running out of disk or
# memory") into 1, so after a failed run this wrapper asks the gate again and returns 3 in that one case. It never turns a failure into 0.
#   2 = refused an argument   4 = refused to start (low disk)
#   usage: scripts/logging/e2e-bounded.sh [e2e-gated.sh options]      (CC_GATE_OUT=<dir> to choose where results go)
set -u
HERE="$(cd "$(dirname "$0")" && pwd)"
GATED="${CC_E2E_GATED:-$HERE/e2e-gated.sh}"
MIN_FREE_MB="${CC_MIN_FREE_MB:-1500}"
KEEP="${CC_KEEP_FAILURES:-25}"
OUT="${CC_GATE_OUT:-$(mktemp -d)}"
mkdir -p "$OUT"

# numeric knobs must be numbers: a typo must not silently switch the disk precheck or the trimming off
for v in MIN_FREE_MB KEEP; do
  case "${!v}" in ''|*[!0-9]*|??????????*) echo "e2e-bounded.sh: $v must be a whole number of at most 9 digits, got '${!v}'" >&2; exit 2 ;; esac
done

PREV=""
for a in "$@"; do
  # the wrapper owns --output (its trimming and size report look there); a second --output would silently win and bypass both
  case "$a" in --output|--output=*) echo "e2e-bounded.sh: refusing $a: the wrapper sets --output itself (use CC_GATE_OUT to choose where results go)" >&2; exit 2 ;; esac
  if [ "${CC_ALLOW_TRACE_ON:-}" != "1" ]; then
    case "$a" in
      --trace=on) echo "e2e-bounded.sh: refusing --trace=on: a trace for every test is what filled the disk (CC_ALLOW_TRACE_ON=1 to override)" >&2; exit 2 ;;
      on) [ "$PREV" = "--trace" ] && { echo "e2e-bounded.sh: refusing --trace on (see --trace=on)" >&2; exit 2; } ;;
    esac
  fi
  PREV="$a"
done

FREE_MB="$(df -Pm "$OUT" | awk 'NR==2 {print $4}')"
if [ -z "$FREE_MB" ] || [ "$FREE_MB" -lt "$MIN_FREE_MB" ]; then
  echo "e2e-bounded.sh: refusing to start: ${FREE_MB:-unknown} MB free where results go ($OUT), need $MIN_FREE_MB (CC_MIN_FREE_MB). Free space and rerun; a run that fills the disk is not evidence." >&2
  exit 4
fi

rm -f "$OUT/results.json"   # a stale file from an earlier run must not be judged as this run
CC_GATE_OUT="$OUT" bash "$GATED" --output "$OUT/pw" "$@"
RC=$?
if [ "$RC" -eq 1 ] && [ -f "$OUT/results.json" ]; then
  node "$HERE/playwright-results-gate.mjs" "$OUT/results.json" >/dev/null 2>&1
  [ $? -eq 3 ] && RC=3
fi

# trim the failure artifacts beyond the first KEEP (error-context.md stays for all of them)
if [ -d "$OUT/pw" ]; then
  N=0; : > "$OUT/TRIMMED.txt"
  for d in "$OUT"/pw/*/; do
    [ -f "$d/error-context.md" ] || continue
    N=$((N + 1))
    if [ "$N" -gt "$KEEP" ]; then
      rm -f "$d"/trace.zip "$d"/*.webm "$d"/*.png 2>/dev/null
      echo "$(basename "$d")" >> "$OUT/TRIMMED.txt"
    fi
  done
  [ -s "$OUT/TRIMMED.txt" ] && echo "e2e-bounded.sh: $(wc -l < "$OUT/TRIMMED.txt") failing tests beyond the first $KEEP keep only error-context.md (list: $OUT/TRIMMED.txt); results.json is complete"
  [ -s "$OUT/TRIMMED.txt" ] || rm -f "$OUT/TRIMMED.txt"
  echo "e2e-bounded.sh: artifacts $(du -sm "$OUT" | cut -f1) MB in $OUT"
fi
exit "$RC"
