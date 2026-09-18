import { sql, and, gte, lt, eq, isNotNull, type SQL } from "drizzle-orm";
import type { PgColumn } from "drizzle-orm/pg-core";
import { db } from "@/db";
import {
  users,
  garageEntries,
  serviceEntries,
  appEvents,
  loginEvents,
  purchases,
  subscriptions,
  paymentEvents,
  vehicleUnlocks,
} from "@/db/schema";
import { EVENT_TYPES } from "@/lib/events";
import type { PeriodRange } from "./periods";
import { dayBuckets } from "./periods";

// ---------------------------------------------------------------------------
// Every number on the Command Center, Analytics and Revenue comes from here.
//
// Two rules this module exists to enforce:
//
//   1. NOTHING IS HARDCODED. Every figure is a COUNT/SUM against a real
//      table, bounded by the selected period.
//   2. "No rows yet" and "no data source yet" are different, and the UI needs
//      to tell them apart. A metric backed by a table that has never had a
//      single row returns `awaiting: true`, which renders as "Waiting for
//      data" instead of a zero that looks like a real measurement. A metric
//      whose table has rows but none in this window returns a real 0.
//
// Query style: counts are done in the database (count(*)::int), never by
// pulling rows into Node and calling .length -- that pattern is why the old
// admin page would have fallen over at a few thousand users.
// ---------------------------------------------------------------------------

export interface Metric {
  value: number;
  previous: number | null;
  awaiting: boolean;
}

function metric(value: number, previous: number | null, awaiting = false): Metric {
  return { value, previous, awaiting };
}

// --- primitives -------------------------------------------------------------

async function scalar(query: Promise<{ n: number | null }[]>): Promise<number> {
  const rows = await query;
  return rows[0]?.n ?? 0;
}

// --- per-source "has this ever had data?" checks ----------------------------
// Cheap EXISTS-style probes (limit 1) so an empty table costs almost nothing.

async function tableHasAnyRow(probe: Promise<unknown[]>): Promise<boolean> {
  const rows = await probe;
  return rows.length > 0;
}

export interface DataAvailability {
  events: boolean;
  purchases: boolean;
  subscriptions: boolean;
  payments: boolean;
}

export async function getDataAvailability(): Promise<DataAvailability> {
  const [events, purch, subs, pay] = await Promise.all([
    tableHasAnyRow(db.select({ id: appEvents.id }).from(appEvents).limit(1)),
    tableHasAnyRow(db.select({ id: purchases.id }).from(purchases).limit(1)),
    tableHasAnyRow(db.select({ id: subscriptions.id }).from(subscriptions).limit(1)),
    tableHasAnyRow(db.select({ id: paymentEvents.id }).from(paymentEvents).limit(1)),
  ]);
  return { events, purchases: purch, subscriptions: subs, payments: pay };
}

// --- the KPI set ------------------------------------------------------------

export interface CommandCenterMetrics {
  totalUsers: Metric;
  newUsers: Metric;
  activeUsers: Metric;
  vehicles: Metric;
  newVehicles: Metric;
  servicesLogged: Metric;
  guideViews: Metric;
  guidePurchases: Metric;
  subscriptionRevenue: Metric;
  totalRevenue: Metric;
  unlocks: Metric;
  availability: DataAvailability;
}

export async function getCommandCenterMetrics(range: PeriodRange): Promise<CommandCenterMetrics> {
  const { start, end, previousStart, previousEnd } = range;
  const availability = await getDataAvailability();

  // Works for any timestamp column, so the same helper bounds users,
  // garage_entries and service_entries alike.
  const inWindow = (col: PgColumn, from: Date | null, to: Date): SQL<unknown> | undefined =>
    from ? and(gte(col, from), lt(col, to)) : undefined;

  const [
    totalUsers,
    newUsers,
    prevNewUsers,
    activeUsers,
    prevActiveUsers,
    totalVehicles,
    newVehicles,
    prevNewVehicles,
    services,
    prevServices,
    guideViews,
    prevGuideViews,
    guidePurchases,
    prevGuidePurchases,
    revenueCents,
    prevRevenueCents,
    subscriptionRevenueCents,
    unlocks,
  ] = await Promise.all([
    // Cumulative totals are not period-bounded -- "Total Users" means total.
    scalar(db.select({ n: sql<number>`count(*)::int` }).from(users)),
    scalar(
      db
        .select({ n: sql<number>`count(*)::int` })
        .from(users)
        .where(inWindow(users.createdAt, start, end))
    ),
    scalar(
      db
        .select({ n: sql<number>`count(*)::int` })
        .from(users)
        .where(inWindow(users.createdAt, previousStart, previousEnd ?? end))
    ),
    // "Active" = signed in during the window. login_events is the one signal
    // that exists for every account regardless of what they did afterwards.
    scalar(
      db
        .select({ n: sql<number>`count(distinct ${loginEvents.userId})::int` })
        .from(loginEvents)
        .where(start ? and(gte(loginEvents.loggedInAt, start), lt(loginEvents.loggedInAt, end)) : undefined)
    ),
    scalar(
      db
        .select({ n: sql<number>`count(distinct ${loginEvents.userId})::int` })
        .from(loginEvents)
        .where(
          previousStart
            ? and(gte(loginEvents.loggedInAt, previousStart), lt(loginEvents.loggedInAt, previousEnd ?? end))
            : undefined
        )
    ),
    scalar(db.select({ n: sql<number>`count(*)::int` }).from(garageEntries)),
    scalar(
      db
        .select({ n: sql<number>`count(*)::int` })
        .from(garageEntries)
        .where(inWindow(garageEntries.createdAt, start, end))
    ),
    scalar(
      db
        .select({ n: sql<number>`count(*)::int` })
        .from(garageEntries)
        .where(inWindow(garageEntries.createdAt, previousStart, previousEnd ?? end))
    ),
    scalar(
      db
        .select({ n: sql<number>`count(*)::int` })
        .from(serviceEntries)
        .where(inWindow(serviceEntries.loggedAt, start, end))
    ),
    scalar(
      db
        .select({ n: sql<number>`count(*)::int` })
        .from(serviceEntries)
        .where(inWindow(serviceEntries.loggedAt, previousStart, previousEnd ?? end))
    ),
    scalar(
      db
        .select({ n: sql<number>`count(*)::int` })
        .from(appEvents)
        .where(
          start
            ? and(eq(appEvents.type, EVENT_TYPES.GUIDE_VIEWED), gte(appEvents.createdAt, start), lt(appEvents.createdAt, end))
            : eq(appEvents.type, EVENT_TYPES.GUIDE_VIEWED)
        )
    ),
    scalar(
      db
        .select({ n: sql<number>`count(*)::int` })
        .from(appEvents)
        .where(
          previousStart
            ? and(
                eq(appEvents.type, EVENT_TYPES.GUIDE_VIEWED),
                gte(appEvents.createdAt, previousStart),
                lt(appEvents.createdAt, previousEnd ?? end)
              )
            : eq(appEvents.type, EVENT_TYPES.GUIDE_VIEWED)
        )
    ),
    scalar(
      db
        .select({ n: sql<number>`count(*)::int` })
        .from(purchases)
        .where(
          start
            ? and(eq(purchases.status, "succeeded"), gte(purchases.createdAt, start), lt(purchases.createdAt, end))
            : eq(purchases.status, "succeeded")
        )
    ),
    scalar(
      db
        .select({ n: sql<number>`count(*)::int` })
        .from(purchases)
        .where(
          previousStart
            ? and(
                eq(purchases.status, "succeeded"),
                gte(purchases.createdAt, previousStart),
                lt(purchases.createdAt, previousEnd ?? end)
              )
            : eq(purchases.status, "succeeded")
        )
    ),
    scalar(
      db
        .select({ n: sql<number>`coalesce(sum(${purchases.amountCents} - ${purchases.refundedCents}), 0)::int` })
        .from(purchases)
        .where(
          start
            ? and(eq(purchases.status, "succeeded"), gte(purchases.createdAt, start), lt(purchases.createdAt, end))
            : eq(purchases.status, "succeeded")
        )
    ),
    scalar(
      db
        .select({ n: sql<number>`coalesce(sum(${purchases.amountCents} - ${purchases.refundedCents}), 0)::int` })
        .from(purchases)
        .where(
          previousStart
            ? and(
                eq(purchases.status, "succeeded"),
                gte(purchases.createdAt, previousStart),
                lt(purchases.createdAt, previousEnd ?? end)
              )
            : eq(purchases.status, "succeeded")
        )
    ),
    // Recognised subscription revenue would need a billing ledger; until a
    // provider exists the honest figure is the sum of active plan prices.
    scalar(
      db
        .select({ n: sql<number>`coalesce(sum(${subscriptions.priceCents}), 0)::int` })
        .from(subscriptions)
        .where(eq(subscriptions.status, "active"))
    ),
    scalar(db.select({ n: sql<number>`count(*)::int` }).from(vehicleUnlocks)),
  ]);

  return {
    totalUsers: metric(totalUsers, null),
    newUsers: metric(newUsers, previousStart ? prevNewUsers : null),
    activeUsers: metric(activeUsers, previousStart ? prevActiveUsers : null),
    vehicles: metric(totalVehicles, null),
    // Period-scoped counts reuse the "new in window" numbers.
    servicesLogged: metric(services, previousStart ? prevServices : null),
    guideViews: metric(guideViews, previousStart ? prevGuideViews : null, !availability.events),
    guidePurchases: metric(guidePurchases, previousStart ? prevGuidePurchases : null, !availability.purchases),
    subscriptionRevenue: metric(subscriptionRevenueCents, null, !availability.subscriptions),
    totalRevenue: metric(revenueCents, previousStart ? prevRevenueCents : null, !availability.purchases),
    newVehicles: metric(newVehicles, previousStart ? prevNewVehicles : null),
    unlocks: metric(unlocks, null),
    availability,
  };
}

// --- time series ------------------------------------------------------------

export interface SeriesPoint {
  label: string;
  value: number;
}

/**
 * Daily counts for a table's timestamp column across the range. Grouped in
 * Postgres by date, then zero-filled in Node so the chart shows empty days as
 * empty rather than skipping them (which would distort the shape).
 */
async function dailySeries(
  rows: { day: string; n: number }[],
  range: PeriodRange
): Promise<SeriesPoint[]> {
  const byDay = new Map(rows.map((r) => [r.day.slice(0, 10), r.n]));
  return dayBuckets(range).map((b) => {
    const key = b.start.toISOString().slice(0, 10);
    return { label: b.label, value: byDay.get(key) ?? 0 };
  });
}

export async function getSignupSeries(range: PeriodRange): Promise<SeriesPoint[]> {
  const rows = await db
    .select({
      day: sql<string>`to_char(date_trunc('day', ${users.createdAt}), 'YYYY-MM-DD')`,
      n: sql<number>`count(*)::int`,
    })
    .from(users)
    .where(range.start ? and(gte(users.createdAt, range.start), lt(users.createdAt, range.end)) : undefined)
    .groupBy(sql`date_trunc('day', ${users.createdAt})`);
  return dailySeries(rows, range);
}

export async function getVehicleSeries(range: PeriodRange): Promise<SeriesPoint[]> {
  const rows = await db
    .select({
      day: sql<string>`to_char(date_trunc('day', ${garageEntries.createdAt}), 'YYYY-MM-DD')`,
      n: sql<number>`count(*)::int`,
    })
    .from(garageEntries)
    .where(
      range.start ? and(gte(garageEntries.createdAt, range.start), lt(garageEntries.createdAt, range.end)) : undefined
    )
    .groupBy(sql`date_trunc('day', ${garageEntries.createdAt})`);
  return dailySeries(rows, range);
}

export async function getEventSeries(range: PeriodRange, type?: string): Promise<SeriesPoint[]> {
  const conditions = [];
  if (range.start) conditions.push(gte(appEvents.createdAt, range.start), lt(appEvents.createdAt, range.end));
  if (type) conditions.push(eq(appEvents.type, type));

  const rows = await db
    .select({
      day: sql<string>`to_char(date_trunc('day', ${appEvents.createdAt}), 'YYYY-MM-DD')`,
      n: sql<number>`count(*)::int`,
    })
    .from(appEvents)
    .where(conditions.length ? and(...conditions) : undefined)
    .groupBy(sql`date_trunc('day', ${appEvents.createdAt})`);
  return dailySeries(rows, range);
}

export async function getRevenueSeries(range: PeriodRange): Promise<SeriesPoint[]> {
  const rows = await db
    .select({
      day: sql<string>`to_char(date_trunc('day', ${purchases.createdAt}), 'YYYY-MM-DD')`,
      n: sql<number>`coalesce(sum(${purchases.amountCents} - ${purchases.refundedCents}), 0)::int`,
    })
    .from(purchases)
    .where(
      range.start
        ? and(eq(purchases.status, "succeeded"), gte(purchases.createdAt, range.start), lt(purchases.createdAt, range.end))
        : eq(purchases.status, "succeeded")
    )
    .groupBy(sql`date_trunc('day', ${purchases.createdAt})`);
  return dailySeries(rows, range);
}

// --- top lists --------------------------------------------------------------

export async function getTopEventObjects(
  range: PeriodRange,
  type: string,
  limit = 8
): Promise<{ objectId: string; n: number }[]> {
  const conditions = [eq(appEvents.type, type), isNotNull(appEvents.objectId)];
  if (range.start) conditions.push(gte(appEvents.createdAt, range.start), lt(appEvents.createdAt, range.end));

  const rows = await db
    .select({ objectId: appEvents.objectId, n: sql<number>`count(*)::int` })
    .from(appEvents)
    .where(and(...conditions))
    .groupBy(appEvents.objectId)
    .orderBy(sql`count(*) desc`)
    .limit(limit);

  return rows.filter((r): r is { objectId: string; n: number } => r.objectId !== null);
}

// --- funnel -----------------------------------------------------------------

export interface FunnelCounts {
  visitors: number | null;
  accounts: number;
  withVehicle: number;
  viewedGuide: number;
  purchased: number;
  loggedService: number;
}

/**
 * Cohort funnel over accounts created in the window: of the people who signed
 * up, how many got to each subsequent step (ever, not necessarily in-window).
 * That's the question "where do users drop out?" actually asks -- an
 * event-count funnel would mix different people at each stage.
 */
export async function getFunnel(range: PeriodRange): Promise<FunnelCounts> {
  const windowClause = range.start
    ? sql`and u.created_at >= ${range.start} and u.created_at < ${range.end}`
    : sql``;

  const rows = await db.execute<{
    accounts: number;
    with_vehicle: number;
    viewed_guide: number;
    purchased: number;
    logged_service: number;
  }>(sql`
    select
      count(*)::int as accounts,
      count(*) filter (where exists (select 1 from garage_entries g where g.user_id = u.id))::int as with_vehicle,
      count(*) filter (where exists (select 1 from app_events e where e.user_id = u.id and e.type = 'guide.viewed'))::int as viewed_guide,
      count(*) filter (where exists (select 1 from purchases p where p.user_id = u.id and p.status = 'succeeded'))::int as purchased,
      count(*) filter (where exists (select 1 from service_entries s where s.user_id = u.id))::int as logged_service
    from users u
    where true ${windowClause}
  `);

  const r = rows.rows?.[0] ?? (rows as unknown as { accounts: number; with_vehicle: number; viewed_guide: number; purchased: number; logged_service: number }[])[0];

  return {
    // No anonymous page-view tracking exists, so top-of-funnel is genuinely
    // unknown rather than zero. The UI states that rather than inventing it.
    visitors: null,
    accounts: r?.accounts ?? 0,
    withVehicle: r?.with_vehicle ?? 0,
    viewedGuide: r?.viewed_guide ?? 0,
    purchased: r?.purchased ?? 0,
    loggedService: r?.logged_service ?? 0,
  };
}
