import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";
import { resolveDatabaseUrl } from "./resolveDatabaseUrl";

// One pool per server process. Production and local use DATABASE_URL; Vercel Preview deployments use only
// PREVIEW_DB_DATABASE_URL (never the production database, see resolveDatabaseUrl.ts). Locally it's the
// sandbox's own Postgres (see build notes for the one-time local setup commands).
//
// Failure behaviour (104-A). The pool used to have no timeouts and no 'error' listener, so:
//   * a database that accepts connections and then goes silent parked every query that touched it, and each parked query held
//     one of the 10 connections for good: after 10 such requests the whole app stayed dead after the database came back,
//     until a restart (measured against a real server: login, signup and reset all hung forever after 14 hung logins);
//   * a connection reset while idle (a restart, scale-to-zero) raised an unhandled 'error' event, which crashes the process.
// Now: connecting (or waiting for a free connection) gives up after 10 s, a query gets 60 s (a query that times out releases its
// connection back as broken, so the pool replaces it), keep-alive is on, and an idle error is logged and the connection dropped.
// Both limits are far above any normal request and are env-tunable (DB_CONNECT_TIMEOUT_MS / DB_QUERY_TIMEOUT_MS) for tests.
// The auth limiter has its own, smaller pool with tighter deadlines: src/lib/limiterDb.ts.
const positive = (value: string | undefined, fallback: number): number => {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : fallback;
};

const pool = new Pool({
  connectionString: resolveDatabaseUrl(process.env),
  connectionTimeoutMillis: positive(process.env.DB_CONNECT_TIMEOUT_MS, 10_000),
  query_timeout: positive(process.env.DB_QUERY_TIMEOUT_MS, 60_000),
  keepAlive: true,
});
pool.on("error", (err) => console.error("[db] idle connection error (connection discarded)", err.message));
// Same for checked-out clients: the listener exists from creation, so a backend terminated while connecting cannot be an uncaught exception.
pool.on("connect", (client) => { client.on("error", () => undefined); });

export const db = drizzle(pool, { schema });
