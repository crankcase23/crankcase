import { sql, and, gte, lt, eq, isNull, desc, count } from "drizzle-orm";
import { db } from "@/db";
import { purchases, subscriptions, paymentEvents, users } from "@/db/schema";
import type { PeriodRange } from "./periods";

// ---------------------------------------------------------------------------
// Revenue.
//
// READ THIS FIRST: there is no payment provider connected to this app. No
// checkout exists. Every query below runs against real tables that are
// currently empty, and returns real zeros.
//
// The page renders those as "Waiting for data", never as "$0.00 revenue" --
// because a zero implies a measurement was taken, and none was. The
// distinction is carried by `hasData`.
//
// Nothing here estimates, projects or annualises anything from an empty set.
// When a provider ships and starts writing to these tables, every figure
// becomes live with no change to this file.
// ---------------------------------------------------------------------------

export interface RevenueSummary {
  hasData: boolean;
  hasSubscriptions: boolean;
  /** Gross, before refunds, for the selected period. */
  grossCents: number;
  refundedCents: number;
  netCents: number;
  /** Calendar month-to-date and the full previous calendar month. */
  thisMonthCents: number;
  lastMonthCents: number;
  oneTimeCount: number;
  oneTimeCents: number;
  subscriptionCents: number;
  activeSubscriptions: number;
  cancelledSubscriptions: number;
  /** Monthly recurring revenue, normalising annual plans to a monthly figure. */
  mrrCents: number;
  /** Cancellations in period / active at period start. Null when no baseline. */
  churnRate: number | null;
  failedPayments: number;
  failedPaymentsCents: number;
  refundCount: number;
}

export async function getRevenueSummary(range: PeriodRange): Promise<RevenueSummary> {
  const { start, end } = range;

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);

  const inPeriod = start
    ? and(gte(purchases.createdAt, start), lt(purchases.createdAt, end))
    : undefined;

  const [
    anyPurchase,
    anySubscription,
    periodTotals,
    thisMonth,
    lastMonth,
    subsActive,
    subsCancelled,
    mrrRows,
    cancelledInPeriod,
    activeAtStart,
    failed,
    refunds,
  ] = await Promise.all([
    db.select({ id: purchases.id }).from(purchases).limit(1),
    db.select({ id: subscriptions.id }).from(subscriptions).limit(1),
    db
      .select({
        gross: sql<number>`coalesce(sum(${purchases.amountCents}), 0)::int`,
        refunded: sql<number>`coalesce(sum(${purchases.refundedCents}), 0)::int`,
        n: sql<number>`count(*)::int`,
      })
      .from(purchases)
      .where(inPeriod ? and(eq(purchases.status, "succeeded"), inPeriod) : eq(purchases.status, "succeeded")),
    db
      .select({ n: sql<number>`coalesce(sum(${purchases.amountCents} - ${purchases.refundedCents}), 0)::int` })
      .from(purchases)
      .where(and(eq(purchases.status, "succeeded"), gte(purchases.createdAt, monthStart))),
    db
      .select({ n: sql<number>`coalesce(sum(${purchases.amountCents} - ${purchases.refundedCents}), 0)::int` })
      .from(purchases)
      .where(
        and(
          eq(purchases.status, "succeeded"),
          gte(purchases.createdAt, lastMonthStart),
          lt(purchases.createdAt, monthStart)
        )
      ),
    db.select({ n: count() }).from(subscriptions).where(eq(subscriptions.status, "active")),
    db.select({ n: count() }).from(subscriptions).where(eq(subscriptions.status, "canceled")),
    // Annual plans divided by 12 so MRR is comparable across intervals.
    db
      .select({
        n: sql<number>`coalesce(sum(case when ${subscriptions.interval} = 'year' then ${subscriptions.priceCents} / 12 else ${subscriptions.priceCents} end), 0)::int`,
      })
      .from(subscriptions)
      .where(eq(subscriptions.status, "active")),
    db
      .select({ n: count() })
      .from(subscriptions)
      .where(
        start
          ? and(eq(subscriptions.status, "canceled"), gte(subscriptions.canceledAt, start), lt(subscriptions.canceledAt, end))
          : eq(subscriptions.status, "canceled")
      ),
    start
      ? db
          .select({ n: count() })
          .from(subscriptions)
          .where(and(lt(subscriptions.createdAt, start), isNull(subscriptions.canceledAt)))
      : Promise.resolve([{ n: 0 }]),
    db
      .select({
        n: count(),
        cents: sql<number>`coalesce(sum(${paymentEvents.amountCents}), 0)::int`,
      })
      .from(paymentEvents)
      .where(and(eq(paymentEvents.type, "payment_failed"), isNull(paymentEvents.resolvedAt))),
    db
      .select({ n: count() })
      .from(purchases)
      .where(sql`${purchases.refundedCents} > 0`),
  ]);

  const gross = periodTotals[0]?.gross ?? 0;
  const refunded = periodTotals[0]?.refunded ?? 0;
  const activeCount = subsActive[0]?.n ?? 0;
  const cancelledCount = cancelledInPeriod[0]?.n ?? 0;
  const baseline = activeAtStart[0]?.n ?? 0;

  return {
    hasData: anyPurchase.length > 0,
    hasSubscriptions: anySubscription.length > 0,
    grossCents: gross,
    refundedCents: refunded,
    netCents: gross - refunded,
    thisMonthCents: thisMonth[0]?.n ?? 0,
    lastMonthCents: lastMonth[0]?.n ?? 0,
    oneTimeCount: periodTotals[0]?.n ?? 0,
    oneTimeCents: gross - refunded,
    subscriptionCents: mrrRows[0]?.n ?? 0,
    activeSubscriptions: activeCount,
    cancelledSubscriptions: subsCancelled[0]?.n ?? 0,
    mrrCents: mrrRows[0]?.n ?? 0,
    // Churn needs a starting population; with none, the honest answer is
    // "unknown", not 0%.
    churnRate: baseline > 0 ? (cancelledCount / baseline) * 100 : null,
    failedPayments: failed[0]?.n ?? 0,
    failedPaymentsCents: failed[0]?.cents ?? 0,
    refundCount: refunds[0]?.n ?? 0,
  };
}

export async function getRevenueByGuide(range: PeriodRange, limit = 8) {
  const rows = await db
    .select({
      label: sql<string>`coalesce(${purchases.guideId}, ${purchases.vehicleId}, ${purchases.description}, 'Unattributed')`,
      value: sql<number>`coalesce(sum(${purchases.amountCents} - ${purchases.refundedCents}), 0)::int`,
      n: sql<number>`count(*)::int`,
    })
    .from(purchases)
    .where(
      range.start
        ? and(eq(purchases.status, "succeeded"), gte(purchases.createdAt, range.start), lt(purchases.createdAt, range.end))
        : eq(purchases.status, "succeeded")
    )
    .groupBy(sql`coalesce(${purchases.guideId}, ${purchases.vehicleId}, ${purchases.description}, 'Unattributed')`)
    .orderBy(sql`sum(${purchases.amountCents} - ${purchases.refundedCents}) desc`)
    .limit(limit);
  return rows;
}

export async function getFailedPayments(limit = 20) {
  return db
    .select({
      id: paymentEvents.id,
      message: paymentEvents.message,
      amountCents: paymentEvents.amountCents,
      status: paymentEvents.status,
      createdAt: paymentEvents.createdAt,
      userId: paymentEvents.userId,
      userEmail: users.email,
    })
    .from(paymentEvents)
    .leftJoin(users, eq(users.id, paymentEvents.userId))
    .where(and(eq(paymentEvents.type, "payment_failed"), isNull(paymentEvents.resolvedAt)))
    .orderBy(desc(paymentEvents.createdAt))
    .limit(limit);
}

export async function getSubscriptionSeries(range: PeriodRange) {
  const [created, cancelled] = await Promise.all([
    db
      .select({
        day: sql<string>`to_char(date_trunc('day', ${subscriptions.createdAt}), 'YYYY-MM-DD')`,
        n: sql<number>`count(*)::int`,
      })
      .from(subscriptions)
      .where(range.start ? and(gte(subscriptions.createdAt, range.start), lt(subscriptions.createdAt, range.end)) : undefined)
      .groupBy(sql`date_trunc('day', ${subscriptions.createdAt})`),
    db
      .select({
        day: sql<string>`to_char(date_trunc('day', ${subscriptions.canceledAt}), 'YYYY-MM-DD')`,
        n: sql<number>`count(*)::int`,
      })
      .from(subscriptions)
      .where(range.start ? and(gte(subscriptions.canceledAt, range.start), lt(subscriptions.canceledAt, range.end)) : undefined)
      .groupBy(sql`date_trunc('day', ${subscriptions.canceledAt})`),
  ]);
  return { created, cancelled };
}
