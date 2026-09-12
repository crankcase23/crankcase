import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Crankcase Garage — DIY Mechanic Guides",
  description:
    "Fluid capacities, real torque specs, and step-by-step repair guides for your exact vehicle, plus a printable service history. Free to start.",
};

export default function MarketingHome() {
  return (
    <section className="mx-auto flex max-w-3xl flex-col items-center px-4 pt-24 pb-24 text-center sm:pt-32 sm:pb-32">
      <div className="inline-flex items-center gap-2 rounded-full border border-slate-800 bg-slate-900 px-3 py-1 text-xs font-medium text-orange-400">
        🔧 Built for DIY, not the shop
      </div>
      <h1 className="mt-6 text-4xl font-bold tracking-tight text-slate-50 sm:text-5xl">
        Fix your own car with the confidence of a factory manual.
      </h1>
      <p className="mt-5 max-w-xl text-lg text-slate-400">
        Fluid capacities, real torque specs, and step-by-step repair guides for your
        exact vehicle — plus a service log you can print when it&apos;s time to sell.
      </p>

      <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
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
        <Link
          href="/how-it-works"
          className="rounded-lg border border-slate-700 px-6 py-3 font-semibold text-slate-200 hover:border-slate-500"
        >
          How it works
        </Link>
        <Link
          href="/swag"
          className="rounded-lg border border-slate-700 px-6 py-3 font-semibold text-slate-200 hover:border-slate-500"
        >
          Shop
        </Link>
      </div>

      <div className="mt-10 inline-flex items-start gap-2 rounded-lg border border-slate-800 bg-slate-900/60 px-4 py-3 text-left text-sm text-slate-400">
        <span aria-hidden>🧭</span>
        <span>
          Built for routine maintenance — oil changes, brakes, fluids, filters, and the
          like. For engine, transmission, or other major repair work, please see a
          professional mechanic.
        </span>
      </div>
    </section>
  );
}
