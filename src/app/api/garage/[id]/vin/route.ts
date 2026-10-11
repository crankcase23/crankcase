import { NextResponse } from "next/server";
import { requireUserId } from "@/lib/apiAuth";
import { completeGarageVin, isBlocked } from "@/lib/garageEntries";
import { validateVin } from "@/lib/vin";
import { blockedResponse, vinProblem } from "@/lib/garageResponses";

// VIN completion for an older garage record that has no (valid) VIN. It only ever attaches a VIN to THIS customer's own
// row. A VIN typed or scanned here is never proof of ownership: if the VIN is not available to this account the answer
// is the same generic claim-required response as on add, and nothing is shared or granted.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const body = await request.json().catch(() => null);
  const check = validateVin(body?.vin);
  if (!check.ok) return vinProblem(check);

  const { id } = await params;
  const result = await completeGarageVin(userId, id, check.vin);
  if (!result) return NextResponse.json({ error: "Vehicle not found in your garage." }, { status: 404 });
  if (isBlocked(result)) return blockedResponse(result);
  return NextResponse.json({ entry: result.entry });
}
