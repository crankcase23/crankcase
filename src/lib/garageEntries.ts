import { and, eq, ne, or, sql } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { db } from "@/db";
import { garageEntries } from "@/db/schema";
import { GarageEntry } from "@/types/garage";
import { isValidVin } from "@/lib/vin";
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

/**
 * Why an add or a VIN completion did NOT happen, without saying anything about anyone else:
 *  - "vin-claim-required": this VIN is not available to attach to this account yet. It is deliberately the same answer
 *    whatever the reason (another account, now or in the past), so it reveals nothing about another customer or vehicle.
 *    It is a "pending claim" answer, not a ruling that the VIN can never be added: the controlled ownership-claim /
 *    transfer workflow (future work) is what resolves it. Nothing is created, shared or granted meanwhile.
 *  - "same-model-other-vin": this account already holds this catalog vehicle under a different VIN.
 *  - "vin-already-set": the entry already has a valid VIN; a VIN names the vehicle and is never swapped by an edit.
 */
export type BlockedReason = "vin-claim-required" | "same-model-other-vin" | "vin-already-set";
export interface Blocked {
  blocked: BlockedReason;
}
export const isBlocked = (r: object): r is Blocked => "blocked" in r;

const UNIQUE_VIOLATION = "23505";

// Canonical VIN identity is the upper-cased VIN (src/lib/vin.ts canonicalVin). Older rows may hold it as typed, so
// comparisons are case-insensitive. Account-to-vehicle relationships are the rows; the VIN is what names the vehicle.
const sameVin = (vin: string) => sql`upper(${garageEntries.vin}) = ${vin}`;

/** True when ANOTHER account has a garage row for this VIN. The caller must never reveal more than this boolean. */
export async function vinHeldByAnotherAccount(userId: string, vin: string): Promise<boolean> {
  const rows = await db
    .select({ id: garageEntries.id })
    .from(garageEntries)
    .where(and(ne(garageEntries.userId, userId), sameVin(vin)))
    .limit(1);
  return rows.length > 0;
}

async function ownRowForVin(userId: string, vin: string): Promise<GarageEntryRow | undefined> {
  return (await db.select().from(garageEntries).where(and(eq(garageEntries.userId, userId), sameVin(vin))).limit(1))[0];
}
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
  vin: string,
  config: ConfigInput,
): Promise<AddResult | Blocked> {
  // `vin` is already validated and normalized by the route (src/lib/vin.ts). A permanent add always has one.
  const find = () =>
    db
      .select()
      .from(garageEntries)
      .where(and(eq(garageEntries.userId, userId), eq(garageEntries.kind, "catalog"), eq(garageEntries.vehicleId, vehicleId)))
      .limit(1);

  // The same VIN already in THIS garage is the same vehicle: no second row, whatever it was added as.
  const mine = await ownRowForVin(userId, vin);
  if (mine) return updateExisting(mine, undefined, config);

  const existing = (await find())[0];
  if (existing) {
    // A row for this catalog model with a DIFFERENT valid VIN is a second car of the same model, which one garage cannot
    // hold yet (one row per model per customer). Say so instead of silently reporting the first car.
    if (existing.vin && isValidVin(existing.vin)) return { blocked: "same-model-other-vin" };
    if (await vinHeldByAnotherAccount(userId, vin)) return { blocked: "vin-claim-required" };
    return updateExisting(existing, vin, config);
  }

  if (await vinHeldByAnotherAccount(userId, vin)) return { blocked: "vin-claim-required" };

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
    return { entry: mapRow(created), created: true, configKept: false };
  } catch (e) {
    // Two requests raced; the unique index let one win. Return the winner rather than failing the customer.
    if (!isUniqueViolation(e)) throw e;
    const winner = (await find())[0] ?? (await ownRowForVin(userId, vin));
    if (!winner) throw e;
    return updateExisting(winner, undefined, config);
  }
}

async function updateExisting(existing: GarageEntryRow, vin: string | undefined, config: ConfigInput): Promise<AddResult> {
  const { set, differs } = fillBlankAxes(existing, config);
  // A row that had no VIN (an older record) gets this one; a row that already has one keeps it.
  if (vin && !existing.vin) set.vin = vin;
  if (Object.keys(set).length === 0) return { entry: mapRow(existing), created: false, configKept: differs };
  const [updated] = await db.update(garageEntries).set(set).where(eq(garageEntries.id, existing.id)).returning();
  return { entry: mapRow(updated), created: false, configKept: differs };
}

export async function addCustomEntry(
  userId: string,
  custom: { vin: string; year?: string; make?: string; model?: string; trim?: string; engine?: string },
  config: ConfigInput,
): Promise<AddResult | Blocked> {
  const mine = await ownRowForVin(userId, custom.vin);
  if (mine) return updateExisting(mine, undefined, config);
  if (await vinHeldByAnotherAccount(userId, custom.vin)) return { blocked: "vin-claim-required" };
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
    if (!isUniqueViolation(e)) throw e;
    const dup = await ownRowForVin(userId, custom.vin);
    if (!dup) throw e;
    return updateExisting(dup, undefined, config);
  }
}

/**
 * VIN completion for an older record that has no (valid) VIN. Attaches the VIN to the customer's OWN row only. It never
 * replaces a valid VIN, never touches another account's rows, and answers a collision with the generic claim-required
 * outcome. `id` is the client-facing id (catalog vehicleId or custom row id).
 */
export async function completeGarageVin(
  userId: string,
  id: string,
  vin: string,
): Promise<{ entry: GarageEntry } | Blocked | null> {
  const row = (
    await db
      .select()
      .from(garageEntries)
      .where(and(eq(garageEntries.userId, userId), or(eq(garageEntries.id, id), eq(garageEntries.vehicleId, id))))
      .limit(1)
  )[0];
  if (!row) return null;
  if (row.vin && isValidVin(row.vin)) {
    return row.vin.toUpperCase() === vin ? { entry: mapRow(row) } : { blocked: "vin-already-set" };
  }
  const mine = await ownRowForVin(userId, vin);
  if (mine && mine.id !== row.id) return { blocked: "vin-claim-required" }; // already on another of this customer's rows: not a second vehicle
  if (await vinHeldByAnotherAccount(userId, vin)) return { blocked: "vin-claim-required" };
  try {
    const [updated] = await db.update(garageEntries).set({ vin }).where(eq(garageEntries.id, row.id)).returning();
    return { entry: mapRow(updated) };
  } catch (e) {
    if (isUniqueViolation(e)) return { blocked: "vin-claim-required" };
    throw e;
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
// Returns null when the vehicle is not in THIS customer's garage; nothing here ever creates a row.
export async function resolveGarageEntryId(
  userId: string,
  vehicleId: string,
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
  // A garage row is only ever created by the VIN-gated add (addCatalogEntry / addCustomEntry). Logging service or an
  // odometer reading used to auto-create a bare catalog row; that was a way around the VIN requirement, so it is gone.
  return null;
}
