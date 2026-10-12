import { NextResponse } from "next/server";
import { withGarageId } from "@/lib/garageRoute";
import { requireUserId } from "@/lib/apiAuth";
import { removeGarageEntry, updateGarageConfig } from "@/lib/garageEntries";
import { catalogIdOf } from "@/lib/garageId";
import { findVehicle } from "@/lib/data";
import { parsePartialConfig } from "@/lib/vehicleConfig";

export const DELETE = withGarageId(async (_request: Request, { params }: { params: Promise<{ id: string }> }) => {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const { id } = await params;
  await removeGarageEntry(userId, id);
  return NextResponse.json({ ok: true });
});

// Edit Configuration: the one explicit way a saved transmission/drivetrain changes. Only the axes sent are touched;
// the vehicle, its VIN, its service history and its odometer are not.
export const PATCH = withGarageId(async (request: Request, { params }: { params: Promise<{ id: string }> }) => {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const { id } = await params;
  const body = await request.json().catch(() => null);
  const cfg = parsePartialConfig(body, findVehicle(catalogIdOf(id)));
  if (!cfg.ok) return NextResponse.json({ error: cfg.error }, { status: 400 });

  const entry = await updateGarageConfig(userId, id, cfg.value);
  if (!entry) return NextResponse.json({ error: "Vehicle not found in your garage." }, { status: 404 });
  return NextResponse.json({ entry });
});
