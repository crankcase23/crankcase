import { and, asc, eq, isNull, or } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { db } from "@/db";
import { garageEntries } from "@/db/schema";
import { GarageEntry } from "@/types/garage";
import { catalogIdOf, composeGarageId, rowIdOf } from "@/lib/garageId";
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

/** `isOldest`: this is the customer's oldest row for its catalog vehicle, so it keeps the plain legacy id (see garageId.ts). */
function mapRow(row: GarageEntryRow, isOldest = true): GarageEntry {
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
    id: row.vehicleId ? (isOldest ? row.vehicleId : composeGarageId(row.vehicleId, row.id)) : row.id,
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
  .where(eq(garageEntries.userId, userId))
  .orderBy(asc(garageEntries.createdAt), asc(garageEntries.id));
  const seen = new Set<string>();
  return rows.map((row) => {
    if (row.kind !== "catalog" || !row.vehicleId) return mapRow(row);
    const first = !seen.has(row.vehicleId);
    seen.add(row.vehicleId);
    return mapRow(row, first);
  });
}

/** Map one row to its client entry, working out whether it is the customer's oldest car of that model. */
async function entryFor(row: GarageEntryRow): Promise<GarageEntry> {
  if (row.kind !== "catalog" || !row.vehicleId) return mapRow(row);
  const oldest = (
    await db
      .select({ id: garageEntries.id })
      .from(garageEntries)
      .where(and(eq(garageEntries.userId, row.userId), eq(garageEntries.kind, "catalog"), eq(garageEntries.vehicleId, row.vehicleId)))
      .orderBy(asc(garageEntries.createdAt), asc(garageEntries.id))
      .limit(1)
  )[0];
  return mapRow(row, !oldest || oldest.id === row.id);
}

/**
 * The customer's own row for a client-facing garage id, or null. A plain id means "the oldest row with this catalog
 * vehicleId, or the row with this id" (every id that existed before same-model cars); "<catalogId>~<rowId>" names one
 * specific additional car. Always scoped to the customer: another customer's row is never returned.
 */
export async function findOwnRow(userId: string, id: string): Promise<GarageEntryRow | null> {
  const rowId = rowIdOf(id);
  if (rowId) {
    const hit = await db
      .select()
      .from(garageEntries)
      .where(and(eq(garageEntries.userId, userId), eq(garageEntries.id, rowId), eq(garageEntries.kind, "catalog"), eq(garageEntries.vehicleId, catalogIdOf(id))))
      .limit(1);
    return hit[0] ?? null;
  }
  const hit = await db
    .select()
    .from(garageEntries)
    .where(and(eq(garageEntries.userId, userId), or(eq(garageEntries.id, id), eq(garageEntries.vehicleId, id))))
    .orderBy(asc(garageEntries.createdAt), asc(garageEntries.id))
    .limit(1);
  return hit[0] ?? null;
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
  try {
    return await addCatalogOnce(userId, vehicleId, vin, config);
  } catch (e) {
    // Another request completed the same record at the same moment; decide again from the fresh state.
    if (!(e instanceof VinRace)) throw e;
    return addCatalogOnce(userId, vehicleId, vin, config);
  }
}

async function addCatalogOnce(
  userId: string,
  vehicleId: string,
  vin: string | undefined,
  config: ConfigInput,
  ): Promise<AddResult> {
  const rowsOfModel = () =>
    db
    .select()
    .from(garageEntries)
    .where(and(eq(garageEntries.userId, userId), eq(garageEntries.kind, "catalog"), eq(garageEntries.vehicleId, vehicleId)))
    .orderBy(asc(garageEntries.createdAt), asc(garageEntries.id));
  const rowForVin = async (v: string) =>
    (await db.select().from(garageEntries).where(and(eq(garageEntries.userId, userId), eq(garageEntries.vin, v))).limit(1))[0];

  // Customers may own any number of cars, including several of the same year/make/model. The VIN is what tells two
  // cars apart:
  //  - this VIN is already in the garage: it is the same car, return it (nothing duplicated);
  //  - a new VIN and an older record of this model that has no VIN yet: the VIN completes that record (its history and
  //    unlock identity stay with it);
  //  - otherwise a new VIN is a new car, with its own Service History.
  // An add with no VIN (older flow) stays idempotent per model.
  if (vin) {
    const same = await rowForVin(vin);
    if (same) return updateExisting(same, undefined, config);
    const blank = (await rowsOfModel()).find((r) => !r.vin);
    if (blank) return updateExisting(blank, vin, config);
  } else {
    const first = (await rowsOfModel())[0];
    if (first) return updateExisting(first, undefined, config);
  }

  try {
    const [created] = await db
    .insert(garageEntries)
    .values({
      id: randomUUID(),
      userId,
      kind: "catalog",
      vehicleId,
      vin,
      transmission: config.transmission,
      drivetrain: config.drivetrain,
      configConfirmedAt: new Date(),
    })
    .returning();
    return { entry: await entryFor(created), created: true, configKept: false };
  } catch (e) {
    // Two requests raced on the same VIN; the unique index let one win. Return the winner rather than failing the customer.
    if (!isUniqueViolation(e)) throw e;
    const winner = vin ? await rowForVin(vin) : (await rowsOfModel())[0];
    if (!winner) throw e;
    return updateExisting(winner, undefined, config);
  }
}

async function updateExisting(existing: GarageEntryRow, vin: string | undefined, config: ConfigInput): Promise<AddResult> {
  const { set, differs } = fillBlankAxes(existing, config);
  if (vin && !existing.vin) {
    const taken = (await db.select({ id: garageEntries.id }).from(garageEntries).where(and(eq(garageEntries.userId, existing.userId), eq(garageEntries.vin, vin))).limit(1))[0];
    if (!taken) set.vin = vin;
  }
  if (Object.keys(set).length === 0) return { entry: await entryFor(existing), created: false, configKept: differs };
  // A VIN is only ever written onto a row that still has none: if a concurrent request completed this record first,
  // we must not overwrite its VIN (the VIN is the car's identity). The caller re-evaluates from the fresh state.
  const [updated] = await db
    .update(garageEntries)
    .set(set)
    .where(set.vin ? and(eq(garageEntries.id, existing.id), isNull(garageEntries.vin)) : eq(garageEntries.id, existing.id))
    .returning();
  if (!updated) throw new VinRace();
  return { entry: await entryFor(updated), created: false, configKept: differs };
}

class VinRace extends Error {}

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
  const own = await findOwnRow(userId, id);
  if (!own) return null;
  const [updated] = await db.update(garageEntries).set(set).where(and(eq(garageEntries.id, own.id), eq(garageEntries.userId, userId))).returning();
  return updated ? await entryFor(updated) : null;
}

// `id` here is the client-facing id -- either a catalog vehicleId or a
// custom entry's row id (see the note above) -- so match on either column.
export async function removeGarageEntry(userId: string, id: string): Promise<void> {
  // Exactly one car: a plain id removes the oldest row of that model, a composite id removes that specific row.
  const own = await findOwnRow(userId, id);
  if (!own) return;
  await db.delete(garageEntries).where(and(eq(garageEntries.id, own.id), eq(garageEntries.userId, userId)));
}

// Service history and odometer are keyed by the same "vehicleId" concept the
// old localStorage hooks used -- a catalog vehicleId or a custom entry's id.
// Both need an actual garage_entries.id to hang their foreign key off of.
// `create: true` auto-provisions a catalog row on first touch, preserving
// the old behavior where you could log service history for a catalog
// vehicle you'd never explicitly "added" (it was just a localStorage key).
export async function resolveGarageEntryId(
  userId: string,
  vehicleId: string,
  opts: { create: boolean },
  ): Promise<string | null> {
  const own = await findOwnRow(userId, vehicleId);
  if (own) return own.id;
  if (!opts.create || rowIdOf(vehicleId)) return null;

const [created] = await db
  .insert(garageEntries)
  .values({ id: randomUUID(), userId, kind: "catalog", vehicleId })
  .returning({ id: garageEntries.id });
  return created.id;
}
