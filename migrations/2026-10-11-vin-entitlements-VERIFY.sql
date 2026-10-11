-- READ-ONLY. Before the migration expect table_exists 0. After: table_exists 1, index 1, constraint 1.
-- legacy_unlocks_with_vin must be <= entitlements_gift_or_purchase (rows with no usable VIN are skipped, not lost: they stay in vehicle_unlocks).
SELECT 'table_exists' AS check, count(*)::text AS value FROM information_schema.tables WHERE table_name = 'vin_entitlements'
UNION ALL SELECT 'unique_index', count(*)::text FROM pg_indexes WHERE indexname = 'vin_entitlements_user_vin_uq'
UNION ALL SELECT 'source_constraint', count(*)::text FROM pg_constraint WHERE conname = 'vin_entitlements_source_chk'
UNION ALL SELECT 'vehicle_unlocks_rows (must not change)', count(*)::text FROM vehicle_unlocks
UNION ALL SELECT 'legacy_unlocks_with_vin', count(*)::text FROM vehicle_unlocks u JOIN garage_entries g ON g.id = u.garage_entry_id WHERE g.vin IS NOT NULL AND length(upper(g.vin)) = 17
UNION ALL SELECT 'garage_entries_rows (must not change)', count(*)::text FROM garage_entries;
-- After the migration only:
-- SELECT count(*) AS entitlements_total FROM vin_entitlements;
