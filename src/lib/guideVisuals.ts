import type { GuideStepVisual, GuideVisualSet, VisualApplication } from "@/types/guideVisuals";
import type { ResolvedGuide, Vehicle } from "@/types/vehicle";
import { chargerVisuals } from "@/data/guide-visuals/charger-2016-sxt-multi-job";

/** Every registered set. Add a vehicle's set here; nothing else changes. */
const REGISTRY: GuideVisualSet[] = [chargerVisuals];

/** Must equal TREATMENT_VERSION in scripts/visuals/lib.mjs. */
export const TREATMENT_VERSION = "cc-visual-1";

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "");

export function applicationMatches(app: VisualApplication, v: Vehicle): boolean {
  return (
    app.year === v.year &&
    norm(app.make) === norm(v.make) &&
    norm(app.model) === norm(v.model) &&
    norm(app.engine) === norm(v.engine) &&
    (!app.trim || norm(app.trim) === norm(v.trim ?? ""))
  );
}

/** Why a visual would be refused, or null when it may be shown. */
export function visualRefusal(
  set: GuideVisualSet,
  vis: GuideStepVisual,
  guide: ResolvedGuide,
  vehicle: Vehicle
): string | null {
  if (set.guideId !== guide.id) return "guide id mismatch";
  if (!applicationMatches(set.application, vehicle)) return "set application does not match vehicle";
  if (!applicationMatches(vis.application, vehicle)) return "image application does not match vehicle";
  const p = vis.provenance;
  if (p.status !== "verified") return "not verified";
  if (!p.source.trim() || !p.sourceRef.trim()) return "missing source / reference";
  if (!p.license || p.license.status === "unknown") return "usage rights not established";
  if (!p.component.trim() || !p.vehicleEvidence.trim()) return "missing component / vehicle evidence";
  if (!p.verifiedBy || !p.verifiedOn) return "vehicle verification missing";
  if (!p.technicalReviewBy || !p.technicalReviewOn) return "technical review missing";
  if (!p.rawSha256 || !p.finalSha256 || !p.treatment || p.treatment.version !== TREATMENT_VERSION)
    return "not produced by the current Crankcase pipeline";
  if (!vis.src.startsWith("/guide-visuals/")) return "bad path";
  if (!vis.alt.trim() || !vis.caption.trim()) return "missing alt/caption";
  if (!(vis.width > 0 && vis.height > 0)) return "missing dimensions";
  return null;
}

/**
 * The visuals to show for one step: only those that pass every check above.
 * Callouts are stripped unless a human confirmed them. Returns [] (never a
 * substitute) when there is nothing trustworthy to show.
 */
export function resolveStepVisuals(
  guide: ResolvedGuide,
  vehicle: Vehicle,
  stepNumber: number
): GuideStepVisual[] {
  const set = REGISTRY.find((s) => s.guideId === guide.id);
  const list = set?.steps[stepNumber];
  if (!set || !list?.length) return [];
  const out: GuideStepVisual[] = [];
  for (const vis of list) {
    const why = visualRefusal(set, vis, guide, vehicle);
    if (why) {
      if (process.env.NODE_ENV !== "production") {
        console.warn(`[guide-visuals] step ${stepNumber} "${vis.id}" not shown: ${why}`);
      }
      continue;
    }
    out.push(vis.provenance.calloutsVerified ? vis : { ...vis, callouts: undefined });
  }
  return out;
}
