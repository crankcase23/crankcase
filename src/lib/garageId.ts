// Garage ids. A customer may own several cars of the same year/make/model (different VINs). Each physical car is its own
// garage row with its own Service History, odometer, configuration, photos and unlock identity. The catalog vehicle
// (specs, guides) is shared; the garage row is not.
//
// Client-facing id of a catalog garage entry:
//   "<catalogId>~<rowId>"    ALWAYS. The row id is permanent, so the id of a car never changes and never starts pointing
//                            at a different car (not when another car of the same model is added or deleted).
//   "<catalogId>"            a LEGACY ALIAS only (every link, bookmark and record made before same-model cars existed
//                            uses it). It resolves to the customer's car only while they own exactly one car of that
//                            model; with two or more it is AMBIGUOUS and every operation refuses it (AmbiguousGarageId)
//                            instead of guessing which car was meant.
// A custom entry's id is its row id, unchanged.
//
// Safe to import from client and server code (no server-only imports).

const SEP = "~";

/** The shared catalog vehicle id behind a garage id (strips the "~<rowId>" suffix when present). */
export function catalogIdOf(garageId: string): string {
  const i = garageId.indexOf(SEP);
  return i === -1 ? garageId : garageId.slice(0, i);
}

/** The row id inside a composite garage id, or null for a plain id. */
export function rowIdOf(garageId: string): string | null {
  const i = garageId.indexOf(SEP);
  return i === -1 ? null : garageId.slice(i + 1) || null;
}

export function composeGarageId(catalogId: string, rowId: string): string {
  return `${catalogId}${SEP}${rowId}`;
}

/** A bare catalog id was used while the customer owns more than one car of that model, so no single car can be chosen. */
export class AmbiguousGarageId extends Error {
  constructor(readonly catalogId: string) {
    super(`ambiguous garage id: more than one car of ${catalogId}`);
  }
}

/** True for the ids the server mints (carry a row id). A bare catalog id is a legacy alias. */
export const isCompositeGarageId = (garageId: string): boolean => rowIdOf(garageId) !== null;
