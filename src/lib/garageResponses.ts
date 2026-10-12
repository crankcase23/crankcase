import { NextResponse } from "next/server";
import type { Blocked } from "@/lib/garageEntries";
import type { validateVin } from "@/lib/vin";

/** Why an add did not happen. Both answers concern only the customer's own garage; nothing about any other account. */
export function blockedResponse(b: Blocked) {
  switch (b.blocked) {
    case "vin-already-in-garage":
      return NextResponse.json(
        { code: "VIN_ALREADY_IN_GARAGE", error: "This VIN is already on another vehicle in your garage, so it can't be used for a second one." },
        { status: 409 },
      );
    default:
      return NextResponse.json({ code: "VIN_ALREADY_SET", error: "This vehicle already has a VIN, and a VIN can't be changed." }, { status: 409 });
  }
}

export const vinProblem = (check: Exclude<ReturnType<typeof validateVin>, { ok: true }>) =>
  NextResponse.json({ code: "VIN_INVALID", problem: check.problem, error: check.message, badPositions: check.badPositions }, { status: 400 });

