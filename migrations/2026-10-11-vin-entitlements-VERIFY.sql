-- READ-ONLY. Before the migration expect table_exists 0. After: table_exists 1, index 1, constraint 1.
-- Legacy unlocks whose car has a canonical, check-digit-valid VIN are copied into vin_entitlements. Every other legacy unlock is NOT copied and NOT lost:
-- it stays in vehicle_unlocks and 2026-10-12-legacy-unlock-holds.sql preserves it. The two counts add up to vehicle_unlocks_rows.
-- The two legacy_* checks need cc_vin_ok(), which exists only AFTER the migration, so they are in the comment block at the bottom.
SELECT 'table_exists' AS check, count(*)::text AS value FROM information_schema.tables WHERE table_name = 'vin_entitlements'
UNION ALL SELECT 'unique_index', count(*)::text FROM pg_indexes WHERE indexname = 'vin_entitlements_user_vin_uq'
UNION ALL SELECT 'source_constraint', count(*)::text FROM pg_constraint WHERE conname = 'vin_entitlements_source_chk'
UNION ALL SELECT 'vehicle_unlocks_rows (must not change)', count(*)::text FROM vehicle_unlocks
UNION ALL SELECT 'garage_entries_rows (must not change)', count(*)::text FROM garage_entries;
-- After the migration only:
-- SELECT count(*) AS entitlements_total FROM vin_entitlements;
-- AFTER the migration only (they error before it, which is expected). The two numbers must add up to vehicle_unlocks_rows:
--   SELECT 'legacy_unlocks_copyable' AS check, count(*) FROM vehicle_unlocks u JOIN garage_entries g ON g.id = u.garage_entry_id WHERE cc_vin_ok(g.vin) AND g.vin = upper(regexp_replace(g.vin, '[\s\-_.]', '', 'g')) AND u.source IN ('purchase','gift')
--   UNION ALL SELECT 'legacy_unlocks_not_copyable (preserved by the holds migration)', count(*) FROM vehicle_unlocks u JOIN garage_entries g ON g.id = u.garage_entry_id WHERE NOT (cc_vin_ok(g.vin) AND g.vin = upper(regexp_replace(g.vin, '[\s\-_.]', '', 'g'))) OR u.source NOT IN ('purchase','gift');
