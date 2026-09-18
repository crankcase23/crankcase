import Link from "next/link";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/admin/rbac";
import { parsePeriod, resolvePeriod, withPeriod } from "@/lib/admin/periods";
import { getCommandCenterMetrics, getSignupSeries, getVehicleSeries } from "@/lib/admin/metrics";
import { getActivityFeed, activityLabel } from "@/lib/admin/activity";
import { getAlerts } from "@/lib/admin/alerts";
import { getHealthChecks, overallState } from "@/lib/admin/health";
import { formatCurrency, relativeTime, formatDateTime } from "@/lib/admin/format";
import { Panel, KpiCard, MicroLabel, EmptyState, StatusPill, Badge } from "@/components/admin/ui";
import { BarSeries } from "@/components/admin/charts";
import { Icon } from "@/components/admin/icons";
import PeriodPicker from "@/components/admin/PeriodPicker";

// ---------------------------------------------------------------------------
// CRANKCASE COMMAND CENTER
//
// The 10-second read, top to bottom: are we healthy, what moved, what needs
// me, what just happened. Deep data lives in the sections; this page shows
// only what changes a decision.
//
// Every number is queried live from Postgres for the selected period. Where a
// data source does not exist yet (payments), the tile says "Waiting for data"
// rather than showing a zero that reads like a measurement.
// ---------------------------------------------------------------------------

export const metadata = { title: "Command Center" };

export default async function CommandCenterPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string }>;
}) {
  const ctx = await requireAdmin("command.view");
  if (!ctx) redirect("/garage");

  const { period: periodParam } = await searchParams;
  const period = parsePeriod(periodParam);
  const range = resolvePeriod(period);

  const [metrics, alerts, activity, health, signupSeries, vehicleSeries] = await Promise.all([
    getCommandCenterMetrics(range),
    getAlerts(),
    getActivityFeed(18),
    getHealthChecks(),
    getSignupSeries(range),
    getVehicleSeries(range),
  ]);

  const systemState = overallState(health);
  const degraded = health.filter((c) => c.state === "error" || c.state === "warning");

  return (
    <div>
      {/* ------------------------------------------------------------- header */}
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <MicroLabel>Crankcase Garage</MicroLabel>
            <span className="text-slate-700">/</span>
            <StatusPill state={systemState} label={systemState === "online" ? "ALL SYSTEMS NOMINAL" : undefined} />
          </div>
          <h1
            className="mt-1 text-3xl font-bold tracking-wide text-slate-50 sm:text-4xl"
            style={{ fontFamily: "var(--font-display)", letterSpacing: "0.04em" }}
          >
            COMMAND CENTER
          </h1>
        </div>
        <PeriodPicker current={period} basePath="/admin" />
      </div>

      {/* ---------------------------------------------------------------- KPIs */}
      <section aria-label="Key performance indicators" className="mb-6">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          <KpiCard label="Total Users" value={metrics.totalUsers.value} hint="all time" href="/admin/users" />
          <KpiCard
            label={`New Users · ${range.label}`}
            value={metrics.newUsers.value}
            previous={metrics.newUsers.previous}
            href="/admin/users?sort=created&dir=desc"
          />
          <KpiCard
            label={`Active Users · ${range.label}`}
            value={metrics.activeUsers.value}
            previous={metrics.activeUsers.previous}
            hint="signed in"
          />
          <KpiCard
            label="Vehicles in Garages"
            value={metrics.vehicles.value}
            hint={`+${metrics.newVehicles.value} this period`}
            href="/admin/vehicles"
          />
          <KpiCard
            label={`Services Logged · ${range.label}`}
            value={metrics.servicesLogged.value}
            previous={metrics.servicesLogged.previous}
          />
          <KpiCard
            label={`Guide Views · ${range.label}`}
            value={metrics.guideViews.value}
            previous={metrics.guideViews.previous}
            awaiting={metrics.guideViews.awaiting}
            hint={metrics.guideViews.awaiting ? "View tracking starts on next deploy" : undefined}
            href="/admin/guides"
          />
          <KpiCard
            label={`Guide Purchases · ${range.label}`}
            value={metrics.guidePurchases.value}
            awaiting={metrics.guidePurchases.awaiting}
            hint={metrics.guidePurchases.awaiting ? "No checkout connected" : undefined}
            href="/admin/revenue"
          />
          <KpiCard
            label="Subscription Revenue"
            value={formatCurrency(metrics.subscriptionRevenue.value)}
            awaiting={metrics.subscriptionRevenue.awaiting}
            hint={metrics.subscriptionRevenue.awaiting ? "No plans sold" : "active plans"}
            tone="accent"
            href="/admin/revenue"
          />
          <KpiCard
            label={`Total Revenue · ${range.label}`}
            value={formatCurrency(metrics.totalRevenue.value)}
            awaiting={metrics.totalRevenue.awaiting}
            hint={metrics.totalRevenue.awaiting ? "No payment provider" : "net of refunds"}
            tone="accent"
            href="/admin/revenue"
          />
          <KpiCard
            label="Unlocks Granted"
            value={metrics.unlocks.value}
            hint="gifted + purchased"
            href="/admin/users"
          />
        </div>
      </section>

      {/* ------------------------------------------ main column + right rail */}
      <div className="grid gap-4 xl:grid-cols-[1fr_340px]">
        <div className="min-w-0 space-y-4">
          {/* trends */}
          <div className="grid gap-4 md:grid-cols-2">
            <Panel title="Signups" eyebrow={range.label} accent>
              <BarSeries data={signupSeries} emptyMessage="No signups in this period" />
            </Panel>
            <Panel title="Vehicles added" eyebrow={range.label} accent>
              <BarSeries data={vehicleSeries} emptyMessage="No vehicles added in this period" />
            </Panel>
          </div>

          {/* activity feed */}
          <Panel
            title="Activity"
            eyebrow="Live feed"
            subtitle="Everything happening across the platform, newest first."
            padded={false}
            action={
              <Link href="/admin/security" className="text-[11px] text-slate-500 hover:text-orange-300">
                Full audit log →
              </Link>
            }
          >
            {activity.length === 0 ? (
              <div className="p-4">
                <EmptyState
                  title="Waiting for data"
                  message="Nothing has happened yet. Signups, vehicles, service logs and admin actions all appear here as they occur."
                />
              </div>
            ) : (
              <ul className="divide-y divide-slate-800/70">
                {activity.map((item) => (
                  <li key={item.id} className="flex items-start gap-3 px-4 py-2.5 hover:bg-slate-800/20">
                    <span
                      className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${
                        item.severity === "critical"
                          ? "bg-rose-500"
                          : item.severity === "warning"
                            ? "bg-amber-400"
                            : item.severity === "success"
                              ? "bg-emerald-400"
                              : "bg-slate-600"
                      }`}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                        <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-slate-500">
                          {activityLabel(item.type)}
                        </span>
                        <span className="truncate text-sm text-slate-200">{item.title}</span>
                      </div>
                      <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[11px] text-slate-600">
                        {item.actorEmail && <span className="truncate">{item.actorEmail}</span>}
                        {item.objectLabel && <span className="truncate">· {item.objectLabel}</span>}
                        <span title={formatDateTime(item.createdAt)}>· {relativeTime(item.createdAt)}</span>
                      </div>
                    </div>
                    {item.href && (
                      <Link
                        href={item.href}
                        className="mt-0.5 shrink-0 text-slate-600 hover:text-orange-400"
                        aria-label="Inspect"
                        title="Inspect"
                      >
                        <Icon name="external" className="h-3.5 w-3.5" />
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>

        {/* ------------------------------------------------------- right rail */}
        <div className="space-y-4">
          {/* Attention Required -- rendered ONLY when something is actually wrong */}
          {alerts.length > 0 && (
            <section id="attention" className="scroll-mt-20">
              <Panel
                title="Attention Required"
                eyebrow={`${alerts.length} item${alerts.length === 1 ? "" : "s"}`}
                accent
                padded={false}
              >
                <ul className="divide-y divide-slate-800/70">
                  {alerts.map((alert) => (
                    <li key={alert.id} className="px-4 py-3">
                      <div className="flex items-start gap-2.5">
                        <span
                          className={`mt-0.5 shrink-0 ${
                            alert.severity === "critical"
                              ? "text-rose-400"
                              : alert.severity === "warning"
                                ? "text-amber-400"
                                : "text-slate-500"
                          }`}
                        >
                          <Icon name="alert" className="h-4 w-4" />
                        </span>
                        <div className="min-w-0">
                          <div className="text-sm font-medium text-slate-100">{alert.title}</div>
                          <p className="mt-0.5 text-xs leading-relaxed text-slate-500">{alert.detail}</p>
                          <Link
                            href={alert.href}
                            className="mt-1.5 inline-block text-[11px] font-medium text-orange-400 hover:text-orange-300"
                          >
                            {alert.actionLabel} →
                          </Link>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              </Panel>
            </section>
          )}

          {/* system snapshot */}
          <Panel
            title="System"
            eyebrow="Health"
            action={
              <Link href="/admin/system" className="text-[11px] text-slate-500 hover:text-orange-300">
                Details →
              </Link>
            }
          >
            {degraded.length === 0 ? (
              <div className="flex items-center gap-2.5">
                <StatusPill state="online" />
                <span className="text-xs text-slate-500">
                  All {health.length} checks passing.
                </span>
              </div>
            ) : (
              <ul className="space-y-2.5">
                {degraded.map((check) => (
                  <li key={check.key}>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs text-slate-300">{check.label}</span>
                      <StatusPill state={check.state} />
                    </div>
                    <p className="mt-0.5 text-[11px] leading-snug text-slate-600">{check.detail}</p>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          {/* quick jumps */}
          <Panel title="Jump to" eyebrow="Shortcuts">
            <div className="flex flex-wrap gap-1.5">
              {[
                { href: withPeriod("/admin/users", period), label: "Users" },
                { href: withPeriod("/admin/vehicles", period), label: "Vehicles" },
                { href: "/admin/guides?filter=incomplete", label: "Incomplete guides" },
                { href: "/admin/vehicles?kind=custom", label: "Demand backlog" },
                { href: "/admin/system#errors", label: "Error log" },
                { href: "/api/admin/export/users", label: "Export users CSV" },
                { href: "/api/admin/export/vehicles", label: "Export vehicles CSV" },
              ].map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="rounded-md border border-slate-800 px-2.5 py-1 text-[11px] text-slate-400 hover:border-orange-500/40 hover:text-orange-300"
                >
                  {link.label}
                </Link>
              ))}
            </div>
          </Panel>

          <Panel title="Access" eyebrow="This session">
            <div className="space-y-2 text-xs">
              <div className="flex items-center justify-between gap-2">
                <span className="text-slate-500">Signed in as</span>
                <span className="truncate text-slate-300">{ctx.email}</span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-slate-500">Role</span>
                <span className="flex flex-wrap justify-end gap-1">
                  {ctx.roles.map((r) => (
                    <Badge key={r} tone="accent">
                      {r.replace("_", " ")}
                    </Badge>
                  ))}
                </span>
              </div>
            </div>
          </Panel>
        </div>
      </div>
    </div>
  );
}
