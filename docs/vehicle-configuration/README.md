# Vehicle Configuration V1 (transmission + drivetrain)

## What it does
VIN lookup -> **Confirm Your Ride** -> save. The customer confirms transmission and drivetrain (or "Not sure") before a vehicle is added. The saved choice is the authority for which guide content applies.

## Model
- `garage_entries.transmission` / `drivetrain`: a kind (`automatic|manual|cvt|dct`, `fwd|rwd|awd|4wd|2wd`), `"unknown"` (Not sure) or NULL (never asked), plus `config_confirmed_at`.
- Options come from `Vehicle.configSpec` (only the BMW 328i has one today), else a generic family (Jeep 2WD/4WD; others FWD/RWD/AWD/4WD). A VIN or catalog entry may *preselect*, never save.
- Adds never overwrite an axis that is already set. Only `PATCH /api/garage/[id]` (Edit Configuration) changes a saved choice.
- Dedupe by (user, catalog vehicle) and by (user, VIN), with unique indexes and race handling.

## Guide applicability (`src/lib/guideConfig.ts`)
Per tagged item: confirmed in scope -> shown; confirmed out of scope -> hidden; not confirmed -> restricted. A guide whose `evidenceFor` excludes the confirmed build is **unavailable** (one "NOT AVAILABLE" step, no tools/parts/torque, Wrench Mode disabled). Blocked steps and universal warnings are never removed. Steps renumber and "step N" references are re-pointed. Wrench Mode sessions end when the saved configuration changes.

## BMW copy
`scripts/bmw/config-axes.mjs` holds the per-guide scopes, tags and customer rewrites. Customer copy only; admin drafts and evidence ledgers keep the full research text. Regenerate with `node scripts/bmw/build-drafts.mjs` (`--check` for freshness).

## Release approach (migration)
**What exists today:** migrations in this repo are hand-run SQL files pasted into the Neon SQL panel (Vercel -> Storage -> Query), exactly as `migrations/2026-09-20-*.sql` documents. There is no CI, no workflow, no migration script, and the Vercel build is plain `next build`. `drizzle.config.ts` points at a `./drizzle` folder that does not exist and nothing runs it. So **no authorized automated mechanism exists**, and I hold no database credentials. Nothing has been run against production.

**Ordering is the one hard prerequisite:** the new code selects the new columns, so deploying it before the SQL breaks every garage read. The old code ignores extra columns (it selects only the columns it knows), so running the SQL first is safe for the live app. Migration first, deploy second.

**Runbook (owner, after the release approach is settled):**
1. Pre-check: run `migrations/2026-10-11-vehicle-configuration-VERIFY.sql` (read-only). Expect 0 columns / 0 constraints / 0 indexes, and 0 duplicate rows. Note the total row count N. If either duplicate count is not 0, stop; the migration would skip that unique index (it prints a NOTICE and changes nothing) and the pairs should be resolved by hand first.
2. Optional safety net: a Neon branch or restore point right before step 3, if your plan includes one.
3. Run `migrations/2026-10-11-vehicle-configuration.sql` (one DO block, one transaction, safe to run twice).
4. Post-check: run VERIFY again: 3 columns, 2 constraints, 2 indexes, row count still N; then the commented query: 0 rows with a saved choice.
5. Merge/deploy.
6. Smoke test: sign in; /garage loads; the existing 328i shows "Confirm transmission & drivetrain"; open it, Edit Configuration -> Automatic + Standard RWD -> save; garage card reads "Automatic · RWD"; open the oil-change guide (no xDrive/manual wording). Add a throwaway vehicle through VIN lookup -> Confirm Your Ride, then remove it.

**Rollback:** roll the app back first, then run `migrations/2026-10-11-vehicle-configuration-ROLLBACK.sql`. The only data lost is saved configuration choices.

All of the above was rehearsed on a scratch Postgres (up, up twice, VERIFY before/after, rollback, duplicate-skip, rows identical).

## Tests
`npm run config:test`, `npm run bmw:test`, and Playwright against a production build (`vehicle-config`, `garage`, `garage-dashboard`, `vehicle-home`, `bmw-admin-guides`).

## Known limitations
- Only the BMW 328i has a model-specific option list and tagged guides. Every other vehicle gets the generic family and its guides are unchanged.
- Browser tests mock the NHTSA vPIC response (NHTSA is unreachable from the build sandbox).
- Confirming a drivetrain does not certify unrelated torque values; those stay flagged.
- Options for every vehicle except the BMW 328i are general (the screen says so) and are saved exactly as the customer gives them; they gate nothing, because no other vehicle's guides are tagged to a build.
- Some non-oil BMW guides still show RealOEM/part-number research wording in the Parts list (existing copy, outside this change).
