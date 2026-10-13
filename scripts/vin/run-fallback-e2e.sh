#!/bin/bash
# Runs the NHTSA-outage fallback e2e (flag ON) against a production build on a scratch Postgres, with the vPIC stub.
# Needs: a built app (npx next build), and a throwaway local Postgres migrated through 2026-10-12-vin-status.sql.
# The e2e specs' psql helper expects that database to be named cc_test on 127.0.0.1:5544.
# The caller supplies the database URL and the auth signing string in the environment (this file carries neither):
#   DATABASE_URL=<local scratch db url> AUTH_SECRET=<any random string> bash scripts/vin/run-fallback-e2e.sh
set -u
cd "$(dirname "$0")/../.."
[ -n "${DATABASE_URL:-}" ] || { echo "set DATABASE_URL to the throwaway local database" >&2; exit 2; }
[ -n "${AUTH_SECRET:-}" ] || { echo "set AUTH_SECRET to any random string" >&2; exit 2; }
export AUTH_TRUST_HOST=true NEXT_TELEMETRY_DISABLED=1
export VIN_FALLBACK_ENABLED=true VPIC_BASE_URL=http://127.0.0.1:3199 VIN_FALLBACK_E2E=on
setsid node scripts/vin/vpic-stub.mjs 3199 & STUB=$!
setsid npx next start --port 3100 & APP=$!
for i in $(seq 1 30); do curl -s -o /dev/null http://localhost:3100/login && break; sleep 1; done
npx playwright test tests/e2e/vin-fallback.spec.ts --workers=3 --reporter=list "$@"
CODE=$?
# each was started as its own process group, so this takes the whole tree (npx, sh, next-server) down
kill -- -$STUB -$APP 2>/dev/null
exit $CODE
