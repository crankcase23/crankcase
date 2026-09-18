import Link from "next/link";
import { redirect } from "next/navigation";
import { desc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { errorEvents, users, vehicleDataCache } from "@/db/schema";
import { requireAdmin } from "@/lib/admin/rbac";
import { getHealthChecks, overallState } from "@/lib/admin/health";
import { formatDateTime, relativeTime, formatNumber } from "@/lib/admin/format";
import {
  PageHeader,
  Panel,
  StatusPill,
  Table,
  THead,
  TBody,
  TR,
  TH,
  TD,
  Badge,
  EmptyState,
  MicroLabel,
  AdminButton,
} from "@/components/admin/ui";

export const metadata = { title: "System Health" };

export default async function AdminSystemPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; ok?: string }>;
}) {
  const ctx = await requireAdmin("system.view");
  if (!ctx) redirect("/admin");

  const params = await searchParams;
  const statusFilter = params.status === "resolved" || params.status === "ignored" ? params.status : "open";
  const canManage = ctx.permissions.has("system.manage");

  const [checks, errorRows, grouped, cacheRows] = await Promise.all([
    getHealthChecks(),
    db
      .select({
        id: errorEvents.id,
        fingerprint: errorEvents.fingerprint,
        level: errorEvents.level,
        source: errorEvents.source,
        message: errorEvents.message,
        path: errorEvents.path,
        status: errorEvents.status,
        createdAt: errorEvents.createdAt,
        userId: errorEvents.userId,
        userEmail: users.email,
      })
      .from(errorEvents)
      .leftJoin(users, eq(users.id, errorEvents.userId))
      .where(eq(errorEvents.status, statusFilter))
      .orderBy(desc(errorEvents.createdAt))
      .limit(50),
    db
      .select({
        fingerprint: errorEvents.fingerprint,
        n: sql<number>`count(*)::int`,
        last: sql<Date>`max(${errorEvents.createdAt})`,
        message: sql<string>`min(${errorEvents.message})`,
        source: sql<string>`min(${errorEvents.source})`,
      })
      .from(errorEvents)
      .where(eq(errorEvents.status, "open"))
      .groupBy(errorEvents.fingerprint)
      .orderBy(sql`count(*) desc`)
      .limit(10),
    db
      .select({
        status: vehicleDataCache.status,
        n: sql<number>`count(*)::int`,
      })
      .from(vehicleDataCache)
      .groupBy(vehicleDataCache.status),
  ]);

  const state = overallState(checks);
  const now = new Date();

  return (
    <div>
      <PageHeader
        title="SYSTEM HEALTH"
        description="Live probes against the things that can actually break. No secrets, keys or environment values are ever displayed here."
        action={<StatusPill state={state} />}
      />

      {params.ok && (
        <div className="mb-4 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-2.5 text-sm text-emerald-300">
          {decodeURIComponent(params.ok)}
        </div>
      )}

      {/* --------------------------------------------------------- checks */}
      <div className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {checks.map((check) => (
          <div
            key={check.key}
            className="relative overflow-hidden rounded-xl border border-slate-800 bg-slate-900/40 p-4"
          >
            <div
              className={`absolute inset-x-0 top-0 h-px ${
                check.state === "online"
                  ? "bg-emerald-500/50"
                  : check.state === "warning"
                    ? "bg-amber-500/50"
                    : check.state === "error"
                      ? "bg-rose-500/60"
                      : "bg-slate-700/50"
              }`}
            />
            <div className="flex items-start justify-between gap-2">
              <span className="text-sm font-medium text-slate-100">{check.label}</span>
              <StatusPill state={check.state} />
            </div>
            <p className="mt-1.5 text-xs leading-relaxed text-slate-500">{check.detail}</p>
            <div className="mt-2 flex items-center justify-between">
              <MicroLabel>checked {relativeTime(check.checkedAt)}</MicroLabel>
              {check.latencyMs !== undefined && (
                <span className="font-mono text-[10px] text-slate-600">{check.latencyMs}ms</span>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* ----------------------------------------------------- integrations */}
      <section id="integrations" className="mb-5 scroll-mt-20">
        <Panel
          title="Vehicle data cache"
          eyebrow="Open Labor Project"
          subtitle="Lookups are cached forever per vehicle because the free tier's daily quota is shared across every user of the app."
        >
          {cacheRows.length === 0 ? (
            <EmptyState title="Waiting for data" message="No vehicle data lookups have been cached yet." />
          ) : (
            <div className="flex flex-wrap gap-3">
              {cacheRows.map((r) => (
                <div key={r.status} className="rounded-lg border border-slate-800 bg-slate-950/60 px-4 py-2.5">
                  <MicroLabel>{r.status}</MicroLabel>
                  <div
                    className={`mt-0.5 text-xl font-semibold tabular-nums ${
                      r.status === "ok"
                        ? "text-emerald-400"
                        : r.status === "pending"
                          ? "text-amber-400"
                          : "text-slate-400"
                    }`}
                    style={{ fontFamily: "var(--font-display)" }}
                  >
                    {formatNumber(r.n)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Panel>
      </section>

      {/* ---------------------------------------------------- recurring errors */}
      {grouped.length > 0 && (
        <div className="mb-5">
          <Panel
            title="Recurring errors"
            eyebrow="Grouped"
            subtitle="Same bug, one line. Grouped by a hash of source plus a normalised message."
            padded={false}
            accent
          >
            <Table minWidth={680}>
              <THead>
                <tr>
                  <TH>Source</TH>
                  <TH>Message</TH>
                  <TH align="right">Occurrences</TH>
                  <TH>Last seen</TH>
                </tr>
              </THead>
              <TBody>
                {grouped.map((g) => (
                  <TR key={g.fingerprint}>
                    <TD mono muted>
                      {g.source}
                    </TD>
                    <TD>{g.message}</TD>
                    <TD align="right" mono>
                      <span className={g.n > 10 ? "text-rose-400" : "text-slate-200"}>{formatNumber(g.n)}</span>
                    </TD>
                    <TD mono muted>
                      {relativeTime(g.last)}
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          </Panel>
        </div>
      )}

      {/* ---------------------------------------------------------- error log */}
      <section id="errors" className="scroll-mt-20">
        <Panel
          title="Error log"
          eyebrow={`${errorRows.length} ${statusFilter}`}
          subtitle="Captured first-party. No Sentry account or DSN required."
          padded={false}
          accent
        >
          <div className="flex flex-wrap items-center gap-1 border-b border-slate-800/80 px-4 py-3">
            {(["open", "resolved", "ignored"] as const).map((s) => (
              <Link
                key={s}
                href={`/admin/system?status=${s}#errors`}
                className={`rounded-md px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.12em] transition-colors ${
                  statusFilter === s ? "bg-orange-500 text-slate-950" : "text-slate-400 hover:bg-slate-800 hover:text-slate-100"
                }`}
              >
                {s}
              </Link>
            ))}
          </div>

          {errorRows.length === 0 ? (
            <div className="p-4">
              <EmptyState
                title={statusFilter === "open" ? "No open errors" : `No ${statusFilter} errors`}
                message={
                  statusFilter === "open"
                    ? "Nothing has thrown. Errors are recorded automatically from route handlers and admin actions."
                    : undefined
                }
              />
            </div>
          ) : (
            <ul className="divide-y divide-slate-800/70">
              {errorRows.map((e) => (
                <li key={e.id} className="px-4 py-3">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge tone={e.level === "fatal" ? "critical" : e.level === "warning" ? "warning" : "critical"}>
                          {e.level}
                        </Badge>
                        <span className="font-mono text-[11px] text-slate-500">{e.source}</span>
                        <span className="font-mono text-[10px] text-slate-700">{formatDateTime(e.createdAt)}</span>
                      </div>
                      <p className="mt-1 break-words text-sm text-slate-200">{e.message}</p>
                      <div className="mt-1 flex flex-wrap gap-x-3 font-mono text-[10px] text-slate-600">
                        {e.path && <span>{e.path}</span>}
                        {e.userId && (
                          <Link href={`/admin/users/${e.userId}`} className="hover:text-orange-400">
                            {e.userEmail}
                          </Link>
                        )}
                        <span>fingerprint {e.fingerprint}</span>
                      </div>
                    </div>

                    {canManage && statusFilter === "open" && (
                      <div className="flex shrink-0 gap-1.5">
                        <form action="/api/admin/errors" method="post">
                          <input type="hidden" name="id" value={e.id} />
                          <input type="hidden" name="action" value="resolve" />
                          <AdminButton variant="secondary">Resolve</AdminButton>
                        </form>
                        <form action="/api/admin/errors" method="post">
                          <input type="hidden" name="fingerprint" value={e.fingerprint} />
                          <input type="hidden" name="action" value="ignoreGroup" />
                          <AdminButton variant="secondary">Ignore all like this</AdminButton>
                        </form>
                      </div>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </section>

      <p className="mt-4 max-w-3xl">
        <MicroLabel>
          Health snapshot taken {formatDateTime(now)}. Stack traces are stored but never rendered in the browser, and no
          environment variable value is ever shown — integration checks report only whether a key is configured.
        </MicroLabel>
      </p>
    </div>
  );
}
