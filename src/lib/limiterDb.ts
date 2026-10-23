import { Pool, type PoolClient } from "pg";
import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { resolveDatabaseUrl } from "@/db/resolveDatabaseUrl";
import { describeError, isSensitiveError } from "@/lib/dbErrorLogSafe";

// DEDICATED DATABASE ACCESS FOR THE AUTH LIMITER (src/lib/authGuard.ts).
//
// Why it is not the shared pool (src/db/index.ts). The review of PR #81 found that a hung database or killed connections wedged
// the limiter until the app restarted, and could take the whole process with it:
//   * the shared pool has no connect or query timeout, so a database that accepts the connection and never answers parks a
//     request forever, and the limiter's transaction slots with it;
//   * drizzle's transaction() runs BEGIN outside its try block, so a connection that dies right then is never released, and
//     enough of those exhaust the pool for every route.
// So the limiter now owns a small pool and does its own BEGIN / COMMIT / ROLLBACK, with a deadline on every step and a rule
// that a client which failed, timed out or was abandoned is DESTROYED, never handed back. Capacity can therefore not leak:
// every unit of work ends within `deadlineMs`, and its client is either returned healthy or thrown away.
//
// Footprint: at most `max` (5) connections per server instance, opened on demand and closed after `idleTimeoutMs` idle, so a
// quiet instance holds none. That is IN ADDITION to the shared pool's default 10 (see docs/auth/ABUSE-CONTROLS.md, "Connection
// capacity": the database's connection limit is a merge gate that has to be checked by the owner).
//
// Contention vs infrastructure failure. A lock_timeout / statement_timeout answer from the server (SQLSTATE 55P03 / 57014) means
// the database is alive and busy: authGuard treats that as BUSY and DENIES. Everything else that goes wrong here (cannot connect,
// no answer by the deadline, connection reset, terminated backend, pool error) is a STORE FAILURE: this module throws and
// authGuard's callers apply their approved policy (login fails open for throttling only, the other three flows fail closed).

export const LIMITER_POOL = {
  max: 5, // connections per instance, hard cap
  connectTimeoutMs: 2500, // waiting for a free client AND establishing a new connection (including the startup handshake)
  idleTimeoutMs: 10_000, // an idle limiter connection is closed after this, so a quiet instance holds none
  queryTimeoutMs: 4500, // client side, per statement: covers a server that stops answering (server-side timers cannot fire then)
  deadlineMs: 6000, // hard cap for one unit of work: connect + BEGIN ... COMMIT
} as const;

export class LimiterStoreError extends Error {
  constructor(message: string, readonly reason: "deadline" | "pool" | "connection", options?: { cause?: unknown }) {
    super(message, options);
    this.name = "LimiterStoreError";
  }
}

export type LimiterDb = NodePgDatabase;

let pool: Pool | null = null;
function getPool(): Pool {
  if (pool) return pool;
  const p = new Pool({
    connectionString: resolveDatabaseUrl(process.env),
    max: LIMITER_POOL.max,
    connectionTimeoutMillis: LIMITER_POOL.connectTimeoutMs,
    idleTimeoutMillis: LIMITER_POOL.idleTimeoutMs,
    query_timeout: LIMITER_POOL.queryTimeoutMs,
    keepAlive: true,
    keepAliveInitialDelayMillis: 5000,
    application_name: "crankcase-limiter",
  });
  // An idle connection that the server drops raises 'error' on the pool. Without a listener that is an uncaught exception.
  p.on("error", (err) => console.error("[auth-limiter] idle connection error (connection discarded)", describeError(err)));
  // Every client gets a permanent error listener THE MOMENT it is created ('connect' fires before the pool removes its own idle listener).
  // A backend terminated right as its connection became ready sends FATAL 57P01 in the same network chunk as ReadyForQuery; with no
  // listener in that window the 'error' is an uncaught exception no matter what the caller does afterwards (unit R22c). The error still
  // reaches the caller as a failed query; the listener only stops it being fatal to the process.
  p.on("connect", (client) => { client.on("error", () => undefined); });
  pool = p;
  return p;
}

/** How many limiter connections exist right now, for tests and diagnostics. */
export const limiterPoolStats = () => (pool ? { total: pool.totalCount, idle: pool.idleCount, waiting: pool.waitingCount } : { total: 0, idle: 0, waiting: 0 });

/** Close the pool (tests). The next call opens a new one. */
export async function closeLimiterPool(): Promise<void> {
  const p = pool;
  pool = null;
  if (p) await p.end().catch(() => undefined);
}

/** Throw a client away for good: pool bookkeeping first (so capacity is free at once), then the socket, even if the peer is silent. */
function destroy(client: PoolClient): void {
  try {
    client.release(true);
  } catch {
    /* already gone */
  }
  try {
    (client as unknown as { connection?: { stream?: { destroy?: () => void } } }).connection?.stream?.destroy?.();
  } catch {
    /* already gone */
  }
}

// An error that carries a SQLSTATE came back from a live server, so the connection itself is fine once the transaction is rolled back.
// drizzle wraps the driver error and keeps it in .cause, so look at both.
const sqlState = (err: unknown): string | undefined => {
  const e = err as { code?: unknown; cause?: { code?: unknown } } | null;
  const c = typeof e?.code === "string" ? e.code : typeof e?.cause?.code === "string" ? e.cause.code : undefined;
  return c && /^[0-9A-Z]{5}$/.test(c) ? c : undefined;
};
// Connection-level SQLSTATEs (08 connection exception, 57P01-57P03 admin shutdown / crash / cannot connect now, 53 resources, 58 system,
// XX internal) mean the backend is going away: never try to reuse that connection.
const answeredByServer = (err: unknown): boolean => {
  const c = sqlState(err);
  return c !== undefined && !/^(08|57P0|53|58|XX)/.test(c);
};

/**
 * Run `work` on a limiter connection, optionally inside BEGIN ... COMMIT, and ALWAYS finish (resolve or throw) within `deadlineMs`.
 * On any failure other than a clean server-side error the connection is destroyed rather than returned to the pool.
 */
export async function withLimiterClient<T>(
  work: (db: LimiterDb) => Promise<T>,
  options: { transaction?: boolean; deadlineMs?: number } = {},
): Promise<T> {
  const deadlineMs = options.deadlineMs ?? LIMITER_POOL.deadlineMs;
  let client: PoolClient | undefined;
  let finished = false; // the caller has its answer (or its error); a client that shows up later is thrown away
  let healthy = false;
  let timer: ReturnType<typeof setTimeout> | undefined;

  const deadline = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new LimiterStoreError(`limiter work exceeded ${deadlineMs} ms`, "deadline")), deadlineMs);
  });
  const job = (async (): Promise<T> => {
    let c: PoolClient;
    try {
      c = await getPool().connect(); // bounded by connectionTimeoutMillis
    } catch (err) {
      throw new LimiterStoreError("limiter could not get a database connection", "pool", { cause: err });
    }
    if (finished) { // the deadline already answered for us
      destroy(c);
      throw new LimiterStoreError("late connection discarded", "deadline");
    }
    client = c;
    const db = drizzle(c);
    if (!options.transaction) {
      try {
        const out = await work(db);
        healthy = true;
        return out;
      } catch (err) {
        if (answeredByServer(err)) healthy = true; // no transaction was open, so a server-side error leaves the connection clean
        throw err;
      }
    }
    await c.query("BEGIN");
    try {
      const out = await work(db);
      await c.query("COMMIT");
      healthy = true;
      return out;
    } catch (err) {
      if (answeredByServer(err)) {
        try {
          await c.query("ROLLBACK");
          healthy = true;
        } catch {
          /* leave healthy=false: the connection is destroyed below */
        }
      }
      throw err;
    }
  })();
  job.catch(() => undefined); // if the deadline wins, the job's later failure must not be an unhandled rejection

  try {
    return await Promise.race([job, deadline]);
  } catch (err) {
    // Anything that is not a clean answer from the server (a client-side query timeout, a reset or terminated connection) is a STORE
    // FAILURE and is reported as one. A server-answered error (lock / statement timeout, a real SQL error) keeps its own shape.
    if (err instanceof LimiterStoreError || answeredByServer(err)) throw err;
    // The wrapper's message is what callers log: a database error's own message is SQL + parameters, so it is replaced by fixed text.
    throw new LimiterStoreError(err instanceof Error && !isSensitiveError(err) ? err.message : "limiter connection failed", "connection", { cause: err });
  } finally {
    finished = true;
    if (timer) clearTimeout(timer);
    if (client) {
      if (healthy) client.release();
      else destroy(client);
    }
  }
}
