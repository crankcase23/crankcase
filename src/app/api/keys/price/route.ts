import { NextResponse } from "next/server";
import { requireUserId } from "@/lib/apiAuth";
import { nextUnlockPrice } from "@/lib/keysEntitlements";
import { KEYS_LADDER } from "@/lib/keysPricing";

// What the signed-in customer's NEXT unlock costs, computed on the server from their own purchases. Read-only: there is
// no way to set or suggest a price here, and no checkout (payments are not built).
export async function GET() {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  const next = await nextUnlockPrice(userId);
  return NextResponse.json({ ...next, ladderCents: KEYS_LADDER.map((d) => d * 100), currency: "usd" });
}
