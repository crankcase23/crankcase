import { NextResponse } from "next/server";
import { requireUserId } from "@/lib/apiAuth";
import { lookupVehicleData } from "@/lib/vehicleDataCache";

// Auth-gated on purpose, not just for privacy: a hit here can spend one of
// the shared 10/day Open Labor Project requests (see vehicleDataCache.ts),
// so this isn't something we want anonymous traffic able to trigger.
export async function POST(request: Request) {
    const userId = await requireUserId();
    if (!userId) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object") {
          return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
    }

  const record = body as Record<string, unknown>;
    const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : undefined);

  const result = await lookupVehicleData({
        make: str(record.make),
        model: str(record.model),
        year: str(record.year),
        engine: str(record.engine),
  });

  return NextResponse.json(result);
}
