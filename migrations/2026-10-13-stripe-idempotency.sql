-- 2026-10-13: payment idempotency constraints (ADDITIVE ONLY). NOT APPLIED ANYWHERE. Production application needs separate owner approval.
--
-- What it adds (three partial unique indexes, nothing else; no column, table, trigger or data change):
--   purchases_provider_ref_uq            one purchase row per provider reference (Stripe session id, later the payment intent id)
--   payment_events_provider_ref_uq       one payment_events row per provider event id: a replayed webhook cannot be recorded twice
--   purchases_one_pending_per_user_uq    at most ONE pending purchase per account, so two simultaneous checkouts cannot be quoted
--                                        (and so cannot drift between) price rungs
-- Safe because nothing writes purchases or payment_events today (both are empty; admin/revenue reads zero rows). The guard below
-- aborts the whole migration, changing nothing, if that is ever not true.
-- Indexes carry a COMMENT marker so the ROLLBACK drops only what this script created.

BEGIN;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM purchases WHERE provider IS NOT NULL AND provider_ref IS NOT NULL GROUP BY provider, provider_ref HAVING count(*) > 1) THEN
    RAISE EXCEPTION 'stripe-idempotency: duplicate (provider, provider_ref) in purchases; resolve by hand first';
  END IF;
  IF EXISTS (SELECT 1 FROM payment_events WHERE provider IS NOT NULL AND provider_ref IS NOT NULL GROUP BY provider, provider_ref HAVING count(*) > 1) THEN
    RAISE EXCEPTION 'stripe-idempotency: duplicate (provider, provider_ref) in payment_events; resolve by hand first';
  END IF;
  IF EXISTS (SELECT 1 FROM purchases WHERE status = 'pending' GROUP BY user_id HAVING count(*) > 1) THEN
    RAISE EXCEPTION 'stripe-idempotency: an account has more than one pending purchase; resolve by hand first';
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS purchases_provider_ref_uq
  ON purchases (provider, provider_ref) WHERE provider IS NOT NULL AND provider_ref IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS payment_events_provider_ref_uq
  ON payment_events (provider, provider_ref) WHERE provider IS NOT NULL AND provider_ref IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS purchases_one_pending_per_user_uq
  ON purchases (user_id) WHERE status = 'pending';

COMMENT ON INDEX purchases_provider_ref_uq IS 'created by 2026-10-13-stripe-idempotency.sql';
COMMENT ON INDEX payment_events_provider_ref_uq IS 'created by 2026-10-13-stripe-idempotency.sql';
COMMENT ON INDEX purchases_one_pending_per_user_uq IS 'created by 2026-10-13-stripe-idempotency.sql';

COMMIT;
