-- ===========================================================================
-- Crankcase Garage -- Admin Command Center migration  (SINGLE-PASTE VERSION)
--
-- Same migration as 2026-09-18-admin-command-center.sql, wrapped in one
-- DO block so Vercel's Neon Query panel accepts it. That panel runs each
-- submission as a single prepared statement and rejects semicolon-separated
-- statements with "cannot insert multiple commands into a prepared statement"
-- -- but a DO block IS a single statement, so the whole migration goes in
-- one paste.
--
-- Bonus: a DO block runs inside one transaction. If any part fails, the
-- WHOLE thing rolls back and the database is left exactly as it was. There
-- is no half-applied state to untangle.
--
-- BEFORE YOU RUN IT:
--   1. Turn the "Read-only" toggle OFF (top right of the query panel).
--   2. Check the admin_email value on the line marked EDIT THIS below.
--
-- Everything is IF NOT EXISTS, so running it twice is harmless.
-- ===========================================================================

DO $migration$
DECLARE
  -- >>> EDIT THIS if your admin account uses a different email <<<
  admin_email text := 'andym@redlineorigin.com';
  granted_to  text;
BEGIN

  -- -------------------------------------------------------------------------
  -- 1. Login history (from 2026-09-16; may never have been run)
  -- -------------------------------------------------------------------------
  ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login_at timestamp;

  CREATE TABLE IF NOT EXISTS login_events (
    id text PRIMARY KEY,
    user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    logged_in_at timestamp NOT NULL DEFAULT now()
  );

  -- -------------------------------------------------------------------------
  -- 2. users -- account management columns
  -- -------------------------------------------------------------------------
  ALTER TABLE users ADD COLUMN IF NOT EXISTS name text;
  ALTER TABLE users ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active';
  ALTER TABLE users ADD COLUMN IF NOT EXISTS disabled_at timestamp;
  ALTER TABLE users ADD COLUMN IF NOT EXISTS disabled_reason text;

  -- -------------------------------------------------------------------------
  -- 3. Administrative audit trail (append-only)
  -- -------------------------------------------------------------------------
  CREATE TABLE IF NOT EXISTS admin_audit_log (
    id text PRIMARY KEY,
    admin_user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    action text NOT NULL,
    object_type text,
    object_id text,
    summary text,
    metadata jsonb,
    ip text,
    user_agent text,
    created_at timestamp NOT NULL DEFAULT now()
  );
  CREATE INDEX IF NOT EXISTS admin_audit_log_created_at_idx ON admin_audit_log (created_at DESC);
  CREATE INDEX IF NOT EXISTS admin_audit_log_admin_idx ON admin_audit_log (admin_user_id, created_at DESC);

  -- -------------------------------------------------------------------------
  -- 4. Admin roles
  -- -------------------------------------------------------------------------
  CREATE TABLE IF NOT EXISTS admin_roles (
    user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role text NOT NULL,
    granted_by text,
    granted_at timestamp NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, role)
  );

  -- -------------------------------------------------------------------------
  -- 5. First-party event stream (activity feed, analytics, funnel)
  -- -------------------------------------------------------------------------
  CREATE TABLE IF NOT EXISTS app_events (
    id text PRIMARY KEY,
    type text NOT NULL,
    user_id text REFERENCES users(id) ON DELETE SET NULL,
    object_type text,
    object_id text,
    path text,
    metadata jsonb,
    created_at timestamp NOT NULL DEFAULT now()
  );
  CREATE INDEX IF NOT EXISTS app_events_created_at_idx ON app_events (created_at DESC);
  CREATE INDEX IF NOT EXISTS app_events_type_created_at_idx ON app_events (type, created_at DESC);
  CREATE INDEX IF NOT EXISTS app_events_user_idx ON app_events (user_id, created_at DESC);

  -- -------------------------------------------------------------------------
  -- 6. First-party error capture ("glitches") -- no Sentry needed
  -- -------------------------------------------------------------------------
  CREATE TABLE IF NOT EXISTS error_events (
    id text PRIMARY KEY,
    fingerprint text NOT NULL,
    level text NOT NULL DEFAULT 'error',
    source text NOT NULL,
    message text NOT NULL,
    stack text,
    path text,
    user_id text REFERENCES users(id) ON DELETE SET NULL,
    status text NOT NULL DEFAULT 'open',
    metadata jsonb,
    resolved_at timestamp,
    resolved_by text,
    created_at timestamp NOT NULL DEFAULT now()
  );
  CREATE INDEX IF NOT EXISTS error_events_status_created_at_idx ON error_events (status, created_at DESC);
  CREATE INDEX IF NOT EXISTS error_events_fingerprint_idx ON error_events (fingerprint, created_at DESC);

  -- -------------------------------------------------------------------------
  -- 7. Commerce -- SCHEMA ONLY. Nothing writes here until a provider exists.
  -- -------------------------------------------------------------------------
  CREATE TABLE IF NOT EXISTS purchases (
    id text PRIMARY KEY,
    user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    garage_entry_id text REFERENCES garage_entries(id) ON DELETE SET NULL,
    vehicle_id text,
    guide_id text,
    description text,
    amount_cents integer NOT NULL,
    refunded_cents integer NOT NULL DEFAULT 0,
    currency text NOT NULL DEFAULT 'usd',
    status text NOT NULL,
    provider text,
    provider_ref text,
    created_at timestamp NOT NULL DEFAULT now()
  );
  CREATE INDEX IF NOT EXISTS purchases_created_at_idx ON purchases (created_at DESC);

  CREATE TABLE IF NOT EXISTS subscriptions (
    id text PRIMARY KEY,
    user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    plan text NOT NULL,
    status text NOT NULL,
    price_cents integer NOT NULL,
    currency text NOT NULL DEFAULT 'usd',
    interval text NOT NULL DEFAULT 'month',
    provider text,
    provider_ref text,
    current_period_start timestamp,
    current_period_end timestamp,
    cancel_at_period_end boolean NOT NULL DEFAULT false,
    canceled_at timestamp,
    created_at timestamp NOT NULL DEFAULT now()
  );
  CREATE INDEX IF NOT EXISTS subscriptions_status_idx ON subscriptions (status, created_at DESC);

  CREATE TABLE IF NOT EXISTS payment_events (
    id text PRIMARY KEY,
    type text NOT NULL,
    user_id text REFERENCES users(id) ON DELETE SET NULL,
    purchase_id text REFERENCES purchases(id) ON DELETE SET NULL,
    subscription_id text REFERENCES subscriptions(id) ON DELETE SET NULL,
    amount_cents integer,
    currency text NOT NULL DEFAULT 'usd',
    status text,
    message text,
    provider text,
    provider_ref text,
    resolved_at timestamp,
    created_at timestamp NOT NULL DEFAULT now()
  );
  CREATE INDEX IF NOT EXISTS payment_events_type_created_at_idx ON payment_events (type, created_at DESC);

  -- -------------------------------------------------------------------------
  -- 8. Lightweight CMS
  -- -------------------------------------------------------------------------
  CREATE TABLE IF NOT EXISTS content_blocks (
    id text PRIMARY KEY,
    kind text NOT NULL,
    slug text NOT NULL UNIQUE,
    title text NOT NULL,
    excerpt text,
    body text,
    status text NOT NULL DEFAULT 'draft',
    seo_title text,
    seo_description text,
    image_url text,
    target_ref text,
    sort_order integer NOT NULL DEFAULT 0,
    published_at timestamp,
    created_by text,
    updated_by text,
    created_at timestamp NOT NULL DEFAULT now(),
    updated_at timestamp NOT NULL DEFAULT now()
  );
  CREATE INDEX IF NOT EXISTS content_blocks_kind_status_idx ON content_blocks (kind, status, sort_order);

  -- -------------------------------------------------------------------------
  -- 9. Grant the super_admin role
  -- -------------------------------------------------------------------------
  INSERT INTO admin_roles (user_id, role, granted_by)
  SELECT id, 'super_admin', 'migration'
  FROM users
  WHERE email = admin_email
  ON CONFLICT (user_id, role) DO NOTHING;

  SELECT email INTO granted_to FROM users WHERE email = admin_email;

  IF granted_to IS NULL THEN
    RAISE EXCEPTION
      'No account found with email %. Nothing was changed -- the whole migration rolled back. Fix the admin_email value at the top and run it again.',
      admin_email;
  END IF;

  RAISE NOTICE 'Migration complete. super_admin granted to %.', admin_email;

END
$migration$;
