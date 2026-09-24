import Link from "next/link";
import type { Metadata } from "next";
import { allRepairs, findRepair, findVehicle, listVehicles } from "@/lib/data";
import { JOB_LABELS } from "@/lib/admin/coverage";
import type { JobTypeId } from "@/types/vehicle";
import CrankcaseMark from "@/components/CrankcaseMark";
import {
  HeroBackdrop,
  IconBox,
  IconCar,
  IconClipboard,
  IconClipboardCheck,
  IconClock,
  IconGauge,
  IconHex,
  IconShield,
  IconSteps,
  IconTarget,
  IconWrench,
  Stamp,
} from "@/components/marketing/HomeVisuals";

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
// Visual system: "Modern Performance Garage, restrained edition". Depth comes
// from graphite panels, seams and a faint drafting grid (globals.css, cg-*),
// plus one line-drawn vehicle in the hero (HomeVisuals.tsx). Orange is spent
// on exactly five things: the primary CTA, the section eyebrow, the vehicle-
// specific torque values, the active step, and the small brand rule under the
// headline. Everything else is off-white, steel and blue-gray.
//
// Voice: confident, automotive, plain. No emojis, no exclamation marks, no
// "unlock your potential". The display face (Big Shoulders Display, the same
// one the badge wears) is used for headings only, as signage.
// ---------------------------------------------------------------------------

// The guide the hero previews. The Jeep is the original demo vehicle and its
// free oil-change guide carries real, sourced figures.
const PREVIEW_GUIDE_ID = "jeep-grand-cherokee-oil-change";

const display = { fontFamily: "var(--font-display)" } as const;

function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <p className="flex items-center gap-3">
      <span className="h-px w-8 shrink-0 bg-orange-500" aria-hidden />
      <span className="text-xs font-extrabold uppercase tracking-[0.22em] text-orange-400" style={display}>
        {children}
      </span>
    </p>
  );
}

function StepTile({
  n,
  icon,
  active = false,
}: {
  n: string;
  icon: React.ReactNode;
  active?: boolean;
}) {
  return (
    <div className="relative shrink-0" aria-hidden>
      <div
        className={`cg-panel flex h-12 w-12 items-center justify-center rounded-lg ${
          active ? "text-orange-400" : "text-slate-200"
        }`}
      >
        {icon}
      </div>
      <div className="absolute -left-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded bg-orange-500 font-mono text-[11px] font-bold text-slate-950">
        {n}
      </div>
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

  const steps = [
    { n: "1", icon: <IconCar className="h-6 w-6" />, title: "Your exact vehicle", body: "Year, make, model, engine — or drop in the VIN." },
    { n: "2", icon: <IconClipboard className="h-6 w-6" />, title: "Pick the job", body: "Oil change, brakes, filters, wipers, fluids and more." },
    { n: "3", icon: <IconWrench className="h-6 w-6" />, title: "Do it right", body: "Tools, parts, torque specs, safety notes. Step by step." },
  ];

  return (
    <>
      {/* ------------------------------------------------------ first screen */}
      <section className="relative isolate overflow-hidden">
        <HeroBackdrop />

        <div className="relative mx-auto grid max-w-6xl gap-10 px-4 pt-10 pb-12 sm:pt-16 lg:grid-cols-[1.15fr_1fr] lg:items-center lg:gap-14 lg:pb-20">
          {/* ---- left: the pitch */}
          <div>
            <Eyebrow>Your ride. Your garage. Your wrenches.</Eyebrow>

            <h1
              className="mt-3 text-5xl font-extrabold uppercase leading-[0.92] tracking-tight text-slate-50 sm:text-6xl lg:text-[4rem]"
              style={display}
            >
              Fix your own car.
              <span className="block text-slate-400">
                Right numbers,
                <br /> right order.
              </span>
            </h1>
            <div className="mt-3.5 h-[3px] w-14 bg-orange-500" aria-hidden />

            <p className="mt-4 max-w-xl text-base leading-relaxed text-slate-300 sm:text-lg">
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
                className="rounded-lg bg-orange-500 px-6 py-3 text-base font-semibold text-slate-950 shadow-lg shadow-black/40 hover:bg-orange-400"
              >
                Add your vehicle — free
              </Link>
              <Link
                href="/how-it-works"
                className="rounded-lg border border-slate-600 bg-slate-900/50 px-6 py-3 text-base font-semibold text-slate-200 hover:border-slate-400 hover:text-white"
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

            {/* ---- the three steps, in the first screen on purpose. A rail on
                desktop (vehicle -> job -> wrench), a stacked list on mobile. */}
            <ol className="relative mt-8 grid gap-5 sm:grid-cols-3 sm:gap-6">
              {/* connector: vertical on the mobile stack; on the desktop rail
                  the chevrons between tiles carry the sequence */}
              <div className="absolute left-6 top-6 bottom-6 w-px bg-slate-800 sm:hidden" aria-hidden />
              {steps.map((s, i) => (
                <li key={s.n} className="relative flex gap-3 sm:flex-col sm:gap-3">
                  <StepTile n={s.n} icon={s.icon} active={i === 0} />
                  <div className="pt-1 sm:pt-0">
                    <div className="font-semibold text-slate-100">{s.title}</div>
                    <p className="mt-1 text-sm text-slate-400">{s.body}</p>
                  </div>
                  {i < steps.length - 1 && (
                    <span
                      className="absolute -right-4 top-3 hidden text-lg leading-none text-slate-600 sm:block"
                      aria-hidden
                    >
                      ›
                    </span>
                  )}
                </li>
              ))}
            </ol>
          </div>

          {/* ---- right: a real guide, not a mockup. Laid out like a page from
              a service manual for this one vehicle. */}
          {guide && vehicle && (
            <aside
              aria-label={`Example guide: ${guide.title} for the ${vehicle.year} ${vehicle.make} ${vehicle.model}`}
              className="relative"
            >
              {/* a second sheet behind the card, for depth */}
              <div
                aria-hidden
                className="absolute inset-0 translate-x-2.5 translate-y-2.5 rounded-2xl border border-slate-800/70 bg-slate-950/50"
              />
              <div className="cg-panel relative overflow-hidden rounded-2xl">
                {/* header bar */}
                <div className="flex items-center justify-between gap-3 border-b border-slate-800 bg-slate-950/50 px-5 py-3">
                  <div className="flex items-center gap-2.5">
                    <CrankcaseMark className="h-5 w-5" />
                    <span className="text-xs font-extrabold uppercase tracking-[0.18em] text-slate-300" style={display}>
                      What a guide looks like
                    </span>
                  </div>
                  <span className="rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2 py-0.5 text-xs font-medium text-emerald-300">
                    {guide.tier === "free" ? "Free guide" : "Guide"}
                  </span>
                </div>

                <div className="p-5 sm:p-6">
                  <Stamp>
                    {vehicle.year} {vehicle.make} {vehicle.model} · {vehicle.engine}
                  </Stamp>
                  <div className="mt-2 text-2xl font-extrabold uppercase leading-tight text-slate-50" style={display}>
                    {guide.title}
                  </div>
                  <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5 text-sm text-slate-300">
                    <span className="flex items-center gap-1.5">
                      <IconGauge className="h-4 w-4 text-slate-500" />
                      <span className="text-slate-500">Difficulty</span> {guide.difficulty}
                    </span>
                    <span className="flex items-center gap-1.5">
                      <IconClock className="h-4 w-4 text-slate-500" />
                      <span className="text-slate-500">Time</span> {guide.estTime}
                    </span>
                    <span className="flex items-center gap-1.5">
                      <IconSteps className="h-4 w-4 text-slate-500" />
                      <span className="text-slate-500">Steps</span> {guide.steps.length}
                    </span>
                  </div>

                  {/* what's in the guide, as a spec strip */}
                  <ul className="-mx-5 mt-5 grid grid-cols-2 border-y border-slate-800 sm:-mx-6 sm:grid-cols-4">
                    {[
                      ["Tools", guide.tools.length, <IconWrench key="t" className="h-4 w-4" />],
                      ["Parts", guide.parts?.length ?? 0, <IconBox key="p" className="h-4 w-4" />],
                      ["Safety notes", guide.safety.length, <IconShield key="s" className="h-4 w-4" />],
                      ["Torque figures", guide.torqueSpecs?.length ?? 0, <IconHex key="q" className="h-4 w-4" />],
                    ].map(([label, n, icon], i) => (
                      <li
                        key={String(label)}
                        className={`flex items-center gap-3 px-5 py-3 sm:px-4 ${
                          i % 2 === 1 ? "border-l border-slate-800" : ""
                        } ${i >= 2 ? "border-t border-slate-800 sm:border-t-0" : ""} ${
                          i > 0 ? "sm:border-l" : ""
                        }`}
                      >
                        <span className="text-slate-500">{icon}</span>
                        <div>
                          <div className="font-mono text-lg font-semibold leading-none text-slate-100">{n}</div>
                          <div className="mt-1 text-xs text-slate-500">{label}</div>
                        </div>
                      </li>
                    ))}
                  </ul>

                  {/* the proof point */}
                  {guide.torqueSpecs && guide.torqueSpecs.length > 0 && (
                    <div className="cg-well mt-5 rounded-lg border-l-2 border-l-orange-500 p-4">
                      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                        <span className="text-xs font-extrabold uppercase tracking-[0.18em] text-slate-200" style={display}>
                          Torque specs
                        </span>
                        <Stamp className="text-orange-400">This vehicle — not an average</Stamp>
                      </div>
                      <ul className="mt-3 space-y-2">
                        {guide.torqueSpecs.slice(0, 2).map((t) => (
                          <li key={t.fastener} className="flex items-baseline gap-2 text-sm">
                            <IconHex className="h-3.5 w-3.5 shrink-0 self-center text-slate-500" />
                            <span className="text-slate-300">{t.fastener}</span>
                            <span className="mb-1 min-w-4 flex-1 border-b border-dotted border-slate-700" aria-hidden />
                            <span className="shrink-0 font-mono font-semibold text-orange-300">{t.value}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* step indicator */}
                  {guide.steps[0] && (
                    <div className="cg-well mt-4 rounded-lg p-3.5">
                      <div className="flex items-center justify-between gap-3">
                        <Stamp>Step 1 of {guide.steps.length}</Stamp>
                        <div className="flex flex-1 justify-end gap-1" aria-hidden>
                          {guide.steps.slice(0, 12).map((s, i) => (
                            <span
                              key={s.number}
                              className={`h-1 w-3 rounded-sm ${i === 0 ? "bg-orange-500" : "bg-slate-800"}`}
                            />
                          ))}
                        </div>
                      </div>
                      <div className="mt-2 font-medium text-slate-200">{guide.steps[0].title}</div>
                    </div>
                  )}

                  <p className="mt-4 text-xs text-slate-500">
                    Pulled live from this vehicle&apos;s actual guide. Every vehicle in the catalog gets
                    its own figures.
                  </p>
                </div>
              </div>
            </aside>
          )}
        </div>

        {/* ---- proof strip: real counts, derived from the catalog. Reads as a
            spec plate along the bottom of the bay. */}
        <div className="cg-seam relative border-b border-slate-800 bg-slate-900/60">
          <div className="mx-auto grid max-w-6xl grid-cols-2 divide-x divide-slate-800 px-4 sm:grid-cols-4">
            <div className="py-4 pr-4 sm:pr-6">
              <div className="font-mono text-xl font-semibold text-slate-100">{vehicles.length}</div>
              <div className="mt-1 text-xs text-slate-400">vehicles in the catalog</div>
            </div>
            <div className="py-4 pl-4 sm:px-6">
              <div className="font-mono text-xl font-semibold text-slate-100">{guides.length}</div>
              <div className="mt-1 text-xs text-slate-400">step-by-step guides</div>
            </div>
            <div className="border-t border-slate-800 py-4 pr-4 sm:border-t-0 sm:px-6">
              <div className="font-mono text-xl font-semibold text-slate-100">ft-lb + Nm</div>
              <div className="mt-1 text-xs text-slate-400">torque on every fastener</div>
            </div>
            <div className="border-t border-slate-800 py-4 pl-4 sm:border-t-0 sm:pl-6">
              <div className="font-mono text-xl font-semibold text-slate-100">Free</div>
              <div className="mt-1 text-xs text-slate-400">to start — no card to look around</div>
            </div>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------ jobs covered:
          the service board on the wall of the bay */}
      <section className="relative border-b border-slate-800">
        <div
          aria-hidden
          className="cg-grid pointer-events-none absolute inset-0 [mask-image:linear-gradient(to_right,transparent,rgba(0,0,0,0.9)_45%)]"
        />
        <div className="relative mx-auto grid max-w-6xl gap-10 px-4 py-14 sm:py-16 lg:grid-cols-[1fr_1.2fr] lg:gap-14">
          <div>
            <Eyebrow>The jobs you can actually do in a driveway</Eyebrow>
            <h2 className="mt-3 max-w-xl text-3xl font-extrabold uppercase leading-tight text-slate-50 sm:text-4xl" style={display}>
              Routine maintenance, done properly. That&apos;s the whole product.
            </h2>
            <div className="mt-6 flex max-w-xl items-start gap-3 border-l-2 border-slate-600 pl-4 text-sm text-slate-400">
              <p>
                Engine, transmission and other major repair work is not what this is for, and we say
                so on the page instead of letting you find out halfway through. For those, see a
                professional mechanic.
              </p>
            </div>
          </div>

          <div className="cg-panel rounded-xl">
            <div className="flex items-center justify-between border-b border-slate-800 px-5 py-3">
              <Stamp>Service board · routine maintenance</Stamp>
              <Stamp>{jobs.length} job types</Stamp>
            </div>
            <ul className="flex flex-wrap gap-2 p-5">
              {jobs.map((id) => (
                <li
                  key={id}
                  className="flex items-center gap-2 rounded-md border border-slate-700/80 bg-slate-950/60 px-3 py-1.5 text-sm text-slate-200"
                >
                  <span className="h-1.5 w-1.5 rounded-sm bg-slate-500" aria-hidden />
                  {JOB_LABELS[id]}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------ reassurance:
          open layout on a brushed graphite band, not three more boxes */}
      <section className="cg-brushed border-b border-slate-800 bg-gradient-to-b from-slate-900/50 to-slate-950">
        <div className="mx-auto max-w-6xl px-4 py-14 sm:py-16">
          <Eyebrow>Built for first-timers. Written like a service manual.</Eyebrow>
          <div className="mt-8 grid gap-8 md:grid-cols-3 md:gap-10">
            {[
              {
                icon: <IconClipboardCheck className="h-5 w-5" />,
                title: "You know what you need before you start",
                body: "Every guide opens with the full tools list, the parts and fluids with quantities, how hard it is, and how long it takes. No mid-job trips to the parts store.",
              },
              {
                icon: <IconTarget className="h-5 w-5" />,
                title: "The numbers are for your car",
                body: "Torque specs, fluid capacities and part fitment are per vehicle, never inherited from a lookalike. Where a figure comes from a sourced dataset, the guide says so.",
              },
              {
                icon: <IconShield className="h-5 w-5" />,
                title: "The dangerous parts are called out",
                body: "Jack stands, hot oil, plastic housings that crack when over-tightened — the safety notes sit at the top of the guide and again on the step where they matter.",
              },
            ].map((c) => (
              <div key={c.title} className="border-t border-slate-700/80 pt-5">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-slate-700 bg-slate-900/60 text-slate-200">
                  {c.icon}
                </div>
                <h3 className="mt-4 text-xl font-extrabold uppercase leading-tight text-slate-50" style={display}>
                  {c.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-400">{c.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------ closing CTA */}
      <section className="mx-auto max-w-6xl px-4 py-14 sm:py-20">
        <div className="cg-panel relative overflow-hidden rounded-2xl p-8 sm:p-10">
          <div className="cg-grid absolute inset-0 opacity-60 [mask-image:linear-gradient(to_left,rgba(0,0,0,0.8),transparent_70%)]" aria-hidden />
          <div className="absolute -right-16 -top-24 h-64 w-64 rounded-full bg-orange-500/[0.08] blur-3xl" aria-hidden />
          <div className="relative flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
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
                className="rounded-lg bg-orange-500 px-6 py-3 font-semibold text-slate-950 shadow-lg shadow-black/40 hover:bg-orange-400"
              >
                Get started free
              </Link>
              <Link
                href="/pricing"
                className="rounded-lg border border-slate-600 bg-slate-950/40 px-6 py-3 font-semibold text-slate-200 hover:border-slate-400"
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
