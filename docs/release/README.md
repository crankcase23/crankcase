# Release runbook: VIN / keys / per-car-id stack (#42 #43 #45 #46 #47 #48 + #50) (the PR was requested as "#49"; GitHub numbered it #50)

Supersedes the per-PR runbook for #44/#42/#43. **Nothing here has been run against production.** Every production step needs its own explicit owner approval. Rehearsed on scratch Postgres 16 only (200k garage rows / 20k users).

## 1. PR dependency order

All PRs were opened against `main`; GitHub will not enforce order. The owner must.

```
main 79cf395
 +- #44 a7d2a52  Next.js security patch. Independent; merges clean into the stack.
 +- #42 2edee0d  vehicle configuration + same-model migration fix
     +- #43 627d47a  VIN-required + photo scan
         +- #46 82ec96c  VIN isolation (cut from an older #43)
             +- #47 4502077  permanent per-car ids
                 +- #48 9af13ca  = #47 + #45 (entitlements PR-A) + 2 commits
                     +- #50  = #48 + latest #43 merged in + this release-readiness work (base branch: claude/keys-entitlements-v2)
```
1. **#44 first, alone**, own deploy and smoke test.
2. **Then the whole stack as one merge**: merge #50 into `main` (it carries #42 #43 #45 #46 #47 #48). Never merge #42 or #43 alone: #43 alone ships the global VIN block and the "We Know This Vehicle" teaser that #46 removes.
3. `claude/vin-required-garage-alt` is a parallel PR-less branch for the same feature. Do not merge it.
4. Recommend converting #42/#43 to draft (or closing as superseded) so a stray merge click cannot ship them alone.

## 2. Mandatory gates (all must PASS before any migration is approved)

Run against the exact commit that will be merged, on a scratch DB named `cc_test` that has M1-M5 applied (see section 4), app built and served with `next start -p 3100`:

| Gate | Command | Required |
|---|---|---|
| Types / build | `npx tsc --noEmit`, `npm run build` | clean |
| Lint | `npx eslint` | exactly the 3 baseline errors (printify-publish.js x2, AddVehicleClient.tsx); anything else is new |
| Unit suites | `npm run vin:test`, `npm run config:test`, and `DATABASE_URL=<scratch db with M3-M5 applied> npm run keys:test` | all pass, **skipped = 0**. Without `DATABASE_URL` every keys test (including `legacy-holds.test.mjs`, the permanent "paid access cannot disappear" tests) is SKIPPED, and a skipped run is not a pass. |
| **Admin cross-account isolation (MANDATORY)** | `npm run release:gate` | PASS. Runs the three isolation specs (admin gift on the same VIN in two accounts; entitlement ISOLATION; no-oracle VIN check). A skipped, filtered-out or missing test is a FAIL. Never waive, never `.skip`, never edit out. Mutation-checked 2026-10-12: removing the account from the admin vehicles export's unlock key turns the first spec red and the gate prints FAIL. |
| Full e2e | `npx playwright test --workers=2` (about 17 min; run in the background) | all pass |
| Migration VERIFY | each `*-VERIFY.sql` after its migration | see section 4 |

## 3. Owner-only checks (cannot be done from the sandbox)

1. **Vercel, Settings, Environment Variables: is `DATABASE_URL` shared with Preview?** Previews exist for #46-#48 (status success). If Preview shares the production DB they run new code against an un-migrated production schema and anyone signing up there writes to production. Do not open previews until known.
2. **Neon: plan, branch permission, restore window.** Confirm you can branch production (copy-on-write) and the point-in-time-restore window.
3. **Neon branch rehearsal** of the whole chain with VERIFY after each step, then ROLLBACKs in reverse, then delete the branch. Never point an app env at the branch. Record: pairs blocked by `vin-canonical` collision abort; duplicate VIN / VIN-less catalog rows (skipped indexes); legacy unlock inventory (total, by source, VIN-less, invalid VIN, **how many `purchase`, expected 0**); garage rows without a VIN; wall-clock per step.
4. Vercel build command not overridden (the `prebuild` step copies OCR assets).
5. Who runs SQL: Neon SQL editor, Read-only ON for VERIFY, OFF for the migration.

## 4. Migration order and VERIFY (production, each step approved separately)

All migrations are additive, idempotent, one transaction each, and refuse to run (changing nothing) if a precondition is missing.

| # | File | Needs | VERIFY says |
|---|---|---|---|
| M1 | `2026-10-11-vehicle-configuration.sql` | - | new columns/CHECKs present; unique-index NOTICEs (skipped when duplicates exist) |
| M2 | `2026-10-11-vin-canonical.sql` | M1 | aborts, changing nothing, if one account has the same VIN in two letter-cases; then upper-cases VINs and adds the CHECK |
| M3 | `2026-10-11-vin-entitlements.sql` | M2 (CHECK, or the staged pre-2 trigger) | refuses to run without it. Copies a legacy unlock only for a canonical, valid VIN (`cc_vin_ok`). VERIFY main query runs BEFORE; the `AFTER` block counts copyable / not-copyable |
| M4 | `2026-10-11-vin-entitlement-events.sql` | M3 | one starting event per entitlement |
| M5 | `2026-10-12-legacy-unlock-holds.sql` | M3 | **unaccounted legacy unlocks MUST be 0**; paid holds (expected 0); trigger count 3 |

Then deploy (merge #50). **After the deploy is live and smoke-tested, re-run M3, M4, M5 once** (idempotent; they never reinstate a revoked row and never reopen a hold) to capture any gift the OLD admin code wrote into `vehicle_unlocks` during the window. Compare VERIFY counts; "unaccounted" must again be 0.

Smoke test: sign up; add a car by VIN; add a second car of the same model; open each by its own URL; open an old bare `/vehicles/<id>` link; admin-gift a VIN and confirm the customer sees it unlocked; remove and re-add the car, still unlocked; `GET /api/garage/<id>/keys/checkout` on the unlocked car says `already-unlocked`.

## 5. The old-code 500 window

**Finding (measured on the live `main` build against the final schema):** the only migration with a visible old-code effect is the VIN uniqueness/canonical constraints. Old code gets a raw 500 (no data change) for (a) the same VIN added twice in one account (unique index) and (b) a lower-case VIN via a crafted request (canonical CHECK; the UI always sends upper-case). Valid add, no-VIN add and garage listing are 200 either way. The 500s last from the end of M1/M2 to the end of the deploy.

**Option A (default, simplest): shrink the window.** Freeze admin gifting, run M1 to M5 back to back (about 2 s of SQL at 200k rows), merge #50 immediately, smoke test, re-run M3/M4/M5. Exposure: minutes, two odd request shapes, no data harm.

**Option B (zero old-code errors): expand/contract**, proposal in `docs/release/old-code-window/`:
1. Pre-deploy: `pre-1-vehicle-configuration.sql` (columns and CHECKs, NO unique indexes), `pre-2-vin-canonical.sql` (same collision abort, upper-case backfill, plus a BEFORE INSERT/UPDATE trigger that upper-cases VINs instead of a CHECK), then M3, M4, M5 (M3 accepts either the CHECK or the trigger).
2. Deploy.
3. Post-deploy: `post-deploy-contract.sql` adds the CHECK and both unique indexes. If the old code created same-account duplicates during the window, an index is SKIPPED with a NOTICE naming the count and nothing is changed; support merges the rows by hand, re-run.

**Proof (scratch, SQL level, 2026-10-12):** after the pre-deploy chain, the exact INSERT shapes old code issues (lower-case VIN, same VIN twice, same catalog model twice, an admin gift to `vehicle_unlocks`) all succeeded; the VIN was stored upper-case; the post-deploy file printed two SKIPPED notices while duplicates existed, created both indexes once removed, and was idempotent on re-run; re-running M3 turned the in-window gift into an entitlement. Final schema diff against the all-at-once chain: only the extra upper-casing trigger and its function (harmless, can be dropped after contract). Not yet proven: a full old-app build driven against the Option B schema over HTTP (the earlier HTTP probe was run for the all-at-once schema). Recommendation: Option A unless the owner wants zero tolerance, then B after the Neon rehearsal.

## 6. Rollback

- **Code first, always:** Vercel Instant Rollback / promote the previous deployment.
- **Schema: leave it.** Everything is additive; the old app ignores extra tables and columns, and gifts/revokes made by new code stay safe in `vin_entitlements` and reappear on re-deploy.
- Only if a migration itself is the problem, run the ROLLBACK files in reverse: `2026-10-12-legacy-unlock-holds-ROLLBACK`, `vin-entitlement-events-ROLLBACK`, `vin-entitlements-ROLLBACK` (also drops `cc_vin_ok`), `vin-canonical-ROLLBACK` (drops the CHECK; upper-cased VINs stay), `vehicle-configuration-ROLLBACK`. **Export `legacy_unlock_holds`, `vin_entitlement_events` and `vin_entitlements` first**; dropping them loses paid/gifted history. Option B extras: drop trigger `garage_entries_canonical_vin` and its function.

## 7. Legacy unlock reconciliation (nothing is ever dropped)

Rule: every historical purchase or gift ends as an active `vin_entitlements` row or a `legacy_unlock_holds` row. Holds are permanent records until resolved; deleting the car, the garage row or the VIN does not touch them; only deleting the whole account does.

- **Customer:** opens the car and completes its VIN (`POST /api/garage/[id]/vin`). A gift tied to that car, or any hold whose stored VIN equals the VIN entered, is restored automatically with its original source and grant time. A paid hold tied only to the car waits for an admin (the response says `needsReview`).
- **Admin** (`unlocks.manage`): Admin > Users > the user > Garage tab > "Legacy unlocks" panel. **Restore** (VIN optional if the hold stores one; reason) or **Waive** (reason, 5+ chars; only for a deliberate decision such as a refunded purchase). Audited as `legacy_hold.convert` / `legacy_hold.waive`; a resolved hold cannot be reopened.
- **Reporting:** `2026-10-12-legacy-unlock-holds-VERIFY.sql` lists pending, converted, waived, paid and "convertible" holds. Review pending paid holds first.

## 8. Checkout eligibility (no real payments exist yet)

`GET /api/garage/[id]/keys/checkout` is read-only and returns `{eligible, priceCents, rung}` or `{eligible:false, reason}` with `not-in-garage | no-vin | invalid-vin | already-unlocked | legacy-unlock-pending`. Gifts are never converted into sales; an already-unlocked VIN (gift, earlier payment or legacy unlock) cannot be paid for. Requirement for the future payment webhook: call `settleCapturedPayment`; on `refund-required` it must refund and never grant.

## 9. Concurrent-session hazards

- The per-PR runbook `claude/crankcase-release-runbook-44-42-43-2026-10-11.md` is superseded (it releases #42/#43 separately and expects indexes the corrected #42 no longer creates).
- Do not touch Vehicle Atlas / Admin Center work in this PR; it is a separate stream.
- Scratch-environment notes: Playwright key helpers hard-code DB name `cc_test`; Turbopack rejects a symlinked `node_modules`.
