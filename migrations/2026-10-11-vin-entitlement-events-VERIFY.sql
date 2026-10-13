-- READ-ONLY. Run before and after 2026-10-11-vin-entitlement-events.sql.
SELECT 'events table exists' AS check, count(*)::text AS result, '0' AS expected_before, '1' AS expected_after
  FROM information_schema.tables WHERE table_name = 'vin_entitlement_events'
UNION ALL SELECT 'append-only triggers present',
  (SELECT count(*)::text FROM pg_trigger WHERE tgname IN ('vin_entitlement_events_no_update','vin_entitlement_events_no_delete','vin_entitlement_events_no_truncate')), '0', '3'
UNION ALL SELECT 'entitlements (must not change)', (SELECT count(*)::text FROM vin_entitlements), 'N', 'N'
UNION ALL SELECT 'legacy purchase-source rows with no price (should be 0: nothing sells yet; review any by hand)',
  (SELECT count(*)::text FROM vin_entitlements WHERE source = 'purchase' AND price_cents IS NULL), '0', '0'
UNION ALL SELECT 'old vehicle_unlocks rows with no canonical, valid VIN (preserved as holds by 2026-10-12-legacy-unlock-holds.sql)',
  (SELECT count(*)::text FROM vehicle_unlocks u JOIN garage_entries g ON g.id = u.garage_entry_id WHERE NOT (cc_vin_ok(g.vin) AND g.vin = upper(regexp_replace(g.vin, '[\s\-_.]', '', 'g')))), 'any', 'same';
-- AFTER the migration only (this errors before it, which is expected). Must return 0:
--   SELECT count(*) AS entitlements_with_no_event FROM vin_entitlements e
--   WHERE NOT EXISTS (SELECT 1 FROM vin_entitlement_events v WHERE v.user_id = e.user_id AND v.vin = e.vin);
