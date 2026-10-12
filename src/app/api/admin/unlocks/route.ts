import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { garageEntries, users } from "@/db/schema";
import { giftEntitlement, revokeEntitlement } from "@/lib/keysEntitlements";
import { canonicalVin, isValidVin } from "@/lib/vin";
import { requireAdmin } from "@/lib/admin/rbac";
import { recordAudit } from "@/lib/admin/audit";
import { recordError } from "@/lib/errors";

// Handles the grant/revoke forms on /admin/users/[id] -- plain HTML form
// posts (no JS), so this redirects back to that page when done rather than
// returning JSON like the other /api routes.
//
// Unlocks are permanent and tied to (account, canonical VIN), the same table paid unlocks use (vin_entitlements), so a gift
// survives the vehicle being removed and re-added, and every grant/revoke is appended to the entitlement history
// (vin_entitlement_events) with this admin as the actor. The garage row only tells us WHICH vehicle's VIN is meant; a
// vehicle with no valid VIN cannot be unlocked. Revoking sets revoked_at; nothing is deleted. The older vehicle_unlocks
// table is no longer written.
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
        vin: garageEntries.vin,
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

    if (action !== "grant" && action !== "revoke") {
      return NextResponse.json({ error: "Unknown action." }, { status: 400 });
    }
    const vin = entry.vin ? canonicalVin(entry.vin) : "";
    if (!vin || !isValidVin(vin)) {
      return NextResponse.json(
        { error: "This vehicle has no valid VIN. Unlocks are tied to the VIN, so the customer needs to add it first." },
        { status: 400 },
      );
    }
    const actor = { type: "admin" as const, id: ctx.userId };
    const reason = String(formData.get("reason") ?? "").trim().slice(0, 500) || null;

    if (action === "grant") {
      const gift = await giftEntitlement({ userId, vin, actor, reason });

      await recordAudit({
        ctx,
        action: "unlock.grant",
        objectType: "garage_entry",
        objectId: garageEntryId,
        summary: gift.created ? `Gifted unlock for ${vehicleLabel} to ${targetEmail}` : `Gift requested for ${vehicleLabel} to ${targetEmail}; already unlocked, no change`,
        metadata: { userId, email: targetEmail, vehicle: vehicleLabel, source: "gift", vinLast6: vin.slice(-6), changed: gift.created },
        request,
      });
    } else {
      const result = await revokeEntitlement({ userId, vin, actor, reason, kind: "revoked" });

      await recordAudit({
        ctx,
        action: "unlock.revoke",
        objectType: "garage_entry",
        objectId: garageEntryId,
        summary: result.revoked ? `Revoked unlock for ${vehicleLabel} from ${targetEmail}` : `Revoke requested for ${vehicleLabel} from ${targetEmail}; nothing was unlocked, no change`,
        metadata: { userId, email: targetEmail, vehicle: vehicleLabel, vinLast6: vin.slice(-6), changed: result.revoked },
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
