import { createHash, randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { and, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import { appEvents } from "@/db/schema";
import { EVENT_TYPES } from "@/lib/events";

// ---------------------------------------------------------------------------
// Abuse throttle for the four credential flows: login, signup, forgot-password, reset-password. Free, no new service,
// no new table, no migration: counters are rows in app_events (type "auth.throttle").
//
// HOW A RESERVATION WORKS ("reserve, check, release")
//   One database transaction per attempt:
//     1. take a Postgres advisory lock for every limiter key the flow uses (sorted, so two requests cannot deadlock);
//     2. count the live rows for each key in its rolling window;
//     3. if ANY key is already at its limit: deny, write NOTHING (a denied attempt never occupies a slot, so an
//        attacker cannot keep a victim locked out by hammering, and the window drains on its own);
//     4. otherwise write one row per key and commit.
//   The advisory lock is what makes it exact across Vercel instances and parallel requests: the old insert-then-count
//   scheme (vinGuard) admitted 0 of a 300-wide burst because every request counted everyone else's rows, and could
//   over-admit by a few when commits interleaved. Here a burst of 80 against a limit of 8 admits exactly 8, and the next
//   legitimate attempt is judged on the true count. Different keys never contend. The lock is transaction-scoped, so it is
//   released on commit or on a dropped connection, never leaked.
//   A flow that wants its slot back (a successful login) calls release().
//
// WHAT IS STORED: a salted SHA-256 of the normalised email and of the network address, per scope, in object_id. No raw
// email, no raw address. If there is no network address (no x-forwarded-for / x-real-ip) the address keys are skipped:
// there is no shared "unknown" bucket that one client could fill to lock everyone out.
//
// FAILURE: reserve() THROWS when the store is unreachable. The caller decides (login fails open for throttling only,
// the other three fail closed). See each route.
//
// LIMITS (rolling windows, see LIMITS below and docs/auth/ABUSE-CONTROLS.md).
// The address is read from x-forwarded-for, which Vercel sets itself; on any other host it is only as trustworthy as that
// host's proxy. Address limits are deliberately loose: carrier and office networks put many real customers behind one.
// ---------------------------------------------------------------------------

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;

export const LIMITS = {
  login: {
    accountIp: { limit: 8, windowMs: 15 * MINUTE },
    ip: { limit: 40, windowMs: 15 * MINUTE },
    account: { limit: 30, windowMs: HOUR },
  },
  signup: {
    ip: { limit: 10, windowMs: HOUR },
    email: { limit: 3, windowMs: HOUR },
  },
  forgot: {
    ip: { limit: 5, windowMs: HOUR },
    email: { limit: 3, windowMs: HOUR },
  },
  reset: {
    ip: { limit: 10, windowMs: HOUR },
    user: { limit: 10, windowMs: HOUR },
  },
} as const;

export interface Rule {
  /** Short name of the limiter, e.g. "login.account_ip". Also the row's object_type. */
  scope: string;
  /** Salted hash identifying the subject; the row's object_id. */
  key: string;
  limit: number;
  windowMs: number;
}
export interface Reservation {
  ids: string[];
}
export type ReserveResult =
  | { ok: true; reservation: Reservation }
  // busy: the limiter could not get a decision in bounded time (contention on a key, or the waiting room is full). The caller
  // DENIES, exactly like a limit hit: contention must never turn into a free pass. Nothing was written.
  | { ok: false; busy?: true; denied: { scope: string; retryAfter: number }[]; retryAfter: number };

// ----- keys -----------------------------------------------------------------

const digest = (scope: string, value: string): string =>
  createHash("sha256").update(`${process.env.AUTH_SECRET ?? "crankcase"}|auth-throttle|${scope}|${value}`).digest("hex").slice(0, 32);

export const normaliseEmail = (email: string): string => email.trim().toLowerCase();

export function clientIp(request: Request): string | null {
  const fwd = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const ip = fwd || request.headers.get("x-real-ip")?.trim();
  return ip || null;
}

export function loginRules(email: string, ip: string | null): Rule[] {
  const e = normaliseEmail(email);
  const rules: Rule[] = [];
  // An empty email (malformed request) gets no account keys: they would all share one bucket and lock out nobody useful.
  if (e) rules.push({ scope: "login.account", key: digest("login.account", e), ...LIMITS.login.account });
  if (ip) {
    if (e) rules.push({ scope: "login.account_ip", key: digest("login.account_ip", `${e}|${ip}`), ...LIMITS.login.accountIp });
    rules.push({ scope: "login.ip", key: digest("login.ip", ip), ...LIMITS.login.ip });
  }
  return rules;
}
export function signupRules(email: string, ip: string | null): Rule[] {
  const rules: Rule[] = [{ scope: "signup.email", key: digest("signup.email", normaliseEmail(email)), ...LIMITS.signup.email }];
  if (ip) rules.push({ scope: "signup.ip", key: digest("signup.ip", ip), ...LIMITS.signup.ip });
  return rules;
}
export function forgotRules(email: string, ip: string | null): Rule[] {
  const rules: Rule[] = [{ scope: "forgot.email", key: digest("forgot.email", normaliseEmail(email)), ...LIMITS.forgot.email }];
  if (ip) rules.push({ scope: "forgot.ip", key: digest("forgot.ip", ip), ...LIMITS.forgot.ip });
  return rules;
}
export function resetRules(userId: string | null, ip: string | null): Rule[] {
  const rules: Rule[] = [];
  if (userId) rules.push({ scope: "reset.user", key: digest("reset.user", userId), ...LIMITS.reset.user });
  if (ip) rules.push({ scope: "reset.ip", key: digest("reset.ip", ip), ...LIMITS.reset.ip });
  return rules;
}

// ----- the reservation ------------------------------------------------------

// Windows are evaluated by the database against its own clock. app_events.created_at is a timestamp WITHOUT time zone filled by
// the database default, so comparing it with a JavaScript Date would be wrong whenever the app and the database disagree.
const within = (windowMs: number) => sql`${appEvents.createdAt} > now() - make_interval(secs => ${windowMs / 1000})`;
const forKey = (key: string) => and(eq(appEvents.type, EVENT_TYPES.AUTH_THROTTLE), eq(appEvents.objectId, key));

// ----- bounded waiting ------------------------------------------------------------------------------------------------------
// Review finding (M3): every reservation held a pooled connection while it waited on the advisory lock, so a flood on ONE key
// could park the whole pool (default max 10) and slow every other query in the process (measured 17 ms -> ~900 ms for an
// unrelated user). Three layers now bound that, with no infrastructure change:
//   1. per-key FIFO queue IN MEMORY: requests for the same key wait their turn without holding a connection, so a hot key
//      occupies at most one connection and unrelated keys never queue behind it. Admission stays exact (FIFO, one at a time
//      per key per process; across processes the database lock does the same job).
//   2. a global cap on database transactions in flight (maxConcurrentTx), below the default pool size, so the limiter can
//      never take the whole pool.
//   3. deadlines: a request that cannot start within queueDeadlineMs, or whose database lock wait exceeds lockTimeoutMs, is
//      answered BUSY (denied, Retry-After) rather than waiting forever. statementTimeoutMs bounds a slow count the same way.
// Busy is a denial, never a fail-open: otherwise flooding a key would unthrottle the attacker's own requests.
export const BOUNDS = {
  lockTimeoutMs: 1500,
  statementTimeoutMs: 4000,
  queueDeadlineMs: 3000,
  maxWaitersPerKey: 200,
  maxWaitersGlobal: 400,
  maxConcurrentTx: 5,
} as const;
const BUSY_RETRY_AFTER = 2;

const stats = { maxConcurrentTx: 0, busyDenials: 0 };
export const limiterStats = () => ({ ...stats });
export const resetLimiterStats = () => { stats.maxConcurrentTx = 0; stats.busyDenials = 0; };

const tails = new Map<string, Promise<void>>();
const depth = new Map<string, number>();

/** Wait for this key's turn. Resolves to a release function, or null if the key's queue is full or the deadline passes first. */
function lockKey(key: string, deadlineAt: number): Promise<(() => void) | null> {
  const d = depth.get(key) ?? 0;
  if (d >= BOUNDS.maxWaitersPerKey) return Promise.resolve(null);
  depth.set(key, d + 1);
  const prev = tails.get(key) ?? Promise.resolve();
  let baton!: () => void;
  const mine = new Promise<void>((r) => (baton = r));
  const tail = prev.then(() => mine);
  tails.set(key, tail);
  const finish = () => {
    const left = (depth.get(key) ?? 1) - 1;
    if (left <= 0) depth.delete(key); else depth.set(key, left);
    if (tails.get(key) === tail) tails.delete(key);
    baton();
  };
  return new Promise((resolve) => {
    let gaveUp = false;
    const timer = setTimeout(() => { gaveUp = true; resolve(null); }, Math.max(0, deadlineAt - Date.now()));
    prev.then(() => {
      if (gaveUp) { finish(); return; } // we stopped waiting: pass the turn on without ever running
      clearTimeout(timer);
      resolve(finish);
    });
  });
}

let activeTx = 0;
const txQueue: Array<() => void> = [];
function acquireTx(deadlineAt: number): Promise<(() => void) | null> {
  const release = () => {
    activeTx--;
    const next = txQueue.shift();
    if (next) next();
  };
  const take = () => { activeTx++; if (activeTx > stats.maxConcurrentTx) stats.maxConcurrentTx = activeTx; return release; };
  if (activeTx < BOUNDS.maxConcurrentTx) return Promise.resolve(take());
  if (txQueue.length >= BOUNDS.maxWaitersGlobal) return Promise.resolve(null);
  return new Promise((resolve) => {
    const entry = () => { clearTimeout(timer); resolve(take()); };
    const timer = setTimeout(() => {
      const i = txQueue.indexOf(entry);
      if (i >= 0) txQueue.splice(i, 1);
      resolve(null);
    }, Math.max(0, deadlineAt - Date.now()));
    txQueue.push(entry);
  });
}

// 55P03 lock_not_available (lock_timeout), 57014 query_canceled (statement_timeout). drizzle wraps the driver error in .cause.
const isContentionTimeout = (err: unknown): boolean => {
  const e = err as { code?: string; cause?: { code?: string } } | null;
  const code = e?.code ?? e?.cause?.code;
  return code === "55P03" || code === "57014";
};
const busy = (): ReserveResult => {
  stats.busyDenials++;
  return { ok: false, busy: true, denied: [{ scope: "busy", retryAfter: BUSY_RETRY_AFTER }], retryAfter: BUSY_RETRY_AFTER };
};

/**
 * Reserve one attempt against every rule, atomically. Returns ok (rows written, hand the reservation to release() if the
 * attempt should not count), not ok with the limits that are full (nothing written, with how long to wait), or not ok and busy
 * (could not decide in bounded time: deny). THROWS only if the store cannot be reached.
 */
export async function reserve(rules: Rule[]): Promise<ReserveResult> {
  if (rules.length === 0) return { ok: true, reservation: { ids: [] } };
  const sorted = [...rules].sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));
  const deadlineAt = Date.now() + BOUNDS.queueDeadlineMs;

  const releases: Array<() => void> = [];
  const releaseAll = () => { for (const r of releases.reverse()) r(); releases.length = 0; };
  for (const r of sorted) { // sorted: two requests can never wait on each other's keys
    const rel = await lockKey(r.key, deadlineAt);
    if (!rel) { releaseAll(); return busy(); }
    releases.push(rel);
  }
  const slot = await acquireTx(deadlineAt);
  if (!slot) { releaseAll(); return busy(); }

  let result: ReserveResult;
  try {
    result = await db.transaction(async (tx): Promise<ReserveResult> => {
      await tx.execute(sql`select set_config('lock_timeout', ${String(BOUNDS.lockTimeoutMs)}, true), set_config('statement_timeout', ${String(BOUNDS.statementTimeoutMs)}, true)`);
      for (const r of sorted) await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${r.key}, 0))`);
      const denied: { scope: string; retryAfter: number }[] = [];
      for (const r of sorted) {
        const n = Number((await tx.select({ n: sql<number>`count(*)` }).from(appEvents).where(and(forKey(r.key), within(r.windowMs))))[0]?.n ?? 0);
        if (n < r.limit) continue;
        // When the limit-th newest row ages out of the window, one more attempt is allowed.
        const rows = await tx
          .select({ left: sql<number>`ceil(extract(epoch from (${appEvents.createdAt} + make_interval(secs => ${r.windowMs / 1000}) - now())))` })
          .from(appEvents)
          .where(and(forKey(r.key), within(r.windowMs)))
          .orderBy(sql`${appEvents.createdAt} desc`)
          .limit(r.limit);
        const left = Number(rows[rows.length - 1]?.left);
        denied.push({ scope: r.scope, retryAfter: Number.isFinite(left) ? Math.min(Math.ceil(r.windowMs / 1000), Math.max(1, left)) : 60 });
      }
      if (denied.length > 0) return { ok: false, denied, retryAfter: Math.max(...denied.map((d) => d.retryAfter)) };
      const ids = sorted.map(() => randomUUID());
      await tx.insert(appEvents).values(sorted.map((r, i) => ({ id: ids[i], type: EVENT_TYPES.AUTH_THROTTLE, objectType: r.scope, objectId: r.key })));
      return { ok: true, reservation: { ids } };
    });
  } catch (err) {
    if (isContentionTimeout(err)) return busy();
    throw err;
  } finally {
    slot();
    releaseAll();
  }
  if (result.ok && Math.random() < PRUNE_ODDS) await pruneThrottleRows().catch(() => undefined);
  return result;
}

/** Give the slots back (a successful login). Best effort: a failure here only leaves a slot to age out. */
export async function release(reservation: Reservation | null | undefined): Promise<void> {
  if (!reservation || reservation.ids.length === 0) return;
  try {
    await db.delete(appEvents).where(inArray(appEvents.id, reservation.ids));
  } catch (err) {
    console.error("[auth-limiter] release failed; the slots will age out", err);
  }
}

// Housekeeping: nothing reads a counter row once its window has passed, so a small share of reservations sweeps the old ones.
const PRUNE_ODDS = 0.01;
export const PRUNE_AFTER_MS = 3 * HOUR; // longer than the longest window (1 h)
export const PRUNE_BATCH = 5000; // one sweep deletes at most this many rows, so a sweep over a big table stays short
export async function pruneThrottleRows(): Promise<void> {
  await db.execute(sql`
    delete from app_events where id in (
      select id from app_events
      where type = ${EVENT_TYPES.AUTH_THROTTLE} and created_at < now() - make_interval(secs => ${PRUNE_AFTER_MS / 1000})
      limit ${PRUNE_BATCH}
    )`);
}

// ----- responses ------------------------------------------------------------

/** The 429 for signup, forgot-password and reset-password. Says nothing about whether any account exists. */
export function tooManyRequests(retryAfter: number, error = "Too many attempts. Wait a bit and try again."): NextResponse {
  return NextResponse.json({ error, retryAfter }, { status: 429, headers: { "Retry-After": String(retryAfter) } });
}

/** The 503 when the limiter store is down for a flow that must fail closed. Generic by design. */
export function temporarilyUnavailable(error = "This is temporarily unavailable. Try again in a minute."): NextResponse {
  return NextResponse.json({ error }, { status: 503, headers: { "Retry-After": "30" } });
}

/** Console line every fail-open / fail-closed event writes, so an outage is greppable in the platform logs. */
export function logLimiterFailure(flow: string, mode: "FAIL-OPEN" | "FAIL-CLOSED", err: unknown): void {
  console.error(`[auth-limiter] ${mode} flow=${flow}`, err instanceof Error ? err.message : err);
}
