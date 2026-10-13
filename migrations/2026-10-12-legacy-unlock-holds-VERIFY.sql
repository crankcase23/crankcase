-- READ-ONLY. Run before and after 2026-10-12-legacy-unlock-holds.sql (the holds table does not exist before it, so run the
-- "AFTER" block only afterwards).
-- The one number that matters: "unaccounted" MUST be 0 after the migration. It counts legacy purchase/gift unlocks that are neither
-- carried by an entitlement for a canonical valid VIN nor preserved as a hold.
SELECT 'legacy unlock rows (vehicle_unlocks; must not change)' AS check, count(*)::text AS result FROM vehicle_unlocks
UNION ALL SELECT 'legacy unlocks with a source other than purchase/gift (migrations ignore these: review by hand; expect 0)', count(*)::text FROM vehicle_unlocks WHERE source NOT IN ('purchase','gift')
UNION ALL SELECT 'legacy unlocks whose car row is missing (cannot exist: foreign key)', count(*)::text FROM vehicle_unlocks u WHERE NOT EXISTS (SELECT 1 FROM garage_entries g WHERE g.id = u.garage_entry_id);
-- AFTER the migration only (errors before it, which is expected):
--   SELECT 'holds' AS check, count(*)::text AS result FROM legacy_unlock_holds
--   UNION ALL SELECT 'holds waiting for a VIN', count(*)::text FROM legacy_unlock_holds WHERE status = 'pending_vin'
--   UNION ALL SELECT 'holds that are PAID (source=purchase): owner review, expect 0', count(*)::text FROM legacy_unlock_holds WHERE source = 'purchase'
--   UNION ALL SELECT 'pending holds whose stored VIN is already valid and canonical (admin can convert these without the customer)', count(*)::text
--     FROM legacy_unlock_holds WHERE status = 'pending_vin' AND cc_vin_ok(vin_at_snapshot) AND vin_at_snapshot = upper(regexp_replace(vin_at_snapshot, '[\s\-_.]', '', 'g'))
--   UNION ALL SELECT 'triggers present (expect 3: no_change, no_truncate, preserve)', count(*)::text FROM pg_trigger
--     WHERE tgname IN ('legacy_unlock_holds_no_change','legacy_unlock_holds_no_truncate','garage_entries_preserve_legacy_unlocks')
--   UNION ALL SELECT 'unaccounted (MUST be 0)', count(*)::text FROM vehicle_unlocks u JOIN garage_entries g ON g.id = u.garage_entry_id
--     WHERE u.source IN ('purchase','gift')
--       AND NOT EXISTS (SELECT 1 FROM legacy_unlock_holds h WHERE h.user_id = u.user_id AND h.garage_entry_id = u.garage_entry_id)
--       AND NOT (cc_vin_ok(g.vin) AND g.vin = upper(regexp_replace(g.vin, '[\s\-_.]', '', 'g'))
--                AND EXISTS (SELECT 1 FROM vin_entitlements e WHERE e.user_id = u.user_id AND e.vin = g.vin));
