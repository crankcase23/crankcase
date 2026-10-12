import { NextResponse } from "next/server";
import { withGarageId } from "@/lib/garageRoute";
import { requireUserId } from "@/lib/apiAuth";
import { completeGarageVin, isBlocked } from "@/lib/garageEntries";
import { validateVin } from "@/lib/vin";
import { blockedResponse, vinProblem } from "@/lib/garageResponses";
import { guardVinAttempt } from "@/lib/vinGuard";

// VIN completion for an older garage record that has no (valid) VIN. It only ever attaches a VIN to THIS customer's own
// row. A VIN typed or scanned here is a private record for this account, never proof of ownership and never visible to
// any other account; whether other accounts hold the same VIN has no effect on the answer.
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
  return NextResponse.json({ entry: result.entry });
});
