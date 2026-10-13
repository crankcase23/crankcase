-- Get the Keys PR-A: permanent VIN-linked entitlements.
-- ADDITIVE and IDEMPOTENT: creates one new table and copies existing gift unlocks into it. Changes nothing existing.
-- DRAFT: rehearsed on scratch Postgres only. NOT run against production. Run VERIFY first, then this, then VERIFY again.
-- Run order: AFTER 2026-10-11-vin-canonical.sql (this refuses to run without it) and BEFORE 2026-10-11-vin-entitlement-events.sql and
-- 2026-10-12-legacy-unlock-holds.sql. Needs `purchases` and `users` (already exist).
--
-- Which legacy unlocks are copied: ONLY those whose car stores a VIN that is already canonical AND passes the check digit
-- (cc_vin_ok below, the same rules as src/lib/vin.ts). Every other legacy unlock is NOT copied here and NOT lost: it is
-- preserved by 2026-10-12-legacy-unlock-holds.sql. (An earlier draft copied any 17-character string, which could create an
-- entitlement keyed to junk that no car could ever match.)
-- VIN check, same rules as src/lib/vin.ts: strip spaces/dashes/underscores/dots, upper-case, 17 chars, no I/O/Q, check digit.
CREATE OR REPLACE FUNCTION cc_vin_ok(raw text) RETURNS boolean AS $f$
DECLARE
  v text := upper(regexp_replace(coalesce(raw, ''), '[\s\-_.]', '', 'g'));
  letters text := 'ABCDEFGHJKLMNPRSTUVWXYZ';
  vals int[] := ARRAY[1,2,3,4,5,6,7,8,1,2,3,4,5,7,9,2,3,4,5,6,7,8,9];
  w int[] := ARRAY[8,7,6,5,4,3,2,10,0,9,8,7,6,5,4,3,2];
  s int := 0; i int; c text; t int; r int; expect text;
BEGIN
  IF length(v) <> 17 THEN RETURN false; END IF;
  FOR i IN 1..17 LOOP
    c := substr(v, i, 1);
    IF c ~ '[0-9]' THEN t := c::int;
    ELSIF strpos(letters, c) > 0 THEN t := vals[strpos(letters, c)];
    ELSE RETURN false; END IF;
    s := s + t * w[i];
  END LOOP;
  r := s % 11;
  expect := CASE WHEN r = 10 THEN 'X' ELSE r::text END;
  RETURN substr(v, 9, 1) = expect;
END $f$ LANGUAGE plpgsql IMMUTABLE;


DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'garage_entries_vin_canonical_chk')
     AND NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'garage_entries_canonical_vin' AND NOT tgisinternal) THEN
    RAISE EXCEPTION 'STOPPED, nothing changed: run 2026-10-11-vin-canonical.sql (or the staged docs/release/old-code-window/pre-2 file) first; stored VINs must be canonical before unlocks are copied.';
  END IF;
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
  -- Copy the ones whose car stores a canonical, check-digit-valid VIN. The old table is left exactly as it is, and every
  -- unlock NOT copied is preserved by 2026-10-12-legacy-unlock-holds.sql.
  INSERT INTO vin_entitlements (id, user_id, vin, source, granted_at)
  SELECT 'bf-' || md5(u.user_id || '|' || upper(g.vin)), u.user_id, upper(g.vin), u.source, u.granted_at
  FROM vehicle_unlocks u
  JOIN garage_entries g ON g.id = u.garage_entry_id
  WHERE cc_vin_ok(g.vin) AND g.vin = upper(regexp_replace(g.vin, '[\s\-_.]', '', 'g')) AND u.source IN ('purchase','gift')
  ON CONFLICT (user_id, vin) DO NOTHING;
END $$;
