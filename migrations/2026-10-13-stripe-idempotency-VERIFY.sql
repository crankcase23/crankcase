-- READ-ONLY. Run before (expect the three duplicate counts 0) and after (expect indexes present = 3) 2026-10-13-stripe-idempotency.sql.
SELECT 'purchases rows' AS check, count(*)::text AS result FROM purchases
UNION ALL SELECT 'payment_events rows', count(*)::text FROM payment_events
UNION ALL SELECT 'duplicate (provider, provider_ref) in purchases (expect 0)', count(*)::text FROM (SELECT 1 FROM purchases WHERE provider IS NOT NULL AND provider_ref IS NOT NULL GROUP BY provider, provider_ref HAVING count(*) > 1) d
UNION ALL SELECT 'duplicate (provider, provider_ref) in payment_events (expect 0)', count(*)::text FROM (SELECT 1 FROM payment_events WHERE provider IS NOT NULL AND provider_ref IS NOT NULL GROUP BY provider, provider_ref HAVING count(*) > 1) d
UNION ALL SELECT 'accounts with more than one pending purchase (expect 0)', count(*)::text FROM (SELECT 1 FROM purchases WHERE status = 'pending' GROUP BY user_id HAVING count(*) > 1) d
UNION ALL SELECT 'idempotency indexes present (expect 3 after the migration, 0 before)', count(*)::text FROM pg_indexes WHERE indexname IN ('purchases_provider_ref_uq','payment_events_provider_ref_uq','purchases_one_pending_per_user_uq');
