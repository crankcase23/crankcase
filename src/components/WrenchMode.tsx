"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import type { ResolvedGuide, Vehicle } from "@/types/vehicle";
import { buildWrenchPlan, splitInstruction } from "@/lib/wrenchSteps";
import { resolveStepVisuals } from "@/lib/guideVisuals";
import GuideStepVisuals from "@/components/GuideStepVisuals";
import type { WrenchCompletionConfig } from "@/lib/wrenchSteps";
import { deriveOverview, vehicleTitle } from "@/lib/guideOverview";
import WrenchCompletionSheet from "@/components/WrenchCompletionSheet";
import BrandLogo from "@/components/BrandLogo";
import { ChevronDownIcon, ChevronRightIcon, WrenchIcon } from "@/components/GuideIcons";

/**
 * Wrench Mode: one step at a time, for someone standing at the vehicle.
 *
 * Reads the SAME canonical guide object the Full Guide renders (see
 * src/lib/wrenchSteps.ts). Owns no guide content of its own.
 *
 * Presented as a full-screen overlay so site/admin chrome cannot crowd the
 * step, and so the Full Guide underneath keeps its scroll position and any
 * answered variant questions while Wrench Mode is open.
 *
 * SESSION LIFECYCLE lives in the host (GuideWithWrenchMode). This component
 * reports its position (onIndexChange), asks to return to the Overall Guide
 * without ending anything (onOverallGuide), and reports that the job was
 * finished (onFinish) after the completion sheet.
 *
 * VISUALS. A step shows pictures only when lib/guideVisuals returns verified,
 * vehicle-matched visuals for it (see types/guideVisuals.ts). Otherwise
 * nothing is shown and nothing is substituted.
 */

// Horizontal swipe = deliberate: at least this far, and clearly more
// horizontal than vertical. Anything else is left to normal scrolling.
const SWIPE_MIN_PX = 64;
const SWIPE_DOMINANCE = 2; // |dx| must exceed |dy| by this factor
const SWIPE_MAX_MS = 900;

const DISPLAY = "font-[family-name:var(--font-display)]";

function isTypingTarget(t: EventTarget | null): boolean {
  if (!(t instanceof HTMLElement)) return false;
  return (
    t.isContentEditable ||
    t.tagName === "INPUT" ||
    t.tagName === "TEXTAREA" ||
    t.tagName === "SELECT"
  );
}

/**
 * Display-only split of a torque string like "12 N·m / 106 in-lb" into its
 * two unit readings. The text is not altered; if it does not look like two
 * numeric readings (e.g. a VERIFY placeholder) it is shown whole.
 */
function splitTorque(value: string): string[] {
  const parts = value.split(/\s+\/\s+/);
  if (parts.length === 2 && parts.every((p) => /\d/.test(p))) return parts;
  return [value];
}

export default function WrenchMode({
  guide,
  vehicle,
  initialIndex = 0,
  onIndexChange,
  onOverallGuide,
  onFinish,
  completion,
}: {
  guide: ResolvedGuide;
  vehicle: Vehicle;
  initialIndex?: number;
  onIndexChange?: (index: number) => void;
  /** Return to the Overall Guide WITHOUT ending the session. */
  onOverallGuide: () => void;
  /** The job was completed (saved) or deliberately finished without saving. */
  onFinish: () => void;
  completion?: WrenchCompletionConfig;
}) {
  const plan = useMemo(() => buildWrenchPlan(guide), [guide]);
  const overview = useMemo(() => deriveOverview(guide), [guide]);
  const total = plan.steps.length;
  const [index, setIndex] = useState(() =>
    Math.min(Math.max(initialIndex, 0), Math.max(total - 1, 0))
  );
  const [completing, setCompleting] = useState(false);
  const current = plan.steps[Math.min(index, Math.max(total - 1, 0))];
  // Which phase is expanded in the side list. Follows the current step unless
  // the reader toggled one; a manual choice lapses as soon as the step changes.
  const [override, setOverride] = useState<{ phase: number | null; at: number } | null>(null);
  const openPhase =
    override && override.at === current?.position ? override.phase : (current?.phaseIndex ?? null);

  const atStart = index <= 0;
  const atEnd = index >= total - 1;

  const rootRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const primaryRef = useRef<HTMLButtonElement>(null);
  const sideRef = useRef<HTMLElement>(null);

  const prev = useCallback(() => setIndex((i) => Math.max(0, i - 1)), []);
  const next = useCallback(
    () => setIndex((i) => Math.min(total - 1, i + 1)),
    [total]
  );

  // Keep the host's saved position in step with ours.
  useEffect(() => {
    onIndexChange?.(index);
  }, [index, onIndexChange]);

  // Lock page scroll behind the overlay; take focus so keys work at once.
  useEffect(() => {
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    rootRef.current?.focus();
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, []);

  // Each new step starts at its top.
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0 });
  }, [index]);
  useEffect(() => {
    sideRef.current
      ?.querySelector('[aria-current="step"]')
      ?.scrollIntoView({ block: "nearest" });
  }, [index, openPhase]);

  // Desktop keyboard: left/right arrows step. Never while typing, never with
  // modifiers, never while the completion sheet is open. Buttons stay the
  // primary, always-visible controls.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (completing) return;
      if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
      if (isTypingTarget(e.target)) return;
      if (e.key === "ArrowRight") {
        e.preventDefault();
        next();
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        prev();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [next, prev, completing]);

  // ---- Swipe -------------------------------------------------------------
  // The scroll surface declares `touch-action: pan-y pinch-zoom`, so the
  // browser itself owns vertical panning and pinch-zoom. If the browser takes
  // a gesture for scrolling it sends pointercancel and we discard it. We only
  // act on a completed touch/pen gesture that travelled far enough and was
  // clearly horizontal. Mouse drags are ignored (text selection stays intact).
  const gesture = useRef<{
    id: number;
    x: number;
    y: number;
    t: number;
  } | null>(null);
  const pointerCount = useRef(0);

  function onPointerDown(e: ReactPointerEvent<HTMLDivElement>) {
    if (e.pointerType === "mouse") return;
    pointerCount.current += 1;
    // Second finger (pinch) or a press on a control: not a swipe.
    if (pointerCount.current > 1 || (e.target as HTMLElement).closest("button, a, input, select, textarea")) {
      gesture.current = null;
      return;
    }
    gesture.current = { id: e.pointerId, x: e.clientX, y: e.clientY, t: performance.now() };
  }

  function onPointerUp(e: ReactPointerEvent<HTMLDivElement>) {
    if (e.pointerType === "mouse") return;
    pointerCount.current = Math.max(0, pointerCount.current - 1);
    const g = gesture.current;
    gesture.current = null;
    if (!g || g.id !== e.pointerId) return;
    const dx = e.clientX - g.x;
    const dy = e.clientY - g.y;
    const dt = performance.now() - g.t;
    if (dt > SWIPE_MAX_MS) return;
    if (Math.abs(dx) < SWIPE_MIN_PX) return;
    if (Math.abs(dx) < Math.abs(dy) * SWIPE_DOMINANCE) return;
    if (dx < 0) next(); // swipe LEFT  -> next step
    else prev(); //        swipe RIGHT -> previous step
  }

  function onPointerCancel(e: ReactPointerEvent<HTMLDivElement>) {
    if (e.pointerType === "mouse") return;
    pointerCount.current = Math.max(0, pointerCount.current - 1);
    gesture.current = null;
  }

  // Bottom-right control: Next, or Complete on the final step. Complete opens
  // the completion sheet; it does not close Wrench Mode by itself.
  function onPrimary() {
    if (atEnd) setCompleting(true);
    else next();
  }

  const closeSheet = useCallback(() => {
    setCompleting(false);
    requestAnimationFrame(() => primaryRef.current?.focus());
  }, []);

  const pct = total > 0 ? ((index + 1) / total) * 100 : 0;
  const sentences = current ? splitInstruction(current.step.instructions) : [];
  const visuals = useMemo(
    () => (current ? resolveStepVisuals(guide, vehicle, current.step.number) : []),
    [guide, vehicle, current]
  );

  return (
    <div
      ref={rootRef}
      role="dialog"
      aria-modal="true"
      aria-label="Wrench Mode"
      tabIndex={-1}
      className="fixed inset-0 z-[100] bg-[#0e1012] text-[#f5f3ee] outline-none"
    >
      <div inert={completing} className="flex h-dvh flex-col">
        {/* Brand bar: logo, where you are, and the way back (session kept) */}
        <header className="flex items-center justify-between gap-3 border-b border-white/10 bg-gradient-to-b from-[#1c1f23] to-[#15181b] px-4 py-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] sm:px-6">
          <BrandLogo className="h-7 w-auto sm:h-8" />
          <p className="hidden min-w-0 flex-1 truncate px-4 text-sm text-slate-400 md:block">
            {vehicleTitle(vehicle)} <span className="text-slate-600">›</span>{" "}
            <span className="text-slate-300">{overview.jobs.length > 1 ? "Multi-Service Repair" : "Repair"}</span>
          </p>
          <button
            type="button"
            onClick={onOverallGuide}
            title="Back to the Overall Guide. Your place in Wrench Mode is kept."
            className="min-h-[44px] shrink-0 whitespace-nowrap rounded-xl border border-white/15 bg-white/[0.03] px-3.5 text-sm font-semibold text-slate-100 hover:border-white/30 hover:bg-white/[0.07]"
          >
            ← Overall Guide
          </button>
        </header>

        {/* Mode strip + progress */}
        <div className="flex items-center justify-between gap-3 border-b border-white/5 bg-[#121417] px-4 py-1.5 sm:px-6">
          <div className="flex items-center gap-2.5 text-orange-400">
            <WrenchIcon direction="left" className="h-4 w-8" />
            <span className={`${DISPLAY} whitespace-nowrap text-base font-extrabold uppercase leading-none tracking-[0.12em] sm:text-lg sm:tracking-[0.16em]`}>
              Wrench Mode
            </span>
          </div>
          <span className="whitespace-nowrap text-sm text-slate-400">
            {current ? `Step ${current.position} of ${total} · ${Math.round(pct)}%` : ""}
          </span>
        </div>
        <div
          role="progressbar"
          aria-label="Guide progress"
          aria-valuemin={1}
          aria-valuemax={Math.max(total, 1)}
          aria-valuenow={Math.min(index + 1, Math.max(total, 1))}
          aria-valuetext={`Step ${index + 1} of ${total}`}
          className="h-1.5 w-full bg-black/70 shadow-[inset_0_1px_2px_rgba(0,0,0,0.8)]"
        >
          <div
            className="h-full bg-orange-500 transition-[width] duration-200"
            style={{ width: `${pct}%` }}
          />
        </div>

        <div className="flex min-h-0 flex-1">
          {/* Phase navigator: large screens only. Touch devices keep the full
              width for the step and swipe/wrench navigation. */}
          {plan.phases.length > 0 && (
            <aside
              ref={sideRef}
              aria-label="Procedure phases"
              className="hidden w-80 shrink-0 overflow-y-auto border-r border-white/10 bg-[#111316] p-4 lg:block"
            >
              <p className="mb-3 flex items-center justify-between px-1 text-lg font-bold text-[#f5f3ee]">
                {overview.jobs.length > 1 ? "Multi-Service Repair" : "Procedure"}
              </p>
              <ul className="space-y-1.5">
                {plan.phases.map((ph) => {
                  const isOpen = openPhase === ph.index;
                  const isCurrent = current?.phaseIndex === ph.index;
                  const done = ph.last < (current?.position ?? 0);
                  return (
                    <li key={ph.index} className={isCurrent ? "rounded-xl bg-white/[0.04]" : ""}>
                      <button
                        type="button"
                        aria-expanded={isOpen}
                        onClick={() =>
                          setOverride({ phase: isOpen ? null : ph.index, at: current?.position ?? 0 })
                        }
                        className="flex min-h-[52px] w-full items-center gap-3 rounded-xl px-3 py-2 text-left hover:bg-white/[0.05]"
                      >
                        <span
                          aria-hidden="true"
                          className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                            done
                              ? "bg-orange-500 text-black"
                              : isCurrent
                                ? "border-2 border-orange-500 text-orange-400"
                                : "border border-white/25 text-slate-400"
                          }`}
                        >
                          {done ? "✓" : ph.index}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className={`block text-base font-semibold leading-snug ${isCurrent ? "text-[#f5f3ee]" : "text-slate-200"}`}>
                            Phase {ph.index} – {ph.name}
                          </span>
                          <span className="block text-sm text-slate-500">
                            Steps {ph.first}
                            {ph.last !== ph.first ? ` – ${ph.last}` : ""}
                          </span>
                        </span>
                        {isOpen ? (
                          <ChevronDownIcon className="h-4 w-4 shrink-0 text-slate-500" />
                        ) : (
                          <ChevronRightIcon className="h-4 w-4 shrink-0 text-slate-500" />
                        )}
                      </button>
                      {isOpen && (
                        <ol className="mb-2 ml-6 space-y-0.5 border-l border-white/10 pl-3">
                          {plan.steps
                            .filter((s) => s.phaseIndex === ph.index)
                            .map((s) => {
                              const isNow = s.position === current?.position;
                              const past = s.position < (current?.position ?? 0);
                              return (
                                <li key={s.position}>
                                  <button
                                    type="button"
                                    aria-current={isNow ? "step" : undefined}
                                    onClick={() => setIndex(s.position - 1)}
                                    className={`flex min-h-[44px] w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-left text-[15px] leading-snug ${
                                      isNow
                                        ? "border border-orange-500/70 bg-orange-500/10 font-semibold text-[#f5f3ee]"
                                        : "text-slate-300 hover:bg-white/[0.05]"
                                    }`}
                                  >
                                    <span
                                      aria-hidden="true"
                                      className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${
                                        past
                                          ? "bg-orange-500 text-black"
                                          : isNow
                                            ? "border-2 border-orange-500"
                                            : "border border-white/25"
                                      }`}
                                    >
                                      {past ? "✓" : ""}
                                    </span>
                                    <span className="min-w-0 flex-1">
                                      {s.position}. {s.title}
                                    </span>
                                  </button>
                                </li>
                              );
                            })}
                        </ol>
                      )}
                    </li>
                  );
                })}
              </ul>
            </aside>
          )}

          {/* Step content: the swipe + scroll surface */}
          <div
            ref={scrollRef}
            onPointerDown={onPointerDown}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerCancel}
            style={{ touchAction: "pan-y pinch-zoom" }}
            className="cg-grid-fine min-w-0 flex-1 overflow-y-auto overscroll-contain px-5 py-6 sm:px-10 sm:py-8"
          >
            {!current ? (
              <p className="text-xl text-slate-300">This guide has no steps.</p>
            ) : (
              <div className="mx-auto max-w-4xl">
                <p className="sr-only" aria-live="polite">
                  Step {current.position} of {total}: {current.title}
                </p>

                {current.phaseIndex !== undefined && (
                  <div className="flex items-stretch gap-3">
                    <span className="w-1 rounded-sm bg-orange-500" aria-hidden="true" />
                    <div>
                      <p className="text-sm font-bold uppercase tracking-[0.2em] text-orange-400 sm:text-base">
                        Phase {current.phaseIndex} of {plan.phaseCount}
                      </p>
                      <p className="mt-0.5 text-lg font-semibold leading-snug text-slate-200 sm:text-xl">
                        {current.phaseName}
                      </p>
                    </div>
                  </div>
                )}

                <p
                  className={`${DISPLAY} mt-6 flex items-baseline gap-2.5 font-extrabold uppercase tracking-[0.1em]`}
                >
                  <span className="text-xl text-orange-400 sm:text-2xl">Step</span>
                  <span className="text-6xl leading-none text-orange-400 sm:text-7xl">
                    {current.position}
                  </span>
                  <span className="text-xl text-slate-400 sm:text-2xl">of {total}</span>
                </p>
                <h2 className="mt-3 text-4xl font-bold leading-[1.1] tracking-tight text-[#f5f3ee] sm:text-5xl">
                  {current.title}
                </h2>

                {current.appliesTo && (
                  <p className="mt-3 inline-block rounded-md border border-white/20 px-2 py-1 text-sm font-semibold text-slate-300">
                    Applies to: {current.appliesTo}
                  </p>
                )}

                {visuals.length > 0 && <GuideStepVisuals key={current.step.number} visuals={visuals} />}
                <section
                  aria-label="Step instructions"
                  className="mt-6 rounded-2xl border border-white/10 bg-gradient-to-b from-[#1f2226] to-[#1a1d21] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_20px_40px_-28px_rgba(0,0,0,0.9)] sm:p-7"
                >
                  {sentences.length > 1 ? (
                    <>
                      <h3 className="mb-4 text-xl font-bold text-[#f5f3ee]">Step Instructions</h3>
                      <ol className="space-y-4">
                        {sentences.map((s, i) => (
                          <li key={i} className="flex items-start gap-4">
                            <span
                              aria-hidden="true"
                              className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-orange-500 text-lg font-extrabold text-black"
                            >
                              {i + 1}
                            </span>
                            <span className="text-xl leading-relaxed text-[#f5f3ee] sm:text-2xl sm:leading-relaxed">
                              {s}
                            </span>
                          </li>
                        ))}
                      </ol>
                    </>
                  ) : (
                    <p className="text-xl leading-relaxed text-[#f5f3ee] sm:text-2xl sm:leading-relaxed">
                      {current.step.instructions}
                    </p>
                  )}
                </section>

                {/* Step-specific service-data modules. All text comes from the
                    canonical step. Each type differs in shape and label, not
                    only color: torque = solid orange rail, warning = hazard
                    header strip, unverified = dashed border. */}
                <div className="mt-5 space-y-4">
                  {current.step.torque && current.step.torque.length > 0 && (
                    <section
                      aria-label="Torque for this step"
                      className="overflow-hidden rounded-2xl border border-orange-500/50 bg-[#1c1f23] shadow-[inset_4px_0_0_0_#f97316]"
                    >
                      <h3
                        className={`${DISPLAY} border-b border-white/10 bg-black/25 py-2 pl-6 pr-4 text-lg font-extrabold uppercase tracking-[0.18em] text-orange-300`}
                      >
                        Torque
                      </h3>
                      <ul className="divide-y divide-white/10">
                        {current.step.torque.map((t) => {
                          const readings = splitTorque(t.value);
                          return (
                            <li key={t.fastener} className="py-3 pl-6 pr-4">
                              <span className="block text-base text-slate-300 sm:text-lg">
                                {t.fastener}
                              </span>
                              {readings.map((r, i) => (
                                <span
                                  key={r}
                                  className={
                                    i === 0
                                      ? "block font-mono text-3xl font-bold leading-tight text-[#f5f3ee] sm:text-4xl"
                                      : "block font-mono text-xl font-semibold leading-tight text-slate-300 sm:text-2xl"
                                  }
                                >
                                  {r}
                                </span>
                              ))}
                              {t.notes && (
                                <span className="mt-1 block text-base text-slate-300">
                                  {t.notes}
                                </span>
                              )}
                            </li>
                          );
                        })}
                      </ul>
                    </section>
                  )}

                  {current.step.warning && (
                    <section
                      aria-label="Warning for this step"
                      className="overflow-hidden rounded-2xl border-2 border-rose-500/70 bg-[#1c1f23]"
                    >
                      <h3
                        className={`${DISPLAY} px-4 py-2 text-lg font-extrabold uppercase tracking-[0.18em] text-rose-100`}
                        style={{
                          background:
                            "repeating-linear-gradient(135deg, rgba(190,18,60,0.55) 0 10px, rgba(127,29,29,0.55) 10px 20px)",
                        }}
                      >
                        ⚠ Warning
                      </h3>
                      <p className="px-4 py-3 text-xl font-semibold leading-snug text-[#f5f3ee] sm:text-2xl">
                        {current.step.warning}
                      </p>
                    </section>
                  )}

                  {current.verifyNotes.length > 0 && (
                    <section
                      aria-label="Unverified information in this step"
                      className="rounded-2xl border-2 border-dashed border-amber-400/70 bg-[#1c1f23]"
                    >
                      <h3
                        className={`${DISPLAY} border-b border-dashed border-amber-400/40 px-4 py-2 text-lg font-extrabold uppercase tracking-[0.18em] text-amber-300`}
                      >
                        ? Unverified
                      </h3>
                      <div className="px-4 py-3">
                        <p className="text-base font-bold uppercase tracking-wider text-amber-200">
                          Check before you continue
                        </p>
                        <ul className="mt-1 space-y-1">
                          {current.verifyNotes.map((n) => (
                            <li
                              key={n}
                              className="text-xl font-semibold leading-snug text-[#f5f3ee] sm:text-2xl"
                            >
                              {n}
                            </li>
                          ))}
                        </ul>
                      </div>
                    </section>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Directional wrench controls. Equal halves on touch; on large
            screens Previous is compact and Next takes the wider, primary slot. */}
        <div className="border-t border-white/10 bg-gradient-to-b from-[#181b1f] to-[#121417] px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] sm:px-8">
          <div className="mx-auto flex max-w-6xl gap-3 lg:justify-between">
            <button
              type="button"
              onClick={prev}
              disabled={atStart}
              aria-label="Previous step"
              className="flex min-h-[84px] flex-1 items-center justify-center gap-3 rounded-2xl border border-white/15 bg-gradient-to-b from-[#31363c] to-[#22262a] px-4 text-xl font-bold text-[#f5f3ee] shadow-[inset_0_1px_0_rgba(255,255,255,0.1),0_3px_0_rgba(0,0,0,0.6)] active:translate-y-px active:shadow-[inset_0_1px_0_rgba(255,255,255,0.1),0_1px_0_rgba(0,0,0,0.6)] disabled:cursor-not-allowed disabled:opacity-35 lg:min-h-[72px] lg:w-64 lg:flex-none"
            >
              <WrenchIcon direction="left" className="h-8 w-16 shrink-0" />
              <span>Previous</span>
            </button>
            <button
              ref={primaryRef}
              type="button"
              onClick={onPrimary}
              disabled={total === 0}
              aria-label={atEnd ? "Complete this job" : "Next step"}
              className="flex min-h-[84px] flex-1 items-center justify-center gap-3 rounded-2xl border border-orange-300/60 bg-gradient-to-b from-orange-400 to-orange-500 px-4 text-xl font-extrabold text-black shadow-[inset_0_1px_0_rgba(255,255,255,0.35),0_3px_0_rgba(0,0,0,0.6)] active:translate-y-px active:shadow-[inset_0_1px_0_rgba(255,255,255,0.35),0_1px_0_rgba(0,0,0,0.6)] disabled:cursor-not-allowed disabled:opacity-35 lg:min-h-[72px] lg:max-w-md lg:flex-[1.4]"
            >
              <span>{atEnd ? "Complete" : "Next"}</span>
              <WrenchIcon direction="right" className="h-8 w-16 shrink-0" />
            </button>
          </div>
        </div>
      </div>

      {completing && (
        <WrenchCompletionSheet
          guide={guide}
          vehicle={vehicle}
          config={completion ?? {}}
          onBack={closeSheet}
          onFinished={onFinish}
        />
      )}
    </div>
  );
}
