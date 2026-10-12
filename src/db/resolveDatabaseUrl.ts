// Which database a running instance talks to.
//
// Vercel Preview deployments must never touch the production database. The Neon integration for production writes
// DATABASE_URL (Production scope only); the separate Preview store writes PREVIEW_DB_DATABASE_URL (Preview scope only).
// This picks between them by VERCEL_ENV and FAILS CLOSED: a Preview deployment never falls back to DATABASE_URL,
// so a misconfigured scope breaks previews loudly instead of silently writing to production.
//
// Everywhere else (production, local dev, tests, CI builds with no VERCEL_ENV) DATABASE_URL is used, unchanged.

export type DbEnv = Record<string, string | undefined>;

export function resolveDatabaseUrl(env: DbEnv): string | undefined {
  if (env.VERCEL_ENV === "preview") return env.PREVIEW_DB_DATABASE_URL || undefined;
  return env.DATABASE_URL;
}
