"use client";

import Link from "next/link";
import { useServiceHistory } from "@/lib/serviceHistory";

export default function PrintServiceHistory({
  vehicleId,
  vehicleLabel,
  vehicleSubline,
  backHref,
}: {
  vehicleId: string;
  vehicleLabel: string;
  vehicleSubline?: string;
  backHref: string;
}) {
  const { entries } = useServiceHistory(vehicleId);

  const printedOn = new Date().toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <div className="mx-auto max-w-3xl px-6 py-10 print:px-0 print:py-0">
      <div className="no-print mb-6 flex items-center justify-between">
        <Link href={backHref} className="text-sm text-slate-400 hover:text-slate-200">
          &larr; Back to {vehicleLabel}
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
            Vehicle Service History
          </div>
          <h1 className="mt-1 text-2xl font-bold">{vehicleLabel}</h1>
          {vehicleSubline && <p className="mt-1 text-sm text-slate-600">{vehicleSubline}</p>}
          <p className="mt-3 text-xs text-slate-500">Report generated {printedOn} via Crankcase Garage</p>
        </div>

        <div className="px-8 py-6 print:px-0">
          {entries.length === 0 ? (
            <p className="text-sm text-slate-500">No service history has been logged for this vehicle yet.</p>
          ) : (
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b-2 border-slate-900 text-left">
                  <th className="py-2 pr-4 font-semibold">Date</th>
                  <th className="py-2 pr-4 font-semibold">Mileage</th>
                  <th className="py-2 pr-4 font-semibold">Service</th>
                  <th className="py-2 font-semibold">Notes</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((e) => (
                  <tr key={e.id} className="border-b border-slate-300 align-top">
                    <td className="py-2 pr-4 whitespace-nowrap">{e.date}</td>
                    <td className="py-2 pr-4 whitespace-nowrap">{e.mileage.toLocaleString()} mi</td>
                    <td className="py-2 pr-4 font-medium">{e.title}</td>
                    <td className="py-2 text-slate-600">{e.notes ?? ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          <p className="mt-8 text-xs text-slate-500">
            Entries are self-reported by the vehicle owner and not independently verified.
          </p>
        </div>
      </div>
    </div>
  );
}
