import { and, asc, eq, isNull, or, sql } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { db } from "@/db";
import { legacyUnlockHolds, vinEntitlements, vinEntitlementEvents } from "@/db/schema";
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

// ---------------------------------------------------------------------------------------------------------------------
// Legacy unlock holds: no historical purchase or gift is ever silently dropped.
//
// Before VIN entitlements, admin gifts lived in vehicle_unlocks, keyed to the garage row and deleted with it. A legacy unlock
// whose car has no canonical, valid VIN (or whose car was deleted before the copy) is preserved as a HOLD
// (migrations/2026-10-12-legacy-unlock-holds.sql; the table has no foreign key to garage_entries and database triggers refuse
// deletion and any change to its original facts). A hold turns into a real entitlement, with the ORIGINAL source and grant time,
// when it is resolved. Nothing here expires or closes a hold on its own: only resolveLegacyHold() (convert) or
// waiveLegacyHold() (admin, with a written reason) ends one. See docs/release/README.md for who does what.
// ---------------------------------------------------------------------------------------------------------------------

export type LegacyHold = typeof legacyUnlockHolds.$inferSelect;

export type LegacyHoldErrorCode = "NOT_FOUND" | "NOT_PENDING" | "VIN_REQUIRED" | "VIN_INVALID" | "REVOKED_EXISTS";
export class LegacyHoldError extends Error {
  constructor(public code: LegacyHoldErrorCode, message: string) {
    super(message);
    this.name = "LegacyHoldError";
  }
}

/** This account's own legacy holds (never another account's). Oldest first. */
export async function listLegacyHolds(userId: string, opts: { pendingOnly?: boolean } = {}): Promise<LegacyHold[]> {
  return db
    .select()
    .from(legacyUnlockHolds)
    .where(opts.pendingOnly ? and(eq(legacyUnlockHolds.userId, userId), eq(legacyUnlockHolds.status, "pending_vin")) : eq(legacyUnlockHolds.userId, userId))
    .orderBy(asc(legacyUnlockHolds.grantedAt), asc(legacyUnlockHolds.id));
}

const resolvedFields = (actor: Actor, note: string | null | undefined) => ({
  resolvedAt: new Date(),
  resolvedBy: actor.id ?? actor.type,
  resolutionNote: note ?? null,
});

/**
 * INTERNAL. Turns one pending hold into a real entitlement for `vin` (default: the VIN stored on the hold when that is already a
 * valid one). The entitlement keeps the hold's ORIGINAL source ("gift" or "purchase") and original grant time, never counts
 * differently from the unlock it replaces, and is logged as an event with the actor. One transaction, under the account lock.
 * - The account already holds that VIN actively: no second entitlement; the hold is closed and says so. Nothing is lost,
 *   because the access already exists.
 * - The account holds that VIN but it was revoked: refused (REVOKED_EXISTS), the hold stays pending, and an admin decides.
 * Throws LegacyHoldError; never silently skips.
 */
export async function resolveLegacyHold(input: {
  holdId: string;
  userId: string;
  vin?: string | null;
  actor: Actor;
  note?: string | null;
}): Promise<{ hold: LegacyHold; entitlement: Entitlement; created: boolean }> {
  return db.transaction(async (tx) => {
    await lockAccount(tx, input.userId);
    const [hold] = await tx
      .select()
      .from(legacyUnlockHolds)
      .where(and(eq(legacyUnlockHolds.id, input.holdId), eq(legacyUnlockHolds.userId, input.userId)))
      .limit(1);
    if (!hold) throw new LegacyHoldError("NOT_FOUND", "No such legacy unlock hold for this account.");
    if (hold.status !== "pending_vin") throw new LegacyHoldError("NOT_PENDING", "This legacy unlock is already resolved.");

    const vin = canonicalVin(input.vin ?? hold.vinAtSnapshot ?? "");
    if (!vin) throw new LegacyHoldError("VIN_REQUIRED", "A valid VIN is needed to restore this unlock.");
    if (!isValidVin(vin)) throw new LegacyHoldError("VIN_INVALID", "That is not a valid VIN.");

    const [existing] = await lookup(tx, input.userId, vin);
    if (existing && existing.revokedAt) {
      throw new LegacyHoldError("REVOKED_EXISTS", "This account's access to that VIN was revoked; an admin must decide.");
    }
    let entitlement: Entitlement;
    let created = false;
    if (existing) {
      entitlement = existing;
    } else {
      const [row] = await tx
        .insert(vinEntitlements)
        .values({ id: randomUUID(), userId: input.userId, vin, source: hold.source, rung: null, priceCents: null, purchaseId: null, grantedAt: hold.grantedAt })
        .returning();
      // A JS Date carries milliseconds, the database microseconds: copy the original grant time across inside the database so it is exact.
      await tx.execute(sql`update vin_entitlements set granted_at = (select granted_at from legacy_unlock_holds where id = ${hold.id}) where id = ${row.id}`);
      [entitlement] = await tx.select().from(vinEntitlements).where(eq(vinEntitlements.id, row.id)).limit(1);
      created = true;
      await recordEvent(tx, {
        userId: input.userId,
        vin,
        type: hold.source === "purchase" ? "purchased" : "gifted",
        entitlement,
        actor: input.actor,
        reason: `legacy unlock reconciled${input.note ? `: ${input.note}` : ""}`,
        detail: { holdId: hold.id, garageEntryId: hold.garageEntryId, originalGrantedAt: hold.grantedAt },
      });
    }
    const note = created ? input.note : `account already held this VIN (${existing!.source}); no second entitlement created${input.note ? `. ${input.note}` : ""}`;
    const [closed] = await tx
      .update(legacyUnlockHolds)
      .set({ status: "converted", resolvedVin: vin, ...resolvedFields(input.actor, note) })
      .where(eq(legacyUnlockHolds.id, hold.id))
      .returning();
    return { hold: closed, entitlement, created };
  });
}

/**
 * INTERNAL (admin only, a written reason is mandatory). Closes a hold WITHOUT restoring access, for the rare case the admin has
 * established the unlock should not exist (e.g. a gift the customer asked to give up). The hold row stays forever as the record.
 */
export async function waiveLegacyHold(input: { holdId: string; userId: string; actor: Actor; note: string }): Promise<LegacyHold> {
  if (input.actor.type !== "admin" || !input.actor.id) throw new Error("waiveLegacyHold: only an admin can waive a hold.");
  if (!input.note || input.note.trim().length < 5) throw new Error("waiveLegacyHold: a written reason is required.");
  return db.transaction(async (tx) => {
    await lockAccount(tx, input.userId);
    const [hold] = await tx
      .select()
      .from(legacyUnlockHolds)
      .where(and(eq(legacyUnlockHolds.id, input.holdId), eq(legacyUnlockHolds.userId, input.userId)))
      .limit(1);
    if (!hold) throw new LegacyHoldError("NOT_FOUND", "No such legacy unlock hold for this account.");
    if (hold.status !== "pending_vin") throw new LegacyHoldError("NOT_PENDING", "This legacy unlock is already resolved.");
    const [closed] = await tx
      .update(legacyUnlockHolds)
      .set({ status: "waived", ...resolvedFields(input.actor, input.note.trim()) })
      .where(eq(legacyUnlockHolds.id, hold.id))
      .returning();
    return closed;
  });
}

/**
 * Called after a customer has put a VIN on one of THEIR OWN cars. Restores what is safe to restore without a person deciding:
 *   - a legacy GIFT held for this very car (same row), or any hold whose stored VIN is exactly this VIN;
 *   - a legacy PURCHASE only when its stored VIN is exactly this VIN (the same car, unchanged).
 * A paid hold tied only to the car (not to this VIN) stays pending for an admin: the customer typing a VIN is not proof it is
 * the VIN that was paid for. Never throws for the VIN route's sake: returns what happened.
 */
export async function reconcileHoldsForVehicle(userId: string, garageId: string, vinInput: string): Promise<{ restored: number; needsReview: number }> {
  const row = await findOwnRow(userId, garageId);
  const vin = canonicalVin(vinInput);
  if (!row || !isValidVin(vin)) return { restored: 0, needsReview: 0 };
  const pending = await listLegacyHolds(userId, { pendingOnly: true });
  let restored = 0;
  let needsReview = 0;
  for (const h of pending) {
    const sameCar = h.garageEntryId === row.id;
    const sameVin = !!h.vinAtSnapshot && canonicalVin(h.vinAtSnapshot) === vin;
    if (!sameCar && !sameVin) continue;
    const safe = sameVin || (sameCar && h.source === "gift");
    if (!safe) {
      needsReview++;
      continue;
    }
    try {
      await resolveLegacyHold({ holdId: h.id, userId, vin, actor: { type: "customer" }, note: "customer completed the VIN" });
      restored++;
    } catch (e) {
      if (e instanceof LegacyHoldError) needsReview++;
      else throw e;
    }
  }
  return { restored, needsReview };
}

// ---------------------------------------------------------------------------------------------------------------------
// Checkout eligibility: nobody pays for a VIN they already have.
//
// No checkout exists yet (no Stripe, no payments). When it does, it MUST call checkoutEligibilityForOwnVehicle() before it creates
// a payment session, and the payment webhook MUST call settleCapturedPayment() and refund on "refund-required". Owner decision
// 2026-10-11: an already-unlocked VIN (by gift, prior payment or a legacy unlock) is refused at checkout; a gift is never converted
// into a sale.
// ---------------------------------------------------------------------------------------------------------------------

export type CheckoutRefusal = "not-in-garage" | "no-vin" | "invalid-vin" | "already-unlocked" | "legacy-unlock-pending";
export type CheckoutEligibility =
  | { eligible: true; vin: string; priceCents: number; rung: number }
  | { eligible: false; reason: CheckoutRefusal; message: string };

const REFUSAL_TEXT: Record<CheckoutRefusal, string> = {
  "not-in-garage": "That vehicle is not in your garage.",
  "no-vin": "Add this vehicle's VIN first. An unlock belongs to the VIN.",
  "invalid-vin": "The VIN on this vehicle is not valid. Correct it first.",
  "already-unlocked": "This VIN is already unlocked for your account. There is nothing to buy.",
  "legacy-unlock-pending": "This vehicle has an earlier unlock that is waiting to be restored. Support will finish it; you do not need to pay.",
};

/** Is this account allowed to be sent to payment for this car of its own? Server decides; the browser sends no price and no VIN. */
export async function checkoutEligibilityForOwnVehicle(userId: string, garageId: string): Promise<CheckoutEligibility> {
  const row = await findOwnRow(userId, garageId);
  const refuse = (reason: CheckoutRefusal): CheckoutEligibility => ({ eligible: false, reason, message: REFUSAL_TEXT[reason] });
  if (!row) return refuse("not-in-garage");
  const vin = row.vin ? canonicalVin(row.vin) : "";
  if (!vin) return refuse("no-vin");
  if (!isValidVin(vin)) return refuse("invalid-vin");
  if (await hasEntitlement(userId, vin)) return refuse("already-unlocked");
  const [pending] = await db
    .select({ id: legacyUnlockHolds.id })
    .from(legacyUnlockHolds)
    .where(and(eq(legacyUnlockHolds.userId, userId), eq(legacyUnlockHolds.status, "pending_vin"), or(eq(legacyUnlockHolds.garageEntryId, row.id), eq(legacyUnlockHolds.vinAtSnapshot, vin))))
    .limit(1);
  if (pending) return refuse("legacy-unlock-pending");
  const next = await nextUnlockPrice(userId);
  return { eligible: true, vin, priceCents: next.priceCents, rung: next.rung };
}

export type SettlementOutcome =
  | { outcome: "granted"; entitlement: Entitlement }
  | { outcome: "refund-required"; reason: "already-unlocked" | "legacy-unlock-pending"; entitlement: Entitlement | null };

/**
 * INTERNAL, for the future payment webhook, called only after money was actually captured. Grants the purchase unless the account
 * already holds the VIN (gift, earlier payment, or a legacy unlock waiting on a hold), in which case it grants NOTHING and tells
 * the caller to refund. Money is never silently kept for access that already existed.
 */
export async function settleCapturedPayment(input: { userId: string; vin: string; purchaseId?: string | null }): Promise<SettlementOutcome> {
  const vin = canonicalVin(input.vin);
  const [pending] = await db
    .select({ id: legacyUnlockHolds.id })
    .from(legacyUnlockHolds)
    .where(
      and(
        eq(legacyUnlockHolds.userId, input.userId),
        eq(legacyUnlockHolds.status, "pending_vin"),
        or(
          eq(legacyUnlockHolds.vinAtSnapshot, vin),
          sql`${legacyUnlockHolds.garageEntryId} in (select id from garage_entries where user_id = ${input.userId} and vin = ${vin})`,
        ),
      ),
    )
    .limit(1);
  if (pending) return { outcome: "refund-required", reason: "legacy-unlock-pending", entitlement: null };
  const result = await grantPurchasedEntitlement({ userId: input.userId, vin, purchaseId: input.purchaseId ?? null, actor: { type: "system" } });
  return result.created
    ? { outcome: "granted", entitlement: result.entitlement }
    : { outcome: "refund-required", reason: "already-unlocked", entitlement: result.entitlement };
}
