import { NextResponse } from "next/server";
import { requireUserId } from "@/lib/apiAuth";
import { recordEvent, EVENT_TYPES } from "@/lib/events";

// View-tracking endpoint for ViewTracker.tsx.
//
// Constrained on purpose:
//   * requires a signed-in session, so it can't be used as an open write
//     endpoint by anyone who finds the URL;
//   * accepts only the two view event types, not arbitrary event names;
//   * bounds every string it stores.
//
// Always returns 204 with no body -- there's nothing for the client to do with
// a result, and an error response would only invite retry loops on a page the
// user is trying to read.
const ALLOWED = new Set<string>([EVENT_TYPES.GUIDE_VIEWED, EVENT_TYPES.VEHICLE_VIEWED]);

export async function POST(request: Request) {
  try {
    const userId = await requireUserId();
    if (!userId) return new NextResponse(null, { status: 204 });

    const body = (await request.json().catch(() => null)) as {
      type?: unknown;
      objectId?: unknown;
      objectType?: unknown;
      path?: unknown;
    } | null;

    const type = typeof body?.type === "string" ? body.type : "";
    if (!ALLOWED.has(type)) return new NextResponse(null, { status: 204 });

    const objectId = typeof body?.objectId === "string" ? body.objectId.slice(0, 200) : undefined;
    const objectType = typeof body?.objectType === "string" ? body.objectType.slice(0, 50) : undefined;
    const path = typeof body?.path === "string" ? body.path.slice(0, 300) : undefined;
    if (!objectId) return new NextResponse(null, { status: 204 });

    await recordEvent({
      type: type as typeof EVENT_TYPES.GUIDE_VIEWED,
      userId,
      objectId,
      objectType,
      path,
    });
  } catch {
    // Swallow everything: a failed analytics write must never affect the page.
  }
  return new NextResponse(null, { status: 204 });
}
