-- PROPOSAL (not in migrations/). Undo of post-deploy-contract.sql ("re-expand"): use ONLY if the new code has been rolled back to the
-- OLD code AFTER the contract step ran, so the old code must be able to add the same VIN twice / a lower-case VIN without a 500.
-- Drops the CHECK and the two unique indexes and re-installs the temporary upper-casing trigger. Deletes no rows. Idempotent.
-- The permanent full rollback files (vin-canonical-ROLLBACK, vehicle-configuration-ROLLBACK) are separate and also safe to run.
DO $$
BEGIN
  DROP INDEX IF EXISTS garage_entries_user_vin_uq;
  DROP INDEX IF EXISTS garage_entries_user_catalog_novin_uq;
  ALTER TABLE garage_entries DROP CONSTRAINT IF EXISTS garage_entries_vin_canonical_chk;
END
$$;
CREATE OR REPLACE FUNCTION garage_entries_canonical_vin() RETURNS trigger AS $f$
BEGIN
  IF NEW.vin IS NOT NULL THEN NEW.vin := upper(NEW.vin); END IF;
  RETURN NEW;
END $f$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS garage_entries_canonical_vin ON garage_entries;
CREATE TRIGGER garage_entries_canonical_vin BEFORE INSERT OR UPDATE OF vin ON garage_entries
  FOR EACH ROW EXECUTE FUNCTION garage_entries_canonical_vin();
