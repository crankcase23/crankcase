-- ROLLBACK for 2026-10-12-legacy-unlock-holds.sql. Roll the CODE back first. Safe to run twice.
-- The holds table is the ONLY copy of the unresolved legacy unlocks of customers who have since deleted that car, and of every
-- resolution record. Once this has been live, export it first and keep the export:
--   \copy (SELECT * FROM legacy_unlock_holds) TO 'legacy_unlock_holds_backup.csv' CSV HEADER
-- Dropping the preserve trigger re-opens the cascade-delete loss path for any unlock that is not yet an entitlement.
BEGIN;
DROP TRIGGER IF EXISTS garage_entries_preserve_legacy_unlocks ON garage_entries;
DROP FUNCTION IF EXISTS garage_entries_preserve_legacy_unlocks();
DROP TRIGGER IF EXISTS legacy_unlock_holds_no_change ON legacy_unlock_holds;
DROP TRIGGER IF EXISTS legacy_unlock_holds_no_truncate ON legacy_unlock_holds;
DROP TABLE IF EXISTS legacy_unlock_holds;
DROP FUNCTION IF EXISTS legacy_unlock_holds_guard();
COMMIT;
