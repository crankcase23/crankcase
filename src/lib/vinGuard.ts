import { createHash, randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { and, desc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { appEvents } from "@/db/schema";
import { EVENT_TYPES } from "@/lib/events";

// ---------------------------------------------------------------------------
// Protection against VIN enumeration and ownership probing. Free, no new service, no new table.
//
// Since 2026-10-12 an add never depends on whether another account holds the VIN, so there is no ownership oracle to
// probe any more (the "collision" counters below are legacy and nothing records collisions now). What remains worth
// limiting is VIN-guessing and hammering of the NHTSA decoder through the add and fallback paths, so:
//   - every VIN that passes the format rules and reaches the lookup is counted per account and per network address;
//   - collisions (the 409 answer) are counted separately and tolerated only a few times;
//   - past the limits the answer is a plain 429 that says nothing about the VIN, with a Retry-After.
// Counts live in the existing app_events table (type "vin.attempt" / "vin.collision"). The VIN itself is never stored;
// the network address is stored only as a salted hash.
//
// Limits (rolling windows):
//   collisions   5 per hour, 10 per day, per account
//   attempts    20 per hour, per account
//   attempts   150 per hour, per network address (hashed). Deliberately loose: carrier and office networks put many
//              real customers behind one address; this only stops one machine from walking VINs through many accounts.
// A real customer adds a handful of cars; a typo or two does not come near these. They are blunt on purpose.
//
// Honest limits of this: an attacker with many accounts AND many addresses can still probe slowly (account creation is
// not rate limited here); the address comes from x-forwarded-for, which Vercel sets itself and does not take from the
// client, so on any other host it is only as trustworthy as that host's proxy; a parallel burst can slip a few extra attempts through before the counters catch up (no
// transaction/lock); the platform-level answer to both is the verified-claim workflow and a CAPTCHA/edge limit, which
// are separate work. This closes the cheap, scripted case.
// ---------------------------------------------------------------------------

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

export const VIN_LIMITS = {
  collisionsPerHour: 5,
  collisionsPerDay: 10,
  attemptsPerHour: 20,
  attemptsPerHourPerIp: 150,
} as const;

export function ipHashOf(request: Request): string | null {
  const fwd = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const ip = fwd || request.headers.get("x-real-ip")?.trim();
  if (!ip) return null;
  return createHash("sha256").update(`${process.env.AUTH_SECRET ?? "crankcase"}|${ip}`).digest("hex").slice(0, 24);
}

// Time windows are evaluated by the database against its own clock. app_events.created_at is a timestamp WITHOUT time
// zone filled by the database default, so comparing it with a JavaScript Date would be wrong whenever the app and the
// database disagree about the zone.
const since = (ms: number) => sql`${appEvents.createdAt} > now() - make_interval(secs => ${ms / 1000})`;

/** Seconds until the (limit)th newest event in this window is old enough to fall out of it, i.e. when one more is allowed. */
async function retryAfterSeconds(where: ReturnType<typeof and>, limit: number, windowMs: number): Promise<number> {
  const rows = await db
    .select({ left: sql<number>`ceil(extract(epoch from (${appEvents.createdAt} + make_interval(secs => ${windowMs / 1000}) - now())))` })
    .from(appEvents)
    .where(where)
    .orderBy(desc(appEvents.createdAt))
    .limit(limit);
  const left = Number(rows[rows.length - 1]?.left);
  return Number.isFinite(left) ? Math.max(60, left) : 60;
}

const count = async (where: ReturnType<typeof and>) => Number((await db.select({ n: sql<number>`count(*)` }).from(appEvents).where(where))[0]?.n ?? 0);

/**
 * Call after the VIN passed the format rules and BEFORE looking it up. Records the attempt, then checks the limits.
 * Returns a ready 429 response when a limit is exceeded, or null when the request may proceed. The attempt is recorded
 * first so a burst of parallel requests counts itself.
 */
export async function guardVinAttempt(request: Request, userId: string): Promise<NextResponse | null> {
  const ipHash = ipHashOf(request);
  await db.insert(appEvents).values({
    id: randomUUID(),
    type: EVENT_TYPES.VIN_ATTEMPT,
    userId,
    metadata: ipHash ? { ipHash } : null,
  });

  const mine = (type: string, windowMs: number) => and(eq(appEvents.type, type), eq(appEvents.userId, userId), since(windowMs));
  const checks: Array<{ where: ReturnType<typeof and>; limit: number; windowMs: number; over: (n: number) => boolean }> = [
    { where: mine(EVENT_TYPES.VIN_COLLISION, HOUR), limit: VIN_LIMITS.collisionsPerHour, windowMs: HOUR, over: (n) => n >= VIN_LIMITS.collisionsPerHour },
    { where: mine(EVENT_TYPES.VIN_COLLISION, DAY), limit: VIN_LIMITS.collisionsPerDay, windowMs: DAY, over: (n) => n >= VIN_LIMITS.collisionsPerDay },
    { where: mine(EVENT_TYPES.VIN_ATTEMPT, HOUR), limit: VIN_LIMITS.attemptsPerHour, windowMs: HOUR, over: (n) => n > VIN_LIMITS.attemptsPerHour },
  ];
  if (ipHash) {
    checks.push({
      where: and(eq(appEvents.type, EVENT_TYPES.VIN_ATTEMPT), sql`${appEvents.metadata} ->> 'ipHash' = ${ipHash}`, since(HOUR)),
      limit: VIN_LIMITS.attemptsPerHourPerIp,
      windowMs: HOUR,
      over: (n) => n > VIN_LIMITS.attemptsPerHourPerIp,
    });
  }
  let wait = 0;
  for (const c of checks) {
    if (c.over(await count(c.where))) wait = Math.max(wait, await retryAfterSeconds(c.where, c.limit, c.windowMs));
  }
  if (wait === 0) return null;
  return NextResponse.json(
    { code: "VIN_RATE_LIMITED", error: "Too many VIN attempts. Wait a bit and try again. Nothing was added." },
    { status: 429, headers: { "Retry-After": String(wait) } },
  );
}

/** Call when a lookup ended in the generic claim-required answer, so repeated probing runs out of budget. */
export async function noteVinCollision(userId: string): Promise<void> {
  await db.insert(appEvents).values({ id: randomUUID(), type: EVENT_TYPES.VIN_COLLISION, userId, metadata: null });
}
