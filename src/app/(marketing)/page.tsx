import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Crankcase — DIY Mechanic Guides",
  description:
    "Fluid capacities, real torque specs, and step-by-step repair guides for your exact vehicle, plus a printable service history. Free to start.",
};

const WHAT_IT_IS = [
  {
    icon: "🎯",
    title: "Your exact vehicle",
    body: "Specs, fluids, and guides matched to your year, make, model, and engine — not a generic average.",
  },
  {
    icon: "🔩",
    title: "Real torque specs",
    body: "Every fastener, in ft-lb and Nm, so you are not guessing or over-tightening plastic housings.",
  },
  {
    icon: "🧾",
    title: "Printable service history",
    body: "Log every oil change and repair with date and mileage, then print a clean report when you sell.",
  },
  {
    icon: "🔓",
    title: "Free to start",
    body: "Specs, fluid capacities, and one guide per vehicle are always free. Pay only to unlock the rest.",
  },
];

const PERSONAS = [
  {
    title: "The weekend wrench-turner",
    body: "Oil changes, brake jobs, and the stuff you can knock out in an afternoon with the right torque spec in hand.",
  },
  {
    title: "The new owner",
    body: "Just bought a car and want to actually understand it — what it takes, what it holds, what it is supposed to sound like.",
  },
  {
    title: "The seller",
    body: "About to sell or trade in? A printed service history with real dates and mileage is proof the car was cared for.",
  },
];

const STEPS = [
  {
    n: "1",
    title: "Add your vehicle",
    body: "Year, make, model, engine. That is all it takes to get started.",
  },
  {
    n: "2",
    title: "See specs & fluids free",
    body: "Capacities, recommended fluids, and general specs — no cost, no account required to look.",
  },
  {
    n: "3",
    title: "Unlock the full guide",
    body: "Pay once per vehicle for torque specs, tools, and the full illustrated step-by-step.",
  },
  {
    n: "4",
    title: "Log it and print it",
    body: "Track every service with date and mileage, then print a clean report when it is time to sell.",
  },
];

export default function MarketingHome() {
  return (
    <>
      <section className="mx-auto max-w-6xl px-4 pt-16 pb-20 sm:pt-24 sm:pb-28">
        <div className="max-w-3xl">
          <div className="inline-flex items-center gap-2 rounded-full border border-slate-800 bg-slate-900 px-3 py-1 text-xs font-medium text-orange-400">
            🔧 Built for DIY, not the shop
          </div>
          <h1 className="mt-5 text-4xl font-bold tracking-tight text-slate-50 sm:text-5xl">
            Fix your own car with the confidence of a factory manual.
          </h1>
          <p className="mt-5 max-w-2xl text-lg text-slate-400">
            Fluid capacities, real torque specs, and step-by-step repair guides for your
            exact vehicle — plus a service log you can print when it is time to sell. No
            shop-speak, no guessing.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href="/vehicles/2014-jeep-grand-cherokee-3.6l"
              className="rounded-lg bg-orange-500 px-6 py-3 font-semibold text-slate-950 hover:bg-orange-400"
            >
              Try the live demo &rarr;
            </Link>
            <Link
              href="/signup"
              className="rounded-lg border border-slate-700 px-6 py-3 font-semibold text-slate-200 hover:border-slate-500"
            >
              Get started free
            </Link>
          </div>
          <p className="mt-4 text-xs text-slate-600">
            No signup required for the demo — it is a real vehicle page from the app.
          </p>
          <div className="mt-6 inline-flex items-start gap-2 rounded-lg border border-slate-800 bg-slate-900/60 px-4 py-3 text-sm text-slate-400">
            <span aria-hidden>🧭</span>
            <span>
              Built for routine maintenance — oil changes, brakes, fluids, filters, and the
              like. For engine, transmission, or other major repair work, please see a
              professional mechanic.
            </span>
          </div>
        </div>
      </section>

      <section className="border-t border-slate-800 bg-slate-900/40">
        <div className="mx-auto max-w-6xl px-4 py-16">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-orange-400">
            What it is
          </h2>
          <p className="mt-2 max-w-2xl text-2xl font-bold text-slate-50">
            One reference for your exact vehicle — not a generic forum thread.
          </p>
          <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {WHAT_IT_IS.map((f) => (
              <div key={f.title} className="rounded-xl border border-slate-800 bg-slate-950 p-5">
                <div className="text-2xl">{f.icon}</div>
                <h3 className="mt-3 font-semibold text-slate-100">{f.title}</h3>
                <p className="mt-1 text-sm text-slate-400">{f.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-16">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-orange-400">
          Who it is for
        </h2>
        <p className="mt-2 max-w-2xl text-2xl font-bold text-slate-50">
          If you would rather turn a wrench than call a shop.
        </p>
        <div className="mt-10 grid gap-6 sm:grid-cols-3">
          {PERSONAS.map((p) => (
            <div key={p.title} className="rounded-xl border border-slate-800 bg-slate-900 p-6">
              <h3 className="font-semibold text-slate-100">{p.title}</h3>
              <p className="mt-2 text-sm text-slate-400">{p.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section id="how-it-works" className="scroll-mt-16 border-t border-slate-800 bg-slate-900/40">
        <div className="mx-auto max-w-6xl px-4 py-16">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-orange-400">
            How it works
          </h2>
          <p className="mt-2 max-w-2xl text-2xl font-bold text-slate-50">
            Four steps, no dealership required.
          </p>
          <ol className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {STEPS.map((s) => (
              <li key={s.n} className="rounded-xl border border-slate-800 bg-slate-950 p-5">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-orange-500 font-mono text-sm font-bold text-slate-950">
                  {s.n}
                </div>
                <h3 className="mt-3 font-semibold text-slate-100">{s.title}</h3>
                <p className="mt-1 text-sm text-slate-400">{s.body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-16">
        <div className="rounded-2xl border border-orange-500/30 bg-gradient-to-br from-orange-500/10 to-transparent p-8 sm:p-10">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-sm font-semibold uppercase tracking-wide text-orange-400">
                See it in action
              </h2>
              <p className="mt-2 max-w-xl text-2xl font-bold text-slate-50">
                Explore a real vehicle page — no signup required.
              </p>
              <p className="mt-2 max-w-xl text-slate-400">
                This is the actual app, not a mockup: specs, fluid capacities, and repair
                guides for a 2014 Jeep Grand Cherokee.
              </p>
            </div>
            <Link
              href="/vehicles/2014-jeep-grand-cherokee-3.6l"
              className="shrink-0 rounded-lg bg-orange-500 px-6 py-3 text-center font-semibold text-slate-950 hover:bg-orange-400"
            >
              Explore the demo Jeep &rarr;
            </Link>
          </div>
        </div>
      </section>

      <section className="border-t border-slate-800 bg-slate-900/40">
        <div className="mx-auto max-w-6xl px-4 py-16">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-orange-400">
            Pricing
          </h2>
          <p className="mt-2 max-w-2xl text-2xl font-bold text-slate-50">
            Free to look. Pay per vehicle to go deep.
          </p>
          <div className="mt-10 grid max-w-3xl gap-6 sm:grid-cols-2">
            <div className="rounded-xl border border-slate-800 bg-slate-950 p-6">
              <div className="text-sm font-semibold text-emerald-400">Free</div>
              <p className="mt-2 text-sm text-slate-400">
                Vehicle specs, fluid capacities, and one full guide per vehicle. Forever.
              </p>
            </div>
            <div className="rounded-xl border border-orange-500/30 bg-slate-950 p-6">
              <div className="text-sm font-semibold text-orange-400">Premium</div>
              <p className="mt-2 text-sm text-slate-400">
                Unlock the full guide library and printable service history for one vehicle.
              </p>
            </div>
          </div>
          <Link
            href="/pricing"
            className="mt-6 inline-block text-sm font-medium text-orange-400 hover:text-orange-300"
          >
            See full pricing &rarr;
          </Link>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-20 text-center">
        <h2 className="text-3xl font-bold text-slate-50">
          Stop guessing. Start with your car&apos;s actual numbers.
        </h2>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link
            href="/signup"
            className="rounded-lg bg-orange-500 px-6 py-3 font-semibold text-slate-950 hover:bg-orange-400"
          >
            Get started free
          </Link>
          <Link
            href="/login"
            className="rounded-lg border border-slate-700 px-6 py-3 font-semibold text-slate-200 hover:border-slate-500"
          >
            Log in
          </Link>
        </div>
      </section>
    </>
  );
}
