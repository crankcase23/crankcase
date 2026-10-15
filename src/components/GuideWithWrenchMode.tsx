"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import GuideBody from "@/components/GuideBody";
import GuideOverview from "@/components/GuideOverview";
import type { BreadcrumbItem } from "@/components/GuideOverview";
import ExitWrenchDialog from "@/components/ExitWrenchDialog";
import WrenchMode from "@/components/WrenchMode";
import { GRAPHITE_VARS } from "@/components/guideTheme";
import { buildWrenchPlan } from "@/lib/wrenchSteps";
import { clearProgress, loadProgress, persistableGarageId, safeStorage, saveProgress } from "@/lib/wrenchProgress";
import type { StorageLike } from "@/lib/wrenchProgress";
import { useWrenchBackGuard } from "@/lib/useWrenchBackGuard";
import { useVehicleConfig } from "@/lib/garage";
import { configKey } from "@/lib/vehicleConfig";
import type { ConfigResolvedGuide } from "@/lib/guideConfig";
import type { WrenchCompletionConfig } from "@/lib/wrenchSteps";
import type { ResolvedGuide, Vehicle } from "@/types/vehicle";

/**
 * The whole Overall Guide + Wrench Mode experience for one guide. Pages render
 * this in place of <GuideBody guide={guide} />, passing the SAME canonical
 * guide and vehicle objects. The Full Guide sections (GuideBody) are the
 * unchanged shared component, re-skinned only through the graphite variables.
 *
 * CONFIGURATION. The guide arrives already resolved for the customer's saved transmission/drivetrain (see
 * resolveGuideForConfig), stamped with the configuration key it was resolved under. A session belongs to that key:
 * if the saved configuration changes while a session exists (Edit Configuration here or in another tab or device), the
 * session is ended and the page refreshes, so nobody carries on with steps written for the old build.
 *
 * SESSION LIFECYCLE.
 *   no session      -> "START WRENCH MODE" (begins at step 1)
 *   session exists  -> "RESUME WRENCH MODE" + "Step X of Y", plus a secondary
 *                      "Exit Wrench Mode" that asks for confirmation
 *   "← Overall Guide" inside Wrench Mode -> hides the overlay, KEEPS session
 *   browser Back while the overlay is open -> same as "← Overall Guide" (see useWrenchBackGuard)
 *   confirmed exit / saved / finished without saving -> clears the session
 *
 * PERSISTENCE (approved behaviour change: this used to be in memory only, so a reload cleared it). When the host has a real
 * garage vehicle (a composite garage id), the session is saved to this device's localStorage on every step and restored after
 * a refresh, a browser restart or in-app navigation, scoped to garage vehicle + guide + configuration, and keyed to the
 * identity of each step so progress for changed content is rejected rather than resumed on the wrong step. It is cleared only
 * by a confirmed exit, a finished job, or a configuration change, never by ordinary navigation. Hosts without a garage id (the
 * admin preview) and browsers without storage stay in memory. A restored session opens on the Overall Guide, one tap from
 * "Resume Wrench Mode"; it never opens the overlay by itself. See wrenchProgress.ts for what is saved and rejected.
 *
 * While the overlay is open the screen is kept awake (useScreenWakeLock inside WrenchMode).
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
  garageId,
}: {
  guide: ResolvedGuide;
  vehicle: Vehicle;
  breadcrumb?: BreadcrumbItem[];
  completion?: WrenchCompletionConfig;
  /** The customer's permanent garage id for THIS car. Live configuration is read from it, never from the shared catalog id. */
  garageId?: string;
}) {
  const router = useRouter();
  // The configuration this guide was resolved under, and what the customer's garage says now (revalidated on focus).
  const guideKey = (guide as Partial<ConfigResolvedGuide>).configResolution?.key ?? null;
  const dependsOnConfig = (guide as Partial<ConfigResolvedGuide>).configResolution?.status !== undefined && (guide as Partial<ConfigResolvedGuide>).configResolution?.status !== "none";
  const { config: liveConfig, ready: liveReady } = useVehicleConfig(garageId ?? vehicle.id);
  const liveKey = liveReady && liveConfig ? configKey(liveConfig) : null;
  const stale = dependsOnConfig && guideKey !== null && liveKey !== null && liveKey !== guideKey;
  useEffect(() => {
    if (stale) router.refresh();
  }, [stale, router]);

  const [rawSession, setSession] = useState<{ index: number; key: string | null } | null>(null);
  // A session only counts while it was started under the configuration the page is showing now.
  const sessionValid = rawSession !== null && rawSession.key === guideKey && !stale;
  const session = sessionValid ? rawSession : null;
  const endedByConfigChange = rawSession !== null && !sessionValid;
  const [openRaw, setOpen] = useState(false);
  const open = openRaw && sessionValid;
  const [confirmExit, setConfirmExit] = useState(false);
  const primaryRef = useRef<HTMLButtonElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);

  const plan = useMemo(() => buildWrenchPlan(guide), [guide]);

  // Device-local persistence. Only for a real garage vehicle (composite id); everything else stays in memory.
  const persistId = persistableGarageId(garageId);
  const progressKeyForConfig = guideKey ?? "none";
  const storageRef = useRef<StorageLike | null>(null);
  // Restore after mount, never during render: the server and the first client render both show "Start", so hydration matches.
  // Functional update: a session that is already live is never overwritten by a restore.
  useEffect(() => {
    if (!persistId) return;
    storageRef.current = safeStorage();
    const r = loadProgress(storageRef.current, { garageId: persistId, guideId: guide.id, configKey: progressKeyForConfig, plan });
    if (r.status === "resume") setSession((s) => s ?? { index: r.index, key: guideKey });
  }, [persistId, guide.id, guideKey, progressKeyForConfig, plan]);
  // Save every step; a session invalidated by a configuration change is removed from storage too.
  useEffect(() => {
    if (!persistId || !rawSession) return;
    if (sessionValid) saveProgress(storageRef.current, { garageId: persistId, guideId: guide.id, configKey: progressKeyForConfig, plan }, rawSession.index);
    else clearProgress(storageRef.current, persistId, guide.id);
  }, [persistId, guide.id, progressKeyForConfig, plan, rawSession, sessionValid]);

  const here = session ? plan.steps[Math.min(session.index, plan.steps.length - 1)] : undefined;

  const focusPrimary = useCallback(
    () => requestAnimationFrame(() => primaryRef.current?.focus()),
    []
  );

  const start = useCallback(() => {
    setSession({ index: 0, key: guideKey });
    setOpen(true);
  }, [guideKey]);

  const resume = useCallback(() => {
    setOpen(true);
  }, []);

  // Position reports from Wrench Mode. Functional update so an unchanged
  // index does not create a new session object.
  const onIndexChange = useCallback((i: number) => {
    setSession((s) => (s && s.index !== i ? { ...s, index: i } : s));
  }, []);

  // "← Overall Guide": leave the overlay, keep the session.
  const toOverallGuide = useCallback(() => {
    setOpen(false);
    focusPrimary();
  }, [focusPrimary]);

  // Browser Back while the overlay is open does the same thing instead of leaving the page. Closed: ordinary navigation.
  useWrenchBackGuard(open, toOverallGuide);

  // Intentional end of the session (confirmed exit, saved, or finished
  // without saving). Back to the initial state.
  const endSession = useCallback(() => {
    if (persistId) clearProgress(storageRef.current, persistId, guide.id);
    setOpen(false);
    setSession(null);
    setConfirmExit(false);
    focusPrimary();
  }, [focusPrimary, persistId, guide.id]);

  const keepWrenching = useCallback(() => {
    setConfirmExit(false);
    focusPrimary();
  }, [focusPrimary]);

  return (
    <div style={GRAPHITE_VARS} className="mt-4">
      {endedByConfigChange && (
        <div role="status" data-testid="wrench-session-ended" className="mb-3 rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
          Your vehicle configuration changed, so the Wrench Mode session in progress was ended. Start again to get the steps for your current configuration.
        </div>
      )}
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
          startDisabledReason={
            (guide as Partial<ConfigResolvedGuide>).configResolution?.status === "unavailable"
              ? "This guide has no verified procedure for your configuration."
              : undefined
          }
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
