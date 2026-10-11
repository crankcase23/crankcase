-- Get the Keys PR-A: permanent VIN-linked entitlements.
-- ADDITIVE and IDEMPOTENT: creates one new table and copies existing gift unlocks into it. Changes nothing existing.
-- DRAFT: rehearsed on scratch Postgres only. NOT run against production. Run VERIFY first, then this, then VERIFY again.
-- Run order with the other open work: this needs `purchases` and `users` (already exist) and does not depend on #42/#43 SQL.
DO $$
BEGIN
  CREATE TABLE IF NOT EXISTS vin_entitlements (
    id            text PRIMARY KEY,
    user_id       text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    vin           text NOT NULL,
    source        text NOT NULL,
    rung          integer,
    price_cents   integer,
    purchase_id   text REFERENCES purchases(id) ON DELETE SET NULL,
    granted_at    timestamp NOT NULL DEFAULT now(),
    revoked_at    timestamp
  );
  CREATE UNIQUE INDEX IF NOT EXISTS vin_entitlements_user_vin_uq ON vin_entitlements (user_id, vin);

  -- A VIN-keyed unlock cannot be a bare string of any kind.
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'vin_entitlements_source_chk') THEN
    ALTER TABLE vin_entitlements ADD CONSTRAINT vin_entitlements_source_chk CHECK (source IN ('purchase','gift'));
  END IF;

  -- Existing admin gifts live in vehicle_unlocks, keyed to the garage row (so removing the vehicle deletes them).
  -- Copy the ones whose vehicle has a 17-character VIN. The old table is left exactly as it is.
  INSERT INTO vin_entitlements (id, user_id, vin, source, granted_at)
  SELECT 'bf-' || md5(u.user_id || '|' || upper(g.vin)), u.user_id, upper(g.vin), u.source, u.granted_at
  FROM vehicle_unlocks u
  JOIN garage_entries g ON g.id = u.garage_entry_id
  WHERE g.vin IS NOT NULL AND length(upper(g.vin)) = 17 AND u.source IN ('purchase','gift')
  ON CONFLICT (user_id, vin) DO NOTHING;
END $$;
