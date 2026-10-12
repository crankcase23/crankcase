-- Canonical VIN -- READ-ONLY verification (SELECTs only; changes nothing). Run BEFORE and AFTER the migration.
SELECT 'rows whose VIN is not upper case' AS check,
       (SELECT count(*)::text FROM garage_entries WHERE vin IS NOT NULL AND vin <> upper(vin)) AS result,
       'any number' AS expected_before, '0' AS expected_after
UNION ALL
SELECT 'customer/VIN pairs that would collide when upper-cased (MUST be 0 before migrating)',
       (SELECT count(*)::text FROM (SELECT 1 FROM garage_entries WHERE vin IS NOT NULL GROUP BY user_id, upper(vin) HAVING count(*) > 1) d),
       '0', '0'
UNION ALL
SELECT 'canonical CHECK present',
       (SELECT count(*)::text FROM pg_constraint WHERE conname = 'garage_entries_vin_canonical_chk'), '0', '1'
UNION ALL
SELECT 'per-customer unique VIN index present',
       (SELECT count(*)::text FROM pg_indexes WHERE indexname = 'garage_entries_user_vin_uq'), '0 or 1', '1'
UNION ALL
SELECT 'same VIN held by more than one customer (normal and allowed; informational only)',
       (SELECT count(*)::text FROM (SELECT 1 FROM garage_entries WHERE vin IS NOT NULL GROUP BY upper(vin) HAVING count(DISTINCT user_id) > 1) d),
       'any number', 'same number';
-- To list the collisions that block the migration:
--   SELECT user_id, upper(vin) AS vin, count(*) AS rows, array_agg(id) AS row_ids
--   FROM garage_entries WHERE vin IS NOT NULL GROUP BY user_id, upper(vin) HAVING count(*) > 1;
