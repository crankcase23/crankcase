import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { and, eq, gte, count } from "drizzle-orm";
import { db } from "@/db";
import { feedback } from "@/db/schema";
import { requireUserId } from "@/lib/apiAuth";
import { recordError } from "@/lib/errors";

// User-facing feedback submission, backing FeedbackWidget.
//
// Guarded, because this is the one endpoint on the site that lets a visitor
// write a row:
//   * requires a signed-in session -- no anonymous writes;
//   * caps the message length server-side, not just in the textarea;
//   * only accepts the four known kinds;
//   * rate-limits to 5 submissions per account per hour, counted in the
//     database rather than in memory (this runs serverless, so an in-process
//     counter would reset constantly and enforce nothing).
//
// Everything else -- who reported it, which page, which guide -- is derived
// server-side or from the posted context, never trusted for authorization.

const KINDS = new Set(["bug", "data", "idea", "other"]);
const MAX_PER_HOUR = 5;

export async function POST(request: Request) {
  try {
    const userId = await requireUserId();
    if (!userId) {
      return NextResponse.json({ error: "Please sign in to send feedback." }, { status: 401 });
    }

    const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
    const message = typeof body?.message === "string" ? body.message.trim() : "";

    if (message.length < 5) {
      return NextResponse.json({ error: "Tell us a little more." }, { status: 400 });
    }

    const rawKind = typeof body?.kind === "string" ? body.kind : "other";
    const kind = KINDS.has(rawKind) ? rawKind : "other";

    const str = (v: unknown, max: number) =>
      typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null;

    // Rate limit: count this account's submissions in the last hour.
    const since = new Date(Date.now() - 60 * 60 * 1000);
    const recent = await db
      .select({ n: count() })
      .from(feedback)
      .where(and(eq(feedback.userId, userId), gte(feedback.createdAt, since)));

    if ((recent[0]?.n ?? 0) >= MAX_PER_HOUR) {
      return NextResponse.json(
        { error: "That's a lot of reports in one hour — give it a bit and try again." },
        { status: 429 }
      );
    }

    await db.insert(feedback).values({
      id: randomUUID(),
      userId,
      kind,
      message: message.slice(0, 2000),
      path: str(body?.path, 300),
      vehicleId: str(body?.vehicleId, 120),
      guideId: str(body?.guideId, 120),
      status: "new",
      userAgent: request.headers.get("user-agent")?.slice(0, 300) ?? null,
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    await recordError({ source: "api/feedback", error, path: "/api/feedback" });
    return NextResponse.json({ error: "Could not send that right now." }, { status: 500 });
  }
}
