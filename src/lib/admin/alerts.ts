import { sql, and, eq, gte, isNull, count } from "drizzle-orm";
import { db } from "@/db";
import {
  errorEvents,
  paymentEvents,
  contentBlocks,
  garageEntries,
  vehicleDataCache,
} from "@/db/schema";
import { getGuideSummary, listGuideRecords } from "./guides";

// ---------------------------------------------------------------------------
// "Attention Required".
//
// Every alert here is a real condition computed from real data. The panel
// renders nothing at all when nothing is wrong -- an empty alerts box that
// says "all clear" every day trains you to stop reading it.
//
// Each alert carries a severity, a count, and a link to the screen where you
// act on it. Nothing is informational-only; if you can't do something about
// it, it isn't an alert, it's a metric.
// ---------------------------------------------------------------------------

export type AlertSeverity = "critical" | "warning" | "info";

export interface Alert {
  id: string;
  severity: AlertSeverity;
  title: string;
  detail: string;
  count?: number;
  href: string;
  actionLabel: string;
}

const DAY_MS = 24 * 60 * 60 * 1000;

export async function getAlerts(): Promise<Alert[]> {
  const alerts: Alert[] = [];
  const since24h = new Date(Date.now() - DAY_MS);
  const since7d = new Date(Date.now() - 7 * DAY_MS);

  const [openErrors, recentErrors, failedPayments, draftContent, staleCustomVehicles, failedLookups] =
    await Promise.all([
      db.select({ n: count() }).from(errorEvents).where(eq(errorEvents.status, "open")),
      db
        .select({ n: count() })
        .from(errorEvents)
        .where(and(eq(errorEvents.status, "open"), gte(errorEvents.createdAt, since24h))),
      db
        .select({ n: count() })
        .from(paymentEvents)
        .where(and(eq(paymentEvents.type, "payment_failed"), isNull(paymentEvents.resolvedAt))),
      db.select({ n: count() }).from(contentBlocks).where(eq(contentBlocks.status, "draft")),
      // Custom garage entries are vehicles we have no curated data for --
      // every one is a user telling us what to build next.
      db.select({ n: count() }).from(garageEntries).where(eq(garageEntries.kind, "custom")),
      // Vehicle data lookups that never resolved against Open Labor Project.
      db
        .select({ n: count() })
        .from(vehicleDataCache)
        .where(and(eq(vehicleDataCache.status, "pending"), gte(vehicleDataCache.attempts, 3))),
    ]);

  // --- system errors --------------------------------------------------------
  const openErrorCount = openErrors[0]?.n ?? 0;
  const recentErrorCount = recentErrors[0]?.n ?? 0;
  if (openErrorCount > 0) {
    alerts.push({
      id: "errors-open",
      severity: recentErrorCount > 0 ? "critical" : "warning",
      title: recentErrorCount > 0 ? "Application errors in the last 24 hours" : "Unresolved application errors",
      detail:
        recentErrorCount > 0
          ? `${recentErrorCount} new in the last 24h, ${openErrorCount} unresolved in total.`
          : `${openErrorCount} unresolved, none in the last 24 hours.`,
      count: openErrorCount,
      href: "/admin/system#errors",
      actionLabel: "Review errors",
    });
  }

  // --- payments -------------------------------------------------------------
  const failedPaymentCount = failedPayments[0]?.n ?? 0;
  if (failedPaymentCount > 0) {
    alerts.push({
      id: "payments-failed",
      severity: "critical",
      title: "Failed payments need attention",
      detail: `${failedPaymentCount} payment ${failedPaymentCount === 1 ? "failure has" : "failures have"} not been resolved.`,
      count: failedPaymentCount,
      href: "/admin/revenue#failed",
      actionLabel: "Open Revenue",
    });
  }

  // --- guide completeness ---------------------------------------------------
  const guideSummary = getGuideSummary();
  if (guideSummary.incomplete > 0) {
    const worst = listGuideRecords()
      .filter((r) => r.requiredMissing > 0)
      .sort((a, b) => b.requiredMissing - a.requiredMissing)[0];
    alerts.push({
      id: "guides-incomplete",
      severity: "warning",
      title: "Live guides are missing required information",
      detail: `${guideSummary.incomplete} of ${guideSummary.total} guides fail the publish checklist${
        worst ? ` — worst is "${worst.guide.title}"` : ""
      }.`,
      count: guideSummary.incomplete,
      href: "/admin/guides?filter=incomplete",
      actionLabel: "Open Guides",
    });
  }

  if (guideSummary.vehiclesWithoutFreeGuide.length > 0) {
    alerts.push({
      id: "vehicles-no-free-guide",
      severity: "warning",
      title: "Vehicles with no free guide",
      detail: `${guideSummary.vehiclesWithoutFreeGuide.length} catalog ${
        guideSummary.vehiclesWithoutFreeGuide.length === 1 ? "vehicle has" : "vehicles have"
      } no free guide, which breaks the freemium hook: ${guideSummary.vehiclesWithoutFreeGuide
        .slice(0, 3)
        .map((v) => `${v.year} ${v.make} ${v.model}`)
        .join(", ")}.`,
      count: guideSummary.vehiclesWithoutFreeGuide.length,
      href: "/admin/guides#coverage",
      actionLabel: "Review coverage",
    });
  }

  if (guideSummary.vehiclesWithoutGuides.length > 0) {
    alerts.push({
      id: "vehicles-no-guides",
      severity: "info",
      title: "Catalog vehicles with no guides at all",
      detail: `${guideSummary.vehiclesWithoutGuides.length} ${
        guideSummary.vehiclesWithoutGuides.length === 1 ? "vehicle is" : "vehicles are"
      } listed with specs but nothing to repair.`,
      count: guideSummary.vehiclesWithoutGuides.length,
      href: "/admin/guides#coverage",
      actionLabel: "Review coverage",
    });
  }

  // --- unpublished content --------------------------------------------------
  const draftCount = draftContent[0]?.n ?? 0;
  if (draftCount > 0) {
    alerts.push({
      id: "content-draft",
      severity: "info",
      title: "Unpublished content",
      detail: `${draftCount} ${draftCount === 1 ? "item is" : "items are"} sitting in draft.`,
      count: draftCount,
      href: "/admin/content?status=draft",
      actionLabel: "Open Content",
    });
  }

  // --- data integrity -------------------------------------------------------
  const customCount = staleCustomVehicles[0]?.n ?? 0;
  if (customCount > 0) {
    alerts.push({
      id: "custom-vehicles",
      severity: "info",
      title: "User vehicles with no curated data",
      detail: `${customCount} garage ${
        customCount === 1 ? "entry is" : "entries are"
      } custom — real demand for catalog vehicles you haven't built yet.`,
      count: customCount,
      href: "/admin/vehicles?kind=custom",
      actionLabel: "See demand",
    });
  }

  const failedLookupCount = failedLookups[0]?.n ?? 0;
  if (failedLookupCount > 0) {
    alerts.push({
      id: "olp-lookups-failing",
      severity: "warning",
      title: "Vehicle data lookups failing",
      detail: `${failedLookupCount} ${
        failedLookupCount === 1 ? "vehicle has" : "vehicles have"
      } failed 3+ Open Labor Project lookups — likely the daily quota or missing upstream data.`,
      count: failedLookupCount,
      href: "/admin/system#integrations",
      actionLabel: "Check integrations",
    });
  }

  // --- suspicious login activity -------------------------------------------
  // Deliberately simple and explainable: an unusual burst of sign-ins for one
  // account inside an hour. No scoring model, no false-positive machine.
  const burst = await db.execute<{ user_id: string; n: number }>(sql`
    select user_id, count(*)::int as n
      from login_events
     where logged_in_at >= ${new Date(Date.now() - 60 * 60 * 1000)}
     group by user_id
    having count(*) >= 10
     limit 5
  `);
  const burstRows = Array.isArray(burst) ? burst : (burst.rows ?? []);
  if (burstRows.length > 0) {
    alerts.push({
      id: "login-burst",
      severity: "warning",
      title: "Unusual sign-in activity",
      detail: `${burstRows.length} account${burstRows.length === 1 ? "" : "s"} recorded 10+ sign-ins in the last hour.`,
      count: burstRows.length,
      href: "/admin/security#logins",
      actionLabel: "Review sign-ins",
    });
  }

  void since7d;

  const order: Record<AlertSeverity, number> = { critical: 0, warning: 1, info: 2 };
  return alerts.sort((a, b) => order[a.severity] - order[b.severity]);
}

export async function getAlertCount(): Promise<number> {
  try {
    const alerts = await getAlerts();
    return alerts.filter((a) => a.severity !== "info").length;
  } catch {
    // The nav badge must never be the thing that breaks the admin.
    return 0;
  }
}
