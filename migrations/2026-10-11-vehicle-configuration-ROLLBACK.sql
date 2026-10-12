-- ===========================================================================
-- ROLLBACK for 2026-10-11-vehicle-configuration.sql
--
-- Removes the vehicle-configuration columns, their checks and the duplicate-prevention
-- indexes. Loses ONLY the saved transmission / drivetrain choices
-- (customers would be asked to confirm again). Vehicles, VIN associations,
-- service history and odometer readings are not touched.
--
-- Roll back the CODE first (revert the deploy), THEN run this. Running it while
-- the new code is live would make the garage page error.
-- Safe to run twice.
-- ===========================================================================

DO $$
BEGIN
  DROP INDEX IF EXISTS garage_entries_user_catalog_vehicle_uq;
  DROP INDEX IF EXISTS garage_entries_user_catalog_novin_uq;
  DROP INDEX IF EXISTS garage_entries_user_vin_uq;
  ALTER TABLE garage_entries DROP CONSTRAINT IF EXISTS garage_entries_transmission_chk;
  ALTER TABLE garage_entries DROP CONSTRAINT IF EXISTS garage_entries_drivetrain_chk;
  ALTER TABLE garage_entries DROP COLUMN IF EXISTS transmission;
  ALTER TABLE garage_entries DROP COLUMN IF EXISTS drivetrain;
  ALTER TABLE garage_entries DROP COLUMN IF EXISTS config_confirmed_at;
END
$$;
