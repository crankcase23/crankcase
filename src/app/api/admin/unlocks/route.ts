import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { requireAdminUserId } from "@/lib/adminAuth";
import { db } from "@/db";
import { vehicleUnlocks } from "@/db/schema";

// Handles the grant/revoke forms on /admin/users/[id] -- plain HTML form
// posts (no JS), so this redirects back to that page when done rather than
// returning JSON like the other /api routes.
export async function POST(request: Request) {
  const adminUserId = await requireAdminUserId();
  if (!adminUserId) return NextResponse.json({ error: "Not authorized." }, { status: 403 });

  const formData = await request.formData();
  const userId = String(formData.get("userId") ?? "");
  const garageEntryId = String(formData.get("garageEntryId") ?? "");
  const action = String(formData.get("action") ?? "");
  if (!userId || !garageEntryId) return NextResponse.json({ error: "Missing fields." }, { status: 400 });

  if (action === "grant") {
    await db.insert(vehicleUnlocks).values({ userId, garageEntryId, source: "gift" }).onConflictDoNothing();
    } else if (action === "revoke") {
    await db
    .delete(vehicleUnlocks)
    .where(and(eq(vehicleUnlocks.userId, userId), eq(vehicleUnlocks.garageEntryId, garageEntryId)));
    }

  return NextResponse.redirect(new URL("/admin/users/" + userId, request.url), 303);
  }
