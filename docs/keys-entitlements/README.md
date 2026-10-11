# Get the Keys, PR-A: permanent VIN entitlements + server pricing

**Not in this PR:** Stripe, checkout, real payments, enforcement (guides stay readable exactly as today), UI changes. Nothing can grant an entitlement from the browser.

## What it adds
- `vin_entitlements` table: one row per (account, canonical VIN). No foreign key to `garage_entries`, so removing a vehicle never touches it. Rows go only with the account itself (privacy deletion) or an explicit `revoked_at` (refund/admin), never as a side effect of a garage change.
- `src/lib/keysEntitlements.ts` (server only): `nextUnlockPrice`, `getEntitlement`/`hasEntitlement`, `keysStatusForOwnVehicle`, and the internal `grantPurchasedEntitlement` for the future payment webhook (idempotent, per-account advisory lock, unique index backstop; priced by the server at the account's next rung and recorded on the row).
- `GET /api/keys/price` and `GET /api/garage/[id]/keys`: read-only. No write verbs exist; the browser cannot send a price.
- `keysPricing.ts` stays the single source of the ladder ($20/$18/$16/$15, floor $15), now also in cents.
- Migration `migrations/2026-10-11-vin-entitlements.sql` (+ VERIFY, ROLLBACK): additive, idempotent; also copies existing admin gift unlocks (which live in `vehicle_unlocks`, keyed to the garage row and cascade-deleted with it) into the new table. **DRAFT, rehearsed on scratch Postgres only, not run anywhere real. Needs owner approval for production.**

## Rules enforced (and tested)
| Rule | Where proven |
|---|---|
| Ladder $20/$18/$16/$15, floors at $15, server-computed | keys:test 1-2, e2e price test (browser params ignored) |
| Same VIN, any spelling = one entitlement, ladder does not advance | keys:test 3 |
| Concurrent grants never double-spend a rung or duplicate a VIN | keys:test 4 |
| Gifts and refunded unlocks do not count toward the ladder; re-buy after refund = current rung | keys:test 5 |
| Deleting a garage vehicle never destroys a paid entitlement; re-adding the VIN restores access at no charge | keys:test 6, e2e PERSISTENCE |
| Another account on the same VIN: locked, own price, cannot read/move the owner's; probing someone else's row id = same 404 as a fake id | keys:test 8, e2e ISOLATION |
| VIN-less or invalid-VIN vehicles cannot carry an entitlement | keys:test 9, e2e |
| One row per (account, VIN); source constrained; account deletion removes its rows | keys:test 10 |
Mutation check: adding a trigger that deletes the entitlement when the garage row is deleted fails keys:test 6 and 8 and the e2e PERSISTENCE test.

## Not duplicating ownership entitlements
An entitlement is (account, VIN). A transfer never copies it: the recipient buys their own at their own rung (with the $5 transfer credit once that exists), and a former owner who reacquires finds their original still there (rule 22/23 of the CLUTCH ownership spec). Two accounts holding one VIN each have their own state; a paid unlock never travels with the car.

## Open items (owner decisions, see PR description)
Gifts vs ladder (here: gifts don't count), refund = revoke (here: row kept, revoked_at set, ladder drops back), admin gift route still writes only the legacy table until dual-write is approved, `SAME_MODEL_OTHER_VIN` limit from #42/#43 caps how many same-model cars a customer can add, which directly caps the ladder.

## Run
`DATABASE_URL=postgres://postgres@127.0.0.1:5544/cc_test npm run keys:test` (refuses non-local databases) and Playwright `keys-entitlements`.
