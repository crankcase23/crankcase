-- ROLLBACK for 2026-10-11-vin-entitlement-events.sql
-- Drops the history table and its trigger/function. vin_entitlements itself is not touched. Once real purchases exist this
-- loses the audit trail: restore from a Neon restore point instead. Roll the CODE back first. Safe to run twice.
DROP TRIGGER IF EXISTS vin_entitlement_events_no_update ON vin_entitlement_events;
DROP TRIGGER IF EXISTS vin_entitlement_events_no_delete ON vin_entitlement_events;
DROP TRIGGER IF EXISTS vin_entitlement_events_no_truncate ON vin_entitlement_events;
DROP TABLE IF EXISTS vin_entitlement_events;
DROP FUNCTION IF EXISTS vin_entitlement_events_append_only();
