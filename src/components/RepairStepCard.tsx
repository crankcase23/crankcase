import Image from "next/image";
import { RepairStep } from "@/types/vehicle";
import { classifyStepWarning } from "@/lib/guideNotices";

export default function RepairStepCard({ step, consolidated = false }: { step: RepairStep; consolidated?: boolean }) {
  const notice = consolidated ? classifyStepWarning(step.warning) : null;
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900 overflow-hidden">
      <div className="flex flex-col sm:flex-row">
        {step.image && (
          <div className="sm:w-56 shrink-0 bg-slate-950 flex items-center justify-center p-4 border-b sm:border-b-0 sm:border-r border-slate-800">
            <Image
              src={step.image}
              alt={step.title}
              width={180}
              height={180}
              className="h-auto w-full max-w-[180px]"
            />
          </div>
        )}
        <div className="p-4 sm:p-5 flex-1">
          <div className="flex items-center gap-3">
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-orange-500 text-sm font-bold text-slate-950">
              {step.number}
            </span>
            <h3 className="font-semibold text-slate-100">{step.title}</h3>
          </div>
          <p className="mt-3 text-sm leading-relaxed text-slate-300">{step.instructions}</p>

          {notice ? (
            <>
              {notice.kind === "blocked" && (
                <div role="alert" className="mt-3 rounded-lg border-2 border-rose-500/70 bg-rose-500/15 px-3 py-2 text-sm font-semibold text-rose-200">
                  {notice.text}
                </div>
              )}
              {notice.kind === "caution" && (
                <div className="mt-3 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-300">⚠ {notice.text}</div>
              )}
              {notice.kind === "note" && (
                <p className="mt-3 border-l-2 border-slate-600 pl-3 text-xs text-slate-400">Note: {notice.text}</p>
              )}
              {notice.flags.length > 0 && (
                <details className="mt-2 text-xs text-slate-400">
                  <summary className="cursor-pointer text-amber-300/90">Source check</summary>
                  <ul className="mt-1 space-y-1">
                    {notice.flags.map((f) => (
                      <li key={f}>{f}</li>
                    ))}
                  </ul>
                </details>
              )}
            </>
          ) : (
            step.warning && (
              <div className="mt-3 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-300">
                ⚠ {step.warning}
              </div>
            )
          )}

          {step.torque && step.torque.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {step.torque.map((t) => (
                <span
                  key={t.fastener}
                  className="rounded-full border border-orange-500/30 bg-orange-500/10 px-3 py-1 text-xs font-mono text-orange-300"
                >
                  {t.fastener}: {t.value}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
