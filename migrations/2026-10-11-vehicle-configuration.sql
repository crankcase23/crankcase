-- ===========================================================================
-- Crankcase Garage -- vehicle configuration (transmission + drivetrain)
-- Created 2026-10-11
--
-- WHAT THIS DOES
--
-- Adds three NULLABLE columns to garage_entries so a customer's confirmed
-- transmission and drivetrain are remembered across logins and devices:
--
--   transmission         'automatic' | 'manual' | 'cvt' | 'dct' | 'unknown'   (NULL = never asked)
--   drivetrain           'fwd' | 'rwd' | 'awd' | '4wd' | '2wd' | 'unknown'    (NULL = never asked)
--   config_confirmed_at  when the customer last saved their choices
--
-- Every existing row keeps working untouched: NULL means "never asked", and the
-- app treats that exactly like "Not sure" until the customer confirms (guide
-- steps that depend on the build stay restricted). No row is rewritten, no
-- data is deleted, nothing is defaulted.
--
-- It also adds two partial UNIQUE indexes that stop duplicate garage rows
-- (one catalog row per vehicle per customer, one row per VIN per customer).
-- Each index is created ONLY if the live table has no duplicates for it yet;
-- if it does, the migration says so with a NOTICE and skips that index (the app
-- still prevents new duplicates in code). It never deletes or merges rows.
--
-- HOW TO RUN IT (Neon SQL panel, via Vercel -> Storage -> Query):
--   1. Turn the "Read-only" toggle OFF.
--   2. Paste this whole file and run it. One DO block, one transaction: if any
--      part fails ALL of it rolls back.
--
-- Safe to run twice (IF NOT EXISTS everywhere).
--
-- RUN THIS BEFORE DEPLOYING THE MATCHING CODE. The code reads and writes the new
-- columns; against a database that lacks them the garage page would fail.
--
-- ROLLBACK: migrations/2026-10-11-vehicle-configuration-ROLLBACK.sql. Rolling back
-- loses ONLY the saved transmission/drivetrain choices; vehicles and history stay.
-- ===========================================================================

DO $$
DECLARE
  dup_catalog integer;
  dup_vin integer;
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

  SELECT count(*) INTO dup_catalog FROM (
    SELECT 1 FROM garage_entries WHERE kind = 'catalog'
    GROUP BY user_id, vehicle_id HAVING count(*) > 1) d;
  IF dup_catalog = 0 THEN
    CREATE UNIQUE INDEX IF NOT EXISTS garage_entries_user_catalog_vehicle_uq
      ON garage_entries (user_id, vehicle_id) WHERE kind = 'catalog';
  ELSE
    RAISE NOTICE 'SKIPPED garage_entries_user_catalog_vehicle_uq: % customer/vehicle pairs already have duplicate catalog rows. Nothing was changed; resolve them by hand, then re-run.', dup_catalog;
  END IF;

  SELECT count(*) INTO dup_vin FROM (
    SELECT 1 FROM garage_entries WHERE vin IS NOT NULL
    GROUP BY user_id, vin HAVING count(*) > 1) d;
  IF dup_vin = 0 THEN
    CREATE UNIQUE INDEX IF NOT EXISTS garage_entries_user_vin_uq
      ON garage_entries (user_id, vin) WHERE vin IS NOT NULL;
  ELSE
    RAISE NOTICE 'SKIPPED garage_entries_user_vin_uq: % customer/VIN pairs already have more than one row. Nothing was changed; resolve them by hand, then re-run.', dup_vin;
  END IF;
END
$$;
