import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { vehicleUnlocks, garageEntries, users } from "@/db/schema";
import { requireAdmin } from "@/lib/admin/rbac";
import { recordAudit } from "@/lib/admin/audit";
import { recordError } from "@/lib/errors";

// Handles the grant/revoke forms on /admin/users/[id] -- plain HTML form
// posts (no JS), so this redirects back to that page when done rather than
// returning JSON like the other /api routes.
//
// Changed with the command center: authorization is now the specific
// "unlocks.manage" permission rather than a blanket admin check, the target
// row is verified to belong to the named user before writing, and every
// grant/revoke is written to the audit log.
export async function POST(request: Request) {
  try {
    const ctx = await requireAdmin("unlocks.manage");
    if (!ctx) return NextResponse.json({ error: "Not authorized." }, { status: 403 });

    const formData = await request.formData();
    const userId = String(formData.get("userId") ?? "");
    const garageEntryId = String(formData.get("garageEntryId") ?? "");
    const action = String(formData.get("action") ?? "");
    if (!userId || !garageEntryId) {
      return NextResponse.json({ error: "Missing fields." }, { status: 400 });
    }

    // Verify the garage entry really belongs to this user before writing an
    // unlock row -- otherwise a crafted POST could grant access against
    // someone else's vehicle.
    const entryRows = await db
      .select({
        id: garageEntries.id,
        userId: garageEntries.userId,
        vehicleId: garageEntries.vehicleId,
        year: garageEntries.year,
        make: garageEntries.make,
        model: garageEntries.model,
      })
      .from(garageEntries)
      .where(and(eq(garageEntries.id, garageEntryId), eq(garageEntries.userId, userId)))
      .limit(1);

    const entry = entryRows[0];
    if (!entry) {
      return NextResponse.json({ error: "Vehicle not found for that account." }, { status: 404 });
    }

    const targetRows = await db.select({ email: users.email }).from(users).where(eq(users.id, userId)).limit(1);
    const targetEmail = targetRows[0]?.email ?? userId;
    const vehicleLabel =
      entry.vehicleId ?? [entry.year, entry.make, entry.model].filter(Boolean).join(" ") ?? garageEntryId;

    if (action === "grant") {
      await db
        .insert(vehicleUnlocks)
        .values({ userId, garageEntryId, source: "gift" })
        .onConflictDoNothing();

      await recordAudit({
        ctx,
        action: "unlock.grant",
        objectType: "garage_entry",
        objectId: garageEntryId,
        summary: `Gifted unlock for ${vehicleLabel} to ${targetEmail}`,
        metadata: { userId, email: targetEmail, vehicle: vehicleLabel, source: "gift" },
        request,
      });
    } else if (action === "revoke") {
      await db
        .delete(vehicleUnlocks)
        .where(and(eq(vehicleUnlocks.userId, userId), eq(vehicleUnlocks.garageEntryId, garageEntryId)));

      await recordAudit({
        ctx,
        action: "unlock.revoke",
        objectType: "garage_entry",
        objectId: garageEntryId,
        summary: `Revoked unlock for ${vehicleLabel} from ${targetEmail}`,
        metadata: { userId, email: targetEmail, vehicle: vehicleLabel },
        request,
      });
    }

    const url = new URL(`/admin/users/${userId}`, request.url);
    url.searchParams.set("tab", "garage");
    return NextResponse.redirect(url, 303);
  } catch (error) {
    await recordError({ source: "api/admin/unlocks", error, path: "/api/admin/unlocks" });
    return NextResponse.json({ error: "Something went wrong." }, { status: 500 });
  }
}
