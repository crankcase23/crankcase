-- PROPOSAL (not in migrations/). PRE-DEPLOY half of 2026-10-11-vin-canonical.sql.
-- Instead of the CHECK (which makes the OLD code's lowercase-VIN insert fail with a raw 500), install a trigger that upper-cases the
-- VIN on every insert and update. Old code writing 'abc...' then simply stores 'ABC...': no error, nothing for the customer to see.
-- Still stops (changes nothing) if upper-casing would merge two rows of the same customer. Idempotent; one transaction.
DO $$
DECLARE
  dup integer;
BEGIN
  SELECT count(*) INTO dup FROM (
    SELECT 1 FROM garage_entries WHERE vin IS NOT NULL
    GROUP BY user_id, upper(vin) HAVING count(*) > 1) d;
  IF dup > 0 THEN
    RAISE EXCEPTION 'STOPPED, nothing changed: % customer/VIN pairs would become duplicates when upper-cased. Resolve them by hand, then re-run.', dup;
  END IF;
  UPDATE garage_entries SET vin = upper(vin) WHERE vin IS NOT NULL AND vin <> upper(vin);
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
