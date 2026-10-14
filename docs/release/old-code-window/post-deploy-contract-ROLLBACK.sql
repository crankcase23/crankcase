-- PROPOSAL (not in migrations/). Undo of post-deploy-contract.sql ("re-expand"): use ONLY if the new code has been rolled back to the
-- OLD code AFTER the contract step ran, so the old code must be able to add the same VIN twice / a lower-case VIN without a 500.
-- Undoes ONLY what post-deploy-contract.sql itself did (it marks its own work with COMMENTs), so the database returns to exactly the state it
-- had before the contract and nothing that pre-existed is touched:
--   * drops the CHECK only if the contract created it (production's CHECK came from M2 and is left alone);
--   * drops an index only if the contract created it (production's two indexes came from M1 and are left alone);
--   * re-installs the temporary upper-casing trigger only if the contract dropped it (production never had it, so none is added).
-- Deletes no rows. Idempotent. Run when the contract never ran: changes nothing.
-- The permanent full rollback files (vin-canonical-ROLLBACK, vehicle-configuration-ROLLBACK) are separate and also safe to run.
DO $$
BEGIN
  IF to_regclass('garage_entries_user_vin_uq') IS NOT NULL
     AND obj_description(to_regclass('garage_entries_user_vin_uq'), 'pg_class') = 'created by post-deploy-contract.sql' THEN
    DROP INDEX garage_entries_user_vin_uq;
  END IF;
  IF to_regclass('garage_entries_user_catalog_novin_uq') IS NOT NULL
     AND obj_description(to_regclass('garage_entries_user_catalog_novin_uq'), 'pg_class') = 'created by post-deploy-contract.sql' THEN
    DROP INDEX garage_entries_user_catalog_novin_uq;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'garage_entries_vin_canonical_chk' AND conrelid = 'garage_entries'::regclass
             AND obj_description(oid, 'pg_constraint') = 'created by post-deploy-contract.sql') THEN
    ALTER TABLE garage_entries DROP CONSTRAINT garage_entries_vin_canonical_chk;
  END IF;
  IF obj_description('garage_entries'::regclass, 'pg_class') = 'post-deploy-contract.sql dropped temporary trigger garage_entries_canonical_vin' THEN
    CREATE OR REPLACE FUNCTION garage_entries_canonical_vin() RETURNS trigger AS $f$
    BEGIN
      IF NEW.vin IS NOT NULL THEN NEW.vin := upper(NEW.vin); END IF;
      RETURN NEW;
    END $f$ LANGUAGE plpgsql;
    DROP TRIGGER IF EXISTS garage_entries_canonical_vin ON garage_entries;
    CREATE TRIGGER garage_entries_canonical_vin BEFORE INSERT OR UPDATE OF vin ON garage_entries
      FOR EACH ROW EXECUTE FUNCTION garage_entries_canonical_vin();
    COMMENT ON TABLE garage_entries IS NULL;
  END IF;
END
$$;
