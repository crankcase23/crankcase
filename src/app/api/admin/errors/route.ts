import { NextResponse } from "next/server";
import { eq, and } from "drizzle-orm";
import { db } from "@/db";
import { errorEvents } from "@/db/schema";
import { requireAdmin } from "@/lib/admin/rbac";
import { recordAudit } from "@/lib/admin/audit";
import { recordError } from "@/lib/errors";

// Resolve or ignore captured errors. Errors are never deleted -- resolving
// changes status so the row stays available for trend analysis.
export async function POST(request: Request) {
  try {
    const ctx = await requireAdmin("system.manage");
    if (!ctx) return NextResponse.json({ error: "Not authorized." }, { status: 403 });

    const formData = await request.formData();
    const action = String(formData.get("action") ?? "");
    const id = String(formData.get("id") ?? "");
    const fingerprint = String(formData.get("fingerprint") ?? "");

    if (action === "resolve" && id) {
      const rows = await db
        .select({ message: errorEvents.message, source: errorEvents.source })
        .from(errorEvents)
        .where(eq(errorEvents.id, id))
        .limit(1);
      if (!rows[0]) return NextResponse.json({ error: "No such error." }, { status: 404 });

      await db
        .update(errorEvents)
        .set({ status: "resolved", resolvedAt: new Date(), resolvedBy: ctx.userId })
        .where(eq(errorEvents.id, id));

      await recordAudit({
        ctx,
        action: "error.resolve",
        objectType: "error",
        objectId: id,
        summary: `Resolved error from ${rows[0].source}`,
        metadata: { message: rows[0].message, source: rows[0].source },
        request,
      });

      const url = new URL("/admin/system", request.url);
      url.searchParams.set("ok", "Error resolved.");
      return NextResponse.redirect(url, 303);
    }

    if (action === "ignoreGroup" && fingerprint) {
      // Ignoring applies to the whole group -- a recurring bug you've decided
      // not to chase shouldn't need dismissing five hundred times.
      const updated = await db
        .update(errorEvents)
        .set({ status: "ignored", resolvedAt: new Date(), resolvedBy: ctx.userId })
        .where(and(eq(errorEvents.fingerprint, fingerprint), eq(errorEvents.status, "open")))
        .returning({ id: errorEvents.id });

      await recordAudit({
        ctx,
        action: "error.ignore",
        objectType: "error_group",
        objectId: fingerprint,
        summary: `Ignored ${updated.length} error(s) in group ${fingerprint}`,
        metadata: { fingerprint, count: updated.length },
        request,
      });

      const url = new URL("/admin/system", request.url);
      url.searchParams.set("ok", `Ignored ${updated.length} matching error(s).`);
      return NextResponse.redirect(url, 303);
    }

    return NextResponse.json({ error: "Unknown action." }, { status: 400 });
  } catch (error) {
    await recordError({ source: "api/admin/errors", error, path: "/api/admin/errors" });
    return NextResponse.json({ error: "Something went wrong." }, { status: 500 });
  }
}
