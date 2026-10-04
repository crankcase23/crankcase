import Link from "next/link";
import { existsSync } from "node:fs";
import path from "node:path";
import type { Metadata } from "next";
import { allRepairs, findRepair, findVehicle } from "@/lib/data";
import type { JobTypeId, Vehicle } from "@/types/vehicle";
import CrankcaseMark from "@/components/CrankcaseMark";
import { CinematicScene, PhotoScene } from "@/components/marketing/Cinematic";
import {
  IconArrowRight,
  IconBox,
  IconCar,
  IconClipboardCheck,
  IconClock,
  IconGauge,
  IconHex,
  IconPlay,
  IconSteps,
  IconWrench,
  Stamp,
} from "@/components/marketing/HomeVisuals";

export const metadata: Metadata = {
  title: "Crankcase Garage — DIY Maintenance Guides for Your Exact Vehicle",
  description:
    "Tell Crankcase your year, make, model and engine, pick the job, and get the tools, parts, fluids, safety notes and torque specs for that exact vehicle — then a step-by-step walkthrough. Free to start.",
};

// ---------------------------------------------------------------------------
// Homepage -- visual correction pass against the approved "Website Theme 1"
// mockup. One job per section, nothing competing with it:
//
//   hero          one headline, one paragraph, two CTAs, one preview card
//   steps         vehicle -> job -> do it right
//   guides        routine maintenance, as a quiet list of jobs
//   close         one more way in
//
// The preview card is NOT a mockup: it is rendered from a real guide in
// src/data, so every number on it is one the site publishes for that vehicle.
//
// Orange is spent on the primary CTA, the middle headline line, the step
// numbers, the eyebrow and one highlighted job chip. Nothing else.
//
// The hero has no photograph (HERO_IMAGE in HomeVisuals.tsx is still null --
// no licensed asset exists). Cinematic.tsx builds the bay out of light
// instead; a photo can replace it without touching this file.
// ---------------------------------------------------------------------------

// The guide the hero previews. The 2021 Accord is the everyday-car demo and its
// free oil-change guide carries real, sourced figures.
const PREVIEW_GUIDE_ID = "honda-accord-oil-change";

// The three photographs live in public/images/home/ (hero-garage.jpg,
// card-vehicle.jpg, guides-oil.jpg). Until a photo is there, its slot falls back
// to the lit-room scene (no drawn vehicle) instead of showing a broken image.
const hasPhoto = (name: string) => existsSync(path.join(process.cwd(), "public", "images", "home", name));

const display = { fontFamily: "var(--font-display)" } as const;

// One focus ring for every link that looks like a button.
const FOCUS = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-400";
const BTN_PRIMARY = `rounded-lg bg-orange-500 px-6 py-3.5 font-semibold text-slate-950 shadow-lg shadow-black/50 hover:bg-orange-400 ${FOCUS}`;
const BTN_SECONDARY = `rounded-lg border border-slate-500/60 bg-slate-950/40 px-6 py-3.5 font-semibold text-slate-100 backdrop-blur-sm hover:border-slate-300 hover:text-white ${FOCUS}`;

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

function Eyebrow({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <p className={`text-[0.8rem] font-extrabold uppercase tracking-[0.2em] text-orange-400 ${className}`} style={display}>
      {children}
    </p>
  );
}

function StepNumber({ n }: { n: string }) {
  return (
    <div
      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-orange-500 font-sans text-base font-extrabold text-slate-950"
      aria-hidden
    >
      {n}
    </div>
  );
}

const GUIDE_CARDS: { id: JobTypeId; title: string; line: string; photo: string; pos: string; icon: React.ReactNode }[] = [
  { id: "oil-change", title: "Oil change", line: "Oil, filter and drain plug torque, in order.", photo: "guides-oil.jpg", pos: "50% 55%", icon: <IconGauge className="h-14 w-14" /> },
  { id: "brake-pads-front", title: "Front brake pads", line: "Pads, hardware and caliper torque specs.", photo: "guide-brakes.jpg", pos: "50% 60%", icon: <IconSteps className="h-14 w-14" /> },
  { id: "engine-air-filter", title: "Engine air filter", line: "A quick swap, with the right filter for your engine.", photo: "guide-air-filter.jpg", pos: "55% 50%", icon: <IconBox className="h-14 w-14" /> },
];

export default function MarketingHome() {
  const guide = findRepair(PREVIEW_GUIDE_ID);
  const vehicle = guide ? findVehicle(guide.vehicleId) : undefined;
  const dataRows = vehicle ? buildDataRows(vehicle) : [];

  const guides = allRepairs();
  const withGuides = new Set(guides.map((g) => g.jobType));
  // Cards are limited to jobs the catalog really has guides for.
  const guideCards = GUIDE_CARDS.filter((c) => withGuides.has(c.id));

  const steps = [
    { n: "1", icon: <IconCar className="h-7 w-7" />, title: "Your exact vehicle", body: "Year, make, model, engine." },
    { n: "2", icon: <IconWrench className="h-7 w-7" />, title: "Pick the job", body: "Maintenance, repair or upgrade." },
    { n: "3", icon: <IconClipboardCheck className="h-7 w-7" />, title: "Do it right", body: "Tools, parts, fluids, torque specs." },
  ];

  return (
    <>
      {/* ------------------------------------------------------------ hero:
          the photograph carries the brand; the type sits on it */}
      <section className="relative isolate overflow-hidden">
        {/* desktop: the photo is the stage. mobile: a dark room behind the copy,
            the photo gets its own band below it (see the strip after the copy) */}
        <div className="max-lg:hidden">
          {hasPhoto("hero-garage.jpg") ? (
            <PhotoScene src="/images/home/hero-garage.jpg" position="50% 55%" shift="5%" />
          ) : (
            <CinematicScene variant="page" />
          )}
        </div>
        <div className="lg:hidden">
          <CinematicScene variant="page" />
        </div>

        <div className="relative mx-auto grid max-w-6xl items-center gap-x-6 gap-y-0 px-4 pt-14 sm:pt-20 lg:min-h-[41rem] lg:grid-cols-[minmax(0,1fr)_17.5rem] lg:pb-16 lg:pt-12">
          <div className="max-lg:pt-2">
            <Eyebrow>Your ride. Your garage.</Eyebrow>
            <h1
              className="mt-4 text-[3.5rem] font-extrabold uppercase leading-[0.88] tracking-tight text-slate-50 [text-shadow:0_4px_30px_rgba(0,0,0,0.6)] sm:text-[5rem] lg:text-[5.5rem]"
              style={display}
            >
              Fix your own car.
              <span className="block text-orange-500">Right numbers.</span>
              <span className="block">Right order.</span>
            </h1>
            <p className="mt-6 max-w-md text-base leading-relaxed text-slate-100 [text-shadow:0_2px_16px_rgba(0,0,0,0.8)] sm:text-lg">
              Tell Crankcase your year, make, model and engine. Get the exact tools, parts, fluids and
              torque specs for that job — in the right order.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
              <Link href="/signup" className={`${BTN_PRIMARY} inline-flex items-center justify-center gap-3 text-[1.05rem]`}>
                <IconCar className="h-5 w-5" />
                Add your vehicle — free
                <IconArrowRight className="h-4 w-4" />
              </Link>
              <Link href="/how-it-works" className={`${BTN_SECONDARY} inline-flex items-center justify-center gap-3 text-[1.05rem]`}>
                <IconPlay className="h-5 w-5 text-orange-400" />
                See how it works
              </Link>
            </div>
            <p className="mt-4 text-sm text-slate-300 [text-shadow:0_2px_12px_rgba(0,0,0,0.9)]">
              Specs and fluid capacities are always free.{" "}
              <Link href="/login" className={`text-slate-100 underline-offset-4 hover:text-white hover:underline ${FOCUS}`}>
                Already have a garage? Log in.
              </Link>
            </p>
          </div>

          {/* mobile only: the garage photo, full bleed, car centred. The card
              below tucks up into its lower edge. */}
          {hasPhoto("hero-garage.jpg") && (
            <div className="relative -mx-4 mt-8 h-64 overflow-hidden sm:h-80 lg:hidden">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/images/home/hero-garage.jpg" alt="" className="h-full w-full object-cover [object-position:92%_62%]" />
              <div aria-hidden className="absolute inset-0 bg-gradient-to-b from-[#05080e] via-transparent via-[28%] to-[#05080e]" />
            </div>
          )}

          {/* the one product card: a compact specs panel for a real guide. No
              photo of its own; the hero Accord is the only vehicle image. On
              desktop it hangs over the car's rear quarter so the face stays clear. */}
          {guide && vehicle && (
            <aside
              aria-label={`Example guide: ${guide.title} for the ${vehicle.year} ${vehicle.make} ${vehicle.model}`}
              className="relative w-full max-w-sm justify-self-center max-lg:-mt-10 max-lg:mb-12 lg:mt-52 lg:-mr-28 lg:justify-self-end"
            >
              <div className="overflow-hidden rounded-2xl border border-white/[0.14] bg-[#080d15]/48 shadow-[0_40px_80px_-30px_rgba(0,0,0,0.9),inset_0_1px_0_rgba(255,255,255,0.14)] backdrop-blur-xl">
                <div className="flex items-start justify-between gap-3 px-4 pt-5">
                  <div>
                    <div className="text-lg font-semibold leading-tight text-slate-50">
                      {vehicle.year} {vehicle.make} {vehicle.model}
                    </div>
                    <div className="mt-1 text-sm text-slate-400">{vehicle.engine}</div>
                  </div>
                  <IconArrowRight className="mt-1.5 h-5 w-5 shrink-0 text-slate-300" />
                </div>
                <dl className="mt-4 grid grid-cols-3 gap-x-2 border-t border-white/10 px-4 pb-1 pt-4 text-sm">
                  {[
                    [<IconGauge key="d" className="h-4 w-4" />, "Difficulty", guide.difficulty],
                    [<IconClock key="t" className="h-4 w-4" />, "Time", guide.estTime],
                    [<IconSteps key="s" className="h-4 w-4" />, "Steps", String(guide.steps.length)],
                  ].map(([icon, k, v]) => (
                    <div key={String(k)}>
                      <dt className="flex items-center gap-1 text-xs text-slate-400">
                        <span className="text-slate-200">{icon}</span>
                        {k}
                      </dt>
                      <dd className="mt-1 whitespace-nowrap font-semibold leading-tight text-slate-50">{v}</dd>
                    </div>
                  ))}
                </dl>
                <dl className="mt-3 grid grid-cols-2 gap-x-3 border-t border-white/10 px-4 pb-5 pt-4 text-sm">
                  <div>
                    <dt className="flex items-center gap-1.5 text-xs text-slate-400">
                      <IconBox className="h-4 w-4 text-slate-200" /> Tools
                    </dt>
                    <dd className="mt-1 font-semibold text-slate-50">{guide.tools.length}</dd>
                  </div>
                  <div>
                    <dt className="flex items-center gap-1.5 text-xs text-slate-400">
                      <IconHex className="h-4 w-4 text-slate-200" /> Torque specs
                    </dt>
                    <dd className="mt-1 font-semibold text-slate-50">
                      {guide.torqueSpecs && guide.torqueSpecs.length > 0 ? "Yes" : "None"}
                    </dd>
                  </div>
                </dl>
              </div>
            </aside>
          )}
        </div>
      </section>

      {/* ------------------------------------------------------ 3 steps */}
      <section className="cg-metal-band border-y border-black/60">
        <ol className="mx-auto grid max-w-6xl px-4 sm:grid-cols-3">
          {steps.map((s, i) => (
            <li
              key={s.n}
              className="relative flex items-center gap-4 border-b border-white/[0.06] py-4 last:border-b-0 sm:border-b-0 sm:px-6 sm:first:pl-0 sm:last:pr-0"
            >
              <StepNumber n={s.n} />
              <span className="hidden shrink-0 text-slate-50 sm:block" aria-hidden>
                {s.icon}
              </span>
              <div className="min-w-0">
                <div className="text-[1.1rem] font-semibold leading-tight text-slate-50">{s.title}</div>
                <p className="mt-0.5 text-sm text-slate-400">{s.body}</p>
              </div>
              {i < steps.length - 1 && (
                <span className="absolute right-0 top-1/2 hidden -translate-y-1/2 text-xl text-slate-500 sm:block" aria-hidden>
                  ›
                </span>
              )}
            </li>
          ))}
        </ol>
      </section>

      {/* ------------------------------------------------------ popular guides:
          "here is what I can actually do." Only jobs the catalog really has
          guides for. A card uses its photograph when the file exists and a
          dark workshop fallback when it does not. */}
      <section className="relative isolate overflow-hidden border-b border-black/60 bg-[#06090f]">
        <div aria-hidden className="absolute inset-0 -z-10 bg-[radial-gradient(70%_60%_at_85%_100%,rgba(251,146,60,0.10),transparent),radial-gradient(60%_50%_at_10%_0%,rgba(120,80,40,0.10),transparent)]" />
        <div className="mx-auto max-w-6xl px-4 py-14 sm:py-20">
          <div className="max-w-2xl">
            <Eyebrow className="!tracking-[0.2em]">Popular guides</Eyebrow>
            <h2 className="mt-3 text-4xl font-extrabold uppercase leading-[0.98] text-slate-50 sm:text-5xl" style={display}>
              Keep your ride <span className="text-orange-500">running strong.</span>
            </h2>
            <p className="mt-4 text-base text-slate-200 sm:text-lg">
              Start with the jobs that keep your vehicle running right. More repair coverage is coming.
            </p>
          </div>
          <ul className="mt-9 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {guideCards.map((g) => (
              <li
                key={g.id}
                className="group relative overflow-hidden rounded-xl border border-white/[0.1] bg-[#080d15]/70 shadow-[0_30px_60px_-34px_rgba(0,0,0,0.95),inset_0_1px_0_rgba(255,255,255,0.06)]"
              >
                <div className="relative h-56 overflow-hidden bg-[#0a0f18]">
                  {hasPhoto(g.photo) ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={`/images/home/${g.photo}`} alt="" className="h-full w-full object-cover" style={{ objectPosition: g.pos }} loading="lazy" />
                  ) : (
                    <div aria-hidden className="absolute inset-0 bg-[radial-gradient(90%_120%_at_70%_0%,#2a2118_0%,#120f0d_55%,#07090d_100%)]">
                      <div className="absolute inset-0 opacity-[0.07] [background:repeating-linear-gradient(90deg,#fff_0_1px,transparent_1px_5px)]" />
                      <div className="absolute inset-0 flex items-center justify-center text-orange-400/60">{g.icon}</div>
                    </div>
                  )}
                  <div aria-hidden className="absolute inset-0 bg-gradient-to-t from-[#080d15] via-[#080d15]/10 to-transparent" />
                </div>
                <div className="relative -mt-8 px-5 pb-5">
                  <h3 className="text-xl font-extrabold uppercase leading-tight text-slate-50" style={display}>
                    {g.title}
                  </h3>
                  <p className="mt-1 text-sm text-slate-300">{g.line}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ------------------------------------------------------ know your ride:
          the vehicle-data half of the product, restored from the live page and
          restyled to sit with the photo-driven homepage. Rendered from the
          demo vehicle's own catalog entry. */}
      {vehicle && dataRows.length > 0 && (
        <section className="relative border-t border-white/[0.07] bg-[#070b12]">
          <div className="mx-auto grid max-w-6xl gap-8 px-4 py-12 sm:gap-10 sm:py-16 lg:grid-cols-[1fr_1.25fr] lg:gap-14">
            <div>
              <Eyebrow>Know your ride</Eyebrow>
              <h2 className="mt-3 max-w-xl text-3xl font-extrabold uppercase leading-tight text-slate-50 sm:text-4xl" style={display}>
                All your vehicle data <span className="block text-orange-500">in one place.</span>
              </h2>
              <p className="mt-4 max-w-xl text-base leading-relaxed text-slate-300">
                Crankcase keeps the fluids, capacities, specs and maintenance information we support
                for your exact vehicle in one place — the numbers you would otherwise dig out of a
                manual, a forum and the underhood label.
              </p>

              <ul className="mt-7 grid max-w-xl grid-cols-3 gap-4 border-t border-white/[0.08] pt-6">
                {[
                  { icon: <IconClipboardCheck className="h-7 w-7" />, t: "Specifications", d: "Engine and drivetrain." },
                  { icon: <IconGauge className="h-7 w-7" />, t: "Fluid capacities", d: "Oil, coolant, brake fluid." },
                  { icon: <IconHex className="h-7 w-7" />, t: "Torque specs", d: "For the fasteners that matter." },
                ].map((f) => (
                  <li key={f.t}>
                    <span className="text-orange-400" aria-hidden>{f.icon}</span>
                    <p className="mt-2 text-sm font-semibold text-slate-50">{f.t}</p>
                    <p className="mt-0.5 text-[0.8rem] leading-snug text-slate-400">{f.d}</p>
                  </li>
                ))}
              </ul>

              <div className="mt-6 flex flex-wrap items-center gap-3">
                <Link href="/signup" className={BTN_PRIMARY}>
                  Add your vehicle — free
                </Link>
                <span className="text-sm text-slate-400">Specs and fluid capacities are free for every vehicle.</span>
              </div>
            </div>

            {/* the data sheet */}
            <div className="relative overflow-hidden rounded-2xl border border-white/[0.1] bg-[#0a0f18]/80 shadow-[0_30px_60px_-30px_rgba(0,0,0,0.95),inset_0_1px_0_rgba(255,255,255,0.06)]" aria-label={`Vehicle data sheet: ${vehicle.year} ${vehicle.make} ${vehicle.model}`} role="region">
              <div className="flex flex-col gap-2 border-b border-white/[0.08] bg-black/20 px-5 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
                <div className="flex items-center gap-2.5">
                  <CrankcaseMark className="h-5 w-5" />
                  <Stamp className="whitespace-nowrap text-slate-300">Vehicle data sheet</Stamp>
                </div>
                <Stamp className="whitespace-nowrap text-orange-400">One vehicle · its own numbers</Stamp>
              </div>

              {/* identity */}
              <div className="cg-grid-fine border-b border-white/[0.08] px-5 py-5 sm:px-6">
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
                    className={`px-5 py-4 sm:px-6 ${i > 0 ? "border-t border-white/[0.08]" : ""} ${
                      i === 1 ? "sm:border-t-0" : ""
                    } ${i % 2 === 1 ? "sm:border-l sm:border-l-white/[0.08]" : ""}`}
                  >
                    <dt className="cg-stamp">{r.label}</dt>
                    <dd className="mt-1.5 font-mono text-base font-semibold leading-snug text-slate-50 sm:text-[17px]">
                      {r.value}
                    </dd>
                    {r.sub && <dd className="mt-1 text-sm leading-snug text-slate-400">{r.sub}</dd>}
                  </div>
                ))}
              </dl>

              <div className="border-t border-white/[0.08] bg-black/20 px-5 py-3 text-xs text-slate-400 sm:px-6">
                Pulled live from this vehicle&apos;s catalog entry. The full sheet on the vehicle page
                adds every fluid, the tire sizes and the part-specific notes.
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ------------------------------------------------------ close */}
      <section className="border-t border-white/[0.07] bg-[#070b12]">
        <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-14 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-3xl font-extrabold uppercase leading-tight text-slate-50 sm:text-4xl" style={display}>
              Add your vehicle. It&apos;s free to look.
            </h2>
            <p className="mt-2 max-w-xl text-slate-400">
              Specs and fluid capacities for every vehicle, plus one full guide, cost nothing.
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
      </section>
    </>
  );
}
