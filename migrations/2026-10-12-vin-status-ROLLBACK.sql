-- ROLLBACK for 2026-10-12-vin-status.sql. Loses ONLY the verified/unverified flags.
-- Roll the CODE back (or leave VIN_FALLBACK_ENABLED off AND revert the deploy) BEFORE running this:
-- the new code selects these columns. Safe to run twice.
DO $$
BEGIN
  ALTER TABLE garage_entries DROP CONSTRAINT IF EXISTS garage_entries_vin_status_chk;
  ALTER TABLE garage_entries DROP COLUMN IF EXISTS vin_status;
  ALTER TABLE garage_entries DROP COLUMN IF EXISTS vin_status_at;
END
$$;
