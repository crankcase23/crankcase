import { NextResponse } from "next/server";
import { withGarageId } from "@/lib/garageRoute";
import { requireUserId } from "@/lib/apiAuth";
import { completeGarageVin, isBlocked } from "@/lib/garageEntries";
import { validateVin } from "@/lib/vin";
import { blockedResponse, vinProblem } from "@/lib/garageResponses";
import { guardVinAttempt } from "@/lib/vinGuard";
import { reconcileHoldsForVehicle } from "@/lib/keysEntitlements";

// VIN completion for an older garage record that has no (valid) VIN. It only ever attaches a VIN to THIS customer's own
// row. A VIN typed or scanned here is a private record for this account, never proof of ownership and never visible to
// any other account. Whether another account holds the same VIN is irrelevant to the answer (one VIN per account).
export const POST = withGarageId(async (request: Request, { params }: { params: Promise<{ id: string }> }) => {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const body = await request.json().catch(() => null);
  const check = validateVin(body?.vin);
  if (!check.ok) return vinProblem(check);

  const limited = await guardVinAttempt(request, userId);
  if (limited) return limited;

  const { id } = await params;
  const result = await completeGarageVin(userId, id, check.vin);
  if (!result) return NextResponse.json({ error: "Vehicle not found in your garage." }, { status: 404 });
  if (isBlocked(result)) {
    return blockedResponse(result);
  }
  // A legacy unlock (an older admin gift) that was waiting for this car's VIN comes back now. A paid one tied only to the car is
  // left for support to confirm; the customer is told in either case. This never changes the outcome of the VIN itself.
  let legacyUnlock: { restored: number; needsReview: number } | undefined;
  try {
    const r = await reconcileHoldsForVehicle(userId, id, check.vin);
    if (r.restored || r.needsReview) legacyUnlock = r;
  } catch (e) {
    console.error("legacy unlock reconciliation failed; the VIN was saved", e);
  }
  return NextResponse.json(legacyUnlock ? { entry: result.entry, legacyUnlock } : { entry: result.entry });
});
