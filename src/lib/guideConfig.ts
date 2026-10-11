import type { ConfigAxis, ConfigScope, RepairStep, ResolvedGuide, TorqueSpec } from "@/types/vehicle";
import { choiceLabel, confirmedValue, configKey, type VehicleConfig } from "@/lib/vehicleConfig";

// Configuration-aware guide resolution.
//
// A guide is authored once. Content that depends on the customer's transmission or drivetrain carries a `forConfig`
// scope (see ConfigScope in src/types/vehicle.ts), and the guide as a whole may declare `evidenceFor`, the builds its
// research actually covers. resolveGuideForConfig() turns the authored guide plus the customer's SAVED configuration
// into the guide they are shown, in Planning Mode and Wrench Mode alike. It is pure: same inputs, same output.
//
// For every scoped item, per axis it names:
//   confirmed and in the scope       -> shown
//   confirmed and not in the scope   -> removed (an xDrive procedure is never shown to a rear-wheel-drive car)
//   not confirmed (unknown / unset)  -> RESTRICTED: it cannot be decided, so the content is withheld until it is confirmed
// Nothing is guessed: an unconfirmed axis never defaults to the common case, and a missing variant is never invented.
//
// Rules that keep this safe:
//   * A guide with no scoped content and no evidenceFor comes back with its content untouched (only a "none" resolution is
//     attached), so every other vehicle's guides, and every guide that does not depend on the build, read exactly as before.
//   * Content with no forConfig is universal and always stays, including every warning and every blocked step.
//   * Restricting never relaxes a rule: a restricted torque row carries no number, and a restricted step carries no procedure.

export type ConfigStatus =
  /** The guide does not depend on the build: shown as authored. */
  | "none"
  /** Every axis the guide depends on is confirmed: the procedure for that build. */
  | "applied"
  /** At least one needed axis is not confirmed: some content is restricted until it is. */
  | "needs-confirmation"
  /** The confirmed build is outside what the guide's evidence covers: no procedure is shown. */
  | "unavailable";

export interface ConfigResolution {
  status: ConfigStatus;
  /** Identity of the configuration this was resolved under (see configKey). */
  key: string;
  /** Axes the customer still has to confirm for this guide to be complete. */
  pendingAxes: ConfigAxis[];
  /** Steps, tools, parts and torque rows withheld because their axis is not confirmed. */
  restrictedCount: number;
  /** Items removed because they belong to a build the customer does not have. */
  hiddenCount: number;
  /** Plain words for the customer when status is "unavailable". */
  unavailableReason?: string;
}

export type ConfigResolvedGuide = ResolvedGuide & { configResolution: ConfigResolution };

export const RESTRICTED_PREFIX = "⛔ RESTRICTED — ";
export const UNAVAILABLE_PREFIX = "⛔ NOT AVAILABLE — ";
export const CONFIRM_TORQUE = "⚠ CONFIRM YOUR CONFIGURATION TO SEE THIS FIGURE";

type Verdict = "show" | "hide" | "restrict";

const AXES: ConfigAxis[] = ["transmission", "drivetrain"];

function verdictFor(scope: ConfigScope | undefined, config: VehicleConfig | null): { verdict: Verdict; pending: ConfigAxis[] } {
  if (!scope) return { verdict: "show", pending: [] };
  let verdict: Verdict = "show";
  const pending: ConfigAxis[] = [];
  for (const axis of AXES) {
    const allowed = scope[axis] as string[] | undefined;
    if (!allowed || allowed.length === 0) continue; // this content does not depend on this axis
    const have = confirmedValue(config, axis);
    if (have == null) {
      pending.push(axis);
      if (verdict === "show") verdict = "restrict";
    } else if (!allowed.includes(have)) {
      verdict = "hide"; // a confirmed mismatch beats an unconfirmed other axis
    }
  }
  if (verdict === "hide") return { verdict, pending: [] };
  return { verdict, pending };
}

/** True when anything in the guide depends on the build, so the UI knows to wait for the saved configuration. */
export function guideDependsOnConfig(guide: ResolvedGuide): boolean {
  return Boolean(
    guide.evidenceFor ||
      guide.configParts?.length ||
      guide.steps.some((s) => s.forConfig || s.torque?.some((t) => t.forConfig)) ||
      guide.tools.some((t) => t.forConfig) ||
      guide.torqueSpecs.some((t) => t.forConfig),
  );
}

const SENT_SPLIT = /(?<=[.!?\]])\s+(?=[A-Z⚠⛔\[])/;
const STEP_REF = /\b([Ss]teps?) (\d{1,2})(?:(\s*(?:to|-|–)\s*|\s+(?:and|or)\s+)(\d{1,2}))?\b/g;

/**
 * Re-points "step N" references after steps were removed, so no text sends a reader to the wrong step.
 * `map` is old 1-based position -> new 1-based position, or null where the step is gone. A sentence whose
 * reference cannot be resolved is dropped rather than left pointing somewhere else.
 */
function relink(text: string | undefined, map: (number | null)[]): string | undefined {
  if (!text) return text;
  const out: string[] = [];
  for (const sent of text.split(SENT_SPLIT)) {
    let dead = false;
    const fixed = sent.replace(STEP_REF, (m, word: string, a: string, sep: string | undefined, b: string | undefined) => {
      const first = (n: number) => {
        for (let i = n; i < map.length + 1; i++) if (map[i - 1] != null) return map[i - 1] as number;
        return null;
      };
      const last = (n: number) => {
        for (let i = n; i >= 1; i--) if (map[i - 1] != null) return map[i - 1] as number;
        return null;
      };
      const A = Number(a);
      if (!b) {
        const to = map[A - 1];
        if (to == null) { dead = true; return m; }
        return `${word} ${to}`;
      }
      const B = Number(b);
      if (/\b(and|or)\b/.test(sep ?? "")) {
        const x = map[A - 1], y = map[B - 1];
        if (x == null || y == null) { dead = true; return m; }
        return `${word} ${x} ${(sep ?? "").trim()} ${y}`;
      }
      const x = first(A), y = last(B);
      if (x == null || y == null || x > y) { dead = true; return m; }
      return `${word} ${x}${/to/.test(sep ?? "") ? " to " : "-"}${y}`;
    });
    if (!dead) out.push(fixed);
  }
  return out.join(" ");
}

const AXIS_WORD: Record<ConfigAxis, string> = { transmission: "transmission", drivetrain: "drivetrain" };
const sayAxes = (axes: ConfigAxis[]) => axes.map((a) => AXIS_WORD[a]).join(" and ");

function restrictedStep(step: RepairStep, pending: ConfigAxis[]): RepairStep {
  return {
    number: step.number,
    title: RESTRICTED_PREFIX + step.title,
    instructions: `This step depends on your ${sayAxes(pending)}, which is not confirmed yet. Confirm it with Edit Configuration and this step will show the right procedure for your car. Do not guess.`,
    warning: "⛔ RESTRICTED — confirm your configuration before doing this step.",
  };
}

function describe(config: VehicleConfig | null, make?: string): string {
  const parts = AXES.map((a) => confirmedValue(config, a)).map((v, i) => (v ? choiceLabel(AXES[i], v, make) : null)).filter(Boolean);
  return parts.length ? parts.join(", ") : "not set";
}

/**
 * The guide this customer should see. `config` is the saved configuration of THEIR vehicle (null when it is not
 * known, e.g. signed out): every axis is then unconfirmed and scoped content is restricted.
 */
export function resolveGuideForConfig(guide: ResolvedGuide, config: VehicleConfig | null, make?: string): ConfigResolvedGuide {
  const key = configKey(config);
  if (!guideDependsOnConfig(guide)) {
    return withNone(guide, key);
  }

  const pendingAxes = new Set<ConfigAxis>();
  let restrictedCount = 0;
  let hiddenCount = 0;

  // 1. Is the confirmed build inside what the guide's research covers?
  let unavailableReason: string | undefined;
  if (guide.evidenceFor) {
    for (const axis of AXES) {
      const covered = guide.evidenceFor[axis] as string[] | undefined;
      if (!covered || covered.length === 0) continue;
      const have = confirmedValue(config, axis);
      if (have == null) pendingAxes.add(axis);
      else if (!covered.includes(have)) {
        const coveredLabels = covered.map((c) => choiceLabel(axis, c as never, make)).join(" or ");
        unavailableReason =
          `This guide was researched for ${coveredLabels} cars only, and your ${AXIS_WORD[axis]} is set to ${choiceLabel(axis, have as never, make)}. ` +
          `There is no verified procedure for your build yet, so none is shown.` +
          (guide.evidenceNote ? ` ${guide.evidenceNote}` : "") +
          ` If your ${AXIS_WORD[axis]} is set wrong, correct it with Edit Configuration.`;
        break;
      }
    }
  }
  if (unavailableReason) {
    return {
      ...guide,
      tools: [],
      parts: [],
      torqueSpecs: [],
      // Warnings stay, but a note that quotes a torque or capacity figure belongs to a build this guide does not cover.
      safety: guide.safety.filter((n) => !/\d\s*(nm|n·m|lb[- ]?ft|ft[- ]?lb|in[- ]?lb|qt|quarts?|litres?|liters?|l)\b/i.test(n)),
      steps: [
        {
          number: 1,
          title: UNAVAILABLE_PREFIX + "No verified procedure for your configuration",
          instructions: unavailableReason,
          warning: "⛔ NOT AVAILABLE — do not use this guide on a build it was not researched for.",
        },
      ],
      variantParts: undefined,
      configParts: undefined,
      configResolution: { status: "unavailable", key, pendingAxes: [], restrictedCount: 0, hiddenCount: guide.steps.length, unavailableReason },
    };
  }

  // 2. Steps: drop other builds, restrict undecided ones, renumber, then re-point step references.
  const oldToNew: (number | null)[] = [];
  const kept: RepairStep[] = [];
  const stepRows = (rows?: TorqueSpec[]) => {
    if (!rows) return rows;
    const out: TorqueSpec[] = [];
    for (const t of rows) {
      const v = verdictFor(t.forConfig, config);
      if (v.verdict === "hide") { hiddenCount++; continue; }
      if (v.verdict === "restrict") {
        v.pending.forEach((a) => pendingAxes.add(a));
        restrictedCount++;
        out.push({ fastener: t.fastener, value: CONFIRM_TORQUE, notes: "Depends on your build. Confirm your configuration to see it." });
        continue;
      }
      out.push(t);
    }
    return out;
  };
  for (const step of guide.steps) {
    const v = verdictFor(step.forConfig, config);
    if (v.verdict === "hide") { oldToNew.push(null); hiddenCount++; continue; }
    if (v.verdict === "restrict") {
      v.pending.forEach((a) => pendingAxes.add(a));
      restrictedCount++;
      kept.push(restrictedStep(step, v.pending));
    } else {
      kept.push({ ...step, ...(step.torque ? { torque: stepRows(step.torque) } : {}) });
    }
    oldToNew.push(kept.length);
  }
  const removedAny = oldToNew.some((n) => n == null);
  const numbered = kept.map((s, i) => ({ ...s, number: i + 1 }));
  const fix = (t?: string) => (removedAny ? relink(t, oldToNew) : t);
  const steps = numbered.map((s) => ({
    ...s,
    instructions: fix(s.instructions) ?? "",
    ...(s.warning ? { warning: fix(s.warning) } : {}),
  }));

  // 3. Tools, torque table and config-dependent parts.
  const tools = guide.tools.filter((t) => {
    const v = verdictFor(t.forConfig, config);
    if (v.verdict === "hide") { hiddenCount++; return false; }
    if (v.verdict === "restrict") { v.pending.forEach((a) => pendingAxes.add(a)); restrictedCount++; return false; }
    return true;
  });
  const torqueSpecs = stepRows(guide.torqueSpecs) ?? [];
  const configParts: string[] = [];
  for (const p of guide.configParts ?? []) {
    const v = verdictFor(p.forConfig, config);
    if (v.verdict === "hide") { hiddenCount++; continue; }
    if (v.verdict === "restrict") { v.pending.forEach((a) => pendingAxes.add(a)); restrictedCount++; continue; }
    configParts.push(p.text);
  }

  const pending = AXES.filter((a) => pendingAxes.has(a));
  return {
    ...guide,
    summary: fix(guide.summary) ?? guide.summary,
    safety: guide.safety.map((s) => fix(s) ?? s).filter(Boolean),
    tools,
    parts: [...configParts, ...guide.parts],
    torqueSpecs: torqueSpecs.map((t) => ({ ...t, notes: fix(t.notes) })),
    steps,
    configParts: undefined,
    configResolution: {
      status: pending.length ? "needs-confirmation" : "applied",
      key,
      pendingAxes: pending,
      restrictedCount,
      hiddenCount,
    },
  };
}

function withNone(guide: ResolvedGuide, key: string): ConfigResolvedGuide {
  return { ...guide, configResolution: { status: "none", key, pendingAxes: [], restrictedCount: 0, hiddenCount: 0 } };
}

/** The sentence a customer reads about how their configuration shaped this guide. */
export function configSummaryLine(config: VehicleConfig | null, make?: string): string {
  return describe(config, make);
}
