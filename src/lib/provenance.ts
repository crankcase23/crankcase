import { Provenance } from "@/types/vehicle";

/**
 * Whether a figure carries nothing at all about where it came from.
 *
 * Three states exist in the data today and they are NOT the same thing:
 *
 *   open-labor-project   pulled from a data source, confidence passes through
 *   curated              hand-typed, but someone checked it against a manual
 *                        and recorded that they had
 *   (no provenance)      hand-typed with no record of a source — a skeleton
 *
 * Only the third is unverified. A curated figure has a human behind it; an
 * absent provenance field means nobody has asserted anything about the number,
 * and on a page whose whole value is being right about torque, the reader has
 * to be able to tell those apart. This is the single definition every surface
 * that renders a figure reads from, so the mark cannot drift between the guide
 * page, the spec sheet and the printout.
 */
export function isUnverified(provenance?: Provenance): boolean {
  return !provenance;
}

/** The word used for the mark, everywhere it appears. */
export const UNVERIFIED_LABEL = "Unverified";

/** Why the mark is there, for a title attribute or a printed footnote. */
export const UNVERIFIED_EXPLANATION =
  "No source recorded for this figure — check it against your factory service manual before you use it.";
