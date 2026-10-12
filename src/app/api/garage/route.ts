import { NextResponse } from "next/server";
import { requireUserId } from "@/lib/apiAuth";
import { listGarageEntries, addCatalogEntry, addCustomEntry, isBlocked } from "@/lib/garageEntries";
import { validateVin } from "@/lib/vin";
import { blockedResponse, vinProblem } from "@/lib/garageResponses";
import { guardVinAttempt, noteVinCollision } from "@/lib/vinGuard";
import { fallbackEnabled, parseFallbackDetails, FALLBACK_DAILY_CAP } from "@/lib/vinFallback";
import { addViaFallback } from "@/lib/vinFallbackServer";
import { recordEvent, EVENT_TYPES } from "@/lib/events";
import { findVehicle } from "@/lib/data";
import { parseFullConfig } from "@/lib/vehicleConfig";

export async function GET() {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

const entries = await listGarageEntries(userId);
  return NextResponse.json({ entries });
}

export async function POST(request: Request) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

const body = await request.json().catch(() => null);
  const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : undefined);

// The customer must have confirmed transmission and drivetrain (or chosen Not sure) before a vehicle is added.
// The Confirm Your Ride screen enforces it in the browser; this enforces it for everything else.
if (body?.kind === "catalog" && typeof body.vehicleId === "string" && body.vehicleId) {
  const vehicle = findVehicle(body.vehicleId);
  if (!vehicle) return NextResponse.json({ error: "Unknown vehicle." }, { status: 400 });
  // A VIN is required to put a vehicle in a garage, and it must be one that passes the VIN rules. Enforced here so the
  // API cannot be used to skip what the screen asks for.
  const vinCheck = validateVin(body.vin);
  if (!vinCheck.ok) return vinProblem(vinCheck);
  const cfg = parseFullConfig(body.config, vehicle);
  if (!cfg.ok) return NextResponse.json({ error: cfg.error, code: "CONFIG_REQUIRED" }, { status: 400 });
  const limited = await guardVinAttempt(request, userId);
  if (limited) return limited;
  const outcome = await addCatalogEntry(userId, body.vehicleId, vinCheck.vin, cfg.value);
  if (isBlocked(outcome)) {
    if (outcome.blocked === "vin-claim-required") await noteVinCollision(userId);
    return blockedResponse(outcome);
  }
  const { entry, created, configKept } = outcome;
  if (created) {
    await recordEvent({
      type: EVENT_TYPES.VEHICLE_ADDED,
      userId,
      objectType: "garage_entry",
      objectId: entry.id,
      metadata: { kind: "catalog", vehicleId: body.vehicleId },
    });
  }
  return NextResponse.json({ entry, created, configKept });
}

if (body?.kind === "custom" && body.custom && typeof body.custom === "object") {
  const c = body.custom as Record<string, unknown>;
  const vinCheck = validateVin(c.vin);
  if (!vinCheck.ok) return vinProblem(vinCheck);
  const cfg = parseFullConfig(body.config);
  if (!cfg.ok) return NextResponse.json({ error: cfg.error, code: "CONFIG_REQUIRED" }, { status: 400 });
  const limited = await guardVinAttempt(request, userId);
  if (limited) return limited;
  const outcome = await addCustomEntry(userId, {
    vin: vinCheck.vin,
    year: str(c.year),
    make: str(c.make),
    model: str(c.model),
    trim: str(c.trim),
    engine: str(c.engine),
  }, cfg.value);
  if (isBlocked(outcome)) {
    if (outcome.blocked === "vin-claim-required") await noteVinCollision(userId);
    return blockedResponse(outcome);
  }
  const { entry, created, configKept } = outcome;
  if (created) {
    await recordEvent({
      type: EVENT_TYPES.VEHICLE_ADDED,
      userId,
      objectType: "garage_entry",
      objectId: entry.id,
      metadata: { kind: "custom", year: str(c.year), make: str(c.make), model: str(c.model) },
    });
  }
  return NextResponse.json({ entry, created, configKept });
}

// NHTSA-outage fallback (off unless VIN_FALLBACK_ENABLED=true). The VIN rules are identical to every other add; the SERVER
// decides whether NHTSA is really down (src/lib/vinFallbackServer.ts). Never creates a catalog entry.
if (body?.kind === "custom-unverified" && body.custom && typeof body.custom === "object") {
  if (!fallbackEnabled()) return NextResponse.json({ code: "FALLBACK_DISABLED", error: "Not available." }, { status: 404 });
  const c = body.custom as Record<string, unknown>;
  const vinCheck = validateVin(c.vin);
  if (!vinCheck.ok) return vinProblem(vinCheck);
  const typed = parseFallbackDetails(c);
  if (!typed.ok) return NextResponse.json({ code: "DETAILS_INVALID", error: typed.error }, { status: 400 });
  const cfg = parseFullConfig(body.config);
  if (!cfg.ok) return NextResponse.json({ error: cfg.error, code: "CONFIG_REQUIRED" }, { status: 400 });
  const limited = await guardVinAttempt(request, userId);
  if (limited) return limited;
  const outcome = await addViaFallback(userId, vinCheck.vin, typed.value, cfg.value);
  if ("refused" in outcome) {
    if (outcome.refused === "cap") {
      return NextResponse.json(
        { code: "FALLBACK_CAP", error: `You've reached today's limit of ${FALLBACK_DAILY_CAP} vehicles added by hand. Try again later, or use Add by VIN once the decoder is back. Nothing was added.` },
        { status: 429, headers: { "Retry-After": String(outcome.retryAfterSeconds) } },
      );
    }
    if (outcome.refused === "decoder-available") {
      return NextResponse.json(
        { code: "DECODER_AVAILABLE", nhtsaReads: outcome.nhtsaReads, error: `The NHTSA decoder is working, and it reads this VIN as ${outcome.nhtsaReads}, which doesn't match what you entered. Use Add by VIN instead. Nothing was added.` },
        { status: 409 },
      );
    }
    return NextResponse.json(
      { code: "VIN_NOT_DECODABLE", error: "NHTSA doesn't recognize this VIN, so it can't be added right now. Double-check each character or use Take photo to scan it. Nothing was added." },
      { status: 422 },
    );
  }
  if (isBlocked(outcome)) {
    if (outcome.blocked === "vin-claim-required") await noteVinCollision(userId);
    return blockedResponse(outcome);
  }
  const { entry, created, configKept, verified } = outcome;
  if (created) {
    await recordEvent({
      type: EVENT_TYPES.VEHICLE_ADDED,
      userId,
      objectType: "garage_entry",
      objectId: entry.id,
      metadata: { kind: "custom", verification: verified ? "verified" : "unverified" },
    });
  }
  return NextResponse.json({ entry, created, configKept, verified });
}

return NextResponse.json({ error: "Invalid garage entry payload." }, { status: 400 });
}
