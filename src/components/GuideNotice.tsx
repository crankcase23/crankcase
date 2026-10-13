import DataDisclaimer from "@/components/DataDisclaimer";
import { buildGuideNotices } from "@/lib/guideNotices";
import type { RepairGuide } from "@/types/vehicle";

/**
 * The ONE guide-level notice for an uncertified preview guide. It replaces three separate notes that used to repeat the same
 * message (the preview banner, the reference-figures disclaimer, and the "not verified" line opening the safety list).
 * The disclaimer sentence is the guide's own text, verbatim.
 */
export default function GuideNotice({ guide }: { guide: Pick<RepairGuide, "safety" | "steps"> }) {
  const { disclaimer } = buildGuideNotices(guide);
  return (
    <div role="note" aria-label="About this guide" className="mt-6 rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
      <p>
        <span className="font-semibold">Preview guide.</span> This guide is still being verified against BMW service data, so it is free to read and is
        not part of a paid Get the Keys unlock. Steps marked blocked stay blocked, and any figure marked VERIFY must be confirmed before you rely on it.
      </p>
      {disclaimer && <p className="mt-2">{disclaimer}</p>}
      <div className="mt-3">
        <DataDisclaimer compact />
      </div>
      <p className="mt-2 text-xs text-amber-200/80">Where each step and figure comes from is under Evidence &amp; Sources, further down.</p>
    </div>
  );
}
