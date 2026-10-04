import Link from "next/link";
import { existsSync } from "node:fs";
import path from "node:path";
import type { Metadata } from "next";
import { allRepairs, findRepair, findVehicle } from "@/lib/data";
import { JOB_LABELS } from "@/lib/admin/coverage";
import type { JobTypeId } from "@/types/vehicle";
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
          the same garage, hood up. Copy and chips stay in the dark left; the
          car and the drain pan own the right. */}
      <section className="relative isolate overflow-hidden">
        <div className="max-lg:hidden">
          {hasPhoto("guides-oil.jpg") ? (
            <PhotoScene src="/images/home/guides-oil.jpg" fit="right" />
          ) : (
            <CinematicScene variant="page" />
          )}
        </div>
        <div className="lg:hidden">
          <CinematicScene variant="page" />
        </div>
        <div className="mx-auto max-w-6xl px-4 pt-16 sm:pt-20 lg:flex lg:min-h-[40rem] lg:items-center lg:py-24">
          <div className="max-w-md">
            <Eyebrow className="!text-slate-300 !tracking-[0.18em]">Popular guides</Eyebrow>
            <h2 className="mt-3 text-4xl font-extrabold leading-[0.98] text-slate-50 [text-shadow:0_4px_24px_rgba(0,0,0,0.7)] sm:text-5xl" style={display}>
              Routine maintenance, done properly.
            </h2>
            <p className="mt-4 text-base text-slate-200 [text-shadow:0_2px_14px_rgba(0,0,0,0.9)]">
              Simple, step-by-step guides for the jobs that keep your vehicle running its best.
            </p>
            <ul className="mt-7 flex flex-wrap gap-2.5">
              {jobs.map((id, i) => (
                <li
                  key={id}
                  className={`rounded-full border px-4 py-2 text-[0.92rem] text-slate-50 backdrop-blur-md ${
                    i === 0 ? "border-orange-500/80 bg-orange-500/15" : "border-white/20 bg-[#080d15]/65"
                  }`}
                >
                  {JOB_LABELS[id]}
                </li>
              ))}
            </ul>
            <p className="mt-7 border-l-2 border-white/20 pl-4 text-sm text-slate-300 [text-shadow:0_2px_12px_rgba(0,0,0,0.9)]">
              Start with the jobs that keep your vehicle running right. More repair coverage is coming.
            </p>
          </div>
        </div>
        {hasPhoto("guides-oil.jpg") && (
          <div className="relative mt-10 h-72 overflow-hidden sm:h-96 lg:hidden">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/images/home/guides-oil.jpg" alt="" className="h-full w-full object-cover [object-position:50%_92%]" />
            <div aria-hidden className="absolute inset-0 bg-gradient-to-b from-[#05080e] via-transparent via-[30%] to-[#05080e]" />
          </div>
        )}
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
