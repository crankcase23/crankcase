import { randomUUID } from "node:crypto";
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { appEvents, garageEntries } from "@/db/schema";
import { EVENT_TYPES } from "@/lib/events";
import { addCustomEntry, entryFor, findOwnRow, ownRowForVin, vinHeldByAnotherAccount, type Blocked, type AddResult, type ConfigInput } from "@/lib/garageEntries";
import { FALLBACK_DAILY_CAP, identityMatches, type TypedDetails } from "@/lib/vinFallback";
import { probeVin, type DecodedIdentity, type ProbeResult } from "@/lib/vpicServer";
import type { GarageEntry } from "@/types/garage";

// The NHTSA-outage fallback, server side. Rules (owner-approved 2026-10-12):
//  1. The SERVER decides the decoder is down, by asking NHTSA itself. The browser's word is never taken.
//  2. Decoder reachable and the typed year/make/model match what NHTSA decoded: add as VERIFIED, using NHTSA's values.
//  3. Decoder reachable but the details do not match: refuse (use the normal Add by VIN).
//  4. Decoder reachable but does not know the VIN (error 7 / empty): refuse in phase 1.
//  5. Decoder unreachable: add as UNVERIFIED (custom vehicle: Service History and reminders only).
//  6. At most FALLBACK_DAILY_CAP additions per account per rolling 24 hours, counted from events so removing a vehicle
//     does not refund the allowance.
// VIN uniqueness, ownership privacy and the existing-row behavior are exactly addCustomEntry's: the first account to
// hold a VIN holds it (unverified or not), the answer for a held VIN is the generic claim-required one, and nothing
// here deletes, reassigns or overwrites any row.

export type ProbeFn = (vin: string) => Promise<ProbeResult>;

export type FallbackRefusal =
  | { refused: "cap"; retryAfterSeconds: number }
  | { refused: "decoder-available"; nhtsaReads: string }
  | { refused: "not-decodable" };

export interface FallbackAdded extends AddResult {
  verified: boolean;
}

const DAY_SECONDS = 24 * 60 * 60;

export async function fallbackAddsInLastDay(userId: string): Promise<number> {
  const rows = await db
    .select({ n: sql<number>`count(*)` })
    .from(appEvents)
    .where(and(eq(appEvents.type, EVENT_TYPES.VIN_FALLBACK_ADD), eq(appEvents.userId, userId), sql`${appEvents.createdAt} > now() - make_interval(secs => ${DAY_SECONDS})`));
  return Number(rows[0]?.n ?? 0);
}

async function secondsUntilAllowance(userId: string): Promise<number> {
  const rows = await db
    .select({ left: sql<number>`ceil(extract(epoch from (${appEvents.createdAt} + make_interval(secs => ${DAY_SECONDS}) - now())))` })
    .from(appEvents)
    .where(and(eq(appEvents.type, EVENT_TYPES.VIN_FALLBACK_ADD), eq(appEvents.userId, userId)))
    .orderBy(sql`${appEvents.createdAt} desc`)
    .limit(FALLBACK_DAILY_CAP);
  const left = Number(rows[rows.length - 1]?.left);
  return Number.isFinite(left) ? Math.max(60, left) : 60;
}

const describe = (d: DecodedIdentity) => [d.year, d.make, d.model].filter(Boolean).join(" ");

/**
 * Add a vehicle by typed details. `vin` is already validated and normalized by the route. Returns Blocked (the generic
 * claim-required answer), a FallbackRefusal, or the added/existing entry.
 */
export async function addViaFallback(
  userId: string,
  vin: string,
  typed: TypedDetails,
  config: ConfigInput,
  probe: ProbeFn = probeVin,
): Promise<FallbackAdded | FallbackRefusal | Blocked> {
  // The customer's own row for this VIN is an idempotent re-add: nothing is created, so it costs no allowance and needs no NHTSA call.
  const mine = await ownRowForVin(userId, vin);
  if (mine) {
    const r = await addCustomEntry(userId, { vin }, config);
    if ("blocked" in r) return r;
    return { ...r, verified: mine.vinStatus === "verified" };
  }
  if (await vinHeldByAnotherAccount(userId, vin)) return { blocked: "vin-claim-required" };

  if ((await fallbackAddsInLastDay(userId)) >= FALLBACK_DAILY_CAP) {
    return { refused: "cap", retryAfterSeconds: await secondsUntilAllowance(userId) };
  }

  const result = await probe(vin);
  if (result.kind === "unknown") return { refused: "not-decodable" };

  let outcome: AddResult | Blocked;
  let verified = false;
  if (result.kind === "ok") {
    if (!identityMatches(typed, result.decoded)) return { refused: "decoder-available", nhtsaReads: describe(result.decoded) };
    verified = true;
    const d = result.decoded;
    outcome = await addCustomEntry(
      userId,
      { vin, year: d.year, make: d.make, model: d.model, trim: d.trim ?? typed.trim, engine: d.engine ?? typed.engine },
      config,
      { vinStatus: "verified" },
    );
  } else {
    outcome = await addCustomEntry(userId, { vin, ...typed }, config, { vinStatus: "unverified" });
  }
  if ("blocked" in outcome) return outcome;
  if (outcome.created) {
    await db.insert(appEvents).values({
      id: randomUUID(),
      type: EVENT_TYPES.VIN_FALLBACK_ADD,
      userId,
      objectType: "garage_entry",
      objectId: outcome.entry.id,
      metadata: { verification: verified ? "verified" : "unverified" },
    });
  }
  return { ...outcome, verified };
}

export type VerifyOutcome =
  | { status: "verified"; entry: GarageEntry }
  | { status: "mismatch"; nhtsaReads: string }
  | { status: "not-decodable" }
  | { status: "outage" }
  | { status: "not-applicable" }
  | { status: "not-found" };

/**
 * Re-check one of the customer's UNVERIFIED vehicles. The server asks NHTSA itself. A match adopts NHTSA's values and marks
 * the row verified; a mismatch changes nothing. Rows that are not unverified (including every older row) are never touched.
 */
export async function verifyOwnEntry(userId: string, id: string, probe: ProbeFn = probeVin): Promise<VerifyOutcome> {
  const row = await findOwnRow(userId, id);
  if (!row) return { status: "not-found" };
  if (row.kind !== "custom" || row.vinStatus !== "unverified" || !row.vin) return { status: "not-applicable" };
  const result = await probe(row.vin.toUpperCase());
  if (result.kind === "outage") return { status: "outage" };
  if (result.kind === "unknown") return { status: "not-decodable" };
  const typed = { year: row.year ?? "", make: row.make ?? "", model: row.model ?? "" };
  if (!identityMatches(typed, result.decoded)) return { status: "mismatch", nhtsaReads: describe(result.decoded) };
  const d = result.decoded;
  const [updated] = await db
    .update(garageEntries)
    .set({ year: d.year, make: d.make, model: d.model, trim: d.trim ?? row.trim, engine: d.engine ?? row.engine, vinStatus: "verified", vinStatusAt: new Date() })
    // The status check in the WHERE keeps this from touching a row that changed under us.
    .where(and(eq(garageEntries.id, row.id), eq(garageEntries.userId, userId), eq(garageEntries.vinStatus, "unverified")))
    .returning();
  if (!updated) return { status: "not-applicable" };
  return { status: "verified", entry: await entryFor(updated) };
}

/** Fix the typed details of an UNVERIFIED vehicle. Never changes the VIN, and never touches a verified or older row. */
export async function updateUnverifiedDetails(userId: string, id: string, typed: TypedDetails): Promise<GarageEntry | "not-applicable" | null> {
  const row = await findOwnRow(userId, id);
  if (!row) return null;
  if (row.kind !== "custom" || row.vinStatus !== "unverified") return "not-applicable";
  const [updated] = await db
    .update(garageEntries)
    .set({ year: typed.year, make: typed.make, model: typed.model, trim: typed.trim ?? null, engine: typed.engine ?? null })
    .where(and(eq(garageEntries.id, row.id), eq(garageEntries.userId, userId), eq(garageEntries.vinStatus, "unverified")))
    .returning();
  return updated ? await entryFor(updated) : "not-applicable";
}
