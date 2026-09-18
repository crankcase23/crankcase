import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/admin/rbac";
import { parsePeriod, resolvePeriod } from "@/lib/admin/periods";
import {
  getCommandCenterMetrics,
  getSignupSeries,
  getVehicleSeries,
  getEventSeries,
  getFunnel,
  getTopEventObjects,
  getDataAvailability,
} from "@/lib/admin/metrics";
import { getFleetStats } from "@/lib/admin/vehicles";
import { listGuideRecords } from "@/lib/admin/guides";
import { EVENT_TYPES } from "@/lib/events";
import { formatNumber, formatPercent } from "@/lib/admin/format";
import { PageHeader, Panel, KpiCard, EmptyState, MicroLabel } from "@/components/admin/ui";
import { BarSeries, RankedBars, Funnel } from "@/components/admin/charts";
import PeriodPicker from "@/components/admin/PeriodPicker";

export const metadata = { title: "Analytics" };

export default async function AdminAnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string }>;
}) {
  const ctx = await requireAdmin("analytics.view");
  if (!ctx) redirect("/admin");

  const { period: periodParam } = await searchParams;
  const period = parsePeriod(periodParam);
  const range = resolvePeriod(period);

  const [metrics, signups, vehicles, guideViewSeries, funnel, topGuides, fleet, availability] = await Promise.all([
    getCommandCenterMetrics(range),
    getSignupSeries(range),
    getVehicleSeries(range),
    getEventSeries(range, EVENT_TYPES.GUIDE_VIEWED),
    getFunnel(range),
    getTopEventObjects(range, EVENT_TYPES.GUIDE_VIEWED, 8),
    getFleetStats(),
    getDataAvailability(),
  ]);

  const guideRecords = listGuideRecords();
  const guideTitle = (id: string) => guideRecords.find((g) => g.guide.id === id)?.guide.title ?? id;

  // Conversion here means: of the accounts created in this window, what share
  // reached each step. Computed from the cohort, not from mixing populations.
  const activationRate = funnel.accounts > 0 ? (funnel.withVehicle / funnel.accounts) * 100 : null;
  const engagementRate = funnel.accounts > 0 ? (funnel.viewedGuide / funnel.accounts) * 100 : null;
  const retentionRate = funnel.accounts > 0 ? (funnel.loggedService / funnel.accounts) * 100 : null;
  const purchaseRate = funnel.accounts > 0 ? (funnel.purchased / funnel.accounts) * 100 : null;

  return (
    <div>
      <PageHeader
        title="ANALYTICS"
        description="First-party only — nothing leaves the database, and no third-party tracker is used."
        action={<PeriodPicker current={period} basePath="/admin/analytics" />}
      />

      {/* --------------------------------------------------------------- KPIs */}
      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <KpiCard
          label="Visitors"
          value={null}
          awaiting
          hint="No anonymous page-view tracking exists"
        />
        <KpiCard label={`Signups · ${range.label}`} value={metrics.newUsers.value} previous={metrics.newUsers.previous} />
        <KpiCard label="Active Users" value={metrics.activeUsers.value} previous={metrics.activeUsers.previous} />
        <KpiCard label="Vehicles Added" value={metrics.newVehicles.value} previous={metrics.newVehicles.previous} />
        <KpiCard label="Services Logged" value={metrics.servicesLogged.value} previous={metrics.servicesLogged.previous} />
        <KpiCard
          label="Guide Views"
          value={metrics.guideViews.value}
          previous={metrics.guideViews.previous}
          awaiting={metrics.guideViews.awaiting}
          hint={metrics.guideViews.awaiting ? "starts recording on deploy" : undefined}
        />
      </div>

      {/* ------------------------------------------------------------- funnel */}
      <div className="mb-5 grid gap-4 lg:grid-cols-[1fr_360px]">
        <Panel
          title="User funnel"
          eyebrow={`Cohort · ${range.label}`}
          subtitle="Of the accounts created in this window, how many reached each step. One cohort followed through, not separate populations stacked together."
          accent
        >
          <Funnel
            stages={[
              {
                label: "Visitor",
                value: funnel.accounts,
                hint: "Anonymous visitors aren't tracked — this stage starts at account creation, so the true top of funnel is larger.",
              },
              { label: "Account created", value: funnel.accounts },
              { label: "Vehicle added", value: funnel.withVehicle },
              { label: "Guide viewed", value: funnel.viewedGuide },
              { label: "Purchased / subscribed", value: funnel.purchased, hint: "No checkout exists yet." },
              { label: "Service logged", value: funnel.loggedService },
            ]}
          />
        </Panel>

        <Panel title="Conversion" eyebrow="Rates" accent>
          {funnel.accounts === 0 ? (
            <EmptyState title="Waiting for data" message="No accounts were created in this period." />
          ) : (
            <div className="space-y-3">
              {[
                {
                  label: "Activation",
                  detail: "added a vehicle",
                  value: activationRate,
                },
                { label: "Engagement", detail: "viewed a guide", value: engagementRate },
                { label: "Retention", detail: "logged a service", value: retentionRate },
                { label: "Purchase", detail: "paid for something", value: purchaseRate },
              ].map((r) => (
                <div key={r.label} className="flex items-baseline justify-between gap-3 border-b border-slate-800/70 pb-2">
                  <div>
                    <div className="text-xs text-slate-300">{r.label}</div>
                    <div className="text-[11px] text-slate-600">{r.detail}</div>
                  </div>
                  <div
                    className="text-xl font-semibold tabular-nums text-slate-100"
                    style={{ fontFamily: "var(--font-display)" }}
                  >
                    {r.value === null ? "—" : formatPercent(r.value, 0)}
                  </div>
                </div>
              ))}
              <p className="text-[11px] leading-relaxed text-slate-600">
                Based on {formatNumber(funnel.accounts)} account{funnel.accounts === 1 ? "" : "s"} created in this
                period. Small cohorts make these percentages volatile.
              </p>
            </div>
          )}
        </Panel>
      </div>

      {/* ------------------------------------------------------------- trends */}
      <div className="mb-5 grid gap-4 lg:grid-cols-3">
        <Panel title="Signups" eyebrow={range.label}>
          <BarSeries data={signups} emptyMessage="No signups in this period" />
        </Panel>
        <Panel title="Vehicles added" eyebrow={range.label}>
          <BarSeries data={vehicles} emptyMessage="No vehicles added" />
        </Panel>
        <Panel title="Guide views" eyebrow={range.label}>
          <BarSeries
            data={guideViewSeries}
            emptyMessage={availability.events ? "No guide views in this period" : "Waiting for data"}
          />
        </Panel>
      </div>

      {/* --------------------------------------------------------- top lists */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Panel title="Popular guides" eyebrow={range.label} accent>
          {topGuides.length === 0 ? (
            <EmptyState
              title="Waiting for data"
              message="Guide views are recorded server-side on every guide page load."
            />
          ) : (
            <RankedBars
              data={topGuides.map((g) => ({ label: guideTitle(g.objectId), value: g.n }))}
              hrefFor={() => undefined}
            />
          )}
        </Panel>

        <Panel title="Popular vehicles" eyebrow="All time" accent>
          <RankedBars data={fleet.topModels} emptyMessage="No vehicles yet" />
        </Panel>

        <Panel title="Popular services" eyebrow="All time" accent>
          <ServicePopularity />
        </Panel>
      </div>

      <p className="mt-4 max-w-3xl">
        <MicroLabel>
          Search activity and per-page traffic are not tracked. Adding them means recording anonymous page views, which
          is a product decision worth making deliberately rather than by default.
        </MicroLabel>
      </p>
    </div>
  );
}

// Most-logged services, read straight from what users actually recorded.
async function ServicePopularity() {
  const { db } = await import("@/db");
  const { serviceEntries } = await import("@/db/schema");
  const { sql } = await import("drizzle-orm");

  const rows = await db
    .select({ label: serviceEntries.title, value: sql<number>`count(*)::int` })
    .from(serviceEntries)
    .groupBy(serviceEntries.title)
    .orderBy(sql`count(*) desc`)
    .limit(8);

  return <RankedBars data={rows} emptyMessage="No services logged yet" />;
}
