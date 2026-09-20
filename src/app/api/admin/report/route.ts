import { NextResponse } from "next/server";
import { createHash, timingSafeEqual } from "node:crypto";
import {
  listFeedback,
  getFeedbackCounts,
  listTasks,
  getBuildQueue,
  getTodoSummary,
  type FeedbackRow,
} from "@/lib/admin/todo";
import { recordError } from "@/lib/errors";

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
 * Both sides are hashed first so the comparison is over two fixed-length
 * buffers - a raw timingSafeEqual on the tokens themselves throws on a length
 * mismatch, and guarding that with an early length check leaks the token's
 * length to anyone willing to time the 401s.
 */
function tokenAccepted(header: string | null): boolean {
  const expected = process.env.ADMIN_REPORT_TOKEN;

  // Fail closed. An unset or trivially short token means the endpoint is
  // closed, never open - a misconfiguration must not publish the inbox.
  if (!expected || expected.length < 24) return false;
  if (!header || !header.startsWith("Bearer ")) return false;

  const digest = (value: string) => createHash("sha256").update(value, "utf8").digest();
  return timingSafeEqual(digest(header.slice(7)), digest(expected));
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

    const [summary, newReports, triagedReports, counts, signals, tasks] = await Promise.all([
      getTodoSummary(),
      listFeedback("new", 50),
      listFeedback("triaged", 50),
      getFeedbackCounts(),
      getBuildQueue(),
      listTasks(false),
    ]);

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
      },
      { headers: NO_STORE },
    );
  } catch (error) {
    await recordError({ source: "api/admin/report", error, path: "/api/admin/report" });
    return NextResponse.json({ error: "Something went wrong." }, { status: 500, headers: NO_STORE });
  }
}
