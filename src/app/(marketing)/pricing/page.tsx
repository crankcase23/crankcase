import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Pricing",
  description: "Free to look up your vehicle's specs and fluids. Pay per vehicle to unlock the full repair-guide library.",
};

const FREE_FEATURES = [
  "Add unlimited vehicles to your garage",
  "Full vehicle specs (engine, drivetrain, tires, battery, and more)",
  "Every fluid capacity and spec",
  "One full repair guide per vehicle, forever",
];

const PREMIUM_FEATURES = [
  "Everything in Free",
  "The full repair guide library for that vehicle — tools, parts, torque specs, and the illustrated step-by-step",
  "Service History logging for that vehicle",
  "A printable, sale-ready service history report",
];

export default function PricingPage() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-16">
      <div className="max-w-2xl">
        <h1 className="text-4xl font-bold tracking-tight text-slate-50">
          Simple, per-vehicle pricing.
        </h1>
        <p className="mt-4 text-lg text-slate-400">
          Look up your vehicle for free. Pay once, per vehicle, only when you want the full
          guide library and a service history you can print.
        </p>
      </div>

      <div className="mt-12 grid gap-6 sm:grid-cols-2">
        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-8">
          <div className="text-sm font-semibold uppercase tracking-wide text-emerald-400">
            Free
          </div>
          <div className="mt-3 text-3xl font-bold text-slate-50">$0</div>
          <p className="mt-1 text-sm text-slate-500">Forever, no card required.</p>
          <ul className="mt-6 space-y-3 text-sm text-slate-300">
            {FREE_FEATURES.map((f) => (
              <li key={f} className="flex gap-2">
                <span className="text-emerald-400">✓</span>
                <span>{f}</span>
              </li>
            ))}
          </ul>
          <Link
            href="/signup"
            className="mt-8 block rounded-lg border border-slate-700 px-4 py-2.5 text-center font-semibold text-slate-200 hover:border-slate-500"
          >
            Get started free
          </Link>
        </div>

        <div className="rounded-2xl border border-orange-500/40 bg-slate-900 p-8">
          <div className="text-sm font-semibold uppercase tracking-wide text-orange-400">
            Premium
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-bold text-slate-50">$19</span>
            <span className="text-sm text-slate-500">one-time, per vehicle*</span>
          </div>
          <p className="mt-1 text-sm text-slate-500">Unlock a vehicle once, keep it forever.</p>
          <ul className="mt-6 space-y-3 text-sm text-slate-300">
            {PREMIUM_FEATURES.map((f) => (
              <li key={f} className="flex gap-2">
                <span className="text-orange-400">✓</span>
                <span>{f}</span>
              </li>
            ))}
          </ul>
          <Link
            href="/signup"
            className="mt-8 block rounded-lg bg-orange-500 px-4 py-2.5 text-center font-semibold text-slate-950 hover:bg-orange-400"
          >
            Unlock a vehicle
          </Link>
        </div>
      </div>

      <p className="mt-6 text-xs text-slate-600">
        * Placeholder pricing while the model is still being finalized — nothing is charged
        today. Premium content currently renders in full for everyone so it can be reviewed
        before payments go live.
      </p>

      <div className="mt-16 rounded-xl border border-slate-800 bg-slate-900/60 p-6">
        <h2 className="font-semibold text-slate-100">Why per-vehicle instead of a subscription?</h2>
        <p className="mt-2 max-w-2xl text-sm text-slate-400">
          Most people only need deep repair data for the car sitting in their driveway, not a
          library of vehicles they will never own. Pay once for the vehicle you actually have,
          and it stays unlocked for as long as you own it.
        </p>
      </div>
    </div>
  );
}
