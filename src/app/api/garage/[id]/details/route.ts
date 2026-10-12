import { NextResponse } from "next/server";
import { requireUserId } from "@/lib/apiAuth";
import { fallbackEnabled, parseFallbackDetails } from "@/lib/vinFallback";
import { updateUnverifiedDetails } from "@/lib/vinFallbackServer";

// Correct the typed details of an UNVERIFIED vehicle (year, make, model, trim, engine). The VIN is never editable, and a
// verified vehicle or an older record is never touched by this route.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  if (!fallbackEnabled()) return NextResponse.json({ code: "FALLBACK_DISABLED", error: "Not available." }, { status: 404 });

  const body = await request.json().catch(() => null);
  const typed = parseFallbackDetails(body);
  if (!typed.ok) return NextResponse.json({ code: "DETAILS_INVALID", error: typed.error }, { status: 400 });

  const { id } = await params;
  const r = await updateUnverifiedDetails(userId, id, typed.value);
  if (r === null) return NextResponse.json({ error: "Vehicle not found in your garage." }, { status: 404 });
  if (r === "not-applicable") return NextResponse.json({ code: "NOT_UNVERIFIED", error: "Only unverified vehicles can be edited this way." }, { status: 409 });
  return NextResponse.json({ entry: r });
}
