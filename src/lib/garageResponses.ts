import { NextResponse } from "next/server";
import type { Blocked } from "@/lib/garageEntries";
import type { validateVin } from "@/lib/vin";

/** The one answer for "not added": says what the customer can do, nothing about anyone else. */
export function blockedResponse(b: Blocked) {
  switch (b.blocked) {
    case "vin-in-garage":
      return NextResponse.json(
        { code: "VIN_IN_GARAGE", error: "This VIN is already on another vehicle in your garage. A VIN names one vehicle, so it can only be added once. Nothing was changed." },
        { status: 409 },
      );
    default:
      return NextResponse.json({ code: "VIN_ALREADY_SET", error: "This vehicle already has a VIN, and a VIN can't be changed." }, { status: 409 });
  }
}

export const vinProblem = (check: Exclude<ReturnType<typeof validateVin>, { ok: true }>) =>
  NextResponse.json({ code: "VIN_INVALID", problem: check.problem, error: check.message, badPositions: check.badPositions }, { status: 400 });
