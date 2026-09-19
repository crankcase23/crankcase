-- ===========================================================================
-- Crankcase Garage -- To-Do tab + user feedback  (SINGLE-PASTE)
--
-- Same shape as the command-center migration: everything is wrapped in one
-- DO block, so Vercel's Neon Query panel accepts it in a single paste (that
-- panel rejects semicolon-separated statements), and the whole thing runs in
-- one transaction -- if any part fails, ALL of it rolls back.
--
-- BEFORE YOU RUN IT:
--   1. Turn the "Read-only" toggle OFF (top right of the query panel).
--   2. That's it. Nothing in here needs editing.
--
-- Everything is IF NOT EXISTS, so running it twice is harmless.
-- ===========================================================================

DO $todo$
BEGIN

  -- -------------------------------------------------------------------------
  -- feedback -- user-submitted reports from the widget on guide/vehicle pages
  -- -------------------------------------------------------------------------
  CREATE TABLE IF NOT EXISTS feedback (
    id text PRIMARY KEY,
    user_id text REFERENCES users(id) ON DELETE SET NULL,
    kind text NOT NULL DEFAULT 'other',
    message text NOT NULL,
    path text,
    vehicle_id text,
    guide_id text,
    status text NOT NULL DEFAULT 'new',
    severity text,
    admin_note text,
    resolved_by text,
    resolved_at timestamp,
    user_agent text,
    created_at timestamp NOT NULL DEFAULT now()
  );

  -- The inbox reads newest-first filtered by status; these two cover it.
  CREATE INDEX IF NOT EXISTS feedback_status_created_at_idx ON feedback (status, created_at DESC);
  CREATE INDEX IF NOT EXISTS feedback_created_at_idx ON feedback (created_at DESC);
  -- "show me everything reported against this guide"
  CREATE INDEX IF NOT EXISTS feedback_guide_idx ON feedback (guide_id, created_at DESC);

  -- -------------------------------------------------------------------------
  -- admin_tasks -- the manual half of the To-Do page
  -- -------------------------------------------------------------------------
  CREATE TABLE IF NOT EXISTS admin_tasks (
    id text PRIMARY KEY,
    title text NOT NULL,
    detail text,
    category text NOT NULL DEFAULT 'product',
    status text NOT NULL DEFAULT 'open',
    priority integer NOT NULL DEFAULT 100,
    created_by text,
    completed_by text,
    completed_at timestamp,
    created_at timestamp NOT NULL DEFAULT now(),
    updated_at timestamp NOT NULL DEFAULT now()
  );

  CREATE INDEX IF NOT EXISTS admin_tasks_status_priority_idx ON admin_tasks (status, priority, created_at);

  RAISE NOTICE 'To-Do migration complete: feedback + admin_tasks ready.';

END
$todo$;
