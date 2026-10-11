import type { GuideStepVisual, GuideVisualSet, VisualApplication } from "@/types/guideVisuals";
import generated from "./bmw-2010-328i-oil-change.visuals.json";

/**
 * Visuals for the 2010 BMW 328i (E90) Engine Oil & Filter Change draft guide (admin-only).
 *
 * Nothing is written here by hand. `*.visuals.json` holds ONLY visuals that reached APPROVED in the Guide Factory
 * (independent QA, overlay QA, owner sign-off); the entries are copied from each run's `registry-entry.preview.json`.
 * NOT yet wired into REGISTRY in src/lib/guideVisuals.ts (that file is hash-locked: see docs/bmw-e90/PARTS-BIN-PROPOSAL.md).
 */
const application: VisualApplication = {
  year: 2010,
  make: "BMW",
  model: "328i",
  trim: "Sedan (E90)",
  engine: "3.0L inline-6 (engine code not confirmed)",
};

export const bmwOilChangeVisuals: GuideVisualSet = {
  guideId: "admin-draft-bmw-2010-328i-oil-change",
  application,
  steps: groupByStep(generated.visuals as unknown as (GuideStepVisual & { step: number })[]),
};

function groupByStep(list: (GuideStepVisual & { step: number })[]): Record<number, GuideStepVisual[]> {
  const out: Record<number, GuideStepVisual[]> = {};
  for (const { step, ...vis } of list) (out[step] ??= []).push(vis as GuideStepVisual);
  return out;
}
