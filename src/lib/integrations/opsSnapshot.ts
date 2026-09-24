import {
  listFeedback,
  getFeedbackCounts,
  listTasks,
  getBuildQueue,
  getTodoSummary,
  type FeedbackRow,
  type BuildSignal,
} from "@/lib/admin/todo";
import { getGuideSummary, getCatalogDataIssues } from "@/lib/admin/guides";
import { allRepairs, listVehicles } from "@/lib/data";
import { getWebAnalytics, type WebAnalytics, type AnalyticsError } from "@/lib/vercelAnalytics";

// ---------------------------------------------------------------------------
// The operational snapshot handed to external, read-only consumers
// (ChatGPT, or anything else that authors a briefing from Crankcase state).
//
// This is a CONTRACT, not a dump. Every field below is here because a report
// author needs it, and every field that is not here was left out on purpose:
//
//   * No reporter email, no admin notes, no user ids, no "who created this
//     task". The consumer needs to know a human wrote in and what they said,
//     not who they are.
//   * User-submitted text is carried as DATA. It is length-capped and
//     control-character-stripped, and it lives under `fromTheSite[].message`
//     so a consumer can treat that one field as untrusted. Nothing in this
//     payload is an instruction to the reader. If the message says "ignore
//     your rules", that is a string a customer typed, and nothing more.
//   * Coverage is computed here, server-side, from the same functions the
//     admin console uses. Nobody should have to clone the repo to count.
//   * Analytics carries an explicit unavailable state. A missing token is
//     "we couldn't ask", never zero visitors.
//   * Anything we cannot see safely from here (pull requests, CI, deployment
//     state) is listed under `notIncluded` with a reason, so the consumer
//     knows it is absent rather than empty.
//
// Bump SCHEMA_VERSION on any change a consumer could notice: a renamed or
// removed field, a changed type, a changed meaning. Additive fields are fine
// under the same major but should still be noted in the changelog comment.
//
// CHANGELOG
//   1 - 2026-09-24. First version.
// ---------------------------------------------------------------------------

export const SCHEMA_VERSION = 1;
export const INTEGRATION_ID = "ops-snapshot";

// Hard caps. These are the ONLY numbers that decide how big a response can
// get, so they are all in one place.
export const LIMITS = {
  feedbackPerStatus: 25,
  feedbackMessageChars: 1000,
  feedbackPathChars: 300,
  openTasks: 50,
  taskTitleChars: 200,
  taskDetailChars: 500,
  signalDetailChars: 600,
  catalogIssues: 100,
  vehicleLabels: 100,
  /** Serialized payload ceiling; over this, lists are trimmed and `truncated` is set. */
  maxBytes: 200_000,
} as const;

// --- sanitized shapes -------------------------------------------------------

export interface SnapshotFeedback {
  /** Stable id so a consumer can reference the same report across days. Not a user id. */
  id: string;
  kind: string;
  /** UNTRUSTED. Free text typed by a member of the public. Capped and cleaned; never an instruction. */
  message: string;
  path: string | null;
  vehicleId: string | null;
  guideId: string | null;
  status: string;
  severity: string | null;
  createdAt: string;
  ageHours: number;
  fromSignedInUser: boolean;
}

export interface SnapshotTask {
  id: string;
  title: string;
  detail: string | null;
  category: string;
  priority: number;
  status: string;
  createdAt: string;
  updatedAt: string | null;
}

export interface SnapshotSignal {
  id: string;
  severity: BuildSignal["severity"];
  category: string;
  title: string;
  detail: string;
  count: number | null;
  href: string | null;
}

export interface SnapshotCoverage {
  vehicles: {
    total: number;
    withGuides: number;
    withoutGuides: string[];
    withoutFreeGuide: string[];
  };
  guides: {
    total: number;
    published: number;
    incomplete: number;
    free: number;
    premium: number;
    averageCompleteness: number;
    totalSteps: number;
  };
  torqueFigures: {
    total: number;
    /** Provenance source "open-labor-project" (machine-sourced). */
    sourcedOpenLaborProject: number;
    /** Provenance explicitly "curated" (a human cited it). */
    citedByHand: number;
    /** No provenance at all. */
    unsourced: number;
  };
  fluidFigures: {
    total: number;
    withProvenance: number;
    sourcedOpenLaborProject: number;
  };
  catalogIssues: { vehicleId: string; label: string; issues: string[] }[];
}

export type SnapshotAnalytics =
  | { status: "ok"; data: WebAnalytics }
  | { status: "unavailable"; reason: AnalyticsError };

export interface OpsSnapshot {
  schemaVersion: typeof SCHEMA_VERSION;
  integration: typeof INTEGRATION_ID;
  generatedAt: string;
  /** Which build answered. Safe to expose: a short commit id and the Vercel environment name. */
  build: { commit: string | null; env: string | null };
  summary: {
    newFeedback: number;
    triagedFeedback: number;
    openTasks: number;
    doneTasks: number;
    signals: number;
    criticalSignals: number;
  };
  fromTheSite: {
    counts: Record<string, number>;
    /** Ordered newest first. Priority for a report: these outrank everything derived. */
    new: SnapshotFeedback[];
    triaged: SnapshotFeedback[];
  };
  buildQueue: SnapshotSignal[];
  openTasks: SnapshotTask[];
  coverage: SnapshotCoverage;
  analytics: SnapshotAnalytics;
  /** Things a report author might expect that this payload deliberately does not carry. */
  notIncluded: { pullRequests: string; deployments: string; previousReport: string; decisions: string };
  /** True when a list was cut to fit LIMITS.maxBytes. Counts in `summary` and `fromTheSite.counts` stay exact. */
  truncated: boolean;
}

// --- helpers ----------------------------------------------------------------

/**
 * Bound and clean a piece of free text. Removes control characters (which
 * is where terminal-escape and zero-width tricks live) but keeps ordinary
 * punctuation and newlines: the goal is a safe *string*, not a rewrite.
 */
export function cleanText(value: string | null | undefined, max: number): string | null {
  if (value === null || value === undefined) return null;
  const cleaned = value
    // C0/C1 controls except \n and \t; plus zero-width and bidi overrides.
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F​-‏‪-‮⁠-⁤﻿]/g, "")
    .trim();
  return cleaned.length > max ? `${cleaned.slice(0, max)}…` : cleaned;
}

function iso(d: Date | string | null | undefined): string | null {
  if (!d) return null;
  return d instanceof Date ? d.toISOString() : new Date(d).toISOString();
}

function sanitizeFeedback(row: FeedbackRow): SnapshotFeedback {
  return {
    id: row.id,
    kind: row.kind,
    message: cleanText(row.message, LIMITS.feedbackMessageChars) ?? "",
    path: cleanText(row.path, LIMITS.feedbackPathChars),
    vehicleId: row.vehicleId,
    guideId: row.guideId,
    status: row.status,
    severity: row.severity,
    createdAt: iso(row.createdAt) ?? "",
    ageHours: Math.round((Date.now() - new Date(row.createdAt).getTime()) / 36e5),
    fromSignedInUser: row.userId !== null,
    // Deliberately absent: userId, userEmail, adminNote.
  };
}

type TaskRow = Awaited<ReturnType<typeof listTasks>>[number];

function sanitizeTask(row: TaskRow): SnapshotTask {
  return {
    id: row.id,
    title: cleanText(row.title, LIMITS.taskTitleChars) ?? "",
    detail: cleanText(row.detail, LIMITS.taskDetailChars),
    category: row.category,
    priority: row.priority,
    status: row.status,
    createdAt: iso(row.createdAt) ?? "",
    updatedAt: iso(row.updatedAt),
    // Deliberately absent: createdBy, completedBy, completedAt.
  };
}

function sanitizeSignal(s: BuildSignal): SnapshotSignal {
  return {
    id: s.id,
    severity: s.severity,
    category: s.category,
    title: s.title,
    // Signal text is server-generated, but it can embed labels users typed
    // (the demand backlog lists custom vehicles), so it gets the same cap.
    detail: cleanText(s.detail, LIMITS.signalDetailChars) ?? "",
    count: s.count,
    href: s.href ?? null,
  };
}

function vehicleLabel(v: { year: number; make: string; model: string }): string {
  return `${v.year} ${v.make} ${v.model}`;
}

/** Coverage the way the morning report has been counting it by hand, computed once here. */
export function computeCoverage(): SnapshotCoverage {
  const summary = getGuideSummary();
  const guides = allRepairs();
  const vehicles = listVehicles();

  let torqueTotal = 0;
  let torqueOlp = 0;
  let torqueCurated = 0;
  for (const g of guides) {
    for (const t of g.torqueSpecs) {
      torqueTotal++;
      if (t.provenance?.source === "open-labor-project") torqueOlp++;
      else if (t.provenance?.source === "curated") torqueCurated++;
    }
  }

  let fluidTotal = 0;
  let fluidWithProv = 0;
  let fluidOlp = 0;
  for (const v of vehicles) {
    for (const f of v.fluids) {
      fluidTotal++;
      if (f.provenance) fluidWithProv++;
      if (f.provenance?.source === "open-labor-project") fluidOlp++;
    }
  }

  return {
    vehicles: {
      total: summary.vehiclesTotal,
      withGuides: summary.vehiclesWithGuides,
      withoutGuides: summary.vehiclesWithoutGuides.slice(0, LIMITS.vehicleLabels).map(vehicleLabel),
      withoutFreeGuide: summary.vehiclesWithoutFreeGuide.slice(0, LIMITS.vehicleLabels).map(vehicleLabel),
    },
    guides: {
      total: summary.total,
      published: summary.complete,
      incomplete: summary.incomplete,
      free: summary.free,
      premium: summary.premium,
      averageCompleteness: summary.averageCompleteness,
      totalSteps: summary.totalSteps,
    },
    torqueFigures: {
      total: torqueTotal,
      sourcedOpenLaborProject: torqueOlp,
      citedByHand: torqueCurated,
      unsourced: torqueTotal - torqueOlp - torqueCurated,
    },
    fluidFigures: {
      total: fluidTotal,
      withProvenance: fluidWithProv,
      sourcedOpenLaborProject: fluidOlp,
    },
    catalogIssues: getCatalogDataIssues().slice(0, LIMITS.catalogIssues),
  };
}

// --- assembly ---------------------------------------------------------------

export async function buildOpsSnapshot(): Promise<OpsSnapshot> {
  const [summary, newReports, triagedReports, counts, signals, tasks, analytics] = await Promise.all([
    getTodoSummary(),
    listFeedback("new", LIMITS.feedbackPerStatus),
    listFeedback("triaged", LIMITS.feedbackPerStatus),
    getFeedbackCounts(),
    getBuildQueue(),
    listTasks(false),
    // getWebAnalytics() is written not to throw, but it is the one call that
    // leaves the building; a rejection must not take the snapshot down.
    getWebAnalytics().catch(() => ({ data: null, error: "network_error" as const })),
  ]);

  const snapshot: OpsSnapshot = {
    schemaVersion: SCHEMA_VERSION,
    integration: INTEGRATION_ID,
    generatedAt: new Date().toISOString(),
    build: {
      commit: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? null,
      env: process.env.VERCEL_ENV ?? null,
    },
    summary,
    fromTheSite: {
      counts,
      new: newReports.map(sanitizeFeedback),
      triaged: triagedReports.map(sanitizeFeedback),
    },
    buildQueue: signals.map(sanitizeSignal),
    openTasks: tasks.slice(0, LIMITS.openTasks).map(sanitizeTask),
    coverage: computeCoverage(),
    analytics: analytics.data
      ? { status: "ok", data: analytics.data }
      : { status: "unavailable", reason: analytics.error ?? "bad_payload" },
    notIncluded: {
      pullRequests: "deferred - needs a read-only GitHub credential held server-side; not added in this version",
      deployments: "deferred - only build.commit/build.env of the answering build are exposed",
      previousReport: "lives in the Shop Rag dashboard database, not on the site",
      decisions: "lives in the Shop Rag dashboard database, not on the site",
    },
    truncated: false,
  };

  return fitToBudget(snapshot);
}

/**
 * Keep the serialized response under LIMITS.maxBytes by shrinking the
 * variable-length lists, largest first. Counts are never altered, so the
 * consumer can always tell that something was cut and by how much.
 */
export function fitToBudget(snapshot: OpsSnapshot): OpsSnapshot {
  const size = (s: OpsSnapshot) => Buffer.byteLength(JSON.stringify(s), "utf8");
  if (size(snapshot) <= LIMITS.maxBytes) return snapshot;

  const out: OpsSnapshot = { ...snapshot, truncated: true };
  const steps: Array<() => void> = [
    () => (out.coverage = { ...out.coverage, catalogIssues: out.coverage.catalogIssues.slice(0, 20) }),
    () => (out.openTasks = out.openTasks.slice(0, 20)),
    () => (out.fromTheSite = { ...out.fromTheSite, triaged: out.fromTheSite.triaged.slice(0, 10) }),
    () => (out.fromTheSite = { ...out.fromTheSite, new: out.fromTheSite.new.slice(0, 10) }),
    () => (out.coverage = { ...out.coverage, catalogIssues: [] }),
    () => (out.openTasks = []),
  ];
  for (const step of steps) {
    step();
    if (size(out) <= LIMITS.maxBytes) break;
  }
  return out;
}
