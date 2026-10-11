import { NextResponse } from "next/server";
import { requireUserId } from "@/lib/apiAuth";
import { listGarageEntries, addCatalogEntry, addCustomEntry } from "@/lib/garageEntries";
import { recordEvent, EVENT_TYPES } from "@/lib/events";
import { findVehicle } from "@/lib/data";
import { parseFullConfig } from "@/lib/vehicleConfig";
import { checkVin } from "@/lib/vin";

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
  const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : undefined);

// The customer must have confirmed transmission and drivetrain (or chosen Not sure) before a vehicle is added.
// The Confirm Your Ride screen enforces it in the browser; this enforces it for everything else.
if (body?.kind === "catalog" && typeof body.vehicleId === "string" && body.vehicleId) {
  const vehicle = findVehicle(body.vehicleId);
  if (!vehicle) return NextResponse.json({ error: "Unknown vehicle." }, { status: 400 });
  // A VIN is required for every permanent garage entry. Same message whether the VIN is missing, malformed, or held by
  // someone else: this route never reveals anything about other accounts.
  const v = checkVin(body.vin);
  if (!v.ok) return NextResponse.json({ error: v.error, code: "VIN_REQUIRED" }, { status: 400 });
  const cfg = parseFullConfig(body.config, vehicle);
  if (!cfg.ok) return NextResponse.json({ error: cfg.error, code: "CONFIG_REQUIRED" }, { status: 400 });
  const { entry, created, configKept } = await addCatalogEntry(userId, body.vehicleId, v.vin, cfg.value);
  if (created) {
    await recordEvent({
      type: EVENT_TYPES.VEHICLE_ADDED,
      userId,
      objectType: "garage_entry",
      objectId: entry.id,
      metadata: { kind: "catalog", vehicleId: body.vehicleId },
    });
  }
  return NextResponse.json({ entry, created, configKept });
}

if (body?.kind === "custom" && body.custom && typeof body.custom === "object") {
  const c = body.custom as Record<string, unknown>;
  const v = checkVin(c.vin);
  if (!v.ok) return NextResponse.json({ error: v.error, code: "VIN_REQUIRED" }, { status: 400 });
  const cfg = parseFullConfig(body.config);
  if (!cfg.ok) return NextResponse.json({ error: cfg.error, code: "CONFIG_REQUIRED" }, { status: 400 });
  const { entry, created, configKept } = await addCustomEntry(userId, {
    vin: v.vin,
    year: str(c.year),
    make: str(c.make),
    model: str(c.model),
    trim: str(c.trim),
    engine: str(c.engine),
  }, cfg.value);
  if (created) {
    await recordEvent({
      type: EVENT_TYPES.VEHICLE_ADDED,
      userId,
      objectType: "garage_entry",
      objectId: entry.id,
      metadata: { kind: "custom", year: str(c.year), make: str(c.make), model: str(c.model) },
    });
  }
  return NextResponse.json({ entry, created, configKept });
}

return NextResponse.json({ error: "Invalid garage entry payload." }, { status: 400 });
}
