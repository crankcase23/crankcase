-- Rolls back 2026-10-13-stripe-idempotency.sql. Drops ONLY an index that still carries this script's COMMENT marker, so an index of
-- the same name created some other way is never removed. Changes no data.
BEGIN;
DO $$
DECLARE n text;
BEGIN
  FOREACH n IN ARRAY ARRAY['purchases_provider_ref_uq','payment_events_provider_ref_uq','purchases_one_pending_per_user_uq'] LOOP
    IF to_regclass(n) IS NOT NULL AND obj_description(to_regclass(n), 'pg_class') = 'created by 2026-10-13-stripe-idempotency.sql' THEN
      EXECUTE format('DROP INDEX %I', n);
    END IF;
  END LOOP;
END $$;
COMMIT;
