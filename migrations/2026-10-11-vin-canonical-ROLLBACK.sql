-- ROLLBACK for 2026-10-11-vin-canonical.sql
-- Removes only the CHECK. VINs that were upper-cased stay upper case (the app writes that spelling anyway, and the
-- original mixed-case text is not kept). The unique index belongs to the vehicle-configuration migration and is left alone.
-- Roll back the CODE first (the previous code compares upper(vin), which still works on canonical data), then run this.
-- Safe to run twice.
ALTER TABLE garage_entries DROP CONSTRAINT IF EXISTS garage_entries_vin_canonical_chk;
