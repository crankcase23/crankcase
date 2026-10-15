import { NextResponse } from "next/server";
import { withGarageId } from "@/lib/garageRoute";
import { requireUserId } from "@/lib/apiAuth";
import { resolveGarageEntryId } from "@/lib/garageEntries";
import { listServiceEntries, addServiceEntry } from "@/lib/serviceEntriesDb";
import { recordEvent, EVENT_TYPES } from "@/lib/events";
import { validateServiceEntry } from "@/lib/serviceValidation";

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
  // One shared validator (also run in the form). Bad input is a controlled 400 with a message, never a database error.
  const parsed = validateServiceEntry(body);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error, field: parsed.field }, { status: 400 });
  const { date, mileage, title, guideId, notes } = parsed.value;

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
