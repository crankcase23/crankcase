import type { GuideStepVisual, GuideVisualSet, VisualApplication, VisualSlot } from "@/types/guideVisuals";
import generated from "./charger-2016-sxt-multi-job.visuals.json";

/**
 * Visuals for the 2016 Dodge Charger SXT 3.6L multi-job guide.
 *
 * Nothing is written here by hand. `*.visuals.json` is produced ONLY by the
 * Crankcase visual pipeline (scripts/visuals/build-visual.mjs) from a raw
 * source plus a reviewed manifest in visual-sources/. It is empty until a
 * verified, vehicle-specific, properly licensed source exists for a step; the
 * rule is to show nothing rather than something close.
 */
const application: VisualApplication = {
  year: 2016,
  make: "Dodge",
  model: "Charger",
  trim: "SXT",
  engine: "3.6L Pentastar V6",
};

export const chargerVisuals: GuideVisualSet = {
  guideId: "admin-test-charger-2016-sxt-multi-job",
  application,
  steps: groupByStep(generated.visuals as unknown as (GuideStepVisual & { step: number })[]),
};

function groupByStep(list: (GuideStepVisual & { step: number })[]): Record<number, GuideStepVisual[]> {
  const out: Record<number, GuideStepVisual[]> = {};
  for (const { step, ...vis } of list) (out[step] ??= []).push(vis as GuideStepVisual);
  return out;
}

const DIR = "/guide-visuals/2016-dodge-charger-sxt-3.6l-pentastar-v6/";

/**
 * Proof-of-concept shot list. Every callout target below is a component the
 * step's own text names; none is added by us. Not rendered anywhere.
 */
export const chargerVisualSlots: VisualSlot[] = [
  {
    step: 2,
    id: "engine-cover",
    targetPath: `${DIR}step-02-engine-cover.jpg`,
    shoot: "Top view of the 3.6L engine bay with the decorative engine cover in place, retaining grommets visible.",
    calloutTargets: ["Retaining grommets"],
    why: "Component identification: confirms which cover, and where to pull.",
  },
  {
    step: 4,
    id: "pdc-cavity-37",
    targetPath: `${DIR}step-04-pdc-f37.jpg`,
    shoot: "Under-hood Power Distribution Center with the cover off, cavity 37 (10A RED mini fuse) legible.",
    calloutTargets: ["Cavity 37 — 10A RED mini fuse"],
    why: "Fuse location: a wrong fuse here means the fuel pressure is never released.",
  },
  {
    step: 10,
    id: "intake-duct",
    targetPath: `${DIR}step-10-intake-duct.png`,
    shoot:
      "Original Crankcase artwork (vector), engine cover already removed: the factory air intake hose from the throttle body to the air box, with both clamps and the IAT connector. Evidence-bounded: see visual-sources/.../artwork/step-10-intake-duct.v3.spec.md.",
    calloutTargets: [
      "IAT connector",
      "Throttle-body clamp",
      "Air-box clamp",
      "Intake hose",
    ],
    why: "Four actions on one assembly: IAT clip, two clamps, then lift the hose out.",
  },
  {
    step: 11,
    id: "routing-before-disconnect",
    targetPath: `${DIR}step-11-routing.jpg`,
    shoot: "Upper intake with the air inlet removed, before anything is disconnected, showing hose and wiring routing.",
    calloutTargets: [
      "Throttle-body connector",
      "PCV hose",
      "EVAP connections",
      "Brake-booster vacuum connection",
    ],
    why: "Hose/routing identification and complex work area: the customer's own reference before disassembly.",
  },
  {
    step: 15,
    id: "coil-connectors",
    targetPath: `${DIR}step-15-coils.jpg`,
    shoot: "Both cylinder banks with the upper intake removed, all six coils and their connectors visible.",
    calloutTargets: ["Coil electrical connectors (six)", "Coil retaining bolts"],
    why: "Connector and fastener location: six similar parts across two banks.",
  },
  {
    step: 33,
    id: "pcv-valve",
    targetPath: `${DIR}step-33-pcv.jpg`,
    shoot: "Right-side valve-cover area showing the PCV valve and its hose.",
    calloutTargets: ["PCV valve", "PCV hose"],
    why: "Hard-to-see component the guide itself calls out for awful access.",
  },
];
