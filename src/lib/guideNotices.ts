// Presentation-only sorting of the warning text in uncertified (preview) guides.
//
// The BMW guides carry the same evidence-limitation sentence on nearly every step ("Based on independent websites, not a BMW
// document..."), which buried the few warnings that matter. This module separates each piece of warning text into:
//   - evidence flags: the fixed source-limitation sentences. Shown once per step in a collapsed "Evidence" control and
//     gathered into the guide's Evidence & Sources section. NEVER dropped.
//   - the remaining text: classified "blocked", "caution" (anything that could hurt someone or break the car, shown red)
//     or "note" (a practical tip, shown plain). The default when unsure is "caution".
// It only splits text. Nothing is rewritten, so `body + flags` always contains every original sentence
// (tests/guide-notices.test.mjs rebuilds every BMW warning and safety line from the parts).

import type { RepairGuide, RepairStep, TorqueSpec } from "@/types/vehicle";

/** The fixed evidence sentences the BMW generator appends. Exact text, matched whole. */
export const EVIDENCE_SENTENCES: readonly RegExp[] = [
  /⚠ Based on independent websites, not a BMW document\. Confirm against your owner's manual before relying on it\./g,
  /⚠ Only one source supports this step\. Confirm before relying on it\./g,
  /⚠ Sources disagree on this step\. Confirm before relying on it\./g,
  /⚠ No source confirms this step\. Confirm before relying on it\./g,
  /⚠ Check each item against your car before buying parts\./g,
];

/** The guide-wide "not verified" line that opens safety[]. Moves into the single guide notice, verbatim. */
export const GUIDE_DISCLAIMER = /^⚠ This guide is not yet verified against BMW repair data\./;

const BLOCKED = /^⛔/;

/** Words that make a warning a real safety caution. Anything matching stays red; only text matching none of them is a plain note. */
const CAUTION =
  /\b(never|do not|don't|must not|stop\b|danger|fatal|injur|burn|scald|fire\b|shock|high voltage|eye protection|gloves?|hot\b|pressur|spring force|fly off|brittle|snap|break|crack|damage|heavy|toxic|poison|spark|pinch|crush|reuse|jack\b|chock)\b/i;

export type NoticeKind = "blocked" | "caution" | "note";

export interface SplitText {
  /** What is left after the evidence sentences are taken out, whitespace tidied. May be empty. */
  body: string;
  /** The evidence sentences found, verbatim, in order of appearance. */
  flags: string[];
}

export function splitEvidence(text: string | undefined | null): SplitText {
  if (!text) return { body: "", flags: [] };
  const found: { at: number; s: string }[] = [];
  let rest = text;
  for (const re of EVIDENCE_SENTENCES) {
    const r = new RegExp(re.source, "g");
    for (const m of text.matchAll(r)) found.push({ at: m.index ?? 0, s: m[0] });
    rest = rest.replace(r, " ");
  }
  found.sort((a, b) => a.at - b.at);
  return { body: rest.replace(/\s+/g, " ").trim(), flags: found.map((f) => f.s) };
}

export interface StepNotice {
  kind: NoticeKind | null;
  /** The warning text without evidence sentences. Blocked steps keep their whole text. */
  text: string;
  flags: string[];
}

export function classifyStepWarning(warning: string | undefined | null): StepNotice {
  if (!warning) return { kind: null, text: "", flags: [] };
  if (BLOCKED.test(warning.trim())) return { kind: "blocked", text: warning, flags: [] };
  const { body, flags } = splitEvidence(warning);
  if (!body) return { kind: null, text: "", flags };
  return { kind: CAUTION.test(body) ? "caution" : "note", text: body, flags };
}

/** True when a guide is built from this evidence machinery, so only those guides get the consolidated presentation. */
export function usesEvidenceNotices(guide: Pick<RepairGuide, "safety" | "steps">): boolean {
  if (guide.safety.some((s) => GUIDE_DISCLAIMER.test(s))) return true;
  return guide.steps.some((s) => splitEvidence(s.warning).flags.length > 0);
}

export interface GuideNotices {
  /** The general disclaimer, verbatim, shown once in the guide notice instead of inside the safety list. */
  disclaimer: string | null;
  /** Safety lines with the disclaimer removed and evidence sentences taken out of the others. */
  safety: string[];
  /** Evidence sentences taken out of safety lines: the line they came from (its text) and the sentences. */
  safetyEvidence: { line: string; flags: string[] }[];
  /** One entry per step that carries evidence sentences. */
  stepEvidence: { number: number; title: string; flags: string[] }[];
}

export function buildGuideNotices(guide: Pick<RepairGuide, "safety" | "steps">): GuideNotices {
  let disclaimer: string | null = null;
  const safety: string[] = [];
  const safetyEvidence: GuideNotices["safetyEvidence"] = [];
  for (const line of guide.safety) {
    if (GUIDE_DISCLAIMER.test(line)) {
      disclaimer = line;
      continue;
    }
    const { body, flags } = splitEvidence(line);
    if (flags.length) safetyEvidence.push({ line: body || line, flags });
    if (body) safety.push(body);
  }
  const stepEvidence: GuideNotices["stepEvidence"] = [];
  guide.steps.forEach((s: RepairStep, i) => {
    const { flags } = splitEvidence(s.warning);
    if (flags.length) stepEvidence.push({ number: s.number ?? i + 1, title: s.title, flags });
  });
  return { disclaimer, safety, safetyEvidence, stepEvidence };
}

/** A torque or spec value that is not confirmed: a VERIFY placeholder, or a figure whose own note says no BMW document backs it. */
export function isUnverifiedTorque(t: Pick<TorqueSpec, "value" | "notes">): boolean {
  return /VERIFY/.test(t.value) || /no BMW document was available|not confirmed|sources conflict/i.test(t.notes ?? "");
}
