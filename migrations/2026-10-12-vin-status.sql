-- ===========================================================================
-- Crankcase Garage -- VIN verification status (NHTSA outage fallback)
-- Created 2026-10-12
--
-- WHAT THIS DOES
--
-- Adds two NULLABLE columns to garage_entries:
--
--   vin_status     'verified' | 'unverified'   (NULL = a row that predates this feature)
--   vin_status_at  when vin_status was last set
--
-- 'unverified' marks a vehicle the customer typed in by hand while the NHTSA VIN
-- decoder was down; Crankcase has not checked those details against NHTSA yet.
-- 'verified' means the SERVER (not the browser) decoded the VIN at NHTSA and the
-- identity matched. NULL rows are left exactly as they are: no backfill, no default,
-- nothing rewritten, nothing relabeled.
--
-- Metadata-only change (no table rewrite). One DO block, one transaction, idempotent.
--
-- HOW TO RUN IT (Neon SQL panel, via Vercel -> Storage -> Query):
--   1. Turn the "Read-only" toggle OFF.
--   2. Paste this whole file and run it once.
--   3. Run 2026-10-12-vin-status-VERIFY.sql, then turn Read-only back ON.
--
-- RUN THIS BEFORE DEPLOYING THE MATCHING CODE. The code selects the new columns; against a
-- database that lacks them the garage page would fail.
--
-- ROLLBACK: 2026-10-12-vin-status-ROLLBACK.sql (roll the code back first). Loses only the
-- verified/unverified flags; vehicles, VINs and history stay.
-- ===========================================================================

DO $$
BEGIN
  ALTER TABLE garage_entries ADD COLUMN IF NOT EXISTS vin_status text;
  ALTER TABLE garage_entries ADD COLUMN IF NOT EXISTS vin_status_at timestamp;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'garage_entries_vin_status_chk') THEN
    ALTER TABLE garage_entries ADD CONSTRAINT garage_entries_vin_status_chk
      CHECK (vin_status IS NULL OR vin_status IN ('verified','unverified'));
  END IF;
END
$$;
