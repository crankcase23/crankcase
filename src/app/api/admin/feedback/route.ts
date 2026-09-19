import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { feedback } from "@/db/schema";
import { requireAdmin } from "@/lib/admin/rbac";
import { recordAudit } from "@/lib/admin/audit";
import { recordError } from "@/lib/errors";
import { FEEDBACK_STATUSES } from "@/lib/admin/todo";

// Triage a user report: new -> triaged -> resolved / wontfix.
//
// Unlike the task routes, this IS audited. A user reported that a torque spec
// looks wrong and somebody marked it "won't fix" -- that is exactly the kind
// of decision you want a record of, on a site where a wrong number can hurt
// someone. Reports are never deleted, only re-statused.

export async function POST(request: Request) {
  try {
    const ctx = await requireAdmin("todo.manage");
    if (!ctx) return NextResponse.json({ error: "Not authorized." }, { status: 403 });

    const formData = await request.formData();
    const id = String(formData.get("id") ?? "");
    const status = String(formData.get("status") ?? "");
    const note = String(formData.get("adminNote") ?? "").trim();

    if (!id || !(FEEDBACK_STATUSES as readonly string[]).includes(status)) {
      return NextResponse.json({ error: "Missing or invalid fields." }, { status: 400 });
    }

    const rows = await db
      .select({ id: feedback.id, kind: feedback.kind, message: feedback.message, status: feedback.status })
      .from(feedback)
      .where(eq(feedback.id, id))
      .limit(1);

    const report = rows[0];
    if (!report) return NextResponse.json({ error: "No such report." }, { status: 404 });

    const resolving = status === "resolved" || status === "wontfix";
    await db
      .update(feedback)
      .set({
        status,
        adminNote: note ? note.slice(0, 1000) : undefined,
        resolvedAt: resolving ? new Date() : null,
        resolvedBy: resolving ? ctx.userId : null,
      })
      .where(eq(feedback.id, id));

    await recordAudit({
      ctx,
      action: "error.resolve",
      objectType: "feedback",
      objectId: id,
      summary: `Marked user report "${report.message.slice(0, 60)}" as ${status}`,
      metadata: { kind: report.kind, from: report.status, to: status, note: note || null },
      request,
    });

    const url = new URL("/admin/todo", request.url);
    url.searchParams.set("ok", `Report marked ${status}.`);
    url.hash = "inbox";
    return NextResponse.redirect(url, 303);
  } catch (error) {
    await recordError({ source: "api/admin/feedback", error, path: "/api/admin/feedback" });
    return NextResponse.json({ error: "Something went wrong." }, { status: 500 });
  }
}
