import { FluidCapacity, SpecItem, TorqueSpec, Tool } from "@/types/vehicle";

export function SpecTable({ specs }: { specs: SpecItem[] }) {
  return (
    <dl className="divide-y divide-slate-800 rounded-xl border border-slate-800 bg-slate-900 overflow-hidden">
      {specs.map((s) => (
        <div key={s.label} className="flex justify-between gap-4 px-4 py-3 text-sm">
          <dt className="text-slate-400">{s.label}</dt>
          <dd className="text-right font-medium text-slate-100">{s.value}</dd>
        </div>
      ))}
    </dl>
  );
}

export function FluidTable({ fluids }: { fluids: FluidCapacity[] }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-slate-800">
      <table className="w-full min-w-[600px] table-fixed divide-y divide-slate-800 text-sm">
        <colgroup>
          <col className="w-[26%]" />
          <col className="w-[30%]" />
          <col className="w-[44%]" />
        </colgroup>
        <thead className="bg-slate-900">
          <tr>
            <th className="px-4 py-3 text-left font-semibold text-slate-300">Fluid</th>
            <th className="px-4 py-3 text-left font-semibold text-slate-300">Capacity</th>
            <th className="px-4 py-3 text-left font-semibold text-slate-300">Spec</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-800 bg-slate-950">
          {fluids.map((f) => (
            <tr key={f.name}>
              <td className="px-4 py-3 font-medium text-slate-100">{f.name}</td>
              <td className="px-4 py-3 text-slate-200 break-words">{f.capacity}</td>
              <td className="px-4 py-3 text-slate-400 break-words">
                {f.spec}
                {f.notes && <div className="mt-1 text-xs text-slate-500">{f.notes}</div>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function TorqueTable({ specs }: { specs: TorqueSpec[] }) {
  return (
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
                {t.notes && <div className="mt-1 text-xs text-slate-500 font-sans">{t.notes}</div>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
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
    <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/15 px-2.5 py-1 text-xs font-semibold text-emerald-400">
      Free
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 rounded-full border border-orange-500/30 bg-orange-500/15 px-2.5 py-1 text-xs font-semibold text-orange-400">
      🔒 Premium
    </span>
  );
}

// Marks a vehicle whose figures are all hand-typed reference numbers with
// nothing sourced behind them (see isUnverifiedVehicle in lib/data). Amber,
// not red: the data is not known to be wrong, it is known to be unconfirmed,
// and a reader deserves to be told which of the two they are looking at.
export function UnverifiedBadge() {
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full border border-amber-500/30 bg-amber-500/15 px-2.5 py-1 text-xs font-semibold text-amber-400"
      title="Every figure on this vehicle is a hand-typed reference number. None of it has been confirmed against a citable source yet."
    >
      Unverified
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
