-- ===========================================================================
-- Crankcase Garage -- canonical VIN storage
-- Created 2026-10-11.   DRAFT FOR OWNER REVIEW: do NOT run against production without separate owner approval.
--
-- WHAT THIS DOES
--
-- A VIN is stored in one spelling only: upper case. The app already writes it that way (src/lib/vin.ts), but rows from
-- before the VIN-required work may hold what the customer typed. This migration:
--   1. STOPS (changes nothing) if upper-casing would make two rows of the SAME customer identical -- those need a human decision;
--   2. upper-cases garage_entries.vin where it is not already;
--   3. adds a CHECK so the database refuses a non-canonical VIN from now on;
--   4. creates the per-customer unique VIN index if the earlier migration had skipped it for lack of clean data.
-- Nothing is deleted, merged or reassigned. The same VIN under DIFFERENT customers is normal and untouched: a VIN
-- identifies a vehicle, it is not ownership, and each customer's record is private.
--
-- WHY: lookups become plain equality on (user_id, vin), which the unique index serves. The previous upper(vin) comparison
-- could not use an index.
--
-- HOW TO RUN (Neon SQL panel): toggle "Read-only" OFF, paste the whole file, run. One DO block = one transaction; any
-- failure rolls back everything. Safe to run twice.
-- LOCKS: the UPDATE row-locks only rows that change; ADD CONSTRAINT scans the table once under a short ACCESS EXCLUSIVE
-- lock (a 200,000-row table took well under a second on the scratch rehearsal). Run it in a quiet moment anyway.
--
-- ORDER: run migrations/2026-10-11-vehicle-configuration.sql first, THEN this, THEN deploy the matching code.
-- ROLLBACK: migrations/2026-10-11-vin-canonical-ROLLBACK.sql (drops the CHECK only; upper-cased VINs stay upper case,
-- which is the spelling the app writes anyway).
-- ===========================================================================

DO $$
DECLARE
  dup integer;
BEGIN
  SELECT count(*) INTO dup FROM (
    SELECT 1 FROM garage_entries WHERE vin IS NOT NULL
    GROUP BY user_id, upper(vin) HAVING count(*) > 1) d;
  IF dup > 0 THEN
    RAISE EXCEPTION 'STOPPED, nothing changed: % customer/VIN pairs would become duplicates when upper-cased. Resolve them by hand (run the VERIFY file to list them), then re-run.', dup;
  END IF;

  UPDATE garage_entries SET vin = upper(vin) WHERE vin IS NOT NULL AND vin <> upper(vin);

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'garage_entries_vin_canonical_chk') THEN
    ALTER TABLE garage_entries ADD CONSTRAINT garage_entries_vin_canonical_chk
      CHECK (vin IS NULL OR vin = upper(vin));
  END IF;

  CREATE UNIQUE INDEX IF NOT EXISTS garage_entries_user_vin_uq
    ON garage_entries (user_id, vin) WHERE vin IS NOT NULL;
END
$$;
