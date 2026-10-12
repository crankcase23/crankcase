import { and, asc, eq, isNull, sql } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { db } from "@/db";
import { vinEntitlements, vinEntitlementEvents } from "@/db/schema";
import { findOwnRow } from "@/lib/garageEntries";
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
//   - Every change is also appended to vin_entitlement_events (purchased / gifted / revoked / refunded / reacquired, with
//     actor and reason) in the SAME transaction. That table is append-only, so reinstating a VIN never erases what came
//     before. Admin gifts and revocations go through the functions below; nothing writes vin_entitlements any other way.
//   - There is NO customer-facing HTTP route that grants an entitlement. Granting is an internal function for the future payment webhook
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

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
export type EntitlementEventType = "purchased" | "gifted" | "revoked" | "refunded" | "reacquired";
export type EntitlementEvent = typeof vinEntitlementEvents.$inferSelect;
export interface Actor {
  type: "system" | "admin" | "customer";
  /** The admin's user id when type is "admin". */
  id?: string | null;
}

const lockAccount = (tx: Tx, userId: string) => tx.execute(sql`select pg_advisory_xact_lock(hashtext(${"keys:" + userId}))`);

async function recordEvent(
  tx: Tx,
  e: {
    userId: string;
    vin: string;
    type: EntitlementEventType;
    entitlement: Pick<Entitlement, "source" | "rung" | "priceCents" | "purchaseId">;
    actor: Actor;
    reason?: string | null;
    detail?: unknown;
  },
) {
  await tx.insert(vinEntitlementEvents).values({
    id: randomUUID(),
    userId: e.userId,
    vin: e.vin,
    eventType: e.type,
    source: e.entitlement.source,
    rung: e.entitlement.rung ?? null,
    priceCents: e.entitlement.priceCents ?? null,
    purchaseId: e.entitlement.purchaseId ?? null,
    actorType: e.actor.type,
    actorId: e.actor.id ?? null,
    reason: e.reason ?? null,
    detail: e.detail === undefined ? null : e.detail,
  });
}

const snapshotOf = (r: Entitlement) => ({ source: r.source, rung: r.rung, priceCents: r.priceCents, purchaseId: r.purchaseId, grantedAt: r.grantedAt, revokedAt: r.revokedAt });
const lookup = (tx: Tx, userId: string, vin: string) =>
  tx.select().from(vinEntitlements).where(and(eq(vinEntitlements.userId, userId), eq(vinEntitlements.vin, vin))).limit(1);
const countedPurchases = async (tx: Tx, userId: string) =>
  (
    await tx
      .select({ n: sql<number>`count(*)::int` })
      .from(vinEntitlements)
      .where(and(eq(vinEntitlements.userId, userId), eq(vinEntitlements.source, "purchase"), isNull(vinEntitlements.revokedAt)))
  )[0].n;

/**
 * INTERNAL. Records that this account bought the Keys for this VIN, priced by the server at the account's next rung.
 * Idempotent and safe under concurrent calls (a per-account advisory lock serializes the count-then-insert, and a unique
 * index on (account, VIN) is the backstop): the same VIN twice is one entitlement at one rung, never two.
 * A revoked / refunded VIN that is bought again is reinstated at the account's current next rung and logged as
 * "reacquired"; the earlier events (and what the row held before) stay in the history.
 * An account that already holds the VIN, including by gift, is not charged again: created is false and nothing changes.
 * Nothing in the app calls this yet; the payment webhook will, after money has actually been captured.
 */
export async function grantPurchasedEntitlement(input: {
  userId: string;
  vin: string;
  purchaseId?: string | null;
  actor?: Actor;
  reason?: string | null;
}): Promise<GrantResult> {
  const vin = canonicalVin(input.vin);
  if (!isValidVin(vin)) throw new Error("grantPurchasedEntitlement: a valid VIN is required.");
  const actor = input.actor ?? { type: "system" };

  return db.transaction(async (tx) => {
    await lockAccount(tx, input.userId);
    const [existing] = await lookup(tx, input.userId, vin);
    if (existing && !existing.revokedAt) return { created: false, entitlement: existing };

    const rung = (await countedPurchases(tx, input.userId)) + 1;
    const priceCents = keysPriceCentsForNthVehicle(rung);
    const fields = { source: "purchase" as const, rung, priceCents, purchaseId: input.purchaseId ?? null };

    if (existing) {
      const [reinstated] = await tx
        .update(vinEntitlements)
        .set({ ...fields, grantedAt: new Date(), revokedAt: null })
        .where(eq(vinEntitlements.id, existing.id))
        .returning();
      await recordEvent(tx, { userId: input.userId, vin, type: "reacquired", entitlement: reinstated, actor, reason: input.reason, detail: { replaced: snapshotOf(existing) } });
      return { created: true, entitlement: reinstated };
    }
    const [created] = await tx.insert(vinEntitlements).values({ id: randomUUID(), userId: input.userId, vin, ...fields }).returning();
    await recordEvent(tx, { userId: input.userId, vin, type: "purchased", entitlement: created, actor, reason: input.reason });
    return { created: true, entitlement: created };
  });
}

/**
 * INTERNAL (admin tooling). Gives this account the Keys for this VIN at no charge. A gift never counts toward the Garage
 * Rewards ladder, so it cannot push the customer's later purchases to a lower rung or a higher price. An account that already
 * holds the VIN (purchase or gift) is left exactly as it is. A revoked row is reinstated as a gift and the earlier history stays.
 * Only a valid VIN can carry an entitlement; a vehicle with no VIN cannot be gifted.
 */
export async function giftEntitlement(input: { userId: string; vin: string; actor: Actor; reason?: string | null }): Promise<GrantResult> {
  const vin = canonicalVin(input.vin);
  if (!isValidVin(vin)) throw new Error("giftEntitlement: a valid VIN is required.");
  return db.transaction(async (tx) => {
    await lockAccount(tx, input.userId);
    const [existing] = await lookup(tx, input.userId, vin);
    if (existing && !existing.revokedAt) return { created: false, entitlement: existing };
    const fields = { source: "gift" as const, rung: null, priceCents: null, purchaseId: null };
    if (existing) {
      const [reinstated] = await tx
        .update(vinEntitlements)
        .set({ ...fields, grantedAt: new Date(), revokedAt: null })
        .where(eq(vinEntitlements.id, existing.id))
        .returning();
      await recordEvent(tx, { userId: input.userId, vin, type: "gifted", entitlement: reinstated, actor: input.actor, reason: input.reason, detail: { replaced: snapshotOf(existing) } });
      return { created: true, entitlement: reinstated };
    }
    const [created] = await tx.insert(vinEntitlements).values({ id: randomUUID(), userId: input.userId, vin, ...fields }).returning();
    await recordEvent(tx, { userId: input.userId, vin, type: "gifted", entitlement: created, actor: input.actor, reason: input.reason });
    return { created: true, entitlement: created };
  });
}

/**
 * INTERNAL. Ends the account's access to this VIN: revoked_at is set and an event is appended; the row is never deleted.
 * kind "refunded" is for a captured payment returned to the customer; "revoked" is any other removal (an admin taking back a
 * gift or a purchase). A revoked purchase stops counting toward the ladder, so a later purchase re-prices from the account's
 * remaining purchases. Revoking something not held (or already revoked) changes nothing and returns revoked:false.
 */
export async function revokeEntitlement(input: {
  userId: string;
  vin: string;
  actor: Actor;
  reason?: string | null;
  kind?: "revoked" | "refunded";
}): Promise<{ revoked: boolean; entitlement: Entitlement | null }> {
  const vin = canonicalVin(input.vin);
  if (!vin) return { revoked: false, entitlement: null };
  return db.transaction(async (tx) => {
    await lockAccount(tx, input.userId);
    const [existing] = await lookup(tx, input.userId, vin);
    if (!existing || existing.revokedAt) return { revoked: false, entitlement: existing ?? null };
    const [updated] = await tx
      .update(vinEntitlements)
      .set({ revokedAt: new Date() })
      .where(eq(vinEntitlements.id, existing.id))
      .returning();
    await recordEvent(tx, { userId: input.userId, vin, type: input.kind ?? "revoked", entitlement: updated, actor: input.actor, reason: input.reason });
    return { revoked: true, entitlement: updated };
  });
}

/** This account's own history for one VIN, oldest first. For support and audit; never takes another account's id from a browser. */
export async function listEntitlementEvents(userId: string, vin: string): Promise<EntitlementEvent[]> {
  const v = canonicalVin(vin);
  if (!v) return [];
  return db
    .select()
    .from(vinEntitlementEvents)
    .where(and(eq(vinEntitlementEvents.userId, userId), eq(vinEntitlementEvents.vin, v)))
    .orderBy(asc(vinEntitlementEvents.createdAt), asc(vinEntitlementEvents.id));
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
 * Keys state of one of the CALLER'S OWN garage vehicles (`id` is the client-facing garage id, see garageId.ts).
 * Returns null when that vehicle is not in the caller's garage, so a guessed id, or another account's vehicle, answers
 * exactly like a vehicle that does not exist. A bare model id for which the caller owns several cars throws
 * AmbiguousGarageId (the route answers 409) instead of reporting some other car's state.
 */
export async function keysStatusForOwnVehicle(userId: string, id: string): Promise<KeysStatus | null> {
  const row = await findOwnRow(userId, id);
  if (!row) return null;
  const vin = row.vin ? canonicalVin(row.vin) : "";
  if (!vin || !isValidVin(vin)) return { hasVin: false, unlocked: false, nextPriceCents: null, nextRung: null };
  if (await hasEntitlement(userId, vin)) return { hasVin: true, unlocked: true, nextPriceCents: null, nextRung: null };
  const next = await nextUnlockPrice(userId);
  return { hasVin: true, unlocked: false, nextPriceCents: next.priceCents, nextRung: next.rung };
}
