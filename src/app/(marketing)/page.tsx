import Link from "next/link";
import type { Metadata } from "next";
import { allRepairs, findRepair, findVehicle, listVehicles } from "@/lib/data";
import { JOB_LABELS } from "@/lib/admin/coverage";
import type { JobTypeId, Vehicle } from "@/types/vehicle";
import CrankcaseMark from "@/components/CrankcaseMark";
import {
  DrawerTexture,
  HeroBackdrop,
  IconArrowRight,
  IconBolt,
  IconBox,
  IconCar,
  IconClipboard,
  IconClipboardCheck,
  IconClock,
  IconGauge,
  IconHex,
  IconPlay,
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

// ---------------------------------------------------------------------------
// "Know your ride" data sheet. Every row below is read from the demo vehicle's
// own catalog entry (specs[] by label, fluids[] by name). A row whose source
// field is missing is simply not rendered -- the sheet never shows a
// placeholder. These six were chosen because the catalog carries them for
// every vehicle (checked 2026-09-24: 49/49 for oil, coolant, brake fluid, fuel
// tank, octane, lug-nut torque; 48/49 for battery). Factory service intervals
// exist for three platforms only, so they are deliberately NOT advertised
// here -- see the vehicle page for those.
// ---------------------------------------------------------------------------
type DataRow = { label: string; value: string; sub?: string };

function buildDataRows(vehicle: Vehicle): DataRow[] {
  const spec = (label: string) => vehicle.specs.find((s) => s.label === label)?.value;
  const fluid = (name: string) => vehicle.fluids.find((f) => f.name === name);
  const oil = fluid("Engine Oil");
  const coolant = fluid("Engine Coolant");
  const brake = fluid("Brake Fluid");
  const rows: (DataRow | undefined)[] = [
    oil && { label: "Engine oil", value: oil.capacity, sub: oil.spec },
    coolant && { label: "Engine coolant", value: coolant.capacity, sub: coolant.spec },
    spec("Battery") ? { label: "Battery", value: spec("Battery")! } : undefined,
    spec("Wheel lug nut torque") ? { label: "Wheel lug nut torque", value: spec("Wheel lug nut torque")! } : undefined,
    brake && { label: "Brake fluid", value: brake.spec, sub: brake.capacity },
    spec("Fuel tank") ? { label: "Fuel", value: spec("Fuel tank")!, sub: spec("Recommended fuel") } : undefined,
  ];
  return rows.filter((r): r is DataRow => Boolean(r));
}

function Eyebrow({ children, as: Tag = "p" }: { children: React.ReactNode; as?: "p" | "h2" }) {
  return (
    <Tag className="flex items-center gap-3">
      <span className="h-px w-8 shrink-0 bg-orange-500" aria-hidden />
      <span className="text-xs font-extrabold uppercase tracking-[0.22em] text-orange-400" style={display}>
        {children}
      </span>
    </Tag>
  );
}

// One focus ring for every link that looks like a button. Keyboard users get
// the same orange the mouse users see on hover.
const FOCUS = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-400";
const BTN_PRIMARY = `rounded-lg bg-orange-500 px-6 py-3 font-semibold text-slate-950 shadow-lg shadow-black/40 hover:bg-orange-400 ${FOCUS}`;
const BTN_SECONDARY = `rounded-lg border border-slate-600 bg-slate-900/50 px-6 py-3 font-semibold text-slate-200 hover:border-slate-400 hover:text-white ${FOCUS}`;

/** The orange number square on the three-step rail. Decorative: the <ol> carries the order. */
function StepNumber({ n }: { n: string }) {
  return (
    <div
      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-orange-500 font-sans text-lg font-extrabold text-slate-950 shadow-md shadow-black/40"
      aria-hidden
    >
      {n}
    </div>
  );
}

export default function MarketingHome() {
  const guide = findRepair(PREVIEW_GUIDE_ID);
  const vehicle = guide ? findVehicle(guide.vehicleId) : undefined;

  const dataRows = vehicle ? buildDataRows(vehicle) : [];

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
    { n: "2", icon: <IconWrench className="h-6 w-6" />, title: "Pick the job", body: "Oil change, brakes, filters, wipers, fluids and more." },
    { n: "3", icon: <IconClipboardCheck className="h-6 w-6" />, title: "Do it right", body: "Tools, parts, torque specs, safety notes. Step by step." },
  ];

  return (
    <>
      {/* ------------------------------------------------------ first screen */}
      <section className="relative isolate overflow-hidden">
        {/* the scene: backdrop, headline, guide card. The steps rail and the
            proof strip are bands below it, so the floor ends where they begin. */}
        <div className="relative">
          <HeroBackdrop />

          <div className="relative mx-auto grid max-w-6xl gap-8 px-4 pt-9 pb-8 sm:gap-10 sm:pt-14 sm:pb-10 lg:grid-cols-[1.1fr_1fr] lg:items-end lg:gap-12 lg:pb-7 lg:pt-8">
          {/* ---- left: the pitch */}
          <div className="lg:self-center lg:pb-4">
            <Eyebrow>Your ride. Your garage. Your wrenches.</Eyebrow>

            <h1
              className="mt-3 text-[3.4rem] font-extrabold uppercase leading-[0.9] tracking-tight text-slate-50 sm:text-6xl lg:text-[4.5rem] 2xl:text-[5rem]"
              style={display}
            >
              Fix your own car.
              <span className="block text-orange-500">
                Right numbers,
                <br /> right order.
              </span>
            </h1>

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
              <Link href="/signup" className={`${BTN_PRIMARY} inline-flex items-center gap-2.5 text-base`}>
                <IconCar className="h-5 w-5" />
                Add your vehicle — free
                <IconArrowRight className="h-4 w-4" />
              </Link>
              <Link href="/how-it-works" className={`${BTN_SECONDARY} inline-flex items-center gap-2.5 text-base`}>
                <IconPlay className="h-5 w-5 text-orange-400" />
                See how it works
              </Link>
            </div>
            <p className="mt-3 text-sm text-slate-400">
              Specs and fluid capacities are always free. One free guide per vehicle.{" "}
              <Link href="/login" className={`text-slate-300 underline-offset-4 hover:text-white hover:underline ${FOCUS}`}>
                Already have a garage? Log in.
              </Link>
            </p>

          </div>

          {/* ---- right: a real guide, not a mockup. Laid out like a page from
              a service manual for this one vehicle. */}
          {guide && vehicle && (
            <aside
              aria-label={`Example guide: ${guide.title} for the ${vehicle.year} ${vehicle.make} ${vehicle.model}`}
              className="relative lg:max-w-[34rem] lg:justify-self-end"
            >
              {/* the card sits ON the floor: a contact shadow under it, and a
                  second sheet behind it */}
              <div aria-hidden className="absolute inset-x-8 -bottom-3 h-8 rounded-[100%] bg-black/70 blur-xl" />
              <div
                aria-hidden
                className="absolute inset-0 translate-x-3 translate-y-3 rounded-2xl border border-slate-700/60 bg-slate-950/70"
              />
              <div className="cg-panel relative overflow-hidden rounded-2xl shadow-[0_40px_60px_-30px_rgba(0,0,0,0.9)]">
                {/* header bar */}
                <div className="flex items-center justify-between gap-3 border-b border-slate-800 bg-slate-950/50 px-5 py-3">
                  <div className="flex items-center gap-2.5">
                    <CrankcaseMark className="h-5 w-5" />
                    <Stamp className="whitespace-nowrap text-slate-300">What a guide looks like</Stamp>
                  </div>
                  <span className="shrink-0 whitespace-nowrap rounded-full border border-slate-600 bg-slate-800/70 px-2.5 py-0.5 text-xs font-medium text-slate-200">
                    {guide.tier === "free" ? "Free guide" : "Guide"}
                  </span>
                </div>

                <div className="p-5">
                  <Stamp>
                    {vehicle.year} {vehicle.make} {vehicle.model} · {vehicle.engine}
                  </Stamp>
                  <div className="mt-2 text-2xl font-extrabold uppercase leading-tight text-slate-50" style={display}>
                    {guide.title}
                  </div>
                  <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5 text-sm text-slate-100">
                    <span className="flex items-center gap-1.5">
                      <IconGauge className="h-4 w-4 text-slate-500" />
                      <span className="text-slate-400">Difficulty</span> {guide.difficulty}
                    </span>
                    <span className="flex items-center gap-1.5">
                      <IconClock className="h-4 w-4 text-slate-500" />
                      <span className="text-slate-400">Time</span> {guide.estTime}
                    </span>
                    <span className="flex items-center gap-1.5">
                      <IconSteps className="h-4 w-4 text-slate-500" />
                      <span className="text-slate-400">Steps</span> {guide.steps.length}
                    </span>
                  </div>

                  {/* what's in the guide: four boxed tiles, icon on top */}
                  <ul className="mt-4 grid grid-cols-4 gap-2">
                    {[
                      ["Tools", guide.tools.length, <IconWrench key="t" className="h-5 w-5" />],
                      ["Parts", guide.parts?.length ?? 0, <IconBox key="p" className="h-5 w-5" />],
                      ["Safety notes", guide.safety.length, <IconShield key="s" className="h-5 w-5" />],
                      ["Torque figures", guide.torqueSpecs?.length ?? 0, <IconHex key="q" className="h-5 w-5" />],
                    ].map(([label, n, icon]) => (
                      <li key={String(label)} className="cg-well flex flex-col items-center rounded-lg px-1 py-2.5 text-center">
                        <span className="text-slate-200">{icon}</span>
                        <span className="mt-1.5 text-[11px] leading-tight text-slate-400">{label}</span>
                        <span className="mt-1 font-mono text-lg font-semibold leading-none text-slate-50">{n}</span>
                      </li>
                    ))}
                  </ul>

                  {/* the proof point */}
                  {guide.torqueSpecs && guide.torqueSpecs.length > 0 && (
                    <div className="cg-well mt-4 rounded-lg border-l-2 border-l-orange-500 p-4">
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
                    <div className="cg-well mt-3 flex items-center gap-3 rounded-lg p-3">
                      <div
                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-orange-500 font-sans text-sm font-extrabold text-slate-950"
                        aria-hidden
                      >
                        1
                      </div>
                      <div className="min-w-0 flex-1">
                        <Stamp>Step 1 of {guide.steps.length}</Stamp>
                        <div className="mt-1 font-medium leading-snug text-slate-200">{guide.steps[0].title}</div>
                      </div>
                      <span className="text-xl leading-none text-slate-500" aria-hidden>
                        ›
                      </span>
                    </div>
                  )}

                  <p className="mt-3 text-xs text-slate-400">
                    Pulled live from this vehicle&apos;s actual guide. Every vehicle in the catalog gets
                    its own figures.
                  </p>
                </div>
              </div>
            </aside>
          )}
          </div>
        </div>

        {/* ---- the three steps, still on the first screen, as a rail along
            the bottom of the bay: vehicle -> job -> wrench */}
        <div className="cg-seam relative border-b border-slate-800 bg-slate-950/95">
          <ol className="mx-auto grid max-w-6xl divide-y divide-slate-800 px-4 sm:grid-cols-3 sm:divide-x sm:divide-y-0">
            {steps.map((s) => (
              <li key={s.n} className="flex items-start gap-4 py-4 sm:px-5 sm:first:pl-0 sm:last:pr-0">
                <StepNumber n={s.n} />
                <span className="mt-2 hidden shrink-0 text-slate-300 sm:block" aria-hidden>
                  {s.icon}
                </span>
                <div className="min-w-0">
                  <div className="text-lg font-semibold leading-tight text-slate-50">{s.title}</div>
                  <p className="mt-1 text-sm text-slate-400">{s.body}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>

        {/* ---- proof strip: real counts, derived from the catalog. Reads as a
            spec plate along the bottom of the bay. */}
        <div className="relative border-b border-slate-800 bg-slate-900/60">
          <div className="mx-auto grid max-w-6xl grid-cols-2 divide-x divide-slate-800 px-4 sm:grid-cols-4">
            {[
              [<IconCar key="i" className="h-6 w-6" />, vehicles.length, "vehicles in the catalog"],
              [<IconClipboard key="i" className="h-6 w-6" />, guides.length, "step-by-step guides"],
              [<IconWrench key="i" className="h-6 w-6" />, "ft-lb + Nm", "torque on every fastener"],
              [<IconBolt key="i" className="h-6 w-6" />, "Free", "to start — no card to look around"],
            ].map(([icon, figure, label], i) => (
              <div
                key={String(label)}
                className={`flex items-center gap-3 py-4 ${i % 2 === 1 ? "pl-4 sm:pl-6" : "pr-4 sm:pr-6"} ${
                  i >= 2 ? "border-t border-slate-800 sm:border-t-0" : ""
                } ${i === 2 ? "sm:pl-6" : ""}`}
              >
                <span className="shrink-0 text-slate-300">{icon}</span>
                <div className="min-w-0">
                  <div className="font-mono text-xl font-semibold leading-none text-slate-100">{figure}</div>
                  <div className="mt-1 text-xs text-slate-400">{label}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------ jobs covered:
          the service board on the wall of the bay */}
      <section className="relative overflow-hidden border-b border-slate-800 bg-[radial-gradient(90%_100%_at_85%_50%,#0d1526_0%,#020617_70%)]">
        {/* the tool chest behind the service board */}
        <DrawerTexture className="pointer-events-none absolute inset-y-0 right-0 h-full w-[70%] text-slate-400 opacity-[0.11] [mask-image:linear-gradient(to_right,transparent,rgba(0,0,0,1)_40%)]" />
        <div className="relative mx-auto grid max-w-6xl gap-8 px-4 py-12 sm:gap-10 sm:py-16 lg:grid-cols-[1fr_1.2fr] lg:gap-14">
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

          <div className="cg-panel rounded-2xl">
            <div className="flex flex-col gap-2 border-b border-slate-800 bg-slate-950/50 px-5 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
              <Stamp className="whitespace-nowrap">Service board · routine maintenance</Stamp>
              <Stamp className="whitespace-nowrap">{jobs.length} job types</Stamp>
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

      {/* ------------------------------------------------------ know your ride:
          the other half of the product. Guides say HOW; this says WHAT. A
          digital under-hood data sheet, rendered from the demo vehicle's own
          catalog entry. */}
      {vehicle && dataRows.length > 0 && (
        <section className="relative border-b border-slate-800 bg-slate-950">
          <div className="mx-auto grid max-w-6xl gap-8 px-4 py-12 sm:gap-10 sm:py-16 lg:grid-cols-[1fr_1.25fr] lg:gap-14">
            <div>
              <Eyebrow>Know your ride</Eyebrow>
              <h2 className="mt-3 max-w-xl text-3xl font-extrabold uppercase leading-tight text-slate-50 sm:text-4xl" style={display}>
                Your vehicle isn&apos;t generic. Neither is its maintenance.
              </h2>
              <p className="mt-4 max-w-xl text-base leading-relaxed text-slate-300">
                Crankcase keeps the fluids, capacities, specs and maintenance information we support
                for your exact vehicle in one place — the numbers you would otherwise dig out of a
                manual, a forum and the underhood label.
              </p>

              <ul className="mt-6 max-w-xl divide-y divide-slate-800 border-y border-slate-800">
                <li className="flex items-start gap-3 py-3">
                  <IconHex className="mt-0.5 h-5 w-5 shrink-0 text-slate-400" />
                  <p className="text-sm text-slate-300">
                    <span className="font-extrabold uppercase tracking-wide text-slate-50" style={display}>
                      Vehicle data
                    </span>{" "}
                    tells you what it needs.
                  </p>
                </li>
                <li className="flex items-start gap-3 py-3">
                  <IconWrench className="mt-0.5 h-5 w-5 shrink-0 text-slate-400" />
                  <p className="text-sm text-slate-300">
                    <span className="font-extrabold uppercase tracking-wide text-slate-50" style={display}>
                      Guides
                    </span>{" "}
                    show you how to do it.
                  </p>
                </li>
              </ul>

              <div className="mt-6 flex flex-wrap items-center gap-3">
                <Link href="/signup" className={BTN_PRIMARY}>
                  Add your vehicle — free
                </Link>
                <span className="text-sm text-slate-400">Specs and fluid capacities are free for every vehicle.</span>
              </div>
            </div>

            {/* the data sheet */}
            <div className="cg-panel relative overflow-hidden rounded-2xl" aria-label={`Vehicle data sheet: ${vehicle.year} ${vehicle.make} ${vehicle.model}`} role="region">
              <div className="flex flex-col gap-2 border-b border-slate-800 bg-slate-950/50 px-5 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
                <div className="flex items-center gap-2.5">
                  <CrankcaseMark className="h-5 w-5" />
                  <Stamp className="whitespace-nowrap text-slate-300">Vehicle data sheet</Stamp>
                </div>
                <Stamp className="whitespace-nowrap text-orange-400">One vehicle · its own numbers</Stamp>
              </div>

              {/* identity */}
              <div className="cg-grid-fine border-b border-slate-800 px-5 py-5 sm:px-6">
                <Stamp>{vehicle.year} · {vehicle.make}</Stamp>
                <div className="mt-1.5 text-3xl font-extrabold uppercase leading-none text-slate-50 sm:text-4xl" style={display}>
                  {vehicle.model}
                  {vehicle.trim ? <span className="text-slate-400"> {vehicle.trim}</span> : null}
                </div>
                <p className="mt-3 text-sm leading-relaxed text-slate-300">
                  {vehicle.engine} · {vehicle.transmission} · {vehicle.drivetrain}
                </p>
              </div>

              {/* rows: one column on phones, two from sm up */}
              <dl className="grid sm:grid-cols-2">
                {dataRows.map((r, i) => (
                  <div
                    key={r.label}
                    className={`px-5 py-4 sm:px-6 ${i > 0 ? "border-t border-slate-800" : ""} ${
                      i === 1 ? "sm:border-t-0" : ""
                    } ${i % 2 === 1 ? "sm:border-l sm:border-l-slate-800" : ""}`}
                  >
                    <dt className="cg-stamp">{r.label}</dt>
                    <dd className="mt-1.5 font-mono text-base font-semibold leading-snug text-slate-50 sm:text-[17px]">
                      {r.value}
                    </dd>
                    {r.sub && <dd className="mt-1 text-sm leading-snug text-slate-400">{r.sub}</dd>}
                  </div>
                ))}
              </dl>

              <div className="border-t border-slate-800 bg-slate-950/40 px-5 py-3 text-xs text-slate-400 sm:px-6">
                Pulled live from this vehicle&apos;s catalog entry. The full sheet on the vehicle page
                adds every fluid, the tire sizes and the part-specific notes.
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ------------------------------------------------------ reassurance:
          open layout on a brushed graphite band, not three more boxes */}
      <section className="cg-brushed border-b border-slate-800 bg-gradient-to-b from-slate-900/50 to-slate-950">
        <div className="mx-auto max-w-6xl px-4 py-12 sm:py-16">
          <Eyebrow as="h2">Built for first-timers. Written like a service manual.</Eyebrow>
          <div className="mt-7 grid gap-6 sm:mt-8 sm:gap-8 md:grid-cols-3 md:gap-10">
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
      <section className="mx-auto max-w-6xl px-4 py-12 sm:py-20">
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
              <Link href="/signup" className={BTN_PRIMARY}>
                Get started free
              </Link>
              <Link href="/pricing" className={BTN_SECONDARY}>
                Pricing
              </Link>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
