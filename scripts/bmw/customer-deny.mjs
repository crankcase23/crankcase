// Phrases that must NEVER appear in customer-facing BMW guide text (src/data/repairs-bmw-e90.ts).
// Shared by the generator (which scrubs and then refuses to emit a match) and by customer.test.mjs (which re-checks the emitted file),
// so a future ledger edit that brings one back fails the build instead of reaching customers.
//
// Context: the research was done on one owner's car. Facts about THAT car (its VIN decode, what the owner said it has, its build month)
// are not facts about the next customer's 328i, and internal build/research instructions mean nothing to a reader.

/** Statements about the owner's own car, or how its configuration was decoded. */
export const OWNER_SPECIFIC = [
  { name: "owner-stated detail", re: /owner[- ]stated|owner states|owner supplied|owner-supplied|the owner's (own )?(car|VIN)/i },
  { name: "VIN decode result", re: /\bdecod(e|ed|er|ers|es|ing)\b/i },
  { name: "DECODED CONFIG block", re: /DECODED CONFIG/ },
  { name: "decoder site", re: /bimmer\.work/i },
  { name: "VIN type code", re: /\bPH73\b|\bPH7\b/ },
  { name: "VIN / option list read for the owner's car", re: /VIN option list (shows|ends)|not in the VIN option list|VIN positions? \d|RealOEM VIN page|RealOEM selection shows/i },
  { name: "decode-confidence note", re: /probable, not proven|Treat as probable|probable for this car/i },
  { name: "dated decoder run", re: /\b2026-\d\d-\d\d\b|\b2010-10-10\b/ },
  { name: "build month of the owner's car", re: /production month|start of production|\b09\/2009 (car|production)\b|this 09\/2009 car/i },
  { name: "owner's VIN or serial", re: /\bthis VIN\b|WBAPH7C58AA175760|A175760/ },
];

/** Internal research / build instructions and jargon. */
export const INTERNAL = [
  { name: "publish instruction", re: /\bDo not publish\b/i },
  { name: "internal modelling instruction", re: /Keep the pan a plain|keep orientation not established/i },
  { name: "ledger jargon", re: /\bUNRESOLVED\b|\bRESOLVED\b|\bledger\b|primary:false|VERIFIED(_SECONDARY)?\b|DISPOSITION|variantDependencies|HOW THE USER CONFIRMS/ },
  { name: "guide referred to by internal number", re: /\bguide \d{1,2}\b/i },
  { name: "points at an internal specs list", re: /\((see|per) (the )?specs\)/i },
  { name: "internal step-structure remark", re: /kept only as a stop sign/i },
  { name: "work marker", re: /\bTODO\b|\bFIXME\b/ },
];

/** Returns [{ rule, match }] for every deny rule that matches `text`. */
export function denied(text) {
  const hits = [];
  for (const { name, re } of [...OWNER_SPECIFIC, ...INTERNAL]) {
    const m = String(text).match(re);
    if (m) hits.push({ rule: name, match: m[0] });
  }
  return hits;
}
