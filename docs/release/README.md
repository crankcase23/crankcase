# Release runbook: VIN / keys / per-car-id stack (#42 #43 #45 #46 #47 #48 + #50)

Status 2026-10-12: PR #50 is **draft**. Nothing here has been run against production. Every production step needs its own explicit owner approval. All rehearsals ran on scratch Postgres 16 (200k garage rows / 20k users). Supersedes `claude/crankcase-release-runbook-44-42-43-2026-10-11.md`.

## 1. PR dependency chain (reconciled 2026-10-12 against live GitHub)

`main` is now **bd66933** (was 79cf395 when the stack was cut). Merged to `main` since, not by this session: **#49** preview databases (86e26ca), **#44** Next.js 16.3.4 to 16.3.8 (fa3e061), **#51** three stale garage e2e tests fixed for main's old add-vehicle flow (904e66c), **#52** sharp/source-map-js lockfile bumps (bd66933).

```
main bd66933  (= 79cf395 + #49 + #44 + #51 + #52)
 +- #42 2edee0d  vehicle configuration + same-model migration fix
     +- #43 627d47a  VIN-required + photo scan                         (latest #43 head; in #50)
         +- #46 82ec96c  VIN isolation (cut from an older #43)
             +- #47 4502077  permanent per-car ids
                 +- #48 9af13ca  = #47 + #45 (ba2650f, entitlements PR-A) + 2 commits
                     +- #50 (draft, base claude/keys-entitlements-v2) = #48 + #43 627d47a + release-readiness work + main bd66933
```
Checked by SHA and `git merge-tree` (2026-10-12 04:40Z):
- #42, #43, #45, #46, #47, #48 heads are all ancestors of #50 and unchanged on GitHub.
- main merged into #50 twice (`598e3c3` for #49; `461ae65` for #44/#51/#52). Conflicts: `package.json` scripts (resolved, all scripts kept) and `tests/e2e/garage.spec.ts` (#51 repaired the old add-vehicle flow that #43 replaces; the stack's version is kept; **#51's fixes become irrelevant once the stack merges**).
- #50 now builds on Next 16.3.8 (`npm ci`, tsc clean, build OK, release gate PASS).
- Remaining risk: any further commit to `main` needs the same merge-tree check before the stack merges.

Merge order: **(1) #44 is already on main; confirm its production deploy and smoke test passed**; **(2) the whole stack as ONE merge: #50** (it carries #42 #43 #45 #46 #47 #48). Never merge #42 or #43 alone (#43 alone ships the global VIN block and the "We Know This Vehicle" teaser that #46 removes). `claude/vin-required-garage-alt` is a parallel PR-less branch: do not merge. Recommend converting #42/#43 to draft or closing them as superseded so a stray merge click cannot ship them alone.

Preview databases (from #49): Preview deployments use `PREVIEW_DB_DATABASE_URL` and fail closed; they never touch production data. That database currently has only the base schema + M1. **Before anyone opens a Preview of #50 (or #46-#48) the preview DB needs M2-M5** (owner, Vercel Storage > crankcase-preview > Query, same files and order as section 4, without the production approvals). Until then previews of the new code will error. This replaces the old "is DATABASE_URL shared with Preview?" worry; verify the scopes once in Vercel (section 3).

## 2. Mandatory gates (all PASS on the exact SHA before any migration is approved)

Scratch DB `cc_test` with M1-M5 applied; app built and served with `next start -p 3100` against it (`DATABASE_URL`, `AUTH_SECRET`, `AUTH_TRUST_HOST=true`).

| Gate | Command | Required |
|---|---|---|
| Types / build | `npx tsc --noEmit`, `npm run build` | clean |
| Lint | `npx eslint` | exactly the 3 baseline errors (printify-publish.js x2, AddVehicleClient.tsx) |
| Unit | `npm run vin:test`, `npm run config:test`, `npm run db:test` | all pass |
| **Release gate (MANDATORY)** | `npm run release:gate -- --full-report <playwright-json>` with DATABASE_URL set to the local scratch database (127.0.0.1) | PASS (see below) |
| Full e2e | `npx playwright test --workers=2 --reporter=json > full.json` (DATABASE_URL set to the local scratch database) (about 17 min, background) | 0 failed; only the `ops-snapshot` tests skipped |
| Transition rehearsal | `OLD_DIR=<built checkout of main> scripts/release/transition-rehearsal.sh` | all phases pass, `SCHEMA IDENTICAL` |

`npm run release:gate` fails (exit 1) unless ALL of these hold:
1. `DATABASE_URL` is set and points at 127.0.0.1/localhost (otherwise database-backed suites skip silently).
2. keys unit suite: 0 failed, **0 skipped**, at least 30 tests; the `legacy-holds` suite ("historical paid access cannot disappear when a garage vehicle is deleted") at least 12 tests, 0 skipped.
3. The three admin cross-account isolation specs each RAN and PASSED (admin gift on the same VIN in two accounts; entitlement ISOLATION; no-oracle VIN answer). A skipped, filtered-out or missing spec is a FAIL. Never waive, `.skip` or edit these out.
4. With `--full-report`: 0 failed/flaky and no unexpected skips (the BMW admin-guide specs skip when `DATABASE_URL` is not local; that is a FAIL).

Proofs that the gate bites (2026-10-12, scratch):
| Break | Gate result |
|---|---|
| `DATABASE_URL` unset, or non-local host | FAIL immediately, exit 1 |
| isolation spec turned into `test.skip` | FAIL: "isolation ... FAIL" and "1 test(s) skipped"; exit 1 |
| full report from a run without a local DB (76 BMW admin tests skipped) | FAIL: "76 unexpected skips"; exit 1 |
| admin vehicles export keyed by VIN only (account dropped from the unlock key) | FAIL on the first isolation spec, other checks PASS, exit 1 (re-proved on the merged build) |
| healthy merged tree, real full-run report | PASS: keys 30/30 (0 skipped), legacy-holds 12/12, 3/3 isolation, full run 169 tests 0 failed, 0 unexpected skips |

## 3. Owner-only checks (cannot be done from the sandbox)

1. Vercel: Production `DATABASE_*` is Production-scoped only; Preview uses `PREVIEW_DB_*` (per the #49 doc). Re-check after any Neon/Vercel integration change.
2. Neon: plan, branch permission, point-in-time-restore window; **rehearse the whole chain on a Neon branch of production** with VERIFY after each step and the ROLLBACKs in reverse; delete the branch; never point an app env at it. Record: pairs blocked by the collision guard; duplicate VIN / VIN-less catalog rows; legacy unlock inventory (total, by source, VIN-less, invalid VIN, **how many `purchase`, expected 0**); garage rows without a VIN; wall-clock per step.
3. Vercel build command not overridden (the `prebuild` step copies OCR assets).
4. Who runs SQL: Neon/Vercel Query editor, Read-only ON for VERIFY, OFF for the migration.
5. Apply M2-M5 to the **preview** database before opening previews (section 1).

## 4. Deployment order (recommended: Option B, expand / deploy / contract)

Option B was proven against the real old `main` app over HTTP (section 5). Option A (everything back to back, accept a short old-code error window) is the fallback.

**Option B, each numbered step needs owner approval; run VERIFY after every SQL file:**
1. Gates green on the exact SHA (section 2). Owner checks done (section 3). Neon branch rehearsal done.
2. **#44** is already merged to `main`; confirm its production deploy is healthy (home, login, garage, a guide) before continuing.
3. **EXPAND** (production DB, old code still live and still fully working):
   `docs/release/old-code-window/pre-1-vehicle-configuration.sql` > `pre-2-vin-canonical.sql` > `migrations/2026-10-11-vin-entitlements.sql` (M3) > `2026-10-11-vin-entitlement-events.sql` (M4) > `2026-10-12-legacy-unlock-holds.sql` (M5).
   `pre-2` STOPS with "N customer/VIN pairs would become duplicates", changing nothing, if an account has the same VIN twice (old code allows it). Resolve those rows by hand, re-run. M3 refuses to run without the canonical guard; M5 refuses to run without M3.
4. **DEPLOY**: merge #50 (one merge, Vercel production deploy). Smoke test: sign up; add a car by VIN; add a second car of the same model; open each by its own URL; open an old bare `/vehicles/<id>` link; admin-gift a VIN; customer sees it unlocked; remove and re-add the car, still unlocked; `GET /api/garage/<id>/keys/checkout` says `already-unlocked`.
5. **STRAGGLERS**: re-run M3, M4, M5 once (idempotent; never reinstate a revoked row, never reopen a hold). They capture any gift the OLD admin wrote to `vehicle_unlocks` during the window. VERIFY: "unaccounted" must be 0.
6. **CONTRACT**, only when no old deployment can still serve: `post-deploy-contract.sql`. Adds the canonical CHECK and the two unique indexes and drops the temporary upper-casing trigger. If it prints `SKIPPED ... N customer/VIN pairs`, the old code created same-account duplicates during the window: nothing was changed, support merges those rows (the new code lists them like any other cars), then re-run. Final VERIFY: only trigger on `garage_entries` is `garage_entries_preserve_legacy_unlocks`; CHECK and both indexes present.
7. Watch error logs for a day.

**Option A:** M1 `2026-10-11-vehicle-configuration.sql` > M2 `2026-10-11-vin-canonical.sql` > M3 > M4 > M5 back to back (about 2 s of SQL at 200k rows), merge #50 immediately, smoke test, re-run M3/M4/M5. Until the deploy finishes, old code returns a raw 500 (no data change) for "same VIN twice in one account" and "lower-case VIN via a crafted request". Freeze admin gifting during the window.

## 5. Transition rehearsal: real old app over HTTP (2026-10-12)

`scripts/release/transition-rehearsal.sh` (spec: `tests/transition/transition.spec.ts`). Old app = built `main` at 79cf395 (`next start`, port 3201); new app = built #50 head (port 3202); one scratch Postgres database throughout, copied from the pre-release schema with 200k garage rows.

| Phase | App / schema | Result |
|---|---|---|
| A | old app, original schema | valid add 200, **same VIN twice 200 (2 rows)**, **lower-case VIN 200 (stored lower-case)**, no-VIN add 200, list 200 |
| guard | before EXPAND | `pre-2` STOPPED ("2 customer/VIN pairs would become duplicates"), nothing changed; support merged them |
| B | old app, after EXPAND (pre-1, pre-2, M3, M4, M5) | the same five calls all **200**; same VIN twice still 200 (2 rows); lower-case VIN now **stored upper-case** (trigger). Old admin gifted 2 cars (writes `vehicle_unlocks`); a purchased VIN-less car and a gifted junk-VIN car were seeded. The OLD app then **deleted three of them**: result 3 holds (`gift`, `gift`, `purchase`, all `pending_vin`), 1 undeleted legacy unlock left, 0 entitlements. Nothing lost. |
| deploy | old app stopped, new app started, M3/M4/M5 re-run | |
| C | new app, expand schema + in-window duplicates | list 200 with the duplicate rows; add valid 200; same VIN again < 500; lower-case < 500. The still-present gifted car (carried by the re-run) is **unlocked** and checkout says `already-unlocked`. Admin page shows 3 holds; admin **restored the paid hold** (entitlement `purchase`, event `purchased:purchase:admin: legacy unlock reconciled: <reason>`), restored the gift, **waived** the junk-VIN gift with a reason. All 3 hold rows still exist (`gift:converted`, `gift:waived`, `purchase:converted`); 3 audit rows (`legacy_hold.convert` x2, `legacy_hold.waive`). A resolved hold cannot be reopened (400). |
| contract #1 | duplicates present | `SKIPPED garage_entries_user_vin_uq: 1 customer/VIN pairs have more than one row. Nothing changed` |
| contract #2, #3 | after support merged them; second run proves idempotence | clean |
| D | new app, final schema | raw lower-case insert **refused by the CHECK**; raw duplicate insert **refused by the unique index**; new app same VIN / lower-case VIN returns < 500 and one row; deleting a car that carries an entitlement keeps the entitlement (`gift|true`), holds stay 3, paid entitlement stays `purchase|true`; re-adding the VIN is unlocked again; event log intact |
| schema | final transition schema vs the all-at-once chain (`M1 > M2 > M3 > M4 > M5`) from the same start | **SCHEMA IDENTICAL** (pg_dump -s diff empty). Triggers on `garage_entries`: only `garage_entries_preserve_legacy_unlocks`. The temporary function `garage_entries_canonical_vin` is gone. |

Results on the build merged with main 86e26ca: full Playwright 158 passed / 0 failed / 11 skipped (the 11 are `ops-snapshot`, tokens not set); transition rehearsal repeated, all phases pass, SCHEMA IDENTICAL again. After the second merge (main bd66933, Next 16.3.8) only tsc, build, the keys suites and the release gate were re-run (PASS); the full 17-minute Playwright run and the rehearsal were not repeated and should be before the production request.

Not covered: real Neon (unreachable from the sandbox), real browsers on a phone, real payments (none exist).

## 6. Rollback, in order

- **Code first, always** (Vercel Instant Rollback / promote the previous deployment). The schema is additive and stays.
- **Before the deploy (EXPAND done):** nothing to roll back for code. Phase B proves old code runs fine on the expanded schema.
- **After the deploy, before CONTRACT:** roll code back; old code keeps working on the expanded schema (phase B). Gifts and revokes made by the new code stay in `vin_entitlements` and reappear on re-deploy.
- **After CONTRACT, then code rolled back to OLD code:** the old 500 cases return unless you first run `docs/release/old-code-window/post-deploy-contract-ROLLBACK.sql` (undoes ONLY what the contract itself did, each step marked by a COMMENT: drops the CHECK only if the contract created it, drops an index only if the contract created it, re-installs the upper-casing trigger only if the contract dropped it; production's M2 CHECK and M1 indexes are left in place and no trigger is added; run when the contract never ran, it changes nothing; deletes no rows). Fixed 2026-10-12 after the Neon rehearsal showed the earlier version dropped M1's two indexes, and again 2026-10-13 after review showed it also dropped the M2 CHECK and always added the trigger; regression tests in `scripts/keys/tests/contract-rollback.test.mjs`. Re-run `post-deploy-contract.sql` when moving forward again.
- **Only if a migration itself is the problem**, reverse order: `2026-10-12-legacy-unlock-holds-ROLLBACK` > `2026-10-11-vin-entitlement-events-ROLLBACK` > `2026-10-11-vin-entitlements-ROLLBACK` (also drops `cc_vin_ok`) > `2026-10-11-vin-canonical-ROLLBACK` (drops the CHECK; upper-cased VINs stay) > `2026-10-11-vehicle-configuration-ROLLBACK`; Option B extra: drop trigger `garage_entries_canonical_vin` and its function if still present. **Export `legacy_unlock_holds`, `vin_entitlement_events` and `vin_entitlements` first**: dropping them destroys paid/gifted history.

## 7. Historical paid holds: identifiable, recoverable, auditable

- **Identify:** `SELECT id, user_id, garage_entry_id, source, granted_at, vehicle_label, vin_at_snapshot, status FROM legacy_unlock_holds WHERE source = 'purchase' ORDER BY granted_at;` The VERIFY file counts them (expected 0 in production). A hold keeps the original source, grant time, vehicle and the VIN as it was at snapshot.
- **Cannot be lost:** no foreign key to `garage_entries`; DELETE and TRUNCATE are refused (only deleting the whole account cascades); the original facts cannot be UPDATEd; a resolved hold cannot be reopened. Deleting the car, the VIN, or the garage row does not touch it (proven: old app deletes, new app deletes, 12 car/state combinations in `legacy-holds.test.mjs`).
- **Recover:** Admin > Users > the user > Garage tab > "Legacy unlocks" > **Restore** (VIN optional if the hold stores one; reason). The customer path is completing the car's VIN: a gift tied to that car, or any hold whose stored VIN matches, restores automatically; a paid hold tied only to the car waits for an admin. Restoring creates the entitlement with the **original source (`purchase`) and original grant time**.
- **Audit:** every restore/waive writes `admin_audit_log` (`legacy_hold.convert` / `legacy_hold.waive`, VIN last six only) and, for a restore, an append-only `vin_entitlement_events` row with the admin as actor and the reason. Waive requires a reason of 5+ characters. No row in `legacy_unlock_holds`, `vin_entitlement_events` or the audit log is ever deleted by these flows.
- Historical purchase prices are not in the legacy table, so a restored paid unlock has no price/rung (`-`); it never counts toward the ladder.

## 8. Customer / admin reconciliation (summary)

Rule: every historical purchase or gift ends as an active `vin_entitlements` row or a `legacy_unlock_holds` row. Customers complete the VIN on the car; admins restore or waive from the user's Garage tab. Checkout (`GET /api/garage/[id]/keys/checkout`, read-only) refuses `already-unlocked` and `legacy-unlock-pending`; a captured payment for such a VIN returns `refund-required` from `settleCapturedPayment` and must be refunded by the future webhook. No real payments exist yet.

## 9. Concurrent-session notes

- #49 (preview DBs) is merged; its doc is `claude/crankcase-preview-db-separation-2026-10-11.md`. Future migrations must also be applied to the preview database by hand.
- Do not touch Vehicle Atlas / Admin Center work in this stack.
- Scratch-environment notes: Playwright key helpers hard-code DB name `cc_test`; Turbopack rejects a symlinked `node_modules`; without a local `DATABASE_URL` the BMW admin specs and keys tests skip, which the gate treats as a FAIL.
