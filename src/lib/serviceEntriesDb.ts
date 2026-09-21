import { and, desc, eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { db } from "@/db";
import { serviceEntries } from "@/db/schema";
import { ServiceEntry } from "@/types/service";

type ServiceEntryRow = typeof serviceEntries.$inferSelect;

function mapRow(row: ServiceEntryRow): ServiceEntry {
  return {
    id: row.id,
    date: row.date,
    mileage: row.mileage,
    title: row.title,
    guideId: row.guideId ?? undefined,
    notes: row.notes ?? undefined,
    loggedAt: row.loggedAt.toISOString(),
  };
}

export async function listServiceEntries(garageEntryId: string): Promise<ServiceEntry[]> {
  const rows = await db
    .select()
    .from(serviceEntries)
    .where(eq(serviceEntries.garageEntryId, garageEntryId))
    .orderBy(desc(serviceEntries.date));
  return rows.map(mapRow);
}

export async function addServiceEntry(
  userId: string,
  garageEntryId: string,
  entry: Omit<ServiceEntry, "id" | "loggedAt">,
): Promise<ServiceEntry> {
  const [created] = await db
    .insert(serviceEntries)
    .values({
      id: randomUUID(),
      userId,
      garageEntryId,
      date: entry.date,
      mileage: entry.mileage,
      title: entry.title,
      guideId: entry.guideId,
      notes: entry.notes,
    })
    .returning();
  return mapRow(created);
}

/**
 * Delete one entry from one vehicle's service log.
 *
 * Scoped by GARAGE ENTRY, not by user, and that is the whole point.
 *
 * This used to match on `id AND userId`, which was sound only while userId
 * was NOT NULL. As of the 2026-09-20 migration it is nullable: when an
 * account is deleted, its rows keep the history and drop the user reference
 * to null. A row with a null userId matches no `userId = $1` predicate, so
 * the old query would have quietly made orphaned history undeletable -- and
 * any later "fix" that relaxed the predicate to let those rows through would
 * have made them deletable by ANYONE. That is the trapdoor this signature
 * closes: there is no longer a userId here to get wrong.
 *
 * The caller passes a garageEntryId it has already resolved through
 * resolveGarageEntryId(), which only ever returns an entry owned by the
 * signed-in user. Ownership of the vehicle is therefore proven before this
 * function is reached, and the delete cannot reach a row on someone else's
 * vehicle no matter what entry id is supplied.
 */
export async function deleteServiceEntry(garageEntryId: string, id: string): Promise<void> {
  await db
    .delete(serviceEntries)
    .where(and(eq(serviceEntries.id, id), eq(serviceEntries.garageEntryId, garageEntryId)));
}
