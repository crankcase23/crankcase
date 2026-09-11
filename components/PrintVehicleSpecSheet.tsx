"use client";

import Link from "next/link";
import { Vehicle, RepairGuide } from "@/types/vehicle";

export default function PrintVehicleSpecSheet({
  vehicle,
  repairGuides,
}: {
  vehicle: Vehicle;
  repairGuides: RepairGuide[];
}) {
  const printedOn = new Date().toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const torqueSections = repairGuides.filter((g) => g.torqueSpecs.length > 0);

  return (
    <div className="mx-auto max-w-3xl px-6 py-10 print:px-0 print:py-0">
      <div className="no-print mb-6 flex items-center justify-between">
        <Link href={`/vehicles/${vehicle.id}`} className="text-sm text-slate-400 hover:text-slate-200">
          &larr; Back to {vehicle.year} {vehicle.make} {vehicle.model}
        </Link>
        <button
          onClick={() => window.print()}
          className="rounded-lg bg-orange-500 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-orange-400"
        >
          🖨 Print / Save as PDF
        </button>
      </div>

      <div className="border border-slate-800 bg-white text-slate-900 print:border-0">
        <div className="border-b-4 border-slate-900 px-8 py-6 print:px-0">
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Vehicle Spec Sheet
          </div>
          <h1 className="mt-1 text-2xl font-bold">
            {vehicle.year} {vehicle.make} {vehicle.model} {vehicle.trim}
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            {vehicle.engine} · {vehicle.drivetrain} · {vehicle.transmission}
          </p>
          <p className="mt-3 text-xs text-slate-500">
            Printed {printedOn} via Crankcase — reference figures only, always confirm
            against your factory service manual.
          </p>
        </div>

        <div className="space-y-8 px-8 py-6 print:px-0">
          <section>
            <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-slate-700">
              Vehicle Specs
            </h2>
            <table className="w-full border-collapse text-sm">
              <tbody>
                {vehicle.specs.map((s) => (
                  <tr key={s.label} className="border-b border-slate-300">
                    <td className="py-2 pr-4 text-slate-600">{s.label}</td>
                    <td className="py-2 text-right font-medium">{s.value}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          <section>
            <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-slate-700">
              Fluid Capacities
            </h2>
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b-2 border-slate-900 text-left">
                  <th className="py-2 pr-4 font-semibold">Fluid</th>
                  <th className="py-2 pr-4 font-semibold">Capacity</th>
                  <th className="py-2 font-semibold">Spec</th>
                </tr>
              </thead>
              <tbody>
                {vehicle.fluids.map((f) => (
                  <tr key={f.name} className="border-b border-slate-300 align-top">
                    <td className="py-2 pr-4 font-medium">{f.name}</td>
                    <td className="py-2 pr-4">{f.capacity}</td>
                    <td className="py-2 text-slate-600">
                      {f.spec}
                      {f.notes && <div className="mt-0.5 text-xs text-slate-500">{f.notes}</div>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          {torqueSections.map((guide) => (
            <section key={guide.id}>
              <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-slate-700">
                Torque Specs — {guide.title}
              </h2>
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b-2 border-slate-900 text-left">
                    <th className="py-2 pr-4 font-semibold">Fastener</th>
                    <th className="py-2 font-semibold">Torque</th>
                  </tr>
                </thead>
                <tbody>
                  {guide.torqueSpecs.map((t) => (
                    <tr key={t.fastener} className="border-b border-slate-300 align-top">
                      <td className="py-2 pr-4 font-medium">{t.fastener}</td>
                      <td className="py-2 font-mono">
                        {t.value}
                        {t.notes && <div className="mt-0.5 font-sans text-xs text-slate-500">{t.notes}</div>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          ))}

          <p className="mt-8 text-xs text-slate-500">
            Reference figures only — always confirm against your vehicle&apos;s factory
            service manual or door-jamb/build sticker before finalizing a fluid fill or
            torque a fastener. Crankcase covers routine maintenance only; for engine,
            transmission, or other major repair work, see a professional mechanic.
          </p>
        </div>
      </div>
    </div>
  );
}
