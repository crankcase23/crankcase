import { NextResponse } from "next/server";
import type { Blocked } from "@/lib/garageEntries";
import type { validateVin } from "@/lib/vin";

/** The one answer for "not added": says what the customer can do, nothing about anyone else. */
export function blockedResponse(b: Blocked) {
  switch (b.blocked) {
    case "vin-claim-required":
      return NextResponse.json(
        {
          code: "VIN_CLAIM_REQUIRED",
          error: "This VIN can't be added to your garage yet. It needs a verified ownership claim, which isn't available yet. Nothing was added and nothing was shared.",
        },
        { status: 409 },
      );
    default:
      return NextResponse.json({ code: "VIN_ALREADY_SET", error: "This vehicle already has a VIN, and a VIN can't be changed." }, { status: 409 });
  }
}

export const vinProblem = (check: Exclude<ReturnType<typeof validateVin>, { ok: true }>) =>
  NextResponse.json({ code: "VIN_INVALID", problem: check.problem, error: check.message, badPositions: check.badPositions }, { status: 400 });

