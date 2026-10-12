-- ===========================================================================
-- Vehicle Configuration V1 -- READ-ONLY verification (SELECTs only; changes nothing)
--
-- Run it TWICE in the Neon SQL panel: once BEFORE the migration, once AFTER.
-- Each line returns check | result | expected_before | expected_after.
-- ===========================================================================
SELECT 'columns present (transmission, drivetrain, config_confirmed_at)' AS check,
       (SELECT count(*)::text FROM information_schema.columns
         WHERE table_name = 'garage_entries'
           AND column_name IN ('transmission','drivetrain','config_confirmed_at')) AS result,
       '0' AS expected_before, '3' AS expected_after
UNION ALL
SELECT 'check constraints present',
       (SELECT count(*)::text FROM pg_constraint
         WHERE conname IN ('garage_entries_transmission_chk','garage_entries_drivetrain_chk')),
       '0', '2'
UNION ALL
SELECT 'one-row-per-model index (must NOT exist: same-model cars are allowed)',
       (SELECT count(*)::text FROM pg_indexes WHERE indexname = 'garage_entries_user_catalog_vehicle_uq'),
       '0', '0'
UNION ALL
SELECT 'duplicate-prevention indexes present',
       (SELECT count(*)::text FROM pg_indexes WHERE indexname IN ('garage_entries_user_vin_uq','garage_entries_user_catalog_novin_uq')),
       '0', '2 (fewer only if a duplicate check below is not 0; the migration prints a NOTICE and skips)'
UNION ALL
SELECT 'duplicate VIN-less catalog rows (customer/vehicle pairs)',
       (SELECT count(*)::text FROM (SELECT 1 FROM garage_entries WHERE kind = 'catalog' AND vin IS NULL
         GROUP BY user_id, vehicle_id HAVING count(*) > 1) d),
       '0 (else resolve by hand first)', '0'
UNION ALL
SELECT 'duplicate VIN rows (customer/VIN pairs)',
       (SELECT count(*)::text FROM (SELECT 1 FROM garage_entries WHERE vin IS NOT NULL
         GROUP BY user_id, vin HAVING count(*) > 1) d),
       '0 (else resolve by hand first)', '0'
UNION ALL
SELECT 'garage_entries total rows (must be identical before and after)',
       (SELECT count(*)::text FROM garage_entries), 'N', 'N (same number)';

-- AFTER the migration only (this errors BEFORE it, which is expected):
-- Every pre-existing vehicle must be untouched: nothing confirmed yet, so every row should be "never asked".
--   SELECT count(*) AS rows_with_a_saved_choice_before_anyone_confirmed
--   FROM garage_entries WHERE transmission IS NOT NULL OR drivetrain IS NOT NULL OR config_confirmed_at IS NOT NULL;
--   expected right after migrating: 0
--
-- Later, to see what customers have confirmed (counts only):
--   SELECT transmission, drivetrain, count(*) FROM garage_entries GROUP BY 1, 2 ORDER BY 3 DESC;
