import Link from "next/link";
import type { Metadata } from "next";
import { allRepairs, findRepair, findVehicle, listVehicles } from "@/lib/data";
import { JOB_LABELS } from "@/lib/admin/coverage";
import type { JobTypeId } from "@/types/vehicle";
import { CinematicScene } from "@/components/marketing/Cinematic";
import {
  IconArrowRight,
  IconBolt,
  IconBox,
  IconCar,
  IconClipboardCheck,
  IconClock,
  IconGauge,
  IconHex,
  IconPlay,
  IconSteps,
  IconWrench,
  VehicleLinework,
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
//   value strip   three plain numbers
//   guides        routine maintenance, as a quiet list of jobs
//   close         one more way in
//
// The preview card is NOT a mockup: it is rendered from a real guide in
// src/data, so every number on it is one the site publishes for that vehicle.
// The stats are counted from the catalog at request time; none is hand-typed.
//
// Orange is spent on the primary CTA, the middle headline line, the step
// numbers, the eyebrow and one highlighted job chip. Nothing else.
//
// The hero has no photograph (HERO_IMAGE in HomeVisuals.tsx is still null --
// no licensed asset exists). Cinematic.tsx builds the bay out of light
// instead; a photo can replace it without touching this file.
// ---------------------------------------------------------------------------

// The guide the hero previews. The Jeep is the original demo vehicle and its
// free oil-change guide carries real, sourced figures.
const PREVIEW_GUIDE_ID = "jeep-grand-cherokee-oil-change";

const display = { fontFamily: "var(--font-display)" } as const;

// One focus ring for every link that looks like a button.
const FOCUS = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-400";
const BTN_PRIMARY = `rounded-lg bg-orange-500 px-6 py-3.5 font-semibold text-slate-950 shadow-lg shadow-black/50 hover:bg-orange-400 ${FOCUS}`;
const BTN_SECONDARY = `rounded-lg border border-slate-500/60 bg-slate-950/40 px-6 py-3.5 font-semibold text-slate-100 backdrop-blur-sm hover:border-slate-300 hover:text-white ${FOCUS}`;

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

// Order the jobs the way a beginner's mental list runs.
const JOB_ORDER: JobTypeId[] = [
  "oil-change",
  "brake-pads-front",
  "battery",
  "tire-rotation",
  "coolant",
  "engine-air-filter",
  "cabin-air-filter",
  "wiper-blades",
];

export default function MarketingHome() {
  const guide = findRepair(PREVIEW_GUIDE_ID);
  const vehicle = guide ? findVehicle(guide.vehicleId) : undefined;

  const guides = allRepairs();
  const withGuides = new Set(guides.map((g) => g.jobType));
  const jobs = JOB_ORDER.filter((id) => withGuides.has(id)).slice(0, 6);

  const steps = [
    { n: "1", icon: <IconCar className="h-7 w-7" />, title: "Your exact vehicle", body: "Year, make, model, engine." },
    { n: "2", icon: <IconWrench className="h-7 w-7" />, title: "Pick the job", body: "Maintenance, repair or upgrade." },
    { n: "3", icon: <IconClipboardCheck className="h-7 w-7" />, title: "Do it right", body: "Tools, parts, fluids, torque specs." },
  ];

  // Counted from the catalog, never typed in.
  const stats = [
    { icon: <IconCar className="h-8 w-8" />, value: String(listVehicles().length), label: "vehicles in the catalog" },
    { icon: <IconClipboardCheck className="h-8 w-8" />, value: String(guides.length), label: "step-by-step guides" },
    { icon: <IconBolt className="h-8 w-8" />, value: "No fluff", label: "just the right info" },
  ];

  return (
    <>
      {/* ------------------------------------------------------------ hero */}
      <section className="relative isolate overflow-hidden">
        <CinematicScene />
        <div className="relative mx-auto grid max-w-6xl items-center gap-10 px-4 pb-14 pt-12 sm:pt-16 lg:min-h-[35rem] lg:grid-cols-[minmax(0,1fr)_22rem] lg:gap-12 lg:pb-20 lg:pt-14">
          <div>
            <Eyebrow>Your ride. Your garage.</Eyebrow>
            <h1
              className="mt-4 text-[3.35rem] font-extrabold uppercase leading-[0.9] tracking-tight text-slate-50 sm:text-7xl lg:text-[5.25rem]"
              style={display}
            >
              Fix your own car.
              <span className="block text-orange-500">Right numbers.</span>
              <span className="block">Right order.</span>
            </h1>
            <p className="mt-6 max-w-lg text-base leading-relaxed text-slate-200 sm:text-lg">
              Tell Crankcase your year, make, model and engine. Get the exact tools, parts, fluids and
              torque specs for that job — in the right order.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
              <Link href="/signup" className={`${BTN_PRIMARY} inline-flex items-center justify-center gap-3 text-base`}>
                <IconCar className="h-5 w-5" />
                Add your vehicle — free
                <IconArrowRight className="h-4 w-4" />
              </Link>
              <Link href="/how-it-works" className={`${BTN_SECONDARY} inline-flex items-center justify-center gap-3 text-base`}>
                <IconPlay className="h-5 w-5 text-orange-400" />
                See how it works
              </Link>
            </div>
            <p className="mt-4 text-sm text-slate-400">
              Specs and fluid capacities are always free.{" "}
              <Link href="/login" className={`text-slate-200 underline-offset-4 hover:text-white hover:underline ${FOCUS}`}>
                Already have a garage? Log in.
              </Link>
            </p>
          </div>

          {/* the one product card, rendered from the real guide */}
          {guide && vehicle && (
            <aside
              aria-label={`Example guide: ${guide.title} for the ${vehicle.year} ${vehicle.make} ${vehicle.model}`}
              className="relative w-full max-w-sm justify-self-start lg:justify-self-end"
            >
              <div className="overflow-hidden rounded-2xl border border-white/10 bg-slate-950/70 shadow-[0_40px_80px_-30px_rgba(0,0,0,0.95)] backdrop-blur-md">
                {/* the vehicle, lit: stands in for the photo in the mockup */}
                <div className="relative h-36 overflow-hidden bg-[radial-gradient(90%_110%_at_60%_0%,#2a3445_0%,#111826_55%,#0a0f18_100%)]">
                  <div className="absolute -right-6 top-0 h-px w-40 bg-orange-100/80 shadow-[0_0_18px_4px_rgba(253,186,116,0.4)]" />
                  <VehicleLinework tonal className="absolute -bottom-3 left-1/2 w-[19rem] max-w-none -translate-x-1/2 text-slate-200 opacity-90" />
                </div>
                <div className="flex items-start justify-between gap-3 px-5 pt-4">
                  <div>
                    <div className="text-lg font-semibold leading-tight text-slate-50">
                      {vehicle.year} {vehicle.make} {vehicle.model}
                    </div>
                    <div className="mt-1 text-sm text-slate-400">{vehicle.engine}</div>
                  </div>
                  <IconArrowRight className="mt-1.5 h-5 w-5 shrink-0 text-slate-300" />
                </div>
                <dl className="mt-4 grid grid-cols-3 gap-x-3 border-t border-white/10 px-5 pb-1 pt-4 text-sm">
                  {[
                    [<IconGauge key="d" className="h-5 w-5" />, "Difficulty", guide.difficulty],
                    [<IconClock key="t" className="h-5 w-5" />, "Time", guide.estTime],
                    [<IconSteps key="s" className="h-5 w-5" />, "Steps", String(guide.steps.length)],
                  ].map(([icon, k, v]) => (
                    <div key={String(k)}>
                      <dt className="flex items-center gap-1.5 text-xs text-slate-400">
                        <span className="text-slate-300">{icon}</span>
                        {k}
                      </dt>
                      <dd className="mt-1 font-semibold text-slate-50">{v}</dd>
                    </div>
                  ))}
                </dl>
                <dl className="mt-3 grid grid-cols-2 gap-x-3 border-t border-white/10 px-5 pb-5 pt-4 text-sm">
                  <div>
                    <dt className="flex items-center gap-1.5 text-xs text-slate-400">
                      <IconBox className="h-5 w-5 text-slate-300" /> Tools
                    </dt>
                    <dd className="mt-1 font-semibold text-slate-50">{guide.tools.length}</dd>
                  </div>
                  <div>
                    <dt className="flex items-center gap-1.5 text-xs text-slate-400">
                      <IconHex className="h-5 w-5 text-slate-300" /> Torque specs
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
      <section className="border-y border-white/[0.07] bg-[#070b12]">
        <ol className="mx-auto grid max-w-6xl px-4 sm:grid-cols-3">
          {steps.map((s, i) => (
            <li
              key={s.n}
              className="relative flex items-center gap-4 border-b border-white/[0.06] py-5 last:border-b-0 sm:border-b-0 sm:px-6 sm:first:pl-0 sm:last:pr-0"
            >
              <StepNumber n={s.n} />
              <span className="hidden shrink-0 text-slate-200 sm:block" aria-hidden>
                {s.icon}
              </span>
              <div className="min-w-0">
                <div className="text-lg font-semibold leading-tight text-slate-50">{s.title}</div>
                <p className="mt-0.5 text-sm text-slate-400">{s.body}</p>
              </div>
              {i < steps.length - 1 && (
                <span className="absolute right-0 top-1/2 hidden -translate-y-1/2 text-slate-600 sm:block" aria-hidden>
                  ›
                </span>
              )}
            </li>
          ))}
        </ol>
      </section>

      {/* ------------------------------------------------------ value strip */}
      <section className="border-b border-white/[0.07] bg-[#090e16]" aria-label="Crankcase in numbers">
        <ul className="mx-auto grid max-w-6xl px-4 sm:grid-cols-3 sm:divide-x sm:divide-white/[0.07]">
          {stats.map((s) => (
            <li key={s.label} className="flex items-center justify-center gap-4 py-6 sm:px-6">
              <span className="text-slate-300" aria-hidden>
                {s.icon}
              </span>
              <div>
                <div className="text-2xl font-bold leading-none text-slate-50">{s.value}</div>
                <div className="mt-1 text-sm text-slate-400">{s.label}</div>
              </div>
            </li>
          ))}
        </ul>
      </section>

      {/* ------------------------------------------------------ popular guides */}
      <section className="relative isolate overflow-hidden bg-[#05080e]">
        <div aria-hidden className="absolute inset-0 -z-10">
          <div className="absolute inset-0 bg-[radial-gradient(60%_90%_at_88%_70%,rgba(251,146,60,0.10)_0%,transparent_60%)]" />
          <div className="absolute -bottom-24 right-[-6rem] h-72 w-[40rem] rounded-[100%] bg-orange-500/[0.07] blur-3xl" />
          <div className="absolute inset-0 bg-gradient-to-r from-[#05080e] via-[#05080e]/80 to-transparent" />
        </div>
        <div className="mx-auto grid max-w-6xl gap-10 px-4 py-16 sm:py-20 lg:grid-cols-[1fr_1.15fr] lg:items-center lg:gap-16">
          <div>
            <Eyebrow className="!text-slate-400 !tracking-[0.18em]">Popular guides</Eyebrow>
            <h2 className="mt-3 text-4xl font-extrabold leading-[0.98] text-slate-50 sm:text-5xl" style={display}>
              Routine maintenance, done properly.
            </h2>
            <p className="mt-4 max-w-sm text-base text-slate-400">
              Simple, step-by-step guides for the jobs that keep your vehicle running its best.
            </p>
            <p className="mt-6 max-w-sm border-l-2 border-slate-700 pl-4 text-sm text-slate-500">
              Engine, transmission and other major repair work is not what this is for. For those, see a
              professional mechanic.
            </p>
          </div>
          <ul className="flex flex-wrap gap-3">
            {jobs.map((id, i) => (
              <li
                key={id}
                className={`rounded-full border px-5 py-2.5 text-[0.95rem] text-slate-100 ${
                  i === 0 ? "border-orange-500/70 bg-orange-500/10" : "border-white/15 bg-slate-950/60"
                }`}
              >
                {JOB_LABELS[id]}
              </li>
            ))}
          </ul>
        </div>
      </section>

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
