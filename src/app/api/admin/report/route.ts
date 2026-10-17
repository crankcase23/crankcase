import { NextResponse } from "next/server";
import { bearerAccepted } from "@/lib/integrations/bearerAuth";
import {
  listFeedback,
  getFeedbackCounts,
  listTasks,
  getBuildQueue,
  getTodoSummary,
  type FeedbackRow,
} from "@/lib/admin/todo";
import { recordError } from "@/lib/errors";
import { getWebAnalytics } from "@/lib/vercelAnalytics";

// ---------------------------------------------------------------------------
// Machine-readable to-do queue, for the scheduled morning report.
//
// WHY THIS EXISTS: every other way into the admin area is session-based, and a
// scheduled run has no browser and no cookie. Without this, the morning report
// only works while Andy's laptop is awake with Chrome open - which is exactly
// the dependency it was supposed to remove.
//
// STRICTLY READ-ONLY. There is no POST, PATCH or DELETE here and there should
// never be one. Triaging and resolving a user report are audited decisions
// that belong to a human, and a bearer token in an environment variable is not
// a human. If a future scheduled task needs to change a report's status, it
// asks Andy in the report rather than getting a write endpoint here.
// ---------------------------------------------------------------------------

export const runtime = "nodejs"; // node:crypto
export const dynamic = "force-dynamic"; // never cache an authed payload

const NO_STORE = { "Cache-Control": "no-store, max-age=0" };

/**
 * Constant-time bearer check.
 *
 * The implementation now lives in src/lib/integrations/bearerAuth.ts so the
 * ops snapshot route uses the exact same code. Behaviour here is unchanged:
 * fail closed when ADMIN_REPORT_TOKEN is unset or under 24 characters,
 * Bearer only, SHA-256 both sides then timingSafeEqual so neither the value
 * nor the length leaks through response timing. Only ADMIN_REPORT_TOKEN
 * opens this route - the snapshot token is a different secret and is never
 * consulted here.
 */
function tokenAccepted(header: string | null): boolean {
  return bearerAccepted(header, { expected: process.env.ADMIN_REPORT_TOKEN, minLength: 24 });
}

/**
 * Drop the reporter's email before the payload leaves the building.
 *
 * The report needs to know a human submitted this and what they said. It does
 * not need their address, and anything carried here is exposed by a leaked
 * token. Keep the blast radius small.
 */
function scrub(row: FeedbackRow) {
  return {
    id: row.id,
    kind: row.kind,
    message: row.message,
    path: row.path,
    vehicleId: row.vehicleId,
    guideId: row.guideId,
    status: row.status,
    severity: row.severity,
    adminNote: row.adminNote,
    createdAt: row.createdAt,
    fromSignedInUser: row.userId !== null,
    ageHours: Math.round((Date.now() - new Date(row.createdAt).getTime()) / 36e5),
  };
}

export async function GET(request: Request) {
  try {
    if (!tokenAccepted(request.headers.get("authorization"))) {
      // Deliberately identical whether the token is absent, malformed, wrong,
      // or the server has none configured. Distinguishing them is free
      // reconnaissance.
      return NextResponse.json({ error: "Unauthorized." }, { status: 401, headers: NO_STORE });
    }

    const [summary, newReports, triagedReports, counts, signals, tasks, analytics] =
      await Promise.all([
        getTodoSummary(),
        listFeedback("new", 50),
        listFeedback("triaged", 50),
        getFeedbackCounts(),
        getBuildQueue(),
        listTasks(false),
        // Belt and braces: getWebAnalytics() is written not to throw, but it
        // is the only call in here that leaves the building, and a rejected
        // promise in this Promise.all would 500 the whole queue.
        getWebAnalytics().catch(() => ({ data: null, error: "network_error" as const })),
      ]);

    // Traffic is a nice-to-have on a queue endpoint, so a failure to read it
    // is worth a warning row but must never take the report down with it. A
    // missing token isn't a fault - that's just the feature switched off.
    if (analytics.error && analytics.error !== "not_configured") {
      await recordError({
        source: "api/admin/report",
        error: new Error(`web analytics unavailable: ${analytics.error}`),
        level: "warning",
        path: "/api/admin/report",
      });
    }

    return NextResponse.json(
      {
        generatedAt: new Date().toISOString(),
        summary,
        // Ordered the way the report should be written: what real people said
        // outranks every derived metric underneath it.
        fromTheSite: {
          counts,
          new: newReports.map(scrub),
          triaged: triagedReports.map(scrub),
        },
        buildQueue: signals,
        openTasks: tasks,
        // null means "we couldn't ask" - not "nobody visited". See
        // src/lib/vercelAnalytics.ts; this is never zero-filled.
        analytics: analytics.data,
        // Why `analytics` is null, when it is. Without this the two very
        // different causes - the token isn't set, versus the token is set and
        // the query is being rejected - are indistinguishable from outside,
        // and the feed can sit silently broken for days looking identical to
        // switched off. Null here means the read succeeded.
        //
        // This is the failure *category* only, never the token and never any
        // part of its value. The categories are the ones declared by
        // AnalyticsError in src/lib/vercelAnalytics.ts.
        analyticsError: analytics.error,
      },
      { headers: NO_STORE },
    );
  } catch (error) {
    await recordError({ source: "api/admin/report", error, path: "/api/admin/report" });
    return NextResponse.json({ error: "Something went wrong." }, { status: 500, headers: NO_STORE });
  }
}
