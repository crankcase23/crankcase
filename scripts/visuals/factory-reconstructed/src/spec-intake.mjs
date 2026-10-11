// RECONSTRUCTED-V1 | NOT the lost original.
// VISUAL SPECIFICATION INTAKE. The original spec file format (`step-10-intake-duct.v3.spec.md`) is LOST (UNKNOWN).
// What survives is the Step 10 handoff PROMPT (documentation), which is itself a rendered projection of a contract:
// SUBJECT / FRAMING / MUST SHOW (ranked) / MAY SHOW / MUST NOT SHOW / NO TEXT / CLEAR SPACE.
// This module parses THAT surviving prompt format. It is a reconstruction aid; it does not claim to be the original intake.
import { sha256 } from "./canon.mjs";
import { P } from "./evidence.mjs";

const section = (text, label) => {
  const m = text.match(new RegExp(`(?:^|\\n)${label}[^\\n]*?:\\s*\\n?([\\s\\S]*?)(?=\\n[A-Z][A-Z ]{3,}[^\\n]*:|$)`));
  return m ? m[1].trim() : null;
};

export function parseVisualSpecPrompt(text) {
  const problems = [];
  const norm = text.replace(/\r\n/g, "\n");
  const subject = section(norm, "SUBJECT");
  const framing = section(norm, "FRAMING");
  const mustShowRaw = section(norm, "MUST SHOW");
  const mayRaw = section(norm, "MAY SHOW");
  const mustNotRaw = section(norm, "MUST NOT SHOW");
  const noText = /\nNO TEXT of any kind/.test(norm);
  const clear = section(norm, "CLEAR SPACE");
  for (const [k, v] of Object.entries({ subject, framing, mustShowRaw, mayRaw, mustNotRaw, clear })) if (!v) problems.push(P("SPEC_SECTION_MISSING", "missing", `section ${k} not found`));
  if (!noText) problems.push(P("SPEC_SECTION_MISSING", "missing", "NO TEXT clause not found"));
  if (problems.length) return { ok: false, problems };

  const mustShow = mustShowRaw.split("\n").map((l) => l.match(/^(\d+)\.\s+(.*)$/)).filter(Boolean).map((m) => ({ rank: Number(m[1]), text: m[2].trim() }));
  const may = mayRaw.replace(/^\(.*?\):?\s*/, "").replace(/\.\s.*$/s, "").split(/,/).map((x) => x.replace(/^\s*(and)\s+/i, "").trim()).filter(Boolean);
  const mustNot = mustNotRaw.replace(/^\(.*?\):?\s*/, "").replace(/\.\s*$/, "").split(/,/).map((x) => x.replace(/^\s*(and|or)\s+/i, "").trim()).filter(Boolean);
  const bands = [...clear.matchAll(/the (top|bottom) (\d+)%-(\d+)% of the height/g)].map((m) => ({ band: m[1], fromPct: Number(m[2]), toPct: Number(m[3]) }));
  const asp = framing.match(/exactly (\d+):(\d+)/), min = framing.match(/(\d+)x(\d+) px or larger/);
  const spec = {
    schema: "reconstructed.visual-spec", sourceKind: "documentation-derived-prompt",
    subject, textOnly: /Text-only prompt/.test(norm) && /do not use, request or trace any reference image/.test(norm),
    framing: { aspect: asp ? [Number(asp[1]), Number(asp[2])] : null, minPx: min ? [Number(min[1]), Number(min[2])] : null },
    mustShow, maySimplify: may, mustNotShow: mustNot, noText, clearSpace: bands, sourcePromptSha256: sha256(Buffer.from(text, "utf8")),
  };
  if (!spec.framing.aspect || !spec.framing.minPx) problems.push(P("SPEC_FRAMING", "malformed", "could not read aspect / minimum pixels"));
  if (spec.mustShow.length === 0) problems.push(P("SPEC_MUST_SHOW", "malformed", "no ranked MUST SHOW items"));
  if (spec.mustNotShow.length === 0) problems.push(P("SPEC_MUST_NOT", "malformed", "no MUST NOT SHOW items"));
  return problems.length ? { ok: false, problems, spec } : { ok: true, problems: [], spec };
}

/**
 * Diagnostic (RECONSTRUCTED, not an original gate): text/visual consistency, CG-QA-v1.0 §11 idea.
 * Which MUST NOT SHOW items does the step text name? An item matches when one of its DISTINCTIVE words appears in the text
 * (generic words like hose/connector/cover are ignored so "breather hose" does not match a step that merely says "intake hose").
 */
const GENERIC = new Set(["any", "second", "or", "red", "locking", "feature", "on", "the", "a", "an", "of", "and", "hose", "hoses", "connector", "unit", "cover", "plain", "features", "air"]);
export function stepTextVsSpec(stepText, spec) {
  const words = new Set(stepText.toLowerCase().match(/[a-z]+/g) ?? []);
  const stem = (w) => w.replace(/(es|s)$/, "");
  const textStems = new Set([...words].map(stem));
  return spec.mustNotShow.filter((n) => (n.toLowerCase().match(/[a-z]+/g) ?? []).filter((w) => !GENERIC.has(w)).some((w) => textStems.has(stem(w))));
}
