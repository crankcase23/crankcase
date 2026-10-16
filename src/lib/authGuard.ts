import { createHash, randomUUID } from "node:crypto";
import { isIPv6 } from "node:net";
import { NextResponse } from "next/server";
import { and, eq, inArray, sql } from "drizzle-orm";
import { appEvents } from "@/db/schema";
import { EVENT_TYPES } from "@/lib/events";
import { withLimiterClient } from "@/lib/limiterDb";

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
// email, no raw address. The address is canonical (see clientIp): every spelling of one IPv4 address is one key, and an
// IPv6 client is keyed by its /64. When NO trustworthy address can be established, login still applies all three of its
// rules, with the address replaced by one shared "untrusted" pseudo-address (a flood from unidentifiable sources trips the
// per-address limit for everyone in that state, which is the safe direction); the other three flows refuse (see routes).
//
// FAILURE: reserve() THROWS (LimiterStoreError) when the store is unreachable or does not answer in time. The caller decides
// (login fails open for throttling only, the other three fail closed). Contention (a lock or statement timeout the database
// itself reported) is not a failure: it is BUSY and DENIES. See src/lib/limiterDb.ts for the dedicated pool and the deadlines.
//
// LIMITS (rolling windows, see LIMITS below and docs/auth/ABUSE-CONTROLS.md).
// Address limits are deliberately loose: carrier and office networks put many real customers behind one.
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

// ----- the client address ---------------------------------------------------------------------------------------------------
// Review finding (104-A): the address was entry 0 of x-forwarded-for, taken raw. A client can send that header itself, so it
// chose its own key (a rotating value is a fresh bucket per request) and `,` produced no key at all (every address limit
// skipped). Now only a header the PLATFORM sets is read, as exactly one canonical address; anything else is "untrusted".
//   * Vercel (VERCEL is set): x-vercel-forwarded-for and x-real-ip. Vercel documents that it overwrites x-forwarded-for with the
//     connecting address and does not forward external values; x-vercel-forwarded-for carries the same value and is not
//     overwritten by an upstream proxy. If both are present they must agree. A client-sent x-forwarded-for is never read.
//   * AUTH_TRUSTED_IP_HEADER=<name> (self-hosted behind a proxy YOU control that sets that header and strips it from clients):
//     only that header.
//   * NODE_ENV other than production (next dev, tests): x-forwarded-for / x-real-ip, so local runs and the suites can pick
//     their own address.
//   * Production anywhere else: nothing is trusted, the address is unknown.
const TRUSTED_HEADER_NAME = /^[a-z0-9-]{1,64}$/i;
const IPV4 = /^(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)$/;

function expandIPv6(addr: string): number[] | null {
  if (!isIPv6(addr)) return null;
  let a = addr.toLowerCase();
  const tail = /(\d+\.\d+\.\d+\.\d+)$/.exec(a); // embedded IPv4 in the last 32 bits
  if (tail) {
    const m = IPV4.exec(tail[1]);
    if (!m) return null;
    a = a.slice(0, -tail[1].length) + (((+m[1] << 8) | +m[2]).toString(16)) + ":" + (((+m[3] << 8) | +m[4]).toString(16));
  }
  const halves = a.split("::");
  if (halves.length > 2) return null;
  const head = halves[0] ? halves[0].split(":") : [];
  const rest = halves.length === 2 && halves[1] ? halves[1].split(":") : [];
  const fill = halves.length === 2 ? 8 - head.length - rest.length : 0;
  if (fill < 0 || (halves.length === 1 && head.length !== 8)) return null;
  const groups = [...head, ...Array(fill).fill("0"), ...rest].map((g) => parseInt(g, 16));
  return groups.length === 8 && groups.every((g) => Number.isInteger(g) && g >= 0 && g <= 0xffff) ? groups : null;
}

/** One address in, one canonical key out (null: not a single, well-formed address). IPv4-mapped IPv6 is the IPv4 address; IPv6 is its /64. */
export function canonicalIp(raw: string): string | null {
  let v = raw.trim();
  if (!v || v.length > 64 || /[\s,;%/]/.test(v)) return null;
  const bracketed = /^\[([^\]]+)\](?::(\d{1,5}))?$/.exec(v);
  if (bracketed) {
    if (bracketed[2] !== undefined && Number(bracketed[2]) > 65535) return null;
    v = bracketed[1];
    if (!v.includes(":")) return null; // [1.2.3.4] is not a valid form
  } else if (/^[0-9.]+:\d+$/.test(v)) {
    const [host, port] = v.split(":");
    if (Number(port) < 1 || Number(port) > 65535) return null;
    v = host;
  }
  if (IPV4.test(v)) return v;
  const g = expandIPv6(v);
  if (!g) return null;
  if (g.slice(0, 5).every((x) => x === 0) && g[5] === 0xffff) return `${g[6] >> 8}.${g[6] & 255}.${g[7] >> 8}.${g[7] & 255}`;
  return `${g.slice(0, 4).map((x) => x.toString(16)).join(":")}::/64`;
}

/** Read ONE header as ONE canonical address. undefined: header absent. null: present but unusable or a list. */
function oneAddress(request: Request, name: string): string | null | undefined {
  const raw = request.headers.get(name);
  return raw === null ? undefined : canonicalIp(raw);
}

/** The trustworthy client address, canonical, or null when none can be established (see the block comment above). */
export function clientIp(request: Request): string | null {
  const named = process.env.AUTH_TRUSTED_IP_HEADER?.trim();
  if (named) return TRUSTED_HEADER_NAME.test(named) ? (oneAddress(request, named) ?? null) : null;
  if (process.env.VERCEL) {
    const a = oneAddress(request, "x-vercel-forwarded-for");
    const b = oneAddress(request, "x-real-ip");
    if (a === null || b === null) return null; // present but unusable
    if (a !== undefined && b !== undefined && a !== b) return null; // two platform headers that disagree: ambiguous
    return a ?? b ?? null;
  }
  if (process.env.NODE_ENV !== "production") {
    const a = oneAddress(request, "x-forwarded-for");
    if (a !== undefined) return a;
    return oneAddress(request, "x-real-ip") ?? null;
  }
  return null;
}

/** The address login keys use when none is trustworthy: one shared bucket, so unidentifiable traffic is still limited per account AND in total. */
export const UNTRUSTED_ADDRESS = "untrusted";

export function loginRules(email: string, ip: string | null): Rule[] {
  const e = normaliseEmail(email);
  const rules: Rule[] = [];
  // An empty email (malformed request) gets no account keys: they would all share one bucket and lock out nobody useful.
  // (It still gets the address rule, so a malformed flood is charged to its address.)
  const addr = ip ?? UNTRUSTED_ADDRESS; // never skip the address rules: a missing address must not switch them off
  if (e) rules.push({ scope: "login.account", key: digest("login.account", e), ...LIMITS.login.account });
  if (e) rules.push({ scope: "login.account_ip", key: digest("login.account_ip", `${e}|${addr}`), ...LIMITS.login.accountIp });
  rules.push({ scope: "login.ip", key: digest("login.ip", addr), ...LIMITS.login.ip });
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

const stats = { maxConcurrentTx: 0, busyDenials: 0, peakKeyDepth: 0, peakQueue: 0, storeFailures: 0 };
export const limiterStats = () => ({ ...stats, activeTx });
export const resetLimiterStats = () => { stats.maxConcurrentTx = 0; stats.busyDenials = 0; stats.peakKeyDepth = 0; stats.peakQueue = 0; stats.storeFailures = 0; };

const tails = new Map<string, Promise<void>>();
const depth = new Map<string, number>();

/** Wait for this key's turn. Resolves to a release function, or null if the key's queue is full or the deadline passes first. */
function lockKey(key: string, deadlineAt: number): Promise<(() => void) | null> {
  const d = depth.get(key) ?? 0;
  if (d >= BOUNDS.maxWaitersPerKey) return Promise.resolve(null);
  depth.set(key, d + 1);
  if (d + 1 > stats.peakKeyDepth) stats.peakKeyDepth = d + 1;
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
    if (txQueue.length > stats.peakQueue) stats.peakQueue = txQueue.length;
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
    result = await withLimiterClient(async (tx): Promise<ReserveResult> => {
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
    }, { transaction: true });
  } catch (err) {
    if (isContentionTimeout(err)) return busy();
    stats.storeFailures++;
    throw err; // LimiterStoreError (no answer in time, cannot connect, connection reset, ...): the caller applies its policy
  } finally {
    slot();
    releaseAll();
  }
  // Housekeeping never competes with attempts: only when there is spare transaction capacity, never awaited, never throws.
  if (result.ok && Math.random() < PRUNE_ODDS && activeTx < BOUNDS.maxConcurrentTx - 1) void pruneThrottleRows().catch(() => undefined);
  return result;
}

const RELEASE_DEADLINE_MS = 2500;
/** Give the slots back (a successful login). Best effort: a failure here only leaves a slot to age out. */
export async function release(reservation: Reservation | null | undefined): Promise<void> {
  if (!reservation || reservation.ids.length === 0) return;
  try {
    await withLimiterClient((d) => d.delete(appEvents).where(inArray(appEvents.id, reservation.ids)), { deadlineMs: RELEASE_DEADLINE_MS });
  } catch (err) {
    console.error("[auth-limiter] release failed; the slots will age out", err);
  }
}

// Housekeeping: nothing reads a counter row once its window has passed, so a small share of reservations sweeps the old ones.
const PRUNE_ODDS = 0.01;
export const PRUNE_AFTER_MS = 3 * HOUR; // longer than the longest window (1 h)
export const PRUNE_BATCH = 5000; // one sweep deletes at most this many rows, so a sweep over a big table stays short
export async function pruneThrottleRows(): Promise<void> {
  await withLimiterClient(async (d) => {
    await d.execute(sql`
      delete from app_events where id in (
        select id from app_events
        where type = ${EVENT_TYPES.AUTH_THROTTLE} and created_at < now() - make_interval(secs => ${PRUNE_AFTER_MS / 1000})
        limit ${PRUNE_BATCH}
      )`);
  }, { deadlineMs: 5000 });
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
