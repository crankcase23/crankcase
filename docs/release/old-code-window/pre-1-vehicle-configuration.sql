-- PROPOSAL (not in migrations/). PRE-DEPLOY half of 2026-10-11-vehicle-configuration.sql.
-- Same as the original EXCEPT it creates NO unique index (the two indexes move to the post-deploy file), so the live OLD code,
-- which knows nothing about them, can never hit a constraint error. Columns and CHECKs on the three NEW nullable columns cannot
-- affect old code. Idempotent; one transaction.
DO $$
BEGIN
  ALTER TABLE garage_entries ADD COLUMN IF NOT EXISTS transmission text;
  ALTER TABLE garage_entries ADD COLUMN IF NOT EXISTS drivetrain text;
  ALTER TABLE garage_entries ADD COLUMN IF NOT EXISTS config_confirmed_at timestamp;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'garage_entries_transmission_chk') THEN
    ALTER TABLE garage_entries ADD CONSTRAINT garage_entries_transmission_chk
      CHECK (transmission IS NULL OR transmission IN ('automatic','manual','cvt','dct','unknown'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'garage_entries_drivetrain_chk') THEN
    ALTER TABLE garage_entries ADD CONSTRAINT garage_entries_drivetrain_chk
      CHECK (drivetrain IS NULL OR drivetrain IN ('fwd','rwd','awd','4wd','2wd','unknown'));
  END IF;

  -- Same-model cars are allowed; remove the one-per-model index if an earlier draft made it.
  DROP INDEX IF EXISTS garage_entries_user_catalog_vehicle_uq;

END
$$;
