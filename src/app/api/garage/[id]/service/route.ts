import { NextResponse } from "next/server";
import { requireUserId } from "@/lib/apiAuth";
import { resolveGarageEntryId } from "@/lib/garageEntries";
import { listServiceEntries, addServiceEntry } from "@/lib/serviceEntriesDb";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const { id } = await params;
  const garageEntryId = await resolveGarageEntryId(userId, id, { create: false });
  if (!garageEntryId) return NextResponse.json({ entries: [] });

  const entries = await listServiceEntries(garageEntryId);
  return NextResponse.json({ entries });
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
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

  const garageEntryId = await resolveGarageEntryId(userId, id, { create: true });
  const entry = await addServiceEntry(userId, garageEntryId!, { date, mileage, title, guideId, notes });
  return NextResponse.json({ entry });
}
