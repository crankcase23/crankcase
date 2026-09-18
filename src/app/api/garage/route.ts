import { NextResponse } from "next/server";
import { requireUserId } from "@/lib/apiAuth";
import { listGarageEntries, addCatalogEntry, addCustomEntry } from "@/lib/garageEntries";
import { recordEvent, EVENT_TYPES } from "@/lib/events";

export async function GET() {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const entries = await listGarageEntries(userId);
  return NextResponse.json({ entries });
}

export async function POST(request: Request) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const body = await request.json().catch(() => null);

  if (body?.kind === "catalog" && typeof body.vehicleId === "string" && body.vehicleId) {
    const entry = await addCatalogEntry(userId, body.vehicleId);
    await recordEvent({
      type: EVENT_TYPES.VEHICLE_ADDED,
      userId,
      objectType: "garage_entry",
      objectId: entry.id,
      metadata: { kind: "catalog", vehicleId: body.vehicleId },
    });
    return NextResponse.json({ entry });
  }

  if (body?.kind === "custom" && body.custom && typeof body.custom === "object") {
    const c = body.custom as Record<string, unknown>;
    const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : undefined);
    const entry = await addCustomEntry(userId, {
      vin: str(c.vin),
      year: str(c.year),
      make: str(c.make),
      model: str(c.model),
      trim: str(c.trim),
      engine: str(c.engine),
    });
    await recordEvent({
      type: EVENT_TYPES.VEHICLE_ADDED,
      userId,
      objectType: "garage_entry",
      objectId: entry.id,
      metadata: { kind: "custom", year: str(c.year), make: str(c.make), model: str(c.model) },
    });
    return NextResponse.json({ entry });
  }

  return NextResponse.json({ error: "Invalid garage entry payload." }, { status: 400 });
}
