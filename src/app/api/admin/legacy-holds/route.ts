import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { legacyUnlockHolds } from "@/db/schema";
import { LegacyHoldError, resolveLegacyHold, waiveLegacyHold } from "@/lib/keysEntitlements";
import { requireAdmin } from "@/lib/admin/rbac";
import { recordAudit } from "@/lib/admin/audit";
import { recordError } from "@/lib/errors";

// Admin completes (or, with a written reason, waives) a customer's legacy unlock hold. Plain HTML form post from the Garage tab
// of /admin/users/[id], like /api/admin/unlocks: it redirects back to that page. Converting restores access with the ORIGINAL source
// and grant time; waiving keeps the hold row as the permanent record. Every action is written to the audit log (last six VIN
// characters only). Permission: unlocks.manage.
export async function POST(request: Request) {
  try {
    const ctx = await requireAdmin("unlocks.manage");
    if (!ctx) return NextResponse.json({ error: "Not authorized." }, { status: 403 });

    const form = await request.formData();
    const userId = String(form.get("userId") ?? "");
    const holdId = String(form.get("holdId") ?? "");
    const action = String(form.get("action") ?? "");
    const reason = String(form.get("reason") ?? "").trim().slice(0, 500);
    const vin = String(form.get("vin") ?? "").trim();
    if (!userId || !holdId) return NextResponse.json({ error: "Missing fields." }, { status: 400 });
    if (action !== "convert" && action !== "waive") return NextResponse.json({ error: "Unknown action." }, { status: 400 });

    // The hold must belong to the named account before anything is written.
    const [hold] = await db.select().from(legacyUnlockHolds).where(eq(legacyUnlockHolds.id, holdId)).limit(1);
    if (!hold || hold.userId !== userId) return NextResponse.json({ error: "Hold not found for that account." }, { status: 404 });

    const actor = { type: "admin" as const, id: ctx.userId };
    let summary: string;
    let usedVin: string | null = null;
    try {
      if (action === "convert") {
        const r = await resolveLegacyHold({ holdId, userId, vin: vin || null, actor, note: reason || null });
        usedVin = r.hold.resolvedVin;
        summary = r.created ? `Restored legacy ${hold.source} unlock` : `Closed legacy ${hold.source} hold (account already held the VIN)`;
      } else {
        await waiveLegacyHold({ holdId, userId, actor, note: reason });
        summary = `Waived legacy ${hold.source} hold`;
      }
    } catch (e) {
      if (e instanceof LegacyHoldError || (e instanceof Error && e.message.startsWith("waiveLegacyHold"))) {
        return NextResponse.json({ error: e.message, code: e instanceof LegacyHoldError ? e.code : "REASON_REQUIRED" }, { status: 400 });
      }
      throw e;
    }

    await recordAudit({
      ctx,
      action: action === "convert" ? "legacy_hold.convert" : "legacy_hold.waive",
      objectType: "legacy_unlock_hold",
      objectId: holdId,
      summary,
      metadata: { userId, source: hold.source, originalGrantedAt: hold.grantedAt, vinLast6: usedVin ? usedVin.slice(-6) : null, reason: reason || null },
      request,
    });

    const url = new URL(`/admin/users/${userId}`, request.url);
    url.searchParams.set("tab", "garage");
    return NextResponse.redirect(url, 303);
  } catch (error) {
    await recordError({ source: "api/admin/legacy-holds", error, path: "/api/admin/legacy-holds" });
    return NextResponse.json({ error: "Something went wrong." }, { status: 500 });
  }
}
