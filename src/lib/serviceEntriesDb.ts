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

export async function deleteServiceEntry(userId: string, id: string): Promise<void> {
  await db
    .delete(serviceEntries)
    .where(and(eq(serviceEntries.id, id), eq(serviceEntries.userId, userId)));
}
