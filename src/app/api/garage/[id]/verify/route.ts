import { NextResponse } from "next/server";
import { withGarageId } from "@/lib/garageRoute";
import { requireUserId } from "@/lib/apiAuth";
import { guardVinAttempt } from "@/lib/vinGuard";
import { fallbackEnabled } from "@/lib/vinFallback";
import { verifyOwnEntry } from "@/lib/vinFallbackServer";

// Re-check one of THIS customer's UNVERIFIED vehicles against NHTSA. The server asks NHTSA itself; nothing the browser
// says about the decode is used. A match marks the vehicle verified with NHTSA's values; anything else changes nothing.
export const POST = withGarageId(async (request: Request, { params }: { params: Promise<{ id: string }> }) => {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  if (!fallbackEnabled()) return NextResponse.json({ code: "FALLBACK_DISABLED", error: "Not available." }, { status: 404 });

  const limited = await guardVinAttempt(request, userId);
  if (limited) return limited;

  const { id } = await params;
  const r = await verifyOwnEntry(userId, id);
  switch (r.status) {
    case "verified":
      return NextResponse.json({ entry: r.entry, verified: true });
    case "mismatch":
      return NextResponse.json(
        { code: "DETAILS_MISMATCH", nhtsaReads: r.nhtsaReads, error: `NHTSA reads this VIN as ${r.nhtsaReads}, which doesn't match the details you entered. Nothing was changed. You can correct the details and check again.` },
        { status: 409 },
      );
    case "not-decodable":
      return NextResponse.json({ code: "VIN_NOT_DECODABLE", error: "NHTSA doesn't recognize this VIN right now. Nothing was changed." }, { status: 422 });
    case "outage":
      return NextResponse.json({ code: "DECODER_UNAVAILABLE", error: "The NHTSA decoder still isn't reachable. Try again later. Nothing was changed." }, { status: 503 });
    case "not-found":
      return NextResponse.json({ error: "Vehicle not found in your garage." }, { status: 404 });
    default:
      return NextResponse.json({ code: "NOT_UNVERIFIED", error: "This vehicle doesn't need checking." }, { status: 409 });
  }
});
