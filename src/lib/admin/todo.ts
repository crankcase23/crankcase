import { randomUUID } from "node:crypto";
import { sql, eq, and, desc, asc, count, gte } from "drizzle-orm";
import { db } from "@/db";
import {
  feedback,
  adminTasks,
  users,
  errorEvents,
  garageEntries,
  vehicleDataCache,
  contentBlocks,
} from "@/db/schema";
import { getGuideSummary, listGuideRecords } from "./guides";
import { listVehicles } from "@/lib/data";

// ---------------------------------------------------------------------------
// The To-Do page has two halves, and the split is the whole design.
//
// DERIVED (this file's `getBuildQueue`): computed from live data every time
// the page loads. Guide coverage, sourced-vs-hand-typed specs, Open Labor
// Project cache health, demand backlog. This half can never go stale and
// never needs maintaining -- which is exactly the failure mode of the process
// docs it replaces. If a gap gets closed, the item disappears on its own.
//
// MANUAL (`listTasks`): a small task table for the things no query can infer.
// Kept deliberately minimal. A heavyweight task system here would just become
// another thing that drifts out of date.
//
// The inbox above both of them is user feedback plus captured errors -- real
// reports from real people, which outrank anything either half computes.
// ---------------------------------------------------------------------------

// --- inbox ------------------------------------------------------------------

export const FEEDBACK_STATUSES = ["new", "triaged", "resolved", "wontfix"] as const;
export type FeedbackStatus = (typeof FEEDBACK_STATUSES)[number];

export const FEEDBACK_KIND_LABELS: Record<string, string> = {
  data: "Spec looks wrong",
  bug: "Broken page",
  idea: "Suggestion",
  other: "Other",
};

export interface FeedbackRow {
  id: string;
  kind: string;
  message: string;
  path: string | null;
  vehicleId: string | null;
  guideId: string | null;
  status: string;
  severity: string | null;
  adminNote: string | null;
  createdAt: Date;
  userId: string | null;
  userEmail: string | null;
}

export async function listFeedback(status?: FeedbackStatus, limit = 50): Promise<FeedbackRow[]> {
  return db
    .select({
      id: feedback.id,
      kind: feedback.kind,
      message: feedback.message,
      path: feedback.path,
      vehicleId: feedback.vehicleId,
      guideId: feedback.guideId,
      status: feedback.status,
      severity: feedback.severity,
      adminNote: feedback.adminNote,
      createdAt: feedback.createdAt,
      userId: feedback.userId,
      userEmail: users.email,
    })
    .from(feedback)
    .leftJoin(users, eq(users.id, feedback.userId))
    .where(status ? eq(feedback.status, status) : undefined)
    .orderBy(desc(feedback.createdAt))
    .limit(limit);
}

export async function getFeedbackCounts(): Promise<Record<string, number>> {
  const rows = await db.select({ status: feedback.status, n: count() }).from(feedback).groupBy(feedback.status);
  const out: Record<string, number> = { new: 0, triaged: 0, resolved: 0, wontfix: 0 };
  for (const r of rows) out[r.status] = r.n;
  return out;
}

// --- manual tasks -----------------------------------------------------------

export const TASK_CATEGORIES = ["content", "data", "product", "ops"] as const;
export type TaskCategory = (typeof TASK_CATEGORIES)[number];
export const TASK_STATUSES = ["open", "doing", "done"] as const;

export const CATEGORY_LABELS: Record<string, string> = {
  content: "Content",
  data: "Data",
  product: "Product",
  ops: "Ops",
};

export async function listTasks(includeDone = false) {
  return db
    .select()
    .from(adminTasks)
    .where(includeDone ? undefined : sql`${adminTasks.status} <> 'done'`)
    .orderBy(asc(adminTasks.status), asc(adminTasks.priority), asc(adminTasks.createdAt));
}

export async function createTask(input: {
  title: string;
  detail?: string | null;
  category: string;
  priority: number;
  createdBy: string;
}) {
  const id = randomUUID();
  await db.insert(adminTasks).values({
    id,
    title: input.title,
    detail: input.detail ?? null,
    category: input.category,
    priority: input.priority,
    createdBy: input.createdBy,
  });
  return id;
}

// --- derived build queue ----------------------------------------------------

export type SignalSeverity = "critical" | "warning" | "info";

export interface BuildSignal {
  id: string;
  severity: SignalSeverity;
  category: string;
  title: string;
  detail: string;
  /** The number that makes it concrete. Null when the signal is a yes/no. */
  count: number | null;
  href?: string;
}

/**
 * Everything on the "what's left" list that can be computed rather than
 * remembered. Each signal states the data behind it so it can be checked.
 */
export async function getBuildQueue(): Promise<BuildSignal[]> {
  const signals: BuildSignal[] = [];
  const summary = getGuideSummary();
  const vehicles = listVehicles();

  const [cacheRows, customDemand, openErrors, draftContent, newFeedback] = await Promise.all([
    db
      .select({ status: vehicleDataCache.status, n: count() })
      .from(vehicleDataCache)
      .groupBy(vehicleDataCache.status),
    db
      .select({
        label: sql<string>`nullif(trim(concat_ws(' ', ${garageEntries.year}, ${garageEntries.make}, ${garageEntries.model})), '')`,
        n: sql<number>`count(*)::int`,
      })
      .from(garageEntries)
      .where(eq(garageEntries.kind, "custom"))
      .groupBy(sql`nullif(trim(concat_ws(' ', ${garageEntries.year}, ${garageEntries.make}, ${garageEntries.model})), '')`)
      .orderBy(sql`count(*) desc`)
      .limit(5),
    db.select({ n: count() }).from(errorEvents).where(eq(errorEvents.status, "open")),
    db.select({ n: count() }).from(contentBlocks).where(eq(contentBlocks.status, "draft")),
    db.select({ n: count() }).from(feedback).where(eq(feedback.status, "new")),
  ]);

  // --- guide coverage -------------------------------------------------------
  if (summary.vehiclesWithoutFreeGuide.length > 0) {
    signals.push({
      id: "no-free-guide",
      severity: "critical",
      category: "Content",
      title: "Vehicles with no free guide",
      detail: `The freemium hook depends on every vehicle having one free guide. Missing on: ${summary.vehiclesWithoutFreeGuide
        .map((v) => `${v.year} ${v.make} ${v.model}`)
        .join(", ")}.`,
      count: summary.vehiclesWithoutFreeGuide.length,
      href: "/admin/guides#coverage",
    });
  }

  if (summary.vehiclesWithoutGuides.length > 0) {
    signals.push({
      id: "no-guides",
      severity: "warning",
      category: "Content",
      title: "Catalog vehicles with no guides at all",
      detail: `Listed with specs but nothing to repair: ${summary.vehiclesWithoutGuides
        .map((v) => `${v.year} ${v.make} ${v.model}`)
        .join(", ")}.`,
      count: summary.vehiclesWithoutGuides.length,
      href: "/admin/guides#coverage",
    });
  }

  if (summary.incomplete > 0) {
    const worst = listGuideRecords()
      .filter((r) => r.requiredMissing > 0)
      .sort((a, b) => b.requiredMissing - a.requiredMissing)
      .slice(0, 3)
      .map((r) => r.guide.title);
    signals.push({
      id: "incomplete-guides",
      severity: "warning",
      category: "Content",
      title: "Live guides failing the publish checklist",
      detail: `${summary.incomplete} of ${summary.total} guides are missing something required — worst: ${worst.join(", ")}.`,
      count: summary.incomplete,
      href: "/admin/guides?filter=incomplete",
    });
  }

  // --- data provenance ------------------------------------------------------
  const handTypedVehicles = vehicles.filter(
    (v) => v.fluids.length > 0 && !v.fluids.some((f) => f.provenance?.source === "open-labor-project")
  );
  if (handTypedVehicles.length > 0) {
    signals.push({
      id: "hand-typed-fluids",
      severity: "warning",
      category: "Data",
      title: "Vehicles with no sourced fluid data",
      detail: `Every fluid figure is hand-typed on: ${handTypedVehicles
        .map((v) => `${v.year} ${v.make} ${v.model}`)
        .join(", ")}. Source these from the factory service manual or owner's manual for each vehicle — Open Labor Project must not be used for capacities.`,
      count: handTypedVehicles.length,
      href: "/admin/vehicles",
    });
  }

  const sourcedPct =
    summary.totalTorqueSpecs === 0
      ? 0
      : Math.round((summary.realDataSpecs / summary.totalTorqueSpecs) * 100);
  if (summary.totalTorqueSpecs > 0 && sourcedPct < 100) {
    signals.push({
      id: "torque-provenance",
      severity: sourcedPct < 50 ? "warning" : "info",
      category: "Data",
      title: "Torque specs still hand-typed",
      detail: `${summary.realDataSpecs} of ${summary.totalTorqueSpecs} torque values are backed by sourced data (${sourcedPct}%). The rest are hand-typed reference figures.`,
      count: summary.totalTorqueSpecs - summary.realDataSpecs,
      href: "/admin/guides",
    });
  }

  // --- Open Labor Project cache --------------------------------------------
  const cache: Record<string, number> = {};
  for (const r of cacheRows) cache[r.status] = r.n;
  const pending = cache.pending ?? 0;
  const notFound = cache.not_found ?? 0;
  const ok = cache.ok ?? 0;

  if (pending > 0) {
    signals.push({
      id: "olp-pending",
      severity: "warning",
      category: "Data",
      title: "Vehicle data lookups unresolved",
      detail: `${pending} pending, ${ok} resolved, ${notFound} with no upstream data. Pending usually means the shared daily quota was tapped out — they retry safely.`,
      count: pending,
      href: "/admin/system#integrations",
    });
  } else if (ok + notFound === 0) {
    signals.push({
      id: "olp-empty",
      severity: "info",
      category: "Data",
      title: "No vehicle data cached yet",
      detail:
        "Nothing has been looked up against Open Labor Project. The cache fills as users add vehicles outside the curated catalog.",
      count: null,
      href: "/admin/system#integrations",
    });
  }

  // --- demand ---------------------------------------------------------------
  const demand = customDemand.filter((d): d is { label: string; n: number } => Boolean(d.label));
  if (demand.length > 0) {
    signals.push({
      id: "demand-backlog",
      severity: "info",
      category: "Content",
      title: "Vehicles users added that you don't cover",
      detail: `Most requested: ${demand.map((d) => `${d.label} (${d.n})`).join(", ")}. This is demand, not a guess.`,
      count: demand.length,
      href: "/admin/vehicles?kind=custom",
    });
  }

  // --- housekeeping ---------------------------------------------------------
  const errCount = openErrors[0]?.n ?? 0;
  if (errCount > 0) {
    signals.push({
      id: "open-errors",
      severity: "critical",
      category: "Ops",
      title: "Unresolved application errors",
      detail: `${errCount} error${errCount === 1 ? "" : "s"} captured and not yet dealt with.`,
      count: errCount,
      href: "/admin/system#errors",
    });
  }

  const drafts = draftContent[0]?.n ?? 0;
  if (drafts > 0) {
    signals.push({
      id: "draft-content",
      severity: "info",
      category: "Content",
      title: "Content sitting in draft",
      detail: `${drafts} item${drafts === 1 ? "" : "s"} written but not published.`,
      count: drafts,
      href: "/admin/content?status=draft",
    });
  }

  const unread = newFeedback[0]?.n ?? 0;
  if (unread > 0) {
    signals.push({
      id: "new-feedback",
      severity: "critical",
      category: "Users",
      title: "Untriaged user reports",
      detail: `${unread} report${unread === 1 ? "" : "s"} from real users waiting in the inbox above.`,
      count: unread,
      href: "/admin/todo#inbox",
    });
  }

  const order: Record<SignalSeverity, number> = { critical: 0, warning: 1, info: 2 };
  return signals.sort((a, b) => order[a.severity] - order[b.severity]);
}

/** Headline numbers for the top of the To-Do page. */
export async function getTodoSummary() {
  const [fb, tasks, signals] = await Promise.all([
    getFeedbackCounts(),
    db.select({ status: adminTasks.status, n: count() }).from(adminTasks).groupBy(adminTasks.status),
    getBuildQueue(),
  ]);

  const taskCounts: Record<string, number> = { open: 0, doing: 0, done: 0 };
  for (const t of tasks) taskCounts[t.status] = t.n;

  return {
    newFeedback: fb.new ?? 0,
    triagedFeedback: fb.triaged ?? 0,
    openTasks: (taskCounts.open ?? 0) + (taskCounts.doing ?? 0),
    doneTasks: taskCounts.done ?? 0,
    signals: signals.length,
    criticalSignals: signals.filter((s) => s.severity === "critical").length,
  };
}

// Kept for a future "reports in the last 7 days" trend on this page.
export async function countRecentFeedback(days = 7): Promise<number> {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const rows = await db.select({ n: count() }).from(feedback).where(and(gte(feedback.createdAt, since)));
  return rows[0]?.n ?? 0;
}
