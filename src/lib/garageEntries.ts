import { and, eq, or } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { db } from "@/db";
import { garageEntries } from "@/db/schema";
import { GarageEntry } from "@/types/garage";

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

function mapRow(row: GarageEntryRow): GarageEntry {
  if (row.kind === "custom") {
    return {
      id: row.id,
      kind: "custom",
      addedAt: row.createdAt.toISOString(),
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
  };
}

export async function listGarageEntries(userId: string): Promise<GarageEntry[]> {
  const rows = await db
  .select()
  .from(garageEntries)
  .where(eq(garageEntries.userId, userId));
  return rows.map(mapRow);
}

// Idempotent -- matches the old client-side "already in garage? skip" check,
// but enforced server-side too. `vin` is optional and set only when this
// catalog match came from a VIN decode (added 2026-09-19 alongside the fix
// for VINs silently matching the wrong cab/trim) -- lets a future audit see
// which real-world VIN a catalog match was derived from. If the row already
// exists without a vin and we're now given one (e.g. the same person
// re-decodes the same VIN later), backfill it rather than leaving the gap.
export async function addCatalogEntry(
  userId: string,
  vehicleId: string,
  vin?: string,
  ): Promise<GarageEntry> {
  const existing = await db
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
  if (existing[0]) {
    if (vin && !existing[0].vin) {
      const [updated] = await db
      .update(garageEntries)
      .set({ vin })
      .where(eq(garageEntries.id, existing[0].id))
      .returning();
      return mapRow(updated);
    }
    return mapRow(existing[0]);
  }

const [created] = await db
  .insert(garageEntries)
  .values({ id: randomUUID(), userId, kind: "catalog", vehicleId, vin })
  .returning();
  return mapRow(created);
}

export async function addCustomEntry(
  userId: string,
  custom: { vin?: string; year?: string; make?: string; model?: string; trim?: string; engine?: string },
  ): Promise<GarageEntry> {
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
  })
  .returning();
  return mapRow(created);
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
// `create: true` auto-provisions a catalog row on first touch, preserving
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
