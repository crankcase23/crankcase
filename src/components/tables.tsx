import { FluidCapacity, SpecItem, TorqueSpec, Tool } from "@/types/vehicle";
import { PANEL } from "@/components/app/Chapter";
import { IconLock } from "@/components/app/AppIcons";
import {
  isUnverified,
  sourcingShape,
  UNVERIFIED_EXPLANATION,
  UNVERIFIED_GROUP_NOTE,
  UNVERIFIED_LABEL,
} from "@/lib/provenance";

/**
 * Marks a figure nobody has sourced yet. Deliberately quiet — amber, not red.
 * The number is probably right; what it is missing is a record of who checked
 * it, and the reader deserves to know which of the two they are holding.
 *
 * Only ever rendered on a MIXED table, where it is the thing telling the two
 * apart. A table with nothing sourced gets UnverifiedTableNote instead.
 */
export function UnverifiedBadge() {
  return (
    <span
      title={UNVERIFIED_EXPLANATION}
      className="ml-2 inline-flex shrink-0 items-center rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 align-middle text-[10px] font-semibold uppercase tracking-wide text-amber-400 font-sans"
    >
      {UNVERIFIED_LABEL}
    </span>
  );
}

/**
 * Said once, above a table in which nothing carries a source. Replaces the
 * per-row badge in that case rather than adding to it.
 */
export function UnverifiedTableNote() {
  return (
    <p className="mb-2 text-xs text-slate-400">
      <span className="font-semibold uppercase tracking-wide text-amber-400">{UNVERIFIED_LABEL}</span>
      {" — "}
      {UNVERIFIED_GROUP_NOTE}
    </p>
  );
}

export function SpecTable({ specs }: { specs: SpecItem[] }) {
  return (
    <div className={`${PANEL} overflow-hidden`}>
      <dl className="-mb-px grid sm:grid-cols-2 sm:gap-x-10 sm:px-3">
        {specs.map((s) => (
          <div key={s.label} className="flex items-baseline justify-between gap-5 border-b border-white/[0.06] px-5 py-3.5 sm:px-3">
            <dt className="text-sm text-slate-400">{s.label}</dt>
            <dd className="min-w-0 text-right font-mono text-[0.95rem] font-semibold text-slate-50">{s.value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

export function FluidTable({ fluids }: { fluids: FluidCapacity[] }) {
  const cols = "sm:grid-cols-[12rem_minmax(0,1fr)_minmax(0,1.3fr)] sm:gap-x-8";
  const shape = sourcingShape(fluids);
  return (
    <>
      {shape === "all" && <UnverifiedTableNote />}
      <div className={`${PANEL} overflow-hidden`}>
        <div className={`hidden border-b border-white/[0.08] px-6 py-3 sm:grid ${cols}`}>
          <span className="cg-stamp">Fluid</span>
          <span className="cg-stamp">Capacity</span>
          <span className="cg-stamp">Spec</span>
        </div>
        <ul>
          {fluids.map((f) => (
            <li key={f.name} className={`grid gap-y-1 border-b border-white/[0.06] px-5 py-4 last:border-b-0 sm:px-6 ${cols}`}>
              <span className="font-semibold text-slate-50">{f.name}</span>
              <span className="font-mono text-[0.95rem] text-slate-100 break-words">
                {f.capacity}
                {shape === "mixed" && isUnverified(f.provenance) && <UnverifiedBadge />}
              </span>
              <span className="text-sm leading-relaxed text-slate-300 break-words">
                {f.spec}
                {f.notes && <span className="mt-1 block text-[0.8rem] leading-relaxed text-slate-500">{f.notes}</span>}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </>
  );
}

export function TorqueTable({ specs }: { specs: TorqueSpec[] }) {
  const shape = sourcingShape(specs);
  return (
    <>
      {shape === "all" && <UnverifiedTableNote />}
      <div className="overflow-x-auto rounded-xl border border-slate-800">
        <table className="w-full table-fixed divide-y divide-slate-800 text-sm">
          <colgroup>
            <col className="w-[40%]" />
            <col className="w-[60%]" />
          </colgroup>
          <thead className="bg-slate-900">
            <tr>
              <th className="px-4 py-3 text-left font-semibold text-slate-300">Fastener</th>
              <th className="px-4 py-3 text-left font-semibold text-slate-300">Torque</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800 bg-slate-950">
            {specs.map((t) => (
              <tr key={t.fastener}>
                <td className="px-4 py-3 font-medium text-slate-100 break-words">{t.fastener}</td>
                <td className="px-4 py-3 text-slate-200 break-words">
                  <span className="font-mono">{t.value}</span>
                  {shape === "mixed" && isUnverified(t.provenance) && <UnverifiedBadge />}
                  {t.notes && <div className="mt-1 text-xs text-slate-500 font-sans">{t.notes}</div>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

export function ToolList({ tools }: { tools: Tool[] }) {
  return (
    <ul className="space-y-2">
      {tools.map((t) => (
        <li key={t.name} className="flex items-start gap-2 text-sm text-slate-200">
          <span className="mt-0.5 text-orange-400">•</span>
          <span>
            <span className="font-medium">{t.name}</span>
            {t.note && <span className="text-slate-400"> — {t.note}</span>}
          </span>
        </li>
      ))}
    </ul>
  );
}

export function BulletList({ items }: { items: string[] }) {
  return (
    <ul className="space-y-2">
      {items.map((item, i) => (
        <li key={i} className="flex items-start gap-2 text-sm text-slate-200">
          <span className="mt-0.5 text-orange-400">•</span>
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

export function TierBadge({ tier }: { tier: "free" | "premium" }) {
  return tier === "free" ? (
    <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-xs font-semibold text-emerald-300">
      Free
    </span>
  ) : (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-white/[0.05] px-2.5 py-1 text-xs font-semibold text-slate-200">
      <IconLock className="h-3 w-3" />
      Keys
    </span>
  );
}

export function DifficultyBadge({ difficulty }: { difficulty: string }) {
  const styles: Record<string, string> = {
    Easy: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
    Moderate: "bg-amber-500/15 text-amber-400 border-amber-500/30",
    Advanced: "bg-rose-500/15 text-rose-400 border-rose-500/30",
  };
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold ${
        styles[difficulty] ?? "bg-slate-800 text-slate-300 border-slate-700"
      }`}
    >
      {difficulty}
    </span>
  );
}
