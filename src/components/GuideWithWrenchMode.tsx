"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import GuideBody from "@/components/GuideBody";
import GuideOverview from "@/components/GuideOverview";
import type { BreadcrumbItem } from "@/components/GuideOverview";
import ExitWrenchDialog from "@/components/ExitWrenchDialog";
import WrenchMode from "@/components/WrenchMode";
import { GRAPHITE_VARS } from "@/components/guideTheme";
import { buildWrenchPlan } from "@/lib/wrenchSteps";
import type { WrenchCompletionConfig } from "@/lib/wrenchSteps";
import type { ResolvedGuide, Vehicle } from "@/types/vehicle";

/**
 * The whole Overall Guide + Wrench Mode experience for one guide. Pages render
 * this in place of <GuideBody guide={guide} />, passing the SAME canonical
 * guide and vehicle objects. The Full Guide sections (GuideBody) are the
 * unchanged shared component, re-skinned only through the graphite variables.
 *
 * SESSION LIFECYCLE (client-side, in memory only: a reload clears it).
 *   no session      -> "START WRENCH MODE" (begins at step 1)
 *   session exists  -> "RESUME WRENCH MODE" + "Step X of Y", plus a secondary
 *                      "Exit Wrench Mode" that asks for confirmation
 *   "← Overall Guide" inside Wrench Mode -> hides the overlay, KEEPS session
 *   confirmed exit / saved / finished without saving -> clears the session
 *
 * The Full Guide stays mounted (inert) behind the overlay so returning to it
 * keeps its scroll position and any answered variant questions.
 *
 * `completion` is how a host with a real signed-in vehicle supplies the
 * Service History save. Hosts without one omit it and saving is shown as
 * unavailable.
 */
export default function GuideWithWrenchMode({
  guide,
  vehicle,
  breadcrumb,
  completion,
}: {
  guide: ResolvedGuide;
  vehicle: Vehicle;
  breadcrumb?: BreadcrumbItem[];
  completion?: WrenchCompletionConfig;
}) {
  const [session, setSession] = useState<{ index: number } | null>(null);
  const [open, setOpen] = useState(false);
  const [confirmExit, setConfirmExit] = useState(false);
  const primaryRef = useRef<HTMLButtonElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);

  const plan = useMemo(() => buildWrenchPlan(guide), [guide]);
  const here = session ? plan.steps[Math.min(session.index, plan.steps.length - 1)] : undefined;

  const focusPrimary = useCallback(
    () => requestAnimationFrame(() => primaryRef.current?.focus()),
    []
  );

  const start = useCallback(() => {
    setSession({ index: 0 });
    setOpen(true);
  }, []);

  const resume = useCallback(() => {
    setOpen(true);
  }, []);

  // Position reports from Wrench Mode. Functional update so an unchanged
  // index does not create a new session object.
  const onIndexChange = useCallback((i: number) => {
    setSession((s) => (s && s.index !== i ? { index: i } : s));
  }, []);

  // "← Overall Guide": leave the overlay, keep the session.
  const toOverallGuide = useCallback(() => {
    setOpen(false);
    focusPrimary();
  }, [focusPrimary]);

  // Intentional end of the session (confirmed exit, saved, or finished
  // without saving). Back to the initial state.
  const endSession = useCallback(() => {
    setOpen(false);
    setSession(null);
    setConfirmExit(false);
    focusPrimary();
  }, [focusPrimary]);

  const keepWrenching = useCallback(() => {
    setConfirmExit(false);
    focusPrimary();
  }, [focusPrimary]);

  return (
    <div style={GRAPHITE_VARS} className="mt-4">
      <div inert={open || confirmExit}>
        <GuideOverview
          guide={guide}
          vehicle={vehicle}
          breadcrumb={breadcrumb}
          session={
            session && here
              ? {
                  position: here.position,
                  total: plan.steps.length,
                  title: here.title,
                  phaseName: here.phaseName,
                }
              : null
          }
          bodyRef={bodyRef}
          primaryRef={primaryRef}
          onStart={start}
          onResume={resume}
          onExit={() => setConfirmExit(true)}
        />
        <div ref={bodyRef} className="mt-2">
          <GuideBody guide={guide} />
        </div>
      </div>

      {confirmExit && <ExitWrenchDialog onKeep={keepWrenching} onExit={endSession} />}

      {open && session && (
        <WrenchMode
          guide={guide}
          vehicle={vehicle}
          initialIndex={session.index}
          onIndexChange={onIndexChange}
          onOverallGuide={toOverallGuide}
          onFinish={endSession}
          completion={completion}
        />
      )}
    </div>
  );
}
