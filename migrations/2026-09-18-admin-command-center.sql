-- ===========================================================================
-- Crankcase Garage -- Admin Command Center migration
-- Created 2026-09-18
--
-- HOW TO RUN THIS (Neon SQL panel, via Vercel -> Storage -> Query):
--
--   Run ONE numbered statement at a time. The Neon query panel executes each
--   submission as a single prepared statement, so pasting several
--   semicolon-separated statements at once fails with
--   "cannot insert multiple commands into a prepared statement".
--   This is a documented gotcha for this project -- see the build notes.
--
--   RUN THIS BEFORE DEPLOYING THE MATCHING CODE. The app selects these
--   columns/tables by name; deploying first would 500 every page that
--   touches `users`.
--
-- Every statement is idempotent (IF NOT EXISTS), so re-running one that has
-- already been applied is harmless. Statements 1-2 recover the login-history
-- migration from 2026-09-16 in case it was never run.
-- ===========================================================================


-- 1. users.last_login_at  (from the 2026-09-16 admin work; may already exist)
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login_at timestamp;


-- 2. login_events  (from the 2026-09-16 admin work; may already exist)
CREATE TABLE IF NOT EXISTS login_events (
  id text PRIMARY KEY,
  user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  logged_in_at timestamp NOT NULL DEFAULT now()
);


-- 3. users.name -- display name, null for every existing account
ALTER TABLE users ADD COLUMN IF NOT EXISTS name text;


-- 4. users.status -- 'active' | 'disabled'; existing rows default to active
ALTER TABLE users ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active';


-- 5. users.disabled_at
ALTER TABLE users ADD COLUMN IF NOT EXISTS disabled_at timestamp;


-- 6. users.disabled_reason
ALTER TABLE users ADD COLUMN IF NOT EXISTS disabled_reason text;


-- 7. admin_audit_log -- append-only record of every administrative action
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


-- 8. index: audit log is always read newest-first
CREATE INDEX IF NOT EXISTS admin_audit_log_created_at_idx ON admin_audit_log (created_at DESC);


-- 9. index: "show me everything this admin did"
CREATE INDEX IF NOT EXISTS admin_audit_log_admin_idx ON admin_audit_log (admin_user_id, created_at DESC);


-- 10. admin_roles -- what an admin may do once past the users.is_admin gate
CREATE TABLE IF NOT EXISTS admin_roles (
  user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role text NOT NULL,
  granted_by text,
  granted_at timestamp NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, role)
);


-- 11. app_events -- first-party event stream (activity feed, analytics, funnel)
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


-- 12. index: the activity feed and every period filter order by this
CREATE INDEX IF NOT EXISTS app_events_created_at_idx ON app_events (created_at DESC);


-- 13. index: analytics counts group by type within a date window
CREATE INDEX IF NOT EXISTS app_events_type_created_at_idx ON app_events (type, created_at DESC);


-- 14. index: per-user activity timeline on the user detail page
CREATE INDEX IF NOT EXISTS app_events_user_idx ON app_events (user_id, created_at DESC);


-- 15. error_events -- first-party error capture ("glitches"), no Sentry needed
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


-- 16. index: error log is read newest-first, filtered by status
CREATE INDEX IF NOT EXISTS error_events_status_created_at_idx ON error_events (status, created_at DESC);


-- 17. index: grouping recurring errors into one line
CREATE INDEX IF NOT EXISTS error_events_fingerprint_idx ON error_events (fingerprint, created_at DESC);


-- 18. purchases -- SCHEMA ONLY. No checkout exists; stays empty until Stripe.
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


-- 19. index: revenue-over-time charts
CREATE INDEX IF NOT EXISTS purchases_created_at_idx ON purchases (created_at DESC);


-- 20. subscriptions -- SCHEMA ONLY. Stays empty until a plan is sold.
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


-- 21. index: MRR / churn windows
CREATE INDEX IF NOT EXISTS subscriptions_status_idx ON subscriptions (status, created_at DESC);


-- 22. payment_events -- SCHEMA ONLY. Feeds the failed-payment alert later.
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


-- 23. index: unresolved failures surface on the Command Center
CREATE INDEX IF NOT EXISTS payment_events_type_created_at_idx ON payment_events (type, created_at DESC);


-- 24. content_blocks -- lightweight CMS (articles, FAQs, announcements, featured)
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


-- 25. index: the CMS list filters by kind then status
CREATE INDEX IF NOT EXISTS content_blocks_kind_status_idx ON content_blocks (kind, status, sort_order);


-- ===========================================================================
-- 26. FINAL STEP -- grant yourself the top role.
--
-- users.is_admin already gates /admin. admin_roles decides what you can DO
-- in there. An admin with no row is treated as SUPPORT_ADMIN (read-mostly),
-- so run this or you'll lock yourself out of destructive actions.
--
-- Replace the email below if your admin account uses a different one.
-- ===========================================================================
INSERT INTO admin_roles (user_id, role, granted_by)
SELECT id, 'super_admin', 'migration'
FROM users
WHERE email = 'andym@redlineorigin.com'
ON CONFLICT (user_id, role) DO NOTHING;


-- 27. Verify (optional). Should return one row with role = super_admin.
SELECT u.email, r.role, r.granted_at
FROM admin_roles r
JOIN users u ON u.id = r.user_id;
