import { redirect } from "next/navigation";
import Link from "next/link";
import { requireAdmin } from "@/lib/admin/rbac";
import { parsePeriod, resolvePeriod } from "@/lib/admin/periods";
import { getRevenueSummary, getRevenueByGuide, getFailedPayments, getSubscriptionSeries } from "@/lib/admin/revenue";
import { getRevenueSeries } from "@/lib/admin/metrics";
import { formatCurrency, formatNumber, formatPercent, formatDateTime } from "@/lib/admin/format";
import {
  PageHeader,
  Panel,
  KpiCard,
  EmptyState,
  Table,
  THead,
  TBody,
  TR,
  TH,
  TD,
  Badge,
  MicroLabel,
} from "@/components/admin/ui";
import { BarSeries, RankedBars } from "@/components/admin/charts";
import PeriodPicker from "@/components/admin/PeriodPicker";

export const metadata = { title: "Revenue" };

export default async function AdminRevenuePage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string }>;
}) {
  const ctx = await requireAdmin("revenue.view");
  if (!ctx) redirect("/admin");

  const { period: periodParam } = await searchParams;
  const period = parsePeriod(periodParam);
  const range = resolvePeriod(period);

  const [summary, byGuide, failed, revenueSeries, subSeries] = await Promise.all([
    getRevenueSummary(range),
    getRevenueByGuide(range),
    getFailedPayments(),
    getRevenueSeries(range),
    getSubscriptionSeries(range),
  ]);

  const noData = !summary.hasData && !summary.hasSubscriptions;

  return (
    <div>
      <PageHeader
        title="REVENUE"
        description="Gross, refunds and net across one-time purchases and subscriptions."
        action={<PeriodPicker current={period} basePath="/admin/revenue" />}
      />

      {/* ---------------------------------------------------- honest banner */}
      {noData && (
        <div className="mb-5 rounded-xl border border-amber-500/30 bg-amber-500/5 px-4 py-3">
          <div className="flex items-start gap-2.5">
            <span className="mt-0.5 font-mono text-[10px] uppercase tracking-[0.18em] text-amber-400">
              No payment provider
            </span>
          </div>
          <p className="mt-1.5 max-w-3xl text-sm leading-relaxed text-slate-400">
            Crankcase Garage has no checkout. Every figure on this page is queried from the real{" "}
            <span className="font-mono text-xs text-slate-500">purchases</span>,{" "}
            <span className="font-mono text-xs text-slate-500">subscriptions</span> and{" "}
            <span className="font-mono text-xs text-slate-500">payment_events</span> tables, which are empty — so
            everything reads &quot;Waiting for data&quot; rather than showing a zero that looks like a measurement. Connect
            a provider and this page fills in with no further work.
          </p>
        </div>
      )}

      {/* --------------------------------------------------------------- KPIs */}
      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        <KpiCard
          label={`Net Revenue · ${range.label}`}
          value={formatCurrency(summary.netCents)}
          awaiting={!summary.hasData}
          hint="gross minus refunds"
          tone="accent"
        />
        <KpiCard
          label={`Gross Revenue · ${range.label}`}
          value={formatCurrency(summary.grossCents)}
          awaiting={!summary.hasData}
          hint="before refunds"
        />
        <KpiCard
          label="Refunds"
          value={formatCurrency(summary.refundedCents)}
          awaiting={!summary.hasData}
          hint={`${formatNumber(summary.refundCount)} refunded order(s)`}
          tone={summary.refundedCents > 0 ? "warning" : "default"}
        />
        <KpiCard
          label="This Month"
          value={formatCurrency(summary.thisMonthCents)}
          previous={summary.hasData ? summary.lastMonthCents : null}
          awaiting={!summary.hasData}
          hint={`last month ${formatCurrency(summary.lastMonthCents)}`}
        />
        <KpiCard
          label="One-time Purchases"
          value={summary.oneTimeCount}
          awaiting={!summary.hasData}
          hint="per-vehicle unlocks"
        />
        <KpiCard
          label="MRR"
          value={formatCurrency(summary.mrrCents)}
          awaiting={!summary.hasSubscriptions}
          hint="annual plans normalised"
          tone="accent"
        />
        <KpiCard
          label="Active Subscriptions"
          value={summary.activeSubscriptions}
          awaiting={!summary.hasSubscriptions}
        />
        <KpiCard
          label="Churn"
          value={summary.churnRate === null ? "—" : formatPercent(summary.churnRate)}
          awaiting={!summary.hasSubscriptions}
          hint={summary.churnRate === null ? "no baseline to measure against" : `${range.label} cancellations`}
          tone={summary.churnRate !== null && summary.churnRate > 5 ? "critical" : "default"}
        />
      </div>

      {/* ------------------------------------------------------------- charts */}
      <div className="mb-5 grid gap-4 lg:grid-cols-2">
        <Panel title="Revenue over time" eyebrow={range.label} accent>
          <BarSeries
            data={revenueSeries}
            valueFormatter={(n) => formatCurrency(n)}
            emptyMessage="Waiting for data — no payments recorded"
          />
        </Panel>
        <Panel title="Revenue by guide / vehicle" eyebrow={range.label} accent>
          {byGuide.length === 0 ? (
            <EmptyState
              title="Waiting for data"
              message="Once purchases exist, this ranks what people actually pay for — which is the signal for what to build next."
            />
          ) : (
            <RankedBars
              data={byGuide.map((r) => ({ label: r.label, value: r.value }))}
              valueFormatter={(n) => formatCurrency(n)}
            />
          )}
        </Panel>
      </div>

      <div className="mb-5 grid gap-4 lg:grid-cols-2">
        <Panel title="New subscriptions" eyebrow={range.label}>
          <BarSeries
            data={subSeries.created.map((r) => ({ label: r.day.slice(5), value: r.n }))}
            emptyMessage="Waiting for data — no subscriptions sold"
          />
        </Panel>
        <Panel title="Cancellations" eyebrow={range.label}>
          <BarSeries
            data={subSeries.cancelled.map((r) => ({ label: r.day.slice(5), value: r.n }))}
            emptyMessage="Waiting for data — no cancellations"
          />
        </Panel>
      </div>

      {/* ----------------------------------------------------- failed payments */}
      <section id="failed" className="scroll-mt-20">
        <Panel
          title="Failed payments"
          eyebrow={summary.failedPayments > 0 ? `${summary.failedPayments} unresolved` : "None"}
          subtitle="Unresolved payment failures, newest first."
          padded={false}
          accent={summary.failedPayments > 0}
        >
          {failed.length === 0 ? (
            <div className="p-4">
              <EmptyState
                title={summary.hasData ? "No failed payments" : "Waiting for data"}
                message={
                  summary.hasData
                    ? "Every payment has settled."
                    : "Payment failures appear here automatically once a provider is sending events."
                }
              />
            </div>
          ) : (
            <Table minWidth={680}>
              <THead>
                <tr>
                  <TH>When</TH>
                  <TH>Account</TH>
                  <TH>Reason</TH>
                  <TH>Status</TH>
                  <TH align="right">Amount</TH>
                </tr>
              </THead>
              <TBody>
                {failed.map((f) => (
                  <TR key={f.id}>
                    <TD mono muted>
                      {formatDateTime(f.createdAt)}
                    </TD>
                    <TD>
                      {f.userId ? (
                        <Link href={`/admin/users/${f.userId}`} className="hover:text-orange-300">
                          {f.userEmail}
                        </Link>
                      ) : (
                        <span className="text-slate-600">—</span>
                      )}
                    </TD>
                    <TD muted>{f.message ?? "—"}</TD>
                    <TD>
                      <Badge tone="critical">{f.status ?? "failed"}</Badge>
                    </TD>
                    <TD align="right" mono>
                      {formatCurrency(f.amountCents)}
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          )}
        </Panel>
      </section>

      <p className="mt-4 max-w-3xl">
        <MicroLabel>
          Gross = sum of succeeded charges. Refunds = amounts returned. Net = gross − refunds. MRR normalises annual
          plans to a monthly figure. Churn = cancellations in period ÷ subscriptions active at period start.
        </MicroLabel>
      </p>
    </div>
  );
}
