import Link from "next/link";
import type { Metadata } from "next";
import { allRepairs, findRepair, findVehicle, listVehicles } from "@/lib/data";
import { JOB_LABELS } from "@/lib/admin/coverage";
import type { JobTypeId } from "@/types/vehicle";

export const metadata: Metadata = {
  title: "Crankcase Garage — DIY Maintenance Guides for Your Exact Vehicle",
  description:
    "Tell Crankcase your year, make, model and engine, pick the job, and get the tools, parts, fluids, safety notes and torque specs for that exact vehicle — then a step-by-step walkthrough. Free to start.",
};

// ---------------------------------------------------------------------------
// Homepage. Built for the first ten seconds.
//
// A first-time visitor -- very possibly someone who has never changed their
// own oil -- should be able to answer five questions from the first screen
// without scrolling or clicking:
//
//   1. Does this know MY car?                 -> "your exact vehicle", step 1
//   2. Can I pick the job I actually need?    -> step 2, the jobs strip
//   3. Will it tell me what I need first?     -> tools / parts / fluids / safety
//   4. Will it walk me through it?            -> "step by step", the preview card
//   5. Is this for someone like me?           -> "First time? Start with an oil change."
//
// The preview card on the right is NOT a mockup. It is rendered from a real
// guide in src/data at request time, so every number on it is a number the
// site actually publishes for that vehicle. The counts in the proof strip are
// derived the same way. Nothing on this page is a placeholder figure -- if the
// catalog changes, the homepage changes with it.
//
// Voice: confident, automotive, plain. No emojis, no exclamation marks, no
// "unlock your potential". The display face (Big Shoulders Display, the same
// one the badge wears) is used for headings only, as signage.
// ---------------------------------------------------------------------------

// The guide the hero previews. The Jeep is the original demo vehicle and its
// free oil-change guide carries real, sourced figures.
const PREVIEW_GUIDE_ID = "jeep-grand-cherokee-oil-change";

const display = { fontFamily: "var(--font-display)" } as const;

function StepNumber({ n }: { n: string }) {
  return (
    <div
      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-orange-500 font-mono text-base font-bold text-slate-950"
      aria-hidden
    >
      {n}
    </div>
  );
}

export default function MarketingHome() {
  const guide = findRepair(PREVIEW_GUIDE_ID);
  const vehicle = guide ? findVehicle(guide.vehicleId) : undefined;

  const vehicles = listVehicles();
  const guides = allRepairs();
  const jobTypesWithGuides = Array.from(new Set(guides.map((g) => g.jobType))) as JobTypeId[];
  // Order the strip the way a beginner's mental list runs: the jobs people
  // actually start with first, the rarer ones last.
  const JOB_ORDER: JobTypeId[] = [
    "oil-change",
    "brake-pads-front",
    "brake-pads-rear",
    "engine-air-filter",
    "cabin-air-filter",
    "wiper-blades",
    "battery",
    "tire-rotation",
    "coolant",
    "fluid-checks",
    "serpentine-belt",
    "driveline-fluid",
    "key-fob-battery",
    "fuse-bulb",
    "pcv-valve",
    "spark-plugs",
    "o2-sensor",
  ];
  const jobs = JOB_ORDER.filter((id) => jobTypesWithGuides.includes(id));

  return (
    <>
      {/* ------------------------------------------------------ first screen */}
      <section className="relative overflow-hidden">
        {/* A single, quiet orange glow behind the left column. Sets the
            "lit bay" mood without putting an image in front of the words. */}
        <div
          aria-hidden
          className="pointer-events-none absolute -left-40 top-[-10rem] h-[32rem] w-[32rem] rounded-full bg-orange-500/10 blur-3xl"
        />

        <div className="relative mx-auto grid max-w-6xl gap-10 px-4 pt-10 pb-12 sm:pt-16 lg:grid-cols-[1.15fr_1fr] lg:items-center lg:gap-14 lg:pb-16">
          {/* ---- left: the pitch */}
          <div>
            <p className="text-sm font-extrabold uppercase tracking-[0.18em] text-orange-400" style={display}>
              Your ride. Your garage. Your wrenches.
            </p>

            <h1
              className="mt-3 text-5xl font-extrabold uppercase leading-[0.92] tracking-tight text-slate-50 sm:text-6xl lg:text-[4.25rem]"
              style={display}
            >
              Fix your own car.
              <span className="block text-orange-400">
                Right numbers,
                <br /> right order.
              </span>
            </h1>

            <p className="mt-5 max-w-xl text-base leading-relaxed text-slate-300 sm:text-lg">
              Tell Crankcase your year, make, model and engine. Pick the job. You get the tools,
              parts, fluids, safety notes and torque specs for{" "}
              <span className="font-semibold text-slate-100">that exact vehicle</span> — then a
              step-by-step walkthrough from the first bolt to the last.
            </p>

            <p className="mt-3 max-w-xl text-sm text-slate-400 sm:text-base">
              Never done this before? Start with an oil change. Every guide tells you what you need,
              how long it takes, and where people get hurt — before you pick up a tool.
            </p>

            <div className="mt-6 flex flex-wrap items-center gap-3">
              <Link
                href="/signup"
                className="rounded-lg bg-orange-500 px-6 py-3 text-base font-semibold text-slate-950 shadow-[0_0_0_1px_rgba(249,115,22,0.4),0_10px_30px_-10px_rgba(249,115,22,0.6)] hover:bg-orange-400"
              >
                Add your vehicle — free
              </Link>
              <Link
                href="/how-it-works"
                className="rounded-lg border border-slate-700 px-6 py-3 text-base font-semibold text-slate-200 hover:border-slate-500 hover:text-white"
              >
                See how it works
              </Link>
            </div>
            <p className="mt-3 text-sm text-slate-500">
              Specs and fluid capacities are always free. One free guide per vehicle.{" "}
              <Link href="/login" className="text-slate-400 underline-offset-4 hover:text-white hover:underline">
                Already have a garage? Log in.
              </Link>
            </p>

            {/* ---- the three steps, in the first screen on purpose */}
            <ol className="mt-8 grid gap-4 sm:grid-cols-3 sm:gap-5">
              <li className="flex gap-3">
                <StepNumber n="1" />
                <div>
                  <div className="font-semibold text-slate-100">Your exact vehicle</div>
                  <p className="mt-1 text-sm text-slate-400">Year, make, model, engine — or drop in the VIN.</p>
                </div>
              </li>
              <li className="flex gap-3">
                <StepNumber n="2" />
                <div>
                  <div className="font-semibold text-slate-100">Pick the job</div>
                  <p className="mt-1 text-sm text-slate-400">Oil change, brakes, filters, wipers, fluids and more.</p>
                </div>
              </li>
              <li className="flex gap-3">
                <StepNumber n="3" />
                <div>
                  <div className="font-semibold text-slate-100">Do it right</div>
                  <p className="mt-1 text-sm text-slate-400">Tools, parts, torque specs, safety notes. Step by step.</p>
                </div>
              </li>
            </ol>
          </div>

          {/* ---- right: a real guide, not a mockup */}
          {guide && vehicle && (
            <aside
              aria-label={`Example guide: ${guide.title} for the ${vehicle.year} ${vehicle.make} ${vehicle.model}`}
              className="relative rounded-2xl border border-slate-800 bg-slate-900/70 p-5 shadow-2xl shadow-black/40 sm:p-6"
            >
              <div className="flex items-center justify-between gap-3">
                <span className="text-xs font-extrabold uppercase tracking-[0.18em] text-orange-400" style={display}>
                  What a guide looks like
                </span>
                <span className="rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2 py-0.5 text-xs font-medium text-emerald-300">
                  {guide.tier === "free" ? "Free guide" : "Guide"}
                </span>
              </div>

              <div className="mt-4 text-sm text-slate-400">
                {vehicle.year} {vehicle.make} {vehicle.model} · {vehicle.engine}
              </div>
              <div className="mt-1 text-2xl font-extrabold uppercase leading-tight text-slate-50" style={display}>
                {guide.title}
              </div>
              <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-300">
                <span>
                  <span className="text-slate-500">Difficulty</span> {guide.difficulty}
                </span>
                <span>
                  <span className="text-slate-500">Time</span> {guide.estTime}
                </span>
                <span>
                  <span className="text-slate-500">Steps</span> {guide.steps.length}
                </span>
              </div>

              <dl className="mt-5 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
                {[
                  ["Tools", guide.tools.length],
                  ["Parts", guide.parts?.length ?? 0],
                  ["Safety notes", guide.safety.length],
                  ["Torque figures", guide.torqueSpecs?.length ?? 0],
                ].map(([label, n]) => (
                  <div key={String(label)} className="rounded-lg border border-slate-800 bg-slate-950/70 px-3 py-2">
                    <dt className="text-xs text-slate-500">{label}</dt>
                    <dd className="mt-0.5 font-mono text-lg font-semibold text-slate-100">{n}</dd>
                  </div>
                ))}
              </dl>

              {guide.torqueSpecs && guide.torqueSpecs.length > 0 && (
                <div className="mt-5 rounded-lg border border-orange-500/30 bg-orange-500/5 p-4">
                  <div className="text-xs font-semibold uppercase tracking-wide text-orange-400">
                    Torque specs — this vehicle, not an average
                  </div>
                  <ul className="mt-2 space-y-1.5">
                    {guide.torqueSpecs.slice(0, 2).map((t) => (
                      <li key={t.fastener} className="flex items-baseline justify-between gap-4 text-sm">
                        <span className="text-slate-300">{t.fastener}</span>
                        <span className="shrink-0 font-mono font-semibold text-slate-50">{t.value}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {guide.steps[0] && (
                <div className="mt-4 flex items-start gap-3 rounded-lg border border-slate-800 bg-slate-950/70 p-3">
                  <div className="mt-0.5 h-2 w-2 shrink-0 rounded-full bg-orange-400" aria-hidden />
                  <div className="text-sm">
                    <div className="text-xs text-slate-500">
                      Step 1 of {guide.steps.length}
                    </div>
                    <div className="mt-0.5 font-medium text-slate-200">{guide.steps[0].title}</div>
                  </div>
                </div>
              )}

              <p className="mt-4 text-xs text-slate-500">
                Pulled live from this vehicle&apos;s actual guide. Every vehicle in the catalog gets
                its own figures.
              </p>
            </aside>
          )}
        </div>

        {/* ---- proof strip: real counts, derived from the catalog */}
        <div className="border-y border-slate-800 bg-slate-900/40">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-8 gap-y-2 px-4 py-4 text-sm text-slate-400">
            <span>
              <span className="font-mono font-semibold text-slate-100">{vehicles.length}</span> vehicles in the
              catalog
            </span>
            <span>
              <span className="font-mono font-semibold text-slate-100">{guides.length}</span> step-by-step guides
            </span>
            <span>Torque in ft-lb and Nm on every fastener</span>
            <span>Free to start — no card to look around</span>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------ jobs covered */}
      <section className="mx-auto max-w-6xl px-4 py-14 sm:py-16">
        <h2 className="text-sm font-extrabold uppercase tracking-[0.18em] text-orange-400" style={display}>
          The jobs you can actually do in a driveway
        </h2>
        <p className="mt-2 max-w-2xl text-2xl font-bold text-slate-50">
          Routine maintenance, done properly. That&apos;s the whole product.
        </p>
        <ul className="mt-6 flex flex-wrap gap-2">
          {jobs.map((id) => (
            <li
              key={id}
              className="rounded-full border border-slate-700 bg-slate-900 px-3.5 py-1.5 text-sm text-slate-200"
            >
              {JOB_LABELS[id]}
            </li>
          ))}
        </ul>
        <div className="mt-6 flex max-w-3xl items-start gap-3 rounded-lg border border-slate-800 bg-slate-900/60 px-4 py-3 text-sm text-slate-400">
          <div className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-orange-400" aria-hidden />
          <p>
            Engine, transmission and other major repair work is not what this is for, and we say so on
            the page instead of letting you find out halfway through. For those, see a professional
            mechanic.
          </p>
        </div>
      </section>

      {/* ------------------------------------------------------ reassurance */}
      <section className="border-t border-slate-800 bg-slate-900/40">
        <div className="mx-auto max-w-6xl px-4 py-14 sm:py-16">
          <h2 className="text-sm font-extrabold uppercase tracking-[0.18em] text-orange-400" style={display}>
            Built for first-timers. Written like a service manual.
          </h2>
          <div className="mt-8 grid gap-6 md:grid-cols-3">
            <div className="rounded-xl border border-slate-800 bg-slate-950 p-6">
              <h3 className="text-xl font-extrabold uppercase text-slate-50" style={display}>
                You know what you need before you start
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-400">
                Every guide opens with the full tools list, the parts and fluids with quantities, how
                hard it is, and how long it takes. No mid-job trips to the parts store.
              </p>
            </div>
            <div className="rounded-xl border border-slate-800 bg-slate-950 p-6">
              <h3 className="text-xl font-extrabold uppercase text-slate-50" style={display}>
                The numbers are for your car
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-400">
                Torque specs, fluid capacities and part fitment are per vehicle, never inherited from
                a lookalike. Where a figure comes from a sourced dataset, the guide says so.
              </p>
            </div>
            <div className="rounded-xl border border-slate-800 bg-slate-950 p-6">
              <h3 className="text-xl font-extrabold uppercase text-slate-50" style={display}>
                The dangerous parts are called out
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-400">
                Jack stands, hot oil, plastic housings that crack when over-tightened — the safety
                notes sit at the top of the guide and again on the step where they matter.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------ closing CTA */}
      <section className="mx-auto max-w-6xl px-4 py-14 sm:py-20">
        <div className="rounded-2xl border border-orange-500/30 bg-gradient-to-br from-orange-500/10 to-transparent p-8 sm:p-10">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-3xl font-extrabold uppercase leading-tight text-slate-50 sm:text-4xl" style={display}>
                Add your vehicle. It&apos;s free to look.
              </h2>
              <p className="mt-2 max-w-xl text-slate-400">
                Specs and fluid capacities for every vehicle, plus one full guide, cost nothing. Pay
                only if you want the rest of the guides for that car.
              </p>
            </div>
            <div className="flex shrink-0 flex-wrap gap-3">
              <Link
                href="/signup"
                className="rounded-lg bg-orange-500 px-6 py-3 font-semibold text-slate-950 hover:bg-orange-400"
              >
                Get started free
              </Link>
              <Link
                href="/pricing"
                className="rounded-lg border border-slate-700 px-6 py-3 font-semibold text-slate-200 hover:border-slate-500"
              >
                Pricing
              </Link>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
