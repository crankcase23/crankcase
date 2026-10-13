-- Legacy unlock holds: no historical purchase or gift is ever silently dropped.
-- ADDITIVE and IDEMPOTENT, one transaction. Creates one table and two triggers; changes nothing existing.
-- DRAFT: rehearsed on scratch Postgres only. NOT run against production. Needs owner approval.
--
-- Run order: ... 2026-10-11-vin-entitlements.sql, 2026-10-11-vin-entitlement-events.sql, THEN this file. Re-running it after the
-- code deploy (together with the two before it) picks up unlocks the OLD admin screen wrote during the migration window.
--
-- Problem this solves. vehicle_unlocks (the old admin-gift table) is keyed to the garage row and deleted with it
-- (ON DELETE CASCADE). 2026-10-11-vin-entitlements.sql copies an unlock into vin_entitlements only when its car stores a canonical,
-- check-digit-valid VIN. Every other legacy unlock (car with no VIN, junk VIN, VIN with spaces or dashes, VIN written after the
-- copy) would vanish if the customer deleted that car. Here each of those becomes a HOLD that no car deletion can touch.
--
-- A hold is resolved only by the customer completing the VIN on that car (gifts) or by an admin (anything else, including every
-- paid hold), which turns it into a real vin_entitlements row with the ORIGINAL source and grant time. A hold is never expired,
-- never auto-closed and never deleted. See docs/release/README.md.
BEGIN;

DO $$
BEGIN
  IF to_regprocedure('cc_vin_ok(text)') IS NULL OR to_regclass('vin_entitlements') IS NULL THEN
    RAISE EXCEPTION 'STOPPED, nothing changed: run 2026-10-11-vin-entitlements.sql (which creates cc_vin_ok and vin_entitlements) first.';
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS legacy_unlock_holds (
  id               text PRIMARY KEY,
  user_id          text NOT NULL REFERENCES users(id) ON DELETE CASCADE,   -- only fires on whole-account (privacy) deletion
  garage_entry_id  text NOT NULL,                  -- the old key, kept as plain text on purpose: NO foreign key to garage_entries
  source           text NOT NULL CHECK (source IN ('purchase','gift')),
  granted_at       timestamp NOT NULL,             -- the ORIGINAL grant time
  vehicle_id       text,
  vehicle_label    text,
  vin_at_snapshot  text,                           -- whatever was stored on the car, verbatim (may be junk, empty or NULL)
  status           text NOT NULL DEFAULT 'pending_vin' CHECK (status IN ('pending_vin','converted','waived')),
  resolved_vin     text,
  resolved_at      timestamp,
  resolved_by      text,                           -- 'customer', or the admin's user id
  resolution_note  text,
  created_at       timestamp NOT NULL DEFAULT now(),
  UNIQUE (user_id, garage_entry_id)
);
CREATE INDEX IF NOT EXISTS legacy_unlock_holds_pending_idx ON legacy_unlock_holds (user_id) WHERE status = 'pending_vin';

-- The original facts never change; only the resolution fields can be set, once; no direct delete; no truncate.
CREATE OR REPLACE FUNCTION legacy_unlock_holds_guard() RETURNS trigger AS $f$
BEGIN
  IF TG_OP = 'TRUNCATE' THEN RAISE EXCEPTION 'legacy_unlock_holds cannot be truncated'; END IF;
  IF TG_OP = 'DELETE' THEN
    IF pg_trigger_depth() <= 1 THEN RAISE EXCEPTION 'legacy_unlock_holds rows cannot be deleted'; END IF;  -- depth > 1 = account deletion cascade
    RETURN OLD;
  END IF;
  IF (NEW.id, NEW.user_id, NEW.garage_entry_id, NEW.source, NEW.granted_at, NEW.vehicle_id, NEW.vehicle_label, NEW.vin_at_snapshot, NEW.created_at)
     IS DISTINCT FROM (OLD.id, OLD.user_id, OLD.garage_entry_id, OLD.source, OLD.granted_at, OLD.vehicle_id, OLD.vehicle_label, OLD.vin_at_snapshot, OLD.created_at) THEN
    RAISE EXCEPTION 'legacy_unlock_holds: the original unlock facts cannot be changed';
  END IF;
  IF OLD.status <> 'pending_vin' THEN RAISE EXCEPTION 'legacy_unlock_holds: a resolved hold cannot be reopened or changed'; END IF;
  RETURN NEW;
END $f$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS legacy_unlock_holds_no_change ON legacy_unlock_holds;
CREATE TRIGGER legacy_unlock_holds_no_change BEFORE UPDATE OR DELETE ON legacy_unlock_holds
  FOR EACH ROW EXECUTE FUNCTION legacy_unlock_holds_guard();
DROP TRIGGER IF EXISTS legacy_unlock_holds_no_truncate ON legacy_unlock_holds;
CREATE TRIGGER legacy_unlock_holds_no_truncate BEFORE TRUNCATE ON legacy_unlock_holds
  FOR EACH STATEMENT EXECUTE FUNCTION legacy_unlock_holds_guard();

-- Safety net for the whole migration window and beyond: when a garage car is deleted (by the OLD code or the new), any legacy
-- unlock on it that is not already carried by a vin_entitlements row is copied into a hold first. This is a BEFORE DELETE trigger on
-- garage_entries (not on vehicle_unlocks) because the car's VIN can no longer be read once the cascade is deleting the child row.
-- Depth > 1 means the delete came from deleting the whole account (privacy deletion): nothing is preserved then, by design.
CREATE OR REPLACE FUNCTION garage_entries_preserve_legacy_unlocks() RETURNS trigger AS $f$
BEGIN
  IF pg_trigger_depth() > 1 THEN RETURN OLD; END IF;
  INSERT INTO legacy_unlock_holds (id, user_id, garage_entry_id, source, granted_at, vehicle_id, vehicle_label, vin_at_snapshot)
  SELECT 'hold-' || md5(u.user_id || '|' || u.garage_entry_id), u.user_id, u.garage_entry_id, u.source, u.granted_at,
         OLD.vehicle_id, nullif(btrim(concat_ws(' ', OLD.year, OLD.make, OLD.model)), ''), OLD.vin
  FROM vehicle_unlocks u
  WHERE u.user_id = OLD.user_id AND u.garage_entry_id = OLD.id AND u.source IN ('purchase','gift')
    AND NOT (cc_vin_ok(OLD.vin) AND OLD.vin = upper(regexp_replace(OLD.vin, '[\s\-_.]', '', 'g'))
             AND EXISTS (SELECT 1 FROM vin_entitlements e WHERE e.user_id = OLD.user_id AND e.vin = OLD.vin))
  ON CONFLICT (user_id, garage_entry_id) DO NOTHING;
  RETURN OLD;
END $f$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS garage_entries_preserve_legacy_unlocks ON garage_entries;
CREATE TRIGGER garage_entries_preserve_legacy_unlocks BEFORE DELETE ON garage_entries
  FOR EACH ROW EXECUTE FUNCTION garage_entries_preserve_legacy_unlocks();

-- Snapshot every legacy unlock not carried by an entitlement today. Safe to re-run: existing holds are left exactly as they are.
INSERT INTO legacy_unlock_holds (id, user_id, garage_entry_id, source, granted_at, vehicle_id, vehicle_label, vin_at_snapshot)
SELECT 'hold-' || md5(u.user_id || '|' || u.garage_entry_id), u.user_id, u.garage_entry_id, u.source, u.granted_at,
       g.vehicle_id, nullif(btrim(concat_ws(' ', g.year, g.make, g.model)), ''), g.vin
FROM vehicle_unlocks u
JOIN garage_entries g ON g.id = u.garage_entry_id
WHERE u.source IN ('purchase','gift')
  AND NOT (cc_vin_ok(g.vin) AND g.vin = upper(regexp_replace(g.vin, '[\s\-_.]', '', 'g'))
           AND EXISTS (SELECT 1 FROM vin_entitlements e WHERE e.user_id = u.user_id AND e.vin = g.vin))
ON CONFLICT (user_id, garage_entry_id) DO NOTHING;

COMMIT;
