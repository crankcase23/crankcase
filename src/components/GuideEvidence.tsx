import { buildGuideNotices } from "@/lib/guideNotices";
import type { RepairGuide } from "@/types/vehicle";

/**
 * Collapsible "Evidence & Sources": every source limitation that used to be repeated inside steps and safety lines, kept in
 * full and grouped here (plus the guide's evidence summary and note). Closed by default; nothing in it is removed from the guide.
 */
export default function GuideEvidence({ guide }: { guide: Pick<RepairGuide, "safety" | "steps" | "summary" | "evidenceNote"> }) {
  const { stepEvidence, safetyEvidence } = buildGuideNotices(guide);
  // Group steps by identical flag so each sentence is written once, with the steps it applies to.
  const byFlag = new Map<string, { number: number; title: string }[]>();
  for (const s of stepEvidence) for (const f of s.flags) byFlag.set(f, [...(byFlag.get(f) ?? []), { number: s.number, title: s.title }]);

  return (
    <section className="mt-8" id="evidence-sources">
      <details className="group rounded-xl border border-slate-800 bg-slate-900/60">
        <summary className="flex min-h-[48px] cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-lg font-semibold text-slate-100">
          <span>Evidence &amp; Sources</span>
          <span className="text-sm font-normal text-slate-400 group-open:hidden">Show</span>
          <span className="hidden text-sm font-normal text-slate-400 group-open:inline">Hide</span>
        </summary>
        <div className="space-y-5 border-t border-slate-800 px-4 py-4 text-sm leading-relaxed text-slate-300">
          <div>
            <h3 className="font-semibold text-slate-100">What this guide is based on</h3>
            <p className="mt-1">{guide.summary}</p>
            {guide.evidenceNote && <p className="mt-2">{guide.evidenceNote}</p>}
          </div>

          {byFlag.size > 0 && (
            <div>
              <h3 className="font-semibold text-slate-100">Source limits by step</h3>
              <ul className="mt-1 space-y-3">
                {[...byFlag].map(([flag, steps]) => (
                  <li key={flag}>
                    <p className="text-amber-200">{flag}</p>
                    <p className="text-slate-400">
                      Applies to: {steps.map((s) => `step ${s.number} (${s.title.replace(/^⛔ BLOCKED — /, "")})`).join("; ")}
                    </p>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {safetyEvidence.length > 0 && (
            <div>
              <h3 className="font-semibold text-slate-100">Source limits on safety notes</h3>
              <ul className="mt-1 space-y-3">
                {safetyEvidence.map((s) => (
                  <li key={s.line}>
                    <p className="text-slate-400">{s.line}</p>
                    {s.flags.map((f) => (
                      <p key={f} className="text-amber-200">{f}</p>
                    ))}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </details>
    </section>
  );
}
