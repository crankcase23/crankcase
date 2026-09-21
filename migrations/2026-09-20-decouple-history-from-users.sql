-- ===========================================================================
-- Crankcase Garage -- decouple maintenance history from user accounts
-- Created 2026-09-20                                    (phase 1 of 5)
--
-- WHAT THIS FIXES
--
-- Today, service_entries.user_id and odometer_readings.user_id are NOT NULL
-- with ON DELETE CASCADE. That means deleting a user account also deletes
-- every service record and odometer reading they ever logged. Someone closes
-- their account and years of maintenance history on a vehicle goes with it,
-- irreversibly, as a side effect of a button that says nothing about history.
--
-- After this migration both columns are NULLABLE with ON DELETE SET NULL.
-- Deleting an account drops the link to the person and keeps the record of
-- the work.
--
-- WHAT THIS DELIBERATELY DOES NOT TOUCH
--
-- garage_entry_id on both tables stays NOT NULL with ON DELETE CASCADE. A
-- deleted VEHICLE *should* still take its own history with it -- that is an
-- owner throwing a record away on purpose, not an account vanishing out from
-- under it. Do not "fix" that one to match; the asymmetry is the design.
--
-- HOW TO RUN IT (Neon SQL panel, via Vercel -> Storage -> Query):
--
--   1. Turn the "Read-only" toggle OFF (top right of the query panel).
--   2. Paste this whole file and run it. It is one DO block, which that
--      panel accepts as a single statement, and it runs in one transaction --
--      if any part fails, ALL of it rolls back and nothing is half-applied.
--
-- Safe to run twice. Dropping a NOT NULL that is already gone is a no-op,
-- and the foreign keys are looked up and re-created by whatever name they
-- currently carry.
--
-- RUN THIS BEFORE DEPLOYING THE MATCHING CODE. The app is being changed to
-- stop trusting user_id for authorization; running the migration first is
-- the safe order, and the code works against either shape.
--
-- IF IT FAILS with "column is in a primary key" on odometer_readings, stop
-- and say so -- that would mean the live table has a composite primary key
-- that src/db/schema.ts does not describe, and the right fix is a different
-- migration, not a workaround. Nothing will have been applied.
-- ===========================================================================

DO $decouple$
DECLARE
  fk_name text;
BEGIN

  -- -------------------------------------------------------------------------
  -- service_entries.user_id : NOT NULL/CASCADE -> NULLABLE/SET NULL
  -- -------------------------------------------------------------------------
  ALTER TABLE service_entries ALTER COLUMN user_id DROP NOT NULL;

  -- Look the constraint up rather than assuming Drizzle's generated name, so
  -- this works whatever the table was actually created with.
  SELECT con.conname
    INTO fk_name
    FROM pg_constraint con
    JOIN pg_class rel ON rel.oid = con.conrelid
    JOIN pg_attribute att
      ON att.attrelid = con.conrelid
     AND att.attnum = con.conkey[1]
   WHERE rel.relname = 'service_entries'
     AND con.contype = 'f'
     AND att.attname = 'user_id'
     AND array_length(con.conkey, 1) = 1
   LIMIT 1;

  IF fk_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE service_entries DROP CONSTRAINT %I', fk_name);
  END IF;

  ALTER TABLE service_entries
    ADD CONSTRAINT service_entries_user_id_users_id_fk
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL;

  -- -------------------------------------------------------------------------
  -- odometer_readings.user_id : NOT NULL/CASCADE -> NULLABLE/SET NULL
  -- -------------------------------------------------------------------------
  ALTER TABLE odometer_readings ALTER COLUMN user_id DROP NOT NULL;

  fk_name := NULL;

  SELECT con.conname
    INTO fk_name
    FROM pg_constraint con
    JOIN pg_class rel ON rel.oid = con.conrelid
    JOIN pg_attribute att
      ON att.attrelid = con.conrelid
     AND att.attnum = con.conkey[1]
   WHERE rel.relname = 'odometer_readings'
     AND con.contype = 'f'
     AND att.attname = 'user_id'
     AND array_length(con.conkey, 1) = 1
   LIMIT 1;

  IF fk_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE odometer_readings DROP CONSTRAINT %I', fk_name);
  END IF;

  ALTER TABLE odometer_readings
    ADD CONSTRAINT odometer_readings_user_id_users_id_fk
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL;

  RAISE NOTICE 'Maintenance history is decoupled: deleting an account no longer deletes service entries or odometer readings.';

END
$decouple$;

-- ===========================================================================
-- To confirm afterwards -- both rows should read is_nullable = YES and
-- delete_rule = SET NULL:
--
--   SELECT c.table_name, c.column_name, c.is_nullable, rc.delete_rule
--     FROM information_schema.columns c
--     JOIN information_schema.key_column_usage kcu
--       ON kcu.table_name = c.table_name AND kcu.column_name = c.column_name
--     JOIN information_schema.referential_constraints rc
--       ON rc.constraint_name = kcu.constraint_name
--    WHERE c.table_name IN ('service_entries', 'odometer_readings')
--      AND c.column_name = 'user_id';
-- ===========================================================================
