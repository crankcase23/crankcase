-- PROPOSAL (not in migrations/). POST-DEPLOY ("contract") step: run AFTER the new code is live and smoke-tested.
-- Adds the constraints the new code relies on as a backstop. Nothing is deleted or merged.
--   * Any same-customer duplicate rows the OLD code created during the window are NOT touched: the unique index is skipped with a
--     NOTICE that names how many, support merges them by hand (the new code lists them like any other cars), then re-run this file.
--   * The canonical CHECK is safe: the pre-deploy trigger has kept every VIN upper case.
-- An index that ALREADY exists (production got both from the full vehicle-configuration migration) is left alone and NOT marked; an index this
-- file creates is marked with a COMMENT so post-deploy-contract-ROLLBACK.sql removes only what this file added.
-- Idempotent. Locks garage_entries briefly while the indexes build. Ends by dropping the temporary trigger from pre-2 (see bottom).
DO $$
DECLARE
  dup_vin integer;
  dup_novin integer;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'garage_entries_vin_canonical_chk') THEN
    ALTER TABLE garage_entries ADD CONSTRAINT garage_entries_vin_canonical_chk CHECK (vin IS NULL OR vin = upper(vin));
  END IF;

  SELECT count(*) INTO dup_novin FROM (
    SELECT 1 FROM garage_entries WHERE kind = 'catalog' AND vin IS NULL GROUP BY user_id, vehicle_id HAVING count(*) > 1) d;
  IF dup_novin = 0 THEN
    IF to_regclass('garage_entries_user_catalog_novin_uq') IS NULL THEN
      CREATE UNIQUE INDEX garage_entries_user_catalog_novin_uq ON garage_entries (user_id, vehicle_id) WHERE kind = 'catalog' AND vin IS NULL;
      COMMENT ON INDEX garage_entries_user_catalog_novin_uq IS 'created by post-deploy-contract.sql';
    END IF;
  ELSE
    RAISE NOTICE 'SKIPPED garage_entries_user_catalog_novin_uq: % customer/vehicle pairs have more than one VIN-less catalog row. Nothing changed; resolve by hand, then re-run.', dup_novin;
  END IF;

  SELECT count(*) INTO dup_vin FROM (
    SELECT 1 FROM garage_entries WHERE vin IS NOT NULL GROUP BY user_id, vin HAVING count(*) > 1) d;
  IF dup_vin = 0 THEN
    IF to_regclass('garage_entries_user_vin_uq') IS NULL THEN
      CREATE UNIQUE INDEX garage_entries_user_vin_uq ON garage_entries (user_id, vin) WHERE vin IS NOT NULL;
      COMMENT ON INDEX garage_entries_user_vin_uq IS 'created by post-deploy-contract.sql';
    END IF;
  ELSE
    RAISE NOTICE 'SKIPPED garage_entries_user_vin_uq: % customer/VIN pairs have more than one row. Nothing changed; resolve by hand, then re-run.', dup_vin;
  END IF;
END
$$;

-- Remove the temporary upper-casing trigger that pre-2-vin-canonical.sql installed. The CHECK above is the permanent guard and the
-- new code upper-cases every VIN itself. Do this only once NO old-code instance can still be serving (the deploy is fully live).
-- It is dropped only if the CHECK exists, so there is never a moment with neither guard.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'garage_entries_vin_canonical_chk') THEN
    DROP TRIGGER IF EXISTS garage_entries_canonical_vin ON garage_entries;
    DROP FUNCTION IF EXISTS garage_entries_canonical_vin();
  END IF;
END
$$;
