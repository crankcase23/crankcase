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

## Entitlement history and admin gifts (step 3, 2026-10-11)
- `vin_entitlement_events` is an **append-only** log: `purchased`, `gifted`, `revoked`, `refunded`, `reacquired`, each with source, rung, price, purchase id, actor (`system` / `admin` / `customer`, plus the admin's user id) and a reason. Triggers reject UPDATE, TRUNCATE and direct DELETE; rows go only when the whole account is deleted (privacy deletion cascades). `vin_entitlements` stays the *current* state; the log is how it got there. Reinstating a VIN never erases anything: a `reacquired` event records the grant it replaced.
- Every change goes through `grantPurchasedEntitlement`, `giftEntitlement` or `revokeEntitlement` in `src/lib/keysEntitlements.ts`, in one transaction with its event, under the per-account advisory lock. Nothing else writes `vin_entitlements`.
- **Admin gift/revoke** (`POST /api/admin/unlocks`, `unlocks.manage`) now writes `vin_entitlements` via those functions (the older `vehicle_unlocks` table is no longer written; it was keyed to the garage row and cascade-deleted with it, so a gift vanished when the customer removed the car). A vehicle with no valid VIN cannot be unlocked (400). Revoke sets `revoked_at` and logs an event; nothing is deleted. Every action still lands in `admin_audit_log` (last six VIN characters only).
- Gifts never count toward the Garage Rewards ladder: a gift cannot push a later purchase to a lower rung or a higher price. Revoked/refunded rows stop counting.
- Admin screens (users list/overview Unlocks, garage tab, vehicles list, metrics, CSV exports) read active `vin_entitlements` by (owner, VIN). Same VIN in two accounts: only the account that holds the entitlement shows as unlocked.
- Keys status resolves a car through the same permanent garage ids as the rest of the garage (`findOwnRow`); a bare model id with several cars is refused (409), never answered for some other car.
- Migration `migrations/2026-10-11-vin-entitlement-events.sql` (+ VERIFY, ROLLBACK): idempotent; creates the table and triggers and writes a starting event for every existing entitlement. Run after `2026-10-11-vin-entitlements.sql`. **DRAFT, rehearsed on a scratch copy only; production needs owner approval.** Full order for the stack: vehicle-configuration, vin-canonical, vin-entitlements, vin-entitlement-events, then deploy code.

## Open items (owner decisions, see PR description)
- Refund = revoke (here: row kept, `revoked_at` set, ladder drops back). The `refunded` event type exists; no payment path calls it yet.
- A customer who already holds a VIN by **gift** and then pays for it: today `grantPurchasedEntitlement` returns `created:false` and changes nothing (no double access), so a captured payment would not be recorded. Decide before payments exist: convert the gift to a purchase at the next rung, or refuse the checkout up front.
- `vehicle_unlocks` rows whose vehicle has no VIN stay in the old table (VERIFY lists the count); decide whether support asks those customers for a VIN or they are dropped.
- A legacy `vehicle_unlocks` row with source `purchase` would be copied by the earlier migration as a purchase without a price and would count on the ladder. Nothing sells today so expect zero; VERIFY flags it.
- `SAME_MODEL_OTHER_VIN` limit from #42/#43 no longer exists after the VIN-isolation work (any number of same-model cars), so the ladder is not capped by it.

## Run
`DATABASE_URL=postgres://postgres@127.0.0.1:5544/cc_test npm run keys:test` (refuses non-local databases) and Playwright `keys-entitlements` + `keys-admin-gifts`.
