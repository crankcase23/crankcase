import { NextResponse } from "next/server";
import { requireUserId } from "@/lib/apiAuth";
import { resolveGarageEntryId } from "@/lib/garageEntries";
import { getOdometer, setOdometer } from "@/lib/odometerDb";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const { id } = await params;
  const garageEntryId = await resolveGarageEntryId(userId, id, { create: false });
  if (!garageEntryId) return NextResponse.json({ odometer: null });

  const odometer = await getOdometer(garageEntryId);
  return NextResponse.json({ odometer });
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const { id } = await params;
  const body = await request.json().catch(() => null);
  const value = body?.value === null ? null : Number(body?.value);
  if (value !== null && !Number.isFinite(value)) {
    return NextResponse.json({ error: "value must be a number or null." }, { status: 400 });
  }

  const garageEntryId = await resolveGarageEntryId(userId, id, { create: true });
  await setOdometer(userId, garageEntryId!, value);
  return NextResponse.json({ odometer: value });
}
