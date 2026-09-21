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

/**
 * How the unsourced figures fall across one group — the rows of one table, or
 * the torque chips on one step.
 *
 *   none    everything here has a source recorded; say nothing
 *   all     nothing here does; say it once, above the group
 *   mixed   some do and some do not; mark the ones that do not
 *
 * The split is what keeps the mark worth reading. Where every row is
 * unsourced, a badge on every row is wallpaper — it carries no information
 * precisely because it is on everything, and a reader who learns to skip it
 * here will skip it on the table where it matters. One line above the group
 * says the same thing once. On a mixed group the per-row mark IS the
 * information: it is the only thing separating the figures somebody stands
 * behind from the ones nobody has checked.
 */
export type SourcingShape = "none" | "all" | "mixed";

export function sourcingShape(figures: { provenance?: Provenance }[]): SourcingShape {
  if (figures.length === 0) return "none";
  const unsourced = figures.filter((f) => isUnverified(f.provenance)).length;
  if (unsourced === 0) return "none";
  return unsourced === figures.length ? "all" : "mixed";
}

/** Said once above a group in which nothing carries a source. */
export const UNVERIFIED_GROUP_NOTE =
  "No source recorded for any of these figures — check them against your factory service manual before you use them.";
