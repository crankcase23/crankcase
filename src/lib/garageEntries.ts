import { and, eq, or } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { db } from "@/db";
import { garageEntries } from "@/db/schema";
import { GarageEntry } from "@/types/garage";
import { normalizeConfig, type AxisChoice, type TransmissionChoice, type DrivetrainChoice } from "@/lib/vehicleConfig";

// Server-side data access for garage entries -- the DB-backed replacement for
// src/lib/garage.ts's old localStorage reads/writes. Kept separate from the
// route handlers so both /api/garage and the service-history/odometer
// routes (which need to resolve a "vehicleId" into a garage entry row) can
// share it.
//
// IMPORTANT id split: a catalog GarageEntry's client-facing `id` is the
// catalog vehicleId (e.g. "2014-jeep-grand-cherokee-3.6l") -- same as the old
// localStorage behavior, so call sites that route by `entry.id` for catalog
// vehicles (AddVehicleClient, GarageClient) don't need to change. But that
// string is NOT safe as a Postgres primary key shared across every user (two
// users adding the same catalog vehicle would collide), so the DB row has
// its own generated `id` and a separate nullable `vehicleId` column -- see
// src/db/schema.ts. A custom GarageEntry's client-facing `id` IS the DB
// row's generated id, since there's no other natural key for it.

type GarageEntryRow = typeof garageEntries.$inferSelect;

function configOf(row: GarageEntryRow) {
  return normalizeConfig({
    transmission: row.transmission,
    drivetrain: row.drivetrain,
    confirmedAt: row.configConfirmedAt ? row.configConfirmedAt.toISOString() : null,
  });
}

function mapRow(row: GarageEntryRow): GarageEntry {
  if (row.kind === "custom") {
    return {
      id: row.id,
      kind: "custom",
      addedAt: row.createdAt.toISOString(),
      config: configOf(row),
      custom: {
        vin: row.vin ?? undefined,
        year: row.year ?? undefined,
        make: row.make ?? undefined,
        model: row.model ?? undefined,
        trim: row.trim ?? undefined,
        engine: row.engine ?? undefined,
      },
    };
  }
  return {
    id: row.vehicleId ?? row.id,
    kind: "catalog",
    addedAt: row.createdAt.toISOString(),
    vin: row.vin ?? undefined,
    config: configOf(row),
  };
}

/** What the customer chose on the Confirm Your Ride screen: every axis explicit, "unknown" meaning Not sure. */
export interface ConfigInput {
  transmission: TransmissionChoice;
  drivetrain: DrivetrainChoice;
}

/** What an add did, so the caller can tell the customer the truth about an existing vehicle. */
export interface AddResult {
  entry: GarageEntry;
  /** false when the vehicle was already in the garage (nothing was duplicated). */
  created: boolean;
  /** true when the vehicle already had confirmed choices that differ from the ones just sent; the saved ones were kept. */
  configKept: boolean;
}

// An add NEVER overwrites a choice the customer already made: an axis that is already set (including "unknown") is left
// alone, and only an axis that was never asked is filled in. Changing a saved choice is a separate, explicit action
// (updateGarageConfig, the Edit Configuration form). This is what makes "a later VIN lookup never overwrites a confirmed
// configuration" true by construction: nothing in the lookup path calls updateGarageConfig.
function fillBlankAxes(row: GarageEntryRow, config: ConfigInput) {
  const set: Partial<typeof garageEntries.$inferInsert> = {};
  if (row.transmission == null) set.transmission = config.transmission;
  if (row.drivetrain == null) set.drivetrain = config.drivetrain;
  if (Object.keys(set).length) set.configConfirmedAt = new Date();
  const differs =
    (row.transmission != null && row.transmission !== config.transmission) ||
    (row.drivetrain != null && row.drivetrain !== config.drivetrain);
  return { set, differs };
}

const UNIQUE_VIOLATION = "23505";
const isUniqueViolation = (e: unknown) => {
  const err = e as { code?: string; cause?: { code?: string } };
  return err?.code === UNIQUE_VIOLATION || err?.cause?.code === UNIQUE_VIOLATION;
};

export async function listGarageEntries(userId: string): Promise<GarageEntry[]> {
  const rows = await db
  .select()
  .from(garageEntries)
  .where(eq(garageEntries.userId, userId));
  return rows.map(mapRow);
}

// Idempotent -- matches the old client-side "already in garage? skip" check, but enforced server-side too (and by a
// unique index where the database has one). `vin` is optional and set only when this catalog match came from a VIN
// decode -- lets a future audit see which real-world VIN a catalog match was derived from. If the row already exists
// without a vin and we're now given one (e.g. the same person re-decodes the same VIN later), backfill it rather than
// leaving the gap. The customer's configuration is saved with the add (see fillBlankAxes for what an existing row keeps).
export async function addCatalogEntry(
  userId: string,
  vehicleId: string,
  vin: string | undefined,
  config: ConfigInput,
  ): Promise<AddResult> {
  const find = () =>
    db
    .select()
    .from(garageEntries)
    .where(
      and(
        eq(garageEntries.userId, userId),
        eq(garageEntries.kind, "catalog"),
        eq(garageEntries.vehicleId, vehicleId),
        ),
      )
    .limit(1);

  const existing = (await find())[0];
  if (existing) return updateExisting(existing, vin, config);

  // A VIN already on one of this customer's other rows must not be attached twice (unique per customer).
  const vinTaken = vin
    ? (await db.select({ id: garageEntries.id }).from(garageEntries).where(and(eq(garageEntries.userId, userId), eq(garageEntries.vin, vin))).limit(1))[0]
    : undefined;

  try {
    const [created] = await db
    .insert(garageEntries)
    .values({
      id: randomUUID(),
      userId,
      kind: "catalog",
      vehicleId,
      vin: vinTaken ? undefined : vin,
      transmission: config.transmission,
      drivetrain: config.drivetrain,
      configConfirmedAt: new Date(),
    })
    .returning();
    return { entry: mapRow(created), created: true, configKept: false };
  } catch (e) {
    // Two requests raced; the unique index let one win. Return the winner rather than failing the customer.
    if (!isUniqueViolation(e)) throw e;
    const winner = (await find())[0];
    if (!winner) throw e;
    return updateExisting(winner, vin, config);
  }
}

async function updateExisting(existing: GarageEntryRow, vin: string | undefined, config: ConfigInput): Promise<AddResult> {
  const { set, differs } = fillBlankAxes(existing, config);
  if (vin && !existing.vin) {
    const taken = (await db.select({ id: garageEntries.id }).from(garageEntries).where(and(eq(garageEntries.userId, existing.userId), eq(garageEntries.vin, vin))).limit(1))[0];
    if (!taken) set.vin = vin;
  }
  if (Object.keys(set).length === 0) return { entry: mapRow(existing), created: false, configKept: differs };
  const [updated] = await db.update(garageEntries).set(set).where(eq(garageEntries.id, existing.id)).returning();
  return { entry: mapRow(updated), created: false, configKept: differs };
}

export async function addCustomEntry(
  userId: string,
  custom: { vin?: string; year?: string; make?: string; model?: string; trim?: string; engine?: string },
  config: ConfigInput,
  ): Promise<AddResult> {
  // The same VIN twice is the same vehicle: return the one already in the garage.
  if (custom.vin) {
    const dup = (await db.select().from(garageEntries).where(and(eq(garageEntries.userId, userId), eq(garageEntries.vin, custom.vin))).limit(1))[0];
    if (dup) return updateExisting(dup, undefined, config);
  }
  try {
    const [created] = await db
    .insert(garageEntries)
    .values({
      id: randomUUID(),
      userId,
      kind: "custom",
      vin: custom.vin,
      year: custom.year,
      make: custom.make,
      model: custom.model,
      trim: custom.trim,
      engine: custom.engine,
      transmission: config.transmission,
      drivetrain: config.drivetrain,
      configConfirmedAt: new Date(),
    })
    .returning();
    return { entry: mapRow(created), created: true, configKept: false };
  } catch (e) {
    if (!isUniqueViolation(e) || !custom.vin) throw e;
    const dup = (await db.select().from(garageEntries).where(and(eq(garageEntries.userId, userId), eq(garageEntries.vin, custom.vin))).limit(1))[0];
    if (!dup) throw e;
    return updateExisting(dup, undefined, config);
  }
}

/**
 * The explicit Edit Configuration path: the ONLY code that changes a saved choice. Updates only the axes given, leaves
 * everything else on the row (VIN, vehicle, history) alone, and returns the updated entry, or null when the entry is not
 * this customer's. `id` is the client-facing id (catalog vehicleId or custom row id), like removeGarageEntry.
 */
export async function updateGarageConfig(
  userId: string,
  id: string,
  change: { transmission?: AxisChoice; drivetrain?: AxisChoice },
  ): Promise<GarageEntry | null> {
  const set: Partial<typeof garageEntries.$inferInsert> = {};
  if (change.transmission !== undefined) set.transmission = change.transmission;
  if (change.drivetrain !== undefined) set.drivetrain = change.drivetrain;
  if (Object.keys(set).length === 0) return null;
  set.configConfirmedAt = new Date();
  const rows = await db
  .update(garageEntries)
  .set(set)
  .where(and(eq(garageEntries.userId, userId), or(eq(garageEntries.id, id), eq(garageEntries.vehicleId, id))))
  .returning();
  return rows[0] ? mapRow(rows[0]) : null;
}

// `id` here is the client-facing id -- either a catalog vehicleId or a
// custom entry's row id (see the note above) -- so match on either column.
export async function removeGarageEntry(userId: string, id: string): Promise<void> {
  await db
  .delete(garageEntries)
  .where(
    and(
      eq(garageEntries.userId, userId),
      or(eq(garageEntries.id, id), eq(garageEntries.vehicleId, id)),
      ),
    );
}

// Service history and odometer are keyed by the same "vehicleId" concept the
// old localStorage hooks used -- a catalog vehicleId or a custom entry's id.
// Both need an actual garage_entries.id to hang their foreign key off of.
// `create: true` (no remaining callers; VIN-required garage) auto-provisions a catalog row on first touch, which was
// the old behavior where you could log service history for a catalog
// vehicle you'd never explicitly "added" (it was just a localStorage key).
export async function resolveGarageEntryId(
  userId: string,
  vehicleId: string,
  opts: { create: boolean },
  ): Promise<string | null> {
  const rows = await db
  .select({ id: garageEntries.id })
  .from(garageEntries)
  .where(
    and(
      eq(garageEntries.userId, userId),
      or(eq(garageEntries.id, vehicleId), eq(garageEntries.vehicleId, vehicleId)),
      ),
    )
  .limit(1);
  if (rows[0]) return rows[0].id;
  if (!opts.create) return null;

const [created] = await db
  .insert(garageEntries)
  .values({ id: randomUUID(), userId, kind: "catalog", vehicleId })
  .returning({ id: garageEntries.id });
  return created.id;
}
