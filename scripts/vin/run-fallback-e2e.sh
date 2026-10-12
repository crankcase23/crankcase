#!/bin/bash
# Runs the NHTSA-outage fallback e2e (flag ON) against a production build on the scratch Postgres, with the vPIC stub.
# Needs: a built app (npx next build), a Postgres reachable as DATABASE_URL (migrated, including 2026-10-12-vin-status.sql),
# and the e2e specs' psql helper expects the database to be named cc_test on 127.0.0.1:5544.
# Usage: bash scripts/vin/run-fallback-e2e.sh
set -u
cd "$(dirname "$0")/../.."
export DATABASE_URL=${DATABASE_URL:-postgres://postgres@127.0.0.1:5544/cc_test}
export AUTH_SECRET=local-throwaway-test-secret-not-used-anywhere-else-0123456789
export AUTH_TRUST_HOST=true NEXT_TELEMETRY_DISABLED=1
export VIN_FALLBACK_ENABLED=true VPIC_BASE_URL=http://127.0.0.1:3199 VIN_FALLBACK_E2E=on
setsid node scripts/vin/vpic-stub.mjs 3199 & STUB=$!
setsid npx next start --port 3100 & APP=$!
for i in $(seq 1 30); do curl -s -o /dev/null http://localhost:3100/login && break; sleep 1; done
npx playwright test tests/e2e/vin-fallback.spec.ts --workers=3 "$@"
CODE=$?
# each was started as its own process group, so this takes the whole tree (npx, sh, next-server) down
kill -- -$STUB -$APP 2>/dev/null
exit $CODE
