import { eq } from "drizzle-orm";
import { db } from "@/db";
import { odometerReadings } from "@/db/schema";

export async function getOdometer(garageEntryId: string): Promise<number | null> {
  const rows = await db
    .select({ miles: odometerReadings.miles })
    .from(odometerReadings)
    .where(eq(odometerReadings.garageEntryId, garageEntryId))
    .limit(1);
  return rows[0]?.miles ?? null;
}

export async function setOdometer(
  userId: string,
  garageEntryId: string,
  value: number | null,
): Promise<void> {
  if (value == null) {
    await db.delete(odometerReadings).where(eq(odometerReadings.garageEntryId, garageEntryId));
    return;
  }
  await db
    .insert(odometerReadings)
    .values({ garageEntryId, userId, miles: value })
    .onConflictDoUpdate({
      target: odometerReadings.garageEntryId,
      set: { miles: value, updatedAt: new Date() },
    });
}
