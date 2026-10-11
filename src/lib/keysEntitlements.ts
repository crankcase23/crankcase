import { and, eq, isNull, sql } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { db } from "@/db";
import { garageEntries, vinEntitlements } from "@/db/schema";
import { keysPriceCentsForNthVehicle } from "@/lib/keysPricing";
import { canonicalVin, isValidVin } from "@/lib/vin";

// Get the Keys: permanent, VIN-linked purchase entitlements (PR-A). SERVER ONLY.
//
// Rules this file is the single owner of:
//   - An entitlement belongs to (account, canonical VIN). It is never keyed to, or deleted with, a garage row, so deleting
//     a vehicle never destroys a paid unlock and re-adding the same VIN finds it again.
//   - Another account holding the same VIN has its OWN entitlement state: nothing here ever reads across accounts, and no
//     function accepts a VIN from a browser to look it up for someone else.
//   - The price is computed here from the customer's own purchased entitlements. The browser never sends a price.
//   - There is NO HTTP route that grants an entitlement. Granting is an internal function for the future payment webhook
//     (not built; no Stripe, no real payments in this PR).
//
// Ladder semantics (owner-locked): vehicle 1 $20, 2 $18, 3 $16, 4 and up $15. The Nth price is for the Nth distinct VIN the
// account has bought; gifts and revoked (refunded) rows do not count, so a gift never pushes a customer down the ladder.

export type Entitlement = typeof vinEntitlements.$inferSelect;

/** How many full-price purchases this account holds that count toward the ladder (active purchases only). */
export async function purchasedCount(userId: string): Promise<number> {
  const [row] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(vinEntitlements)
    .where(and(eq(vinEntitlements.userId, userId), eq(vinEntitlements.source, "purchase"), isNull(vinEntitlements.revokedAt)));
  return row?.n ?? 0;
}

/** What the NEXT unlock costs this account, in cents, and which rung that is. Same price whatever VIN is being bought. */
export async function nextUnlockPrice(userId: string): Promise<{ rung: number; priceCents: number; purchasedCount: number }> {
  const n = await purchasedCount(userId);
  return { rung: n + 1, priceCents: keysPriceCentsForNthVehicle(n + 1), purchasedCount: n };
}

/** The account's own active entitlement for a VIN, or null. Never looks at anyone else's rows. */
export async function getEntitlement(userId: string, vin: string): Promise<Entitlement | null> {
  const v = canonicalVin(vin);
  if (!v) return null;
  const [row] = await db
    .select()
    .from(vinEntitlements)
    .where(and(eq(vinEntitlements.userId, userId), eq(vinEntitlements.vin, v), isNull(vinEntitlements.revokedAt)))
    .limit(1);
  return row ?? null;
}

export async function hasEntitlement(userId: string, vin: string): Promise<boolean> {
  return (await getEntitlement(userId, vin)) !== null;
}

export interface GrantResult {
  /** false when the account already held this VIN: nothing was charged to the ladder and nothing changed. */
  created: boolean;
  entitlement: Entitlement;
}

/**
 * INTERNAL. Records that this account bought the Keys for this VIN, priced by the server at the account's next rung.
 * Idempotent and safe under concurrent calls (a per-account advisory lock serializes the count-then-insert, and a unique
 * index on (account, VIN) is the backstop): the same VIN twice is one entitlement at one rung, never two.
 * A revoked (refunded) VIN that is bought again is reinstated at the account's current next rung.
 * Nothing in the app calls this yet; the payment webhook will, after money has actually been captured.
 */
export async function grantPurchasedEntitlement(input: { userId: string; vin: string; purchaseId?: string | null }): Promise<GrantResult> {
  const vin = canonicalVin(input.vin);
  if (!isValidVin(vin)) throw new Error("grantPurchasedEntitlement: a valid VIN is required.");

  return db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${"keys:" + input.userId}))`);

    const [existing] = await tx
      .select()
      .from(vinEntitlements)
      .where(and(eq(vinEntitlements.userId, input.userId), eq(vinEntitlements.vin, vin)))
      .limit(1);
    if (existing && !existing.revokedAt) return { created: false, entitlement: existing };

    const [{ n }] = await tx
      .select({ n: sql<number>`count(*)::int` })
      .from(vinEntitlements)
      .where(and(eq(vinEntitlements.userId, input.userId), eq(vinEntitlements.source, "purchase"), isNull(vinEntitlements.revokedAt)));
    const rung = n + 1;
    const priceCents = keysPriceCentsForNthVehicle(rung);

    if (existing) {
      const [reinstated] = await tx
        .update(vinEntitlements)
        .set({ source: "purchase", rung, priceCents, purchaseId: input.purchaseId ?? null, grantedAt: new Date(), revokedAt: null })
        .where(eq(vinEntitlements.id, existing.id))
        .returning();
      return { created: true, entitlement: reinstated };
    }
    const [created] = await tx
      .insert(vinEntitlements)
      .values({ id: randomUUID(), userId: input.userId, vin, source: "purchase", rung, priceCents, purchaseId: input.purchaseId ?? null })
      .returning();
    return { created: true, entitlement: created };
  });
}

export interface KeysStatus {
  /** The vehicle has a VIN on file, so it can carry an entitlement. */
  hasVin: boolean;
  unlocked: boolean;
  /** What unlocking would cost THIS account next, in cents. Present only while the vehicle is locked and has a VIN. */
  nextPriceCents: number | null;
  nextRung: number | null;
}

/**
 * Keys state of one of the CALLER'S OWN garage vehicles (`id` is the client-facing id: catalog vehicleId or custom row id).
 * Returns null when that vehicle is not in the caller's garage, so a guessed id, or another account's vehicle, answers
 * exactly like a vehicle that does not exist.
 */
export async function keysStatusForOwnVehicle(userId: string, id: string): Promise<KeysStatus | null> {
  const [row] = await db
    .select({ vin: garageEntries.vin })
    .from(garageEntries)
    .where(and(eq(garageEntries.userId, userId), sql`(${garageEntries.id} = ${id} or ${garageEntries.vehicleId} = ${id})`))
    .limit(1);
  if (!row) return null;
  const vin = row.vin ? canonicalVin(row.vin) : "";
  if (!vin || !isValidVin(vin)) return { hasVin: false, unlocked: false, nextPriceCents: null, nextRung: null };
  if (await hasEntitlement(userId, vin)) return { hasVin: true, unlocked: true, nextPriceCents: null, nextRung: null };
  const next = await nextUnlockPrice(userId);
  return { hasVin: true, unlocked: false, nextPriceCents: next.priceCents, nextRung: next.rung };
}
