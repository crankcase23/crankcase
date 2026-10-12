// Garage ids. A customer may own several cars of the same year/make/model (different VINs), and each is its own garage
// row with its own Service History and unlock identity. The catalog vehicle (specs, guides) is shared; the garage row is not.
//
// Client-facing id of a catalog garage entry:
//   "<catalogId>"            the customer's oldest row for that model. This is the id every record, link and bookmark
//                            made before same-model cars existed already uses, so nothing existing breaks.
//   "<catalogId>~<rowId>"    any additional car of the same model.
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
