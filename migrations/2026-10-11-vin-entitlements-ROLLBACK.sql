-- Removes the new table only. Loses any entitlements recorded in it (after a real launch that would be paid access:
-- do NOT run this once purchases exist; restore from a Neon restore point instead). Before launch it is lossless:
-- gifts are still in vehicle_unlocks, untouched by the migration.
DROP TABLE IF EXISTS vin_entitlements;
