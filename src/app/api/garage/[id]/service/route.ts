import { NextResponse } from "next/server";
import { withGarageId } from "@/lib/garageRoute";
import { requireUserId } from "@/lib/apiAuth";
import { resolveGarageEntryId } from "@/lib/garageEntries";
import { listServiceEntries, addServiceEntry } from "@/lib/serviceEntriesDb";
import { recordEvent, EVENT_TYPES } from "@/lib/events";

export const GET = withGarageId(async (_request: Request, { params }: { params: Promise<{ id: string }> }) => {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const { id } = await params;
  const garageEntryId = await resolveGarageEntryId(userId, id);
  if (!garageEntryId) return NextResponse.json({ entries: [] });

  const entries = await listServiceEntries(garageEntryId);
  return NextResponse.json({ entries });
});

export const POST = withGarageId(async (request: Request, { params }: { params: Promise<{ id: string }> }) => {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const { id } = await params;
  const body = await request.json().catch(() => null);
  const date = typeof body?.date === "string" ? body.date : "";
  const mileage = Number(body?.mileage);
  const title = typeof body?.title === "string" ? body.title.trim() : "";
  const guideId = typeof body?.guideId === "string" ? body.guideId : undefined;
  const notes = typeof body?.notes === "string" && body.notes.trim() ? body.notes.trim() : undefined;

  if (!date || !title || !Number.isFinite(mileage)) {
    return NextResponse.json({ error: "date, mileage, and title are required." }, { status: 400 });
  }

  const garageEntryId = await resolveGarageEntryId(userId, id);
  if (!garageEntryId) return NextResponse.json({ error: "Add this vehicle to your garage first. A VIN is required to add a vehicle." , code: "NOT_IN_GARAGE" }, { status: 404 });
  const entry = await addServiceEntry(userId, garageEntryId, { date, mileage, title, guideId, notes });
  await recordEvent({
    type: EVENT_TYPES.SERVICE_LOGGED,
    userId,
    objectType: "garage_entry",
    objectId: garageEntryId,
    metadata: { title, mileage, guideId },
  });
  return NextResponse.json({ entry });
});
