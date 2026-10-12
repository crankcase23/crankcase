import { NextResponse } from "next/server";
import { requireUserId } from "@/lib/apiAuth";
import { checkoutEligibilityForOwnVehicle } from "@/lib/keysEntitlements";
import { withGarageId } from "@/lib/garageRoute";

// May this account be sent to payment for one of its OWN vehicles? Read-only; nothing is granted or charged here and the browser
// sends no price or VIN. An already-unlocked VIN (gift, earlier payment, or a legacy unlock) and a vehicle with no valid VIN are
// refused with a reason. There is no checkout yet: whatever builds one must call this first (and settleCapturedPayment after).
export const GET = withGarageId(async (_request: Request, { params }: { params: Promise<{ id: string }> }) => {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  const { id } = await params;
  const result = await checkoutEligibilityForOwnVehicle(userId, id);
  if (!result.eligible && result.reason === "not-in-garage") {
    return NextResponse.json({ error: "Vehicle not found in your garage.", code: "NOT_IN_GARAGE" }, { status: 404 });
  }
  return NextResponse.json(result.eligible ? { eligible: true, priceCents: result.priceCents, rung: result.rung } : { eligible: false, reason: result.reason, message: result.message });
});
