#!/usr/bin/env bash
# OLD/NEW COMPATIBILITY REHEARSAL (scratch Postgres only; never point this at a real database).
#   OLD_DIR  a built checkout of main (the live code)           e.g. a git worktree of 79cf395 after `npm run build`
#   NEW_DIR  a built checkout of the release branch             default: the repo containing this script
#   TEMPLATE_DB  scratch copy of the pre-release schema/data   default: cc_pre
# Flow: A old app on old schema -> expand SQL -> B old app again -> "deploy" new app, re-run M3/M4/M5 -> C -> contract SQL
#       (once with duplicates present, once after support merged them) -> D -> schema diff against the all-at-once chain.
set -u
NEW_DIR="${NEW_DIR:-$(cd "$(dirname "$0")/../.." && pwd)}"
OLD_DIR="${OLD_DIR:?set OLD_DIR to a built checkout of main}"
TEMPLATE_DB="${TEMPLATE_DB:-cc_pre}"
export TDB="${TDB:-cc_win2}" TDIR="${TDIR:-/var/tmp/transition}"
PSQL="psql -h 127.0.0.1 -p 5544 -U postgres -v ON_ERROR_STOP=1 -q"
URL="postgres://postgres@127.0.0.1:5544"
M="$NEW_DIR/migrations"; W="$NEW_DIR/docs/release/old-code-window"
rm -rf "$TDIR"; mkdir -p "$TDIR"; LOG="$TDIR/rehearsal.log"; : > "$LOG"
say() { echo "== $*" | tee -a "$LOG"; }
run_sql() { say "sql: $(basename "$2")"; $PSQL -d "$1" -f "$2" 2>&1 | grep -E "ERROR|NOTICE: +(SKIPPED|STOPPED)|SKIPPED|STOPPED" | tee -a "$LOG"; }
startapp() { # dir port
  (cd "$1" && DATABASE_URL="$URL/$TDB" AUTH_SECRET=local-test-secret-not-real AUTH_TRUST_HOST=true nohup npx next start -p "$2" > "$TDIR/app-$2.log" 2>&1 & echo $! > "$TDIR/app-$2.pid")
  for i in $(seq 1 40); do curl -s -o /dev/null "localhost:$2/" && return 0; sleep 1; done; echo "app on $2 did not start" | tee -a "$LOG"; return 1; }
stopapp() { # port
  [ -f "$TDIR/app-$1.pid" ] && pkill -P "$(cat "$TDIR/app-$1.pid")" 2>/dev/null; [ -f "$TDIR/app-$1.pid" ] && kill "$(cat "$TDIR/app-$1.pid")" 2>/dev/null
  for p in $(ps aux | grep "[n]ext-server" | awk '{print $2}'); do if tr '\0' ' ' < /proc/$p/environ 2>/dev/null | grep -q "PORT=$1"; then kill "$p"; fi; done; sleep 1; }
phase() { # letter port
  say "PHASE $1 against :$2"
  (cd "$NEW_DIR" && APP_URL="http://localhost:$2" PHASE="$1" npx playwright test -c tests/transition/playwright.config.ts 2>&1 | tee -a "$LOG" | grep -E "✓|✘|passed|failed|Error|Expected|Received" | head -30) ; }

say "scratch database $TDB from $TEMPLATE_DB"
$PSQL -c "drop database if exists $TDB" -c "create database $TDB template $TEMPLATE_DB" || exit 1

startapp "$OLD_DIR" 3201 || exit 1
phase A 3201

say "pre-check right before EXPAND: the case-collision guard (same VIN twice in one account is refused, nothing changes)"
run_sql "$TDB" "$W/pre-2-vin-canonical.sql" | tee "$TDIR/precheck.txt"
if grep -q STOPPED "$TDIR/precheck.txt"; then
  say "guard fired as designed (old code lets a customer add the same VIN twice); support merges those rows by hand, then continue"
  $PSQL -d "$TDB" -c "delete from garage_entries where id in (select id from (select id, row_number() over (partition by user_id, upper(vin) order by created_at, id) rn from garage_entries where vin is not null) x where rn > 1)"
fi

say "EXPAND (pre-deploy): pre-1, pre-2, M3, M4, M5"
for f in "$W/pre-1-vehicle-configuration.sql" "$W/pre-2-vin-canonical.sql" "$M/2026-10-11-vin-entitlements.sql" "$M/2026-10-11-vin-entitlement-events.sql" "$M/2026-10-12-legacy-unlock-holds.sql"; do run_sql "$TDB" "$f"; done
phase B 3201

say "DEPLOY: old app stops, new app starts on the same database; post-deploy re-run of M3/M4/M5 captures stragglers"
stopapp 3201; startapp "$NEW_DIR" 3202 || exit 1
for f in "$M/2026-10-11-vin-entitlements.sql" "$M/2026-10-11-vin-entitlement-events.sql" "$M/2026-10-12-legacy-unlock-holds.sql"; do run_sql "$TDB" "$f"; done
phase C 3202

say "CONTRACT #1 with the in-window duplicates still present (expect SKIPPED notices, nothing deleted)"
run_sql "$TDB" "$W/post-deploy-contract.sql" | tee "$TDIR/contract1.txt"
$PSQL -d "$TDB" -Atc "select 'dup rows still present: '||count(*) from garage_entries where vin is not null group by user_id, vin having count(*)>1" | tee -a "$LOG" "$TDIR/dups-before.txt"
say "support merges the duplicate rows (scratch stand-in: keep the oldest)"
$PSQL -d "$TDB" -c "delete from garage_entries where id in (select id from (select id, row_number() over (partition by user_id, vin order by created_at, id) rn from garage_entries where vin is not null) x where rn > 1)" -c "delete from garage_entries where id in (select id from (select id, row_number() over (partition by user_id, vehicle_id order by created_at, id) rn from garage_entries where kind='catalog' and vin is null) x where rn > 1)"
say "CONTRACT #2 and #3 (second run proves idempotence)"
run_sql "$TDB" "$W/post-deploy-contract.sql"; run_sql "$TDB" "$W/post-deploy-contract.sql"
phase D 3202
stopapp 3202

say "SCHEMA: final transition schema vs the all-at-once chain on the same starting data"
$PSQL -c "drop database if exists ${TDB}_ref" -c "create database ${TDB}_ref template $TEMPLATE_DB"
$PSQL -d "${TDB}_ref" -c "delete from garage_entries where id in (select id from (select id, row_number() over (partition by user_id, upper(vin) order by created_at) rn from garage_entries where vin is not null) x where rn > 1)"
for f in 2026-10-11-vehicle-configuration 2026-10-11-vin-canonical 2026-10-11-vin-entitlements 2026-10-11-vin-entitlement-events 2026-10-12-legacy-unlock-holds; do $PSQL -d "${TDB}_ref" -f "$M/$f.sql" 2>&1 | grep ERROR; done
for d in "$TDB" "${TDB}_ref"; do pg_dump -h 127.0.0.1 -p 5544 -U postgres -s --no-owner "$d" | grep -v '^--' | grep -v '^$' | grep -v 'restrict' > "$TDIR/$d.schema.sql"; done
if diff "$TDIR/$TDB.schema.sql" "$TDIR/${TDB}_ref.schema.sql" > "$TDIR/schema.diff"; then say "SCHEMA IDENTICAL"; else say "SCHEMA DIFFERS"; cat "$TDIR/schema.diff" | tee -a "$LOG"; fi
$PSQL -d "$TDB" -Atc "select 'user triggers on garage_entries: '||coalesce(string_agg(tgname, ', ' order by tgname),'none') from pg_trigger where tgrelid='garage_entries'::regclass and not tgisinternal" | tee -a "$LOG"
$PSQL -d "$TDB" -Atc "select 'garage_entries constraints+indexes: '||string_agg(n, ', ' order by n) from (select conname n from pg_constraint where conrelid='garage_entries'::regclass union all select indexname from pg_indexes where tablename='garage_entries') x" | tee -a "$LOG"
say "done; evidence in $TDIR"
