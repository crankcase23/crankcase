import Link from "next/link";
import type { CarChoice } from "@/lib/viewerConfig";

/**
 * Shown when an old link names a model and the customer owns more than one car of it. We never guess: each car has its
 * own history, odometer, configuration and unlocks, so the customer picks. The VIN's last six characters tell them apart
 * the way they would on the dash plate.
 */
export default function ChooseYourCar({
  vehicleLabel,
  cars,
  hrefFor,
}: {
  vehicleLabel: string;
  cars: CarChoice[];
  hrefFor: (garageId: string) => string;
}) {
  return (
    <div className="mx-auto max-w-2xl px-4 py-10" data-testid="choose-your-car">
      <Link href="/garage" className="text-sm text-slate-400 hover:text-slate-200">&larr; Back to garage</Link>
      <h1 className="mt-4 text-2xl font-bold text-slate-50">Which {vehicleLabel}?</h1>
      <p className="mt-2 text-slate-400">
        You have {cars.length} of these in your garage. Each one keeps its own service history, odometer and setup, so pick the one you mean.
      </p>
      <ul className="mt-6 space-y-3">
        {cars.map((c, i) => (
          <li key={c.garageId}>
            <Link
              href={hrefFor(c.garageId)}
              data-testid="choose-car-link"
              className="block rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 text-slate-100 hover:border-orange-500/60"
            >
              <span className="font-semibold">{vehicleLabel}</span>
              <span className="ml-2 font-mono text-sm text-slate-400">
                {c.vin ? `VIN ending ${c.vin.slice(-6)}` : `Car ${i + 1} (no VIN yet)`}
              </span>
              <span className="mt-0.5 block text-xs text-slate-500">Added {new Date(c.addedAt).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })}</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
