-- ===========================================================================
-- Get the Keys -- append-only entitlement history (vin_entitlement_events)
-- Created 2026-10-11.   DRAFT FOR OWNER REVIEW: do NOT run against production without separate owner approval.
--
-- WHAT THIS DOES
--   1. creates vin_entitlement_events (purchased / gifted / revoked / refunded / reacquired, with actor and reason);
--   2. makes it APPEND-ONLY with triggers: UPDATE and TRUNCATE are always rejected, and a direct DELETE is rejected. The only way rows
--      leave is the owning account being deleted (privacy deletion cascades from users);
--   3. writes one starting event for every entitlement that already exists (reason 'backfilled'), plus a 'revoked' event for
--      rows already revoked, so the log is complete from day one. Idempotent: only entitlements with no events yet.
-- Nothing existing is changed or deleted. Requires migrations/2026-10-11-vin-entitlements.sql to have run first.
--
-- HOW TO RUN (Neon SQL panel): toggle "Read-only" OFF, paste the whole file, run. Single DO block = one transaction.
-- Safe to run twice.
-- ROLLBACK: migrations/2026-10-11-vin-entitlement-events-ROLLBACK.sql (drops this table and trigger only; the
-- entitlements themselves are untouched, but the history of changes is lost, so do not roll back after real purchases).
-- ===========================================================================

DO $$
BEGIN
  CREATE TABLE IF NOT EXISTS vin_entitlement_events (
    id           text PRIMARY KEY,
    user_id      text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    vin          text NOT NULL,
    event_type   text NOT NULL,
    source       text NOT NULL,
    rung         integer,
    price_cents  integer,
    purchase_id  text REFERENCES purchases(id) ON DELETE SET NULL,
    actor_type   text NOT NULL,
    actor_id     text,
    reason       text,
    detail       jsonb,
    created_at   timestamp NOT NULL DEFAULT now()
  );
  CREATE INDEX IF NOT EXISTS vin_entitlement_events_user_vin_idx ON vin_entitlement_events (user_id, vin, created_at);

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'vin_entitlement_events_type_chk') THEN
    ALTER TABLE vin_entitlement_events ADD CONSTRAINT vin_entitlement_events_type_chk
      CHECK (event_type IN ('purchased','gifted','revoked','refunded','reacquired'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'vin_entitlement_events_source_chk') THEN
    ALTER TABLE vin_entitlement_events ADD CONSTRAINT vin_entitlement_events_source_chk CHECK (source IN ('purchase','gift'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'vin_entitlement_events_actor_chk') THEN
    ALTER TABLE vin_entitlement_events ADD CONSTRAINT vin_entitlement_events_actor_chk CHECK (actor_type IN ('system','admin','customer'));
  END IF;

  -- Starting events for entitlements that already exist (copied from the older admin-gift table by the previous migration).
  INSERT INTO vin_entitlement_events (id, user_id, vin, event_type, source, rung, price_cents, purchase_id, actor_type, reason, created_at)
  SELECT 'bf-ev-' || md5(e.id || '|granted'), e.user_id, e.vin,
         CASE e.source WHEN 'gift' THEN 'gifted' ELSE 'purchased' END,
         e.source, e.rung, e.price_cents, e.purchase_id, 'system', 'backfilled from existing entitlement', e.granted_at
  FROM vin_entitlements e
  WHERE NOT EXISTS (SELECT 1 FROM vin_entitlement_events v WHERE v.user_id = e.user_id AND v.vin = e.vin);

  INSERT INTO vin_entitlement_events (id, user_id, vin, event_type, source, rung, price_cents, purchase_id, actor_type, reason, created_at)
  SELECT 'bf-ev-' || md5(e.id || '|revoked'), e.user_id, e.vin, 'revoked', e.source, e.rung, e.price_cents, e.purchase_id,
         'system', 'backfilled from existing entitlement', e.revoked_at
  FROM vin_entitlements e
  WHERE e.revoked_at IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM vin_entitlement_events v WHERE v.id = 'bf-ev-' || md5(e.id || '|revoked'));
END
$$;

-- Append-only. pg_trigger_depth() > 1 means the delete came from the users -> events foreign-key cascade (privacy deletion
-- of the whole account); a delete typed against the table directly runs at depth 1 and is refused.
CREATE OR REPLACE FUNCTION vin_entitlement_events_append_only() RETURNS trigger AS $f$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    RAISE EXCEPTION 'vin_entitlement_events is append-only: rows cannot be changed';
  END IF;
  IF TG_OP = 'TRUNCATE' THEN
    RAISE EXCEPTION 'vin_entitlement_events is append-only: the table cannot be truncated';
  END IF;
  IF TG_OP = 'DELETE' AND pg_trigger_depth() <= 1 THEN
    RAISE EXCEPTION 'vin_entitlement_events is append-only: rows cannot be deleted';
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END
$f$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS vin_entitlement_events_no_update ON vin_entitlement_events;
CREATE TRIGGER vin_entitlement_events_no_update BEFORE UPDATE ON vin_entitlement_events
  FOR EACH ROW EXECUTE FUNCTION vin_entitlement_events_append_only();
DROP TRIGGER IF EXISTS vin_entitlement_events_no_delete ON vin_entitlement_events;
CREATE TRIGGER vin_entitlement_events_no_delete BEFORE DELETE ON vin_entitlement_events
  FOR EACH ROW EXECUTE FUNCTION vin_entitlement_events_append_only();
DROP TRIGGER IF EXISTS vin_entitlement_events_no_truncate ON vin_entitlement_events;
CREATE TRIGGER vin_entitlement_events_no_truncate BEFORE TRUNCATE ON vin_entitlement_events
  FOR EACH STATEMENT EXECUTE FUNCTION vin_entitlement_events_append_only();
