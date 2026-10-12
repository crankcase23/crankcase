import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";
import { resolveDatabaseUrl } from "./resolveDatabaseUrl";

// One pool per server process. Production and local use DATABASE_URL; Vercel Preview deployments use only
// PREVIEW_DB_DATABASE_URL (never the production database, see resolveDatabaseUrl.ts). Locally it's the
// sandbox's own Postgres (see build notes for the one-time local setup commands).
const pool = new Pool({ connectionString: resolveDatabaseUrl(process.env) });

export const db = drizzle(pool, { schema });
