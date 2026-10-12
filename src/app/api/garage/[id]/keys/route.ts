import { NextResponse } from "next/server";
import { requireUserId } from "@/lib/apiAuth";
import { keysStatusForOwnVehicle } from "@/lib/keysEntitlements";
import { withGarageId } from "@/lib/garageRoute";

// Keys state of one of the caller's OWN vehicles. Read-only (no grant route exists). A vehicle that is not in the caller's
// garage, including another account's, gets the same 404 as one that does not exist.
export const GET = withGarageId(async (_request: Request, { params }: { params: Promise<{ id: string }> }) => {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  const { id } = await params;
  const status = await keysStatusForOwnVehicle(userId, id);
  if (!status) return NextResponse.json({ error: "Vehicle not found in your garage.", code: "NOT_IN_GARAGE" }, { status: 404 });
  return NextResponse.json(status);
});
