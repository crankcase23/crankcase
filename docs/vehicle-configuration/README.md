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

## Migration (run by the owner, BEFORE deploying)
1. Neon SQL editor: run `migrations/2026-10-11-vehicle-configuration.sql`. Additive and idempotent (new nullable columns, unique indexes that skip existing duplicates). No rows are rewritten or deleted.
2. Deploy.
3. Existing vehicles keep working with nothing saved; they show "Confirm transmission & drivetrain" and are confirmed in place (Edit Configuration), no delete/re-add.

Rollback: `migrations/2026-10-11-vehicle-configuration-ROLLBACK.sql` removes only what the migration added. The only data lost is saved configuration choices. Roll back the app first, then the SQL.

## Tests
`npm run config:test`, `npm run bmw:test`, and Playwright against a production build (`vehicle-config`, `garage`, `garage-dashboard`, `vehicle-home`, `bmw-admin-guides`).

## Known limitations
- Only the BMW 328i has a model-specific option list and tagged guides. Every other vehicle gets the generic family and its guides are unchanged.
- Browser tests mock the NHTSA vPIC response (NHTSA is unreachable from the build sandbox).
- Confirming a drivetrain does not certify unrelated torque values; those stay flagged.
- Some non-oil BMW guides still show RealOEM/part-number research wording in the Parts list (existing copy, outside this change).
