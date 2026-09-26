import type { RepairStep, ResolvedGuide } from "@/types/vehicle";

/**
 * Pure derivation of Wrench Mode's view of a guide. It READS the canonical
 * guide object and returns display structure only. It never stores, copies or
 * rewrites guide content, so there is no second source of truth: edit the
 * guide and both Full Guide and Wrench Mode change together.
 *
 * PHASES. The canonical RepairStep has no phase field. The Charger guide
 * carries its phase inside the step title as "Phase 9 · Oil Filter / Cooler
 * Housing — Install replacement housing". This parses that existing
 * convention. A guide whose titles do not follow it simply has no phase
 * (phase fields are undefined and the UI hides the phase row), so every other
 * guide still works. The smallest future data-model improvement would be an
 * optional `phase?: { number: number; name: string }` on RepairStep, at which
 * point this parser can be deleted; nothing else here would change.
 *
 * STEP CALLOUTS. Torque chips and the warning are already per-step fields
 * (`step.torque`, `step.warning`) and are passed through untouched. VERIFY
 * placeholders are embedded in the instruction text; they are additionally
 * extracted here VERBATIM so the UI can flag them, while the full instruction
 * text (which still contains them) is shown unchanged.
 */

const PHASE_TITLE = /^Phase\s+(\d+)\s*·\s*(.+?)\s+—\s+(.+)$/;
const VERIFY_NOTE = /⚠\s*VERIFY[^.;:\n]*?BEFORE SERVICE/g;

export interface WrenchStep {
  /** 1-based position among the steps shown in Wrench Mode. */
  position: number;
  step: RepairStep;
  /** Title with any "Phase N · Name — " prefix removed. */
  title: string;
  /** 1-based rank of this step's phase among the guide's phases. */
  phaseIndex?: number;
  phaseName?: string;
  /** Verbatim "⚠ VERIFY ... BEFORE SERVICE" markers found in the instructions. */
  verifyNotes: string[];
  /** Variant / rotor scope, when the step only applies to some builds. */
  appliesTo?: string;
}

export interface WrenchPhase {
  /** 1-based rank among the guide's phases. */
  index: number;
  name: string;
  /** 1-based positions of this phase's first and last step. */
  first: number;
  last: number;
}

export interface WrenchPlan {
  steps: WrenchStep[];
  phaseCount: number;
  phases: WrenchPhase[];
}

export function buildWrenchPlan(guide: ResolvedGuide): WrenchPlan {
  const labelOf: Record<string, string> = {};
  for (const g of guide.variants ?? []) {
    for (const o of g.options) labelOf[o.id] = o.label;
  }

  const phaseRank = new Map<string, number>();
  const steps: WrenchStep[] = guide.steps.map((step, i) => {
    let title = step.title;
    let phaseIndex: number | undefined;
    let phaseName: string | undefined;

    const m = PHASE_TITLE.exec(step.title);
    if (m) {
      const key = m[1];
      if (!phaseRank.has(key)) phaseRank.set(key, phaseRank.size + 1);
      phaseIndex = phaseRank.get(key);
      phaseName = m[2];
      title = m[3];
    }

    const verifyNotes = Array.from(
      new Set(step.instructions.match(VERIFY_NOTE) ?? [])
    );

    const scope: string[] = [];
    if (step.onlyFor?.length) {
      scope.push(step.onlyFor.map((id) => labelOf[id] ?? id).join(" / "));
    }
    if (step.rotorsOnly) scope.push("Only when replacing rotors");

    return {
      position: i + 1,
      step,
      title,
      phaseIndex,
      phaseName,
      verifyNotes,
      appliesTo: scope.length ? scope.join("; ") : undefined,
    };
  });

  const phases: WrenchPhase[] = [];
  for (const s of steps) {
    if (s.phaseIndex === undefined) continue;
    const last = phases[phases.length - 1];
    if (last && last.index === s.phaseIndex) last.last = s.position;
    else
      phases.push({
        index: s.phaseIndex,
        name: s.phaseName ?? "",
        first: s.position,
        last: s.position,
      });
  }

  return { steps, phaseCount: phaseRank.size, phases };
}

/**
 * Display-only: break one instruction paragraph into its sentences so Wrench
 * Mode can show them as a short numbered list. No words are added, removed or
 * reordered. A sentence ends at . ! or ? followed by whitespace and a capital
 * letter (or the warning sign), so decimals ("9.5 L") and abbreviations
 * followed by lowercase or digits stay intact. If the pieces would not
 * reassemble into exactly the original text, the original is returned whole.
 */
export function splitInstruction(text: string): string[] {
  const parts: string[] = [];
  let start = 0;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c !== "." && c !== "!" && c !== "?") continue;
    if (!/\s/.test(text[i + 1] ?? "")) continue;
    let j = i + 1;
    while (j < text.length && /\s/.test(text[j])) j++;
    if (j < text.length && /[A-Z⚠]/.test(text[j])) {
      parts.push(text.slice(start, i + 1).trim());
      start = j;
      i = j - 1;
    }
  }
  parts.push(text.slice(start).trim());
  const clean = parts.filter(Boolean);
  const same =
    clean.join(" ").replace(/\s+/g, " ") === text.trim().replace(/\s+/g, " ");
  return same && clean.length >= 2 ? clean : [text];
}

/**
 * What the completion sheet needs from whoever hosts Wrench Mode.
 *
 * Wrench Mode never talks to the database itself. A host that has a real,
 * signed-in vehicle context passes `save`, which should post to the existing
 * service-history API (see useServiceHistory(vehicleId).addEntry, which POSTs
 * /api/garage/[id]/service with { date, mileage, title, guideId }). A host
 * with no such context (the admin test guide, the local preview) omits `save`
 * and the sheet shows saving as unavailable. There is no fallback fake save.
 */
export interface WrenchCompletionConfig {
  save?: (entry: {
    /** yyyy-mm-dd, local date at the moment of saving. */
    date: string;
    mileage: number;
    /** The canonical guide title, same string the guide itself displays. */
    title: string;
    guideId: string;
  }) => Promise<void>;
  /** Shown in the sheet so the user can see which vehicle will be credited. */
  vehicleLabel?: string;
  /** Why saving is unavailable, when `save` is absent. */
  unavailableReason?: string;
}
