import Image from "next/image";
import { RepairStep } from "@/types/vehicle";
import {
  isUnverified,
  UNVERIFIED_EXPLANATION,
  UNVERIFIED_LABEL,
} from "@/lib/provenance";

export default function RepairStepCard({ step }: { step: RepairStep }) {
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

          {step.warning && (
            <div className="mt-3 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-300">
              ⚠ {step.warning}
            </div>
          )}

          {step.torque && step.torque.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {step.torque.map((t) => {
                const unsourced = isUnverified(t.provenance);
                return (
                  <span
                    key={t.fastener}
                    title={unsourced ? UNVERIFIED_EXPLANATION : undefined}
                    className={`rounded-full border px-3 py-1 text-xs font-mono ${
                      unsourced
                        ? "border-amber-500/30 bg-amber-500/10 text-amber-300"
                        : "border-orange-500/30 bg-orange-500/10 text-orange-300"
                    }`}
                  >
                    {t.fastener}: {t.value}
                    {unsourced && (
                      <span className="ml-1.5 font-sans font-semibold uppercase tracking-wide text-[10px] text-amber-400">
                        {UNVERIFIED_LABEL}
                      </span>
                    )}
                  </span>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
