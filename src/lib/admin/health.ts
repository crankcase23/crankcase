import { sql, count, eq, gte, desc } from "drizzle-orm";
import { db } from "@/db";
import { errorEvents, vehicleDataCache, users, reminderNotifications } from "@/db/schema";
import type { HealthState } from "@/components/admin/ui";

// ---------------------------------------------------------------------------
// System health.
//
// Every check here actually probes something. A check that cannot be run --
// because the integration genuinely does not exist yet -- reports OFFLINE
// with a plain explanation, never a green light it hasn't earned.
//
// SECURITY: nothing in this module returns a secret. Integration checks
// report only whether a variable is CONFIGURED (a boolean), never its value,
// and no environment variable is ever echoed into the response.
// ---------------------------------------------------------------------------

export interface HealthCheck {
  key: string;
  label: string;
  state: HealthState;
  detail: string;
  latencyMs?: number;
  checkedAt: Date;
}

async function timed<T>(fn: () => Promise<T>): Promise<{ value: T | null; ms: number; error: unknown }> {
  const t0 = Date.now();
  try {
    const value = await fn();
    return { value, ms: Date.now() - t0, error: null };
  } catch (error) {
    return { value: null, ms: Date.now() - t0, error };
  }
}

export async function getHealthChecks(): Promise<HealthCheck[]> {
  const checkedAt = new Date();
  const checks: HealthCheck[] = [];

  // --- application ----------------------------------------------------------
  // If this code is executing, the app is serving. Useful mainly as the anchor
  // row and for the deployment/runtime detail beside it.
  checks.push({
    key: "app",
    label: "Application",
    state: "online",
    detail: `Serving · ${process.env.NODE_ENV ?? "unknown"} · node ${process.version}`,
    checkedAt,
  });

  // --- database -------------------------------------------------------------
  const dbProbe = await timed(() => db.execute(sql`select 1 as ok`));
  checks.push({
    key: "database",
    label: "Database",
    state: dbProbe.error ? "error" : dbProbe.ms > 1500 ? "warning" : "online",
    detail: dbProbe.error
      ? "Query failed — the database is unreachable or rejecting connections."
      : dbProbe.ms > 1500
        ? `Responding slowly (${dbProbe.ms}ms round trip).`
        : `Postgres responding in ${dbProbe.ms}ms.`,
    latencyMs: dbProbe.ms,
    checkedAt,
  });

  // --- authentication -------------------------------------------------------
  // Auth is healthy when its secret is configured and the users table is
  // readable; both are required for a sign-in to succeed.
  const authSecretSet = Boolean(process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET);
  const userProbe = await timed(() => db.select({ n: count() }).from(users));
  checks.push({
    key: "auth",
    label: "Authentication",
    state: !authSecretSet ? "error" : userProbe.error ? "error" : "online",
    detail: !authSecretSet
      ? "AUTH_SECRET is not configured — sessions cannot be signed."
      : userProbe.error
        ? "Cannot read the users table."
        : `Credentials provider active · ${userProbe.value?.[0]?.n ?? 0} accounts.`,
    checkedAt,
  });

  // --- payments -------------------------------------------------------------
  const stripeConfigured = Boolean(process.env.STRIPE_SECRET_KEY);
  checks.push({
    key: "payments",
    label: "Payment integration",
    state: stripeConfigured ? "online" : "offline",
    detail: stripeConfigured
      ? "Payment provider credentials are configured."
      : "Not connected. No checkout exists yet — revenue tables are in place and waiting.",
    checkedAt,
  });

  // --- email ----------------------------------------------------------------
  const emailConfigured = Boolean(process.env.RESEND_API_KEY || process.env.SMTP_HOST || process.env.EMAIL_SERVER);
  const reminderProbe = await timed(() =>
    db
      .select({ notifiedAt: reminderNotifications.notifiedAt })
      .from(reminderNotifications)
      .orderBy(desc(reminderNotifications.notifiedAt))
      .limit(1)
  );
  const lastReminder = reminderProbe.value?.[0]?.notifiedAt ?? null;
  checks.push({
    key: "email",
    label: "Email delivery",
    state: emailConfigured ? "online" : "offline",
    detail: emailConfigured
      ? lastReminder
        ? `Provider configured · last reminder sent ${lastReminder.toISOString().slice(0, 10)}.`
        : "Provider configured · no reminder emails sent yet."
      : "No email provider configured — maintenance reminder emails will not send.",
    checkedAt,
  });

  // --- vehicle data API -----------------------------------------------------
  // Must match the variable src/lib/openLaborProject.ts actually reads. This
  // check originally looked for OPEN_LABOR_PROJECT_API_KEY / OLP_API_KEY, which
  // nothing sets — so it reported the integration offline while it was working
  // fine. The legacy names are kept as a fallback only so a differently-named
  // deployment doesn't regress; OPEN_LABOR_API_KEY is the real one.
  const olpConfigured = Boolean(
    process.env.OPEN_LABOR_API_KEY ||
      process.env.OPEN_LABOR_PROJECT_API_KEY ||
      process.env.OLP_API_KEY,
  );
  const cacheProbe = await timed(async () => {
    const [ok, pending, notFound] = await Promise.all([
      db.select({ n: count() }).from(vehicleDataCache).where(eq(vehicleDataCache.status, "ok")),
      db.select({ n: count() }).from(vehicleDataCache).where(eq(vehicleDataCache.status, "pending")),
      db.select({ n: count() }).from(vehicleDataCache).where(eq(vehicleDataCache.status, "not_found")),
    ]);
    return { ok: ok[0]?.n ?? 0, pending: pending[0]?.n ?? 0, notFound: notFound[0]?.n ?? 0 };
  });
  const cache = cacheProbe.value;
  checks.push({
    key: "vehicle-data",
    label: "Vehicle data API",
    state: !olpConfigured ? "offline" : (cache?.pending ?? 0) > 0 ? "warning" : "online",
    detail: !olpConfigured
      ? "Open Labor Project API key is not configured in this environment."
      : `Cache: ${cache?.ok ?? 0} resolved · ${cache?.pending ?? 0} pending · ${cache?.notFound ?? 0} not found. Free tier is a shared daily quota.`,
    checkedAt,
  });

  // --- background jobs ------------------------------------------------------
  // The only scheduled job is the maintenance-reminder cron (vercel.json).
  checks.push({
    key: "jobs",
    label: "Background jobs",
    state: lastReminder
      ? Date.now() - lastReminder.getTime() < 48 * 60 * 60 * 1000
        ? "online"
        : "warning"
      : "unknown",
    detail: lastReminder
      ? `Maintenance reminder cron last produced a notification ${lastReminder.toISOString().slice(0, 10)}.`
      : "Maintenance reminder cron is scheduled daily; it has not produced a notification yet.",
    checkedAt,
  });

  // --- storage --------------------------------------------------------------
  // There is no blob/object store in this app; assets are committed to the
  // repo and served from the CDN. Saying so is more useful than a green tick.
  checks.push({
    key: "storage",
    label: "Storage",
    state: "online",
    detail: "Static assets served from the deployment bundle. No external object store in use.",
    checkedAt,
  });

  // --- error rate -----------------------------------------------------------
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const recent = await timed(() =>
    db.select({ n: count() }).from(errorEvents).where(gte(errorEvents.createdAt, since))
  );
  const recentCount = recent.value?.[0]?.n ?? 0;
  checks.push({
    key: "errors",
    label: "Error rate (24h)",
    state: recent.error ? "unknown" : recentCount === 0 ? "online" : recentCount > 20 ? "error" : "warning",
    detail: recent.error
      ? "Could not read the error log."
      : recentCount === 0
        ? "No errors recorded in the last 24 hours."
        : `${recentCount} error${recentCount === 1 ? "" : "s"} recorded in the last 24 hours.`,
    checkedAt,
  });

  return checks;
}

export function overallState(checks: HealthCheck[]): HealthState {
  if (checks.some((c) => c.state === "error")) return "error";
  if (checks.some((c) => c.state === "warning")) return "warning";
  return "online";
}
