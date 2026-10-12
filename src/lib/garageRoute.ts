import { NextResponse } from "next/server";
import { AmbiguousGarageId } from "@/lib/garageId";

/** The one answer for a bare catalog id when the customer owns several cars of that model: nothing is read or changed. */
export function ambiguousVehicleResponse() {
  return NextResponse.json(
    {
      code: "VEHICLE_AMBIGUOUS",
      error: "You have more than one of this vehicle. Open the one you mean from your garage; nothing was changed.",
    },
    { status: 409 },
  );
}

/** Wrap a garage route handler so an ambiguous legacy id becomes the 409 above instead of a 500 (or a guess). */
export function withGarageId<A extends unknown[]>(handler: (...args: A) => Promise<Response>) {
  return async (...args: A): Promise<Response> => {
    try {
      return await handler(...args);
    } catch (e) {
      if (e instanceof AmbiguousGarageId) return ambiguousVehicleResponse();
      throw e;
    }
  };
}
