import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

// One pool per server process. On Vercel this connects to Vercel Postgres
// via the same DATABASE_URL env var; locally it's the sandbox's own
// Postgres (see build notes for the one-time local setup commands).
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

export const db = drizzle(pool, { schema });
