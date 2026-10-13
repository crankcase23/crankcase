-- READ-ONLY (SELECTs only). Run once BEFORE the migration and once AFTER.
SELECT * FROM (
SELECT '01 database' AS check, current_database() AS result, 'neondb' AS expected
UNION ALL SELECT '02 new columns present', (SELECT count(*)::text FROM information_schema.columns WHERE table_schema='public' AND table_name='garage_entries' AND column_name IN ('vin_status','vin_status_at')), 'before 0 / after 2'
UNION ALL SELECT '03 check constraint present', (SELECT count(*)::text FROM pg_constraint WHERE conname='garage_entries_vin_status_chk'), 'before 0 / after 1'
UNION ALL SELECT '04 garage_entries total', (SELECT count(*)::text FROM garage_entries), 'same before and after'
UNION ALL SELECT '05 rows with a vin_status', (SELECT count(*)::text FROM garage_entries g WHERE to_jsonb(g) ->> 'vin_status' IS NOT NULL), 'before 0 / after 0 (legacy rows untouched)'
UNION ALL SELECT '06 users', (SELECT count(*)::text FROM users), 'same before and after'
UNION ALL SELECT '07 VIN indexes intact', (SELECT count(*)::text FROM pg_indexes WHERE indexname IN ('garage_entries_user_vin_uq','garage_entries_user_catalog_novin_uq')), '2'
) t ORDER BY 1;
