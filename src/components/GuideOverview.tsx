"use client";

import { useMemo, useState } from "react";
import type { RefObject } from "react";
import Link from "next/link";
import type { ResolvedGuide, Vehicle } from "@/types/vehicle";
import { deriveOverview, difficultyLevel, vehicleTitle } from "@/lib/guideOverview";
import {
  ChevronRightIcon,
  ClockIcon,
  ExitIcon,
  LayersIcon,
  OrangeCheck,
  PlayIcon,
  WrenchIcon,
} from "@/components/GuideIcons";

export interface GuideSession {
  position: number;
  total: number;
  title: string;
  phaseName?: string;
}

export interface BreadcrumbItem {
  label: string;
  href?: string;
}

const DISPLAY = "font-[family-name:var(--font-display)]";

// In-page navigation. Each tab scrolls to a heading GuideBody already renders;
// no tab exists for a section the guide does not have.
const TABS: { key: string; label: (n: number) => string; heading: string | null }[] = [
  { key: "overview", label: () => "Overview", heading: null },
  { key: "tools", label: () => "Tools & Parts", heading: "Tools Needed" },
  { key: "safety", label: () => "Safety", heading: "Safety Notes" },
  { key: "torque", label: () => "Torque Specs", heading: "Torque Specs" },
  { key: "steps", label: (n) => `All Steps (${n})`, heading: "Step-by-Step" },
];

/**
 * The top of the Overall Guide: vehicle, what the job covers, the Wrench Mode
 * session card, and in-page section tabs. Presentation only; every value is
 * derived from the canonical guide/vehicle.
 */
export default function GuideOverview({
  guide,
  vehicle,
  breadcrumb,
  session,
  bodyRef,
  primaryRef,
  onStart,
  onResume,
  onExit,
}: {
  guide: ResolvedGuide;
  vehicle: Vehicle;
  breadcrumb?: BreadcrumbItem[];
  session: GuideSession | null;
  bodyRef: RefObject<HTMLDivElement | null>;
  primaryRef: RefObject<HTMLButtonElement | null>;
  onStart: () => void;
  onResume: () => void;
  onExit: () => void;
}) {
  const overview = useMemo(() => deriveOverview(guide), [guide]);
  const [showFull, setShowFull] = useState(false);
  const [tab, setTab] = useState("overview");
  const level = difficultyLevel(guide.difficulty);
  const multi = overview.jobs.length > 1;
  const pct = session ? Math.round((session.position / session.total) * 100) : 0;

  const crumbs: BreadcrumbItem[] = breadcrumb?.length
    ? [...breadcrumb, { label: multi ? "Multi-Service Repair" : "Repair guide" }]
    : [];

  function jump(key: string, heading: string | null) {
    setTab(key);
    if (!heading) {
      window.scrollTo({ top: 0 });
      return;
    }
    const h = Array.from(bodyRef.current?.querySelectorAll("h2") ?? []).find(
      (el) => el.textContent?.trim() === heading
    );
    h?.scrollIntoView({ block: "start" });
  }

  return (
    <div>
      {crumbs.length > 0 && (
        <nav aria-label="Breadcrumb" className="mb-4 flex flex-wrap items-center gap-1.5 text-sm text-slate-400">
          {crumbs.map((b, i) => (
            <span key={b.label} className="flex items-center gap-1.5">
              {i > 0 && <ChevronRightIcon className="h-3.5 w-3.5 text-slate-600" />}
              {b.href ? (
                <Link href={b.href} className="hover:text-white">
                  {b.label}
                </Link>
              ) : (
                <span className="text-slate-300">{b.label}</span>
              )}
            </span>
          ))}
        </nav>
      )}

      <section className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-[#1d2025] via-[#15181b] to-[#0f1113] shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_30px_60px_-30px_rgba(0,0,0,0.9)]">
        <div
          aria-hidden="true"
          className="cg-grid-fine pointer-events-none absolute inset-0 opacity-70 [mask-image:linear-gradient(100deg,black,transparent_75%)]"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-28 -top-28 h-80 w-80 rounded-full bg-orange-500/[0.07] blur-3xl"
        />

        <div className="relative grid gap-8 p-5 sm:p-8 lg:grid-cols-[minmax(0,1fr)_340px]">
          <div>
            <p className="flex items-center gap-2.5 text-sm font-bold uppercase tracking-[0.2em] text-slate-400">
              <span className="h-5 w-1 rounded-sm bg-orange-500" aria-hidden="true" />
              {multi ? "Multi-service repair" : "Repair guide"}
            </p>
            <h1 className="mt-3 text-4xl font-extrabold leading-[1.05] tracking-tight text-[#f5f3ee] sm:text-5xl">
              {vehicleTitle(vehicle)}
            </h1>
            <p className="mt-2 text-xl text-slate-300 sm:text-2xl">{vehicle.engine}</p>

            <dl className="mt-7 grid grid-cols-1 gap-5 sm:grid-cols-3 sm:gap-0 sm:divide-x sm:divide-white/10">
              <div className="flex items-center gap-3 sm:pr-6">
                <ClockIcon className="h-9 w-9 shrink-0 text-slate-300" />
                <div>
                  <dt className="sr-only">Estimated time</dt>
                  <dd className="text-lg font-bold leading-tight text-[#f5f3ee]">
                    {overview.timeShort ?? "See description"}
                  </dd>
                  <dd className="text-sm text-slate-400">DIY, carefully</dd>
                </div>
              </div>
              <div className="flex items-center gap-3 sm:px-6">
                <WrenchIcon direction="left" className="h-7 w-14 shrink-0 text-slate-300" />
                <div>
                  <dt className="sr-only">Difficulty</dt>
                  <dd className="text-lg font-bold leading-tight text-[#f5f3ee]">{guide.difficulty}</dd>
                  <dd className="mt-1.5 flex gap-1" aria-hidden="true">
                    {[1, 2, 3].map((n) => (
                      <span
                        key={n}
                        className={`h-1.5 w-7 rounded-full ${n <= level ? "bg-orange-500" : "bg-white/15"}`}
                      />
                    ))}
                  </dd>
                </div>
              </div>
              <div className="flex items-center gap-3 sm:pl-6">
                <LayersIcon className="h-9 w-9 shrink-0 text-slate-300" />
                <div>
                  <dt className="sr-only">Scope</dt>
                  <dd className="text-lg font-bold leading-tight text-[#f5f3ee]">
                    {overview.jobs.length > 0 ? `${overview.jobs.length} jobs` : `${guide.steps.length} steps`}
                  </dd>
                  <dd className="text-sm text-slate-400">
                    {multi ? "Combined procedure" : "Single procedure"}
                  </dd>
                </div>
              </div>
            </dl>

            <p className="mt-7 max-w-2xl text-lg leading-relaxed text-slate-300">{overview.intro}</p>
            <button
              type="button"
              onClick={() => setShowFull((v) => !v)}
              aria-expanded={showFull}
              className="mt-2 min-h-[44px] text-base font-semibold text-sky-300 hover:text-sky-200"
            >
              {showFull ? "Hide full description" : "View full description"} →
            </button>
            {showFull && (
              <div className="mt-2 max-w-2xl space-y-3 rounded-2xl border border-white/10 bg-black/25 p-4 text-base leading-relaxed text-slate-300">
                <p>{guide.summary}</p>
                <p>
                  <span className="font-semibold text-slate-100">Estimated time: </span>
                  {guide.estTime}
                </p>
              </div>
            )}
          </div>

          {overview.jobs.length > 0 && (
            <aside
              aria-label="Jobs included"
              className="self-start rounded-2xl border border-white/10 bg-black/30 p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]"
            >
              <h2 className="text-sm font-bold uppercase tracking-[0.18em] text-slate-200">
                Jobs included
              </h2>
              <ul className="mt-4 space-y-3">
                {overview.jobs.map((j) => (
                  <li key={j} className="flex items-start gap-3 text-base leading-snug text-slate-200">
                    <OrangeCheck className="mt-0.5 h-5 w-5 shrink-0" />
                    <span>{j}</span>
                  </li>
                ))}
              </ul>
            </aside>
          )}
        </div>

        {guide.steps.length > 0 && (
          <div className="relative border-t border-white/10 bg-black/25 p-4 sm:p-5">
            <div className="flex flex-col gap-4 rounded-2xl border border-orange-500/20 bg-[#16191c] p-4 sm:flex-row sm:items-center sm:p-5">
              <div className="flex min-w-0 flex-1 items-center gap-4">
                <div className="min-w-0 flex-1">
                  <p className={`${DISPLAY} flex items-center gap-2.5 text-base font-extrabold uppercase tracking-[0.14em] text-orange-400 sm:text-lg`}>
                    <WrenchIcon direction="left" className="h-4 w-8 shrink-0" />
                    <span>{session ? "Your Wrench Mode session" : "Wrench Mode"}</span>
                  </p>
                  {session ? (
                    <>
                      <p className="mt-0.5 text-xl font-semibold leading-snug text-[#f5f3ee]">
                        Step {session.position} of {session.total} · {session.title}
                      </p>
                      {session.phaseName && (
                        <p className="text-base text-slate-400">{session.phaseName}</p>
                      )}
                      <div className="mt-3 flex items-center gap-3">
                        <div
                          role="progressbar"
                          aria-label="Wrench Mode progress"
                          aria-valuemin={0}
                          aria-valuemax={100}
                          aria-valuenow={pct}
                          className="h-2 flex-1 overflow-hidden rounded-full bg-black/60 shadow-[inset_0_1px_2px_rgba(0,0,0,0.8)]"
                        >
                          <div className="h-full rounded-full bg-orange-500" style={{ width: `${pct}%` }} />
                        </div>
                        <span className="shrink-0 text-sm text-slate-400">{pct}% through</span>
                      </div>
                    </>
                  ) : (
                    <>
                      <p className="mt-0.5 text-xl font-semibold leading-snug text-[#f5f3ee]">
                        Work this job one step at a time
                      </p>
                      <p className="text-base text-slate-400">
                        Each step with its own torque, warnings and checks. The full guide below stays
                        the complete reference.
                      </p>
                    </>
                  )}
                </div>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <button
                  ref={primaryRef}
                  type="button"
                  onClick={session ? onResume : onStart}
                  className="flex min-h-[64px] items-center justify-center gap-3 whitespace-nowrap rounded-2xl border border-orange-300/60 bg-gradient-to-b from-orange-400 to-orange-500 px-6 text-base sm:text-lg font-extrabold uppercase tracking-wide text-black shadow-[inset_0_1px_0_rgba(255,255,255,0.35),0_3px_0_rgba(0,0,0,0.6)] active:translate-y-px"
                >
                  <PlayIcon className="h-5 w-5" />
                  <span>{session ? "Resume Wrench Mode" : "Start Wrench Mode"}</span>
                </button>
                {session && (
                  <button
                    type="button"
                    onClick={onExit}
                    className="flex min-h-[56px] items-center justify-center gap-2.5 whitespace-nowrap rounded-2xl border border-white/15 bg-transparent px-4 text-base font-semibold text-slate-200 hover:border-white/30 hover:bg-white/5"
                  >
                    <ExitIcon className="h-5 w-5" />
                    <span>Exit Wrench Mode</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        <nav aria-label="Guide sections" className="relative flex overflow-x-auto border-t border-white/10 bg-black/20 px-2 sm:px-4">
          {TABS.map((t) => {
            const on = tab === t.key;
            return (
              <button
                key={t.key}
                type="button"
                aria-current={on ? "true" : undefined}
                onClick={() => jump(t.key, t.heading)}
                className={`relative min-h-[56px] shrink-0 px-4 text-base font-semibold sm:px-6 ${
                  on ? "text-orange-400" : "text-slate-300 hover:text-white"
                }`}
              >
                {t.label(guide.steps.length)}
                {on && <span className="absolute inset-x-3 bottom-0 h-0.5 rounded-full bg-orange-500" aria-hidden="true" />}
              </button>
            );
          })}
        </nav>
      </section>
    </div>
  );
}
