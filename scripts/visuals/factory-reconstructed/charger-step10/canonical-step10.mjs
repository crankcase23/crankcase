// RECONSTRUCTED-V1 | NOT the lost original.  CHARGER #001 / STEP 10 — PROPOSED CANONICAL CONTRACT (C-5).
// STATUS: PROPOSED. It resolves CF-01…CF-09 (charger-step10/conflicts.mjs) in ONE contract, pending Andy/Hermes acceptance.
// It does NOT modify any recovered original (recovered/ is hash-frozen) and generates NO artwork.
//
// PRIORITY RULE (Andy, C-5): "Mechanical truth beats old visual wording. A visual prompt must conform to the actual procedure, not the other way around."
// The ONLY surviving statement of the mechanical procedure is the guide's own step-10 text, so that text is the anchor: everything below is derived from it
// (verbatim, not paraphrased). Where an old visual constraint (prompt/manifest/shot-list wording) would make the picture misrepresent that action, the
// constraint is dropped. No automotive fact is invented: anything about how the real 2016 Charger SXT 3.6L parts look or sit is isolated in VERIFICATION
// (VV-xx) and must be established by reference evidence before it may be drawn. Until then the contract says what MUST be shown and what may NOT be
// claimed, never what the part looks like.
import { CONFLICTS } from "./conflicts.mjs";

export const BANNER = "THIS GUIDE FACTORY IMPLEMENTATION IS RECONSTRUCTED FROM SURVIVING EVIDENCE. IT IS NOT THE LOST ORIGINAL IMPLEMENTATION.";
export const STATUS = "PROPOSED (C-5) — pending Andy/Hermes acceptance. Recovered originals unchanged. No artwork generated.";

// ---- anchors copied VERBATIM from recovered/src/data/admin-test-guides/charger-2016-sxt-multi-job.ts (tests re-read the file and compare)
export const GUIDE_STEP = Object.freeze({
  number: 10,
  title: "Remove intake duct",
  text: "Disconnect the IAT electrical connector. Loosen the clamp at the throttle body. Loosen the clamp at the air-cleaner housing. Release the intake assembly from its retaining grommet. Remove the intake hose/resonator assembly.",
});

// ---- action sequence: one image, five actions, one callout each, in the guide's own order
export const ACTIONS = Object.freeze([
  { n: 1, sentence: "Disconnect the IAT electrical connector.", target: "iat-connector", callout: "IAT connector" },
  { n: 2, sentence: "Loosen the clamp at the throttle body.", target: "throttle-body-clamp", callout: "Throttle-body clamp" },
  { n: 3, sentence: "Loosen the clamp at the air-cleaner housing.", target: "air-cleaner-housing-clamp", callout: "Air-cleaner housing clamp" },
  { n: 4, sentence: "Release the intake assembly from its retaining grommet.", target: "retaining-grommet", callout: "Retaining grommet" },
  { n: 5, sentence: "Remove the intake hose/resonator assembly.", target: "intake-hose-resonator-assembly", callout: "Intake hose/resonator" },
]);
export const CALLOUT_LABELS = Object.freeze(ACTIONS.map((a) => a.callout));

// ---- terminology dictionary
export const TERMS = Object.freeze([
  { term: "intake duct", status: "CANONICAL (title only)", meaning: "The guide step's title word for the removable intake assembly of this step. Used in the step title only.", use: "title" },
  { term: "intake hose/resonator assembly", status: "CANONICAL (assembly name)", meaning: "The one removable assembly named in the guide's action 5 and referred to as 'the intake assembly' in action 4. Hose and resonator are parts of this single assembly in this step; neither is a separately removed part.", use: "instruction text (verbatim), alt text, callout 'Intake hose/resonator'" },
  { term: "intake hose", status: "CANONICAL (part of the assembly)", meaning: "The hose portion of the assembly. Not a separate callout; the assembly is the callout target.", use: "descriptive only" },
  { term: "resonator", status: "CANONICAL (part of the assembly)", meaning: "The resonator portion of the assembly, as named by the guide. Never listed as separately removed, shown, or hidden. Whether it is a visibly distinct section is VV-02.", use: "descriptive only" },
  { term: "air-cleaner housing", status: "CANONICAL (component name)", meaning: "The component at the far end of the assembly from the throttle body, named in guide action 3.", use: "instruction text, callout 'Air-cleaner housing clamp'" },
  { term: "throttle body", status: "CANONICAL", meaning: "The component at the engine end of the assembly, named in guide action 2.", use: "instruction text, callout 'Throttle-body clamp'" },
  { term: "IAT electrical connector", status: "CANONICAL; short form 'IAT connector' for callouts", meaning: "The electrical connector named in guide action 1.", use: "instruction text; callout 'IAT connector'" },
  { term: "retaining grommet", status: "CANONICAL", meaning: "The grommet that retains the intake assembly (guide action 4). Not the engine-cover grommets of guide step 2.", use: "instruction text, callout 'Retaining grommet'" },
  { term: "air inlet duct", status: "LEGACY alias (old manifest 'component')", meaning: "Same assembly as 'intake duct' by the manifest's own usage. Not used in any customer-facing text or in the visual brief.", use: "never" },
  { term: "air intake hose", status: "LEGACY alias (old prompt 'Step:')", meaning: "Old prompt's name for the hero. Narrower than the guide's 'intake hose/resonator assembly'. Banned from customer-facing text and the brief.", use: "never" },
  { term: "air box", status: "LEGACY alias (old prompt/shot list); ASSUMED same component as air-cleaner housing", meaning: "Not confirmed to be the same part as the air-cleaner housing (VV-03). Banned from customer-facing text and the brief; the guide's term wins.", use: "never" },
  { term: "IAT clip", status: "LEGACY alias (old shot-list rationale)", meaning: "Guide says 'IAT electrical connector'; a 'clip' is a different claim about the mechanism. Banned.", use: "never" },
]);
export const BANNED_ALIASES = Object.freeze(["air box", "air inlet duct", "air intake hose", "iat clip"]);

// ---- representation rules (what the picture may and may not CLAIM)
export const RULES = Object.freeze({
  clamp: "Both clamps are shown as clamps on the assembly, each unobstructed, with its TIGHTENING point visible to the viewer, because the action is to LOOSEN it and an image that hides the tightening point misrepresents the action. The tightening feature's TYPE, HEAD and side are drawn ONLY from established evidence (ledger attributes fastener-position and fastener-head-type, both safety-critical); until established the step is BLOCKED, not guessed. No torque, size or direction-of-turn is stated.",
  connector: "The IAT connector is shown fully visible and unobstructed, as a plain connector attached to what it connects to, with its callout arrow touching it. Release or locking detail is drawn ONLY if established (release-mechanism-geometry is safety-critical); otherwise it is drawn plain, the instruction text carries the action, and the standing 'Simplified illustration' disclosure applies. No colours, tabs, pins or latches are invented.",
  grommet: "The retaining grommet IS shown and IS the fourth callout, because guide action 4 acts on it. Its type and location are drawn only from established evidence (VV-01). The engine-cover fixings of step 2 are never drawn (the cover is already removed).",
  resonator: "The resonator is NOT a separate part, callout or prohibition. The hero is the guide's intake hose/resonator assembly. Only the sections evidence establishes are drawn (hose, resonator, and the join between them as evidence shows it); no section, seam or ring is invented or denied.",
  assembly: "One assembly, drawn as the assembly the evidence shows, running from the throttle body to the air-cleaner housing.",
});

// ---- legacy constraints WITHDRAWN by this proposal (documentation only; never fed into a brief)
export const WITHDRAWN = Object.freeze([
  { cf: "CF-02", was: "MUST NOT SHOW: hose grommet", because: "guide action 4 acts on the grommet" },
  { cf: "CF-03", was: "MUST NOT SHOW: resonator; 'No seam, joint or ring between the two sections'", because: "guide action 5 removes a hose/resonator assembly; the seamless construction is unverified" },
  { cf: "CF-07", was: "'Do NOT show the screw … rotate the clamp so that side faces away from the viewer'", because: "the action is to loosen the clamp; hiding the tightening point misrepresents it" },
  { cf: "CF-08", was: "'partly hidden behind the hose edge'; 'no release tab, no pins, no colours, no locking features'; 'any second or red locking feature' as a blanket ban", because: "the callout must touch a visible connector; release detail is evidence-gated rather than banned" },
  { cf: "CF-05", was: "'Four actions on one assembly: IAT clip, two clamps, then lift the hose out.'", because: "the guide has five actions and says connector, not clip" },
  { cf: "CF-01/06", was: "'air intake hose', 'air inlet duct', 'air box'", because: "legacy aliases; the guide's wording wins" },
]);

// ---- the canonical visual contract (inputs to the Guide Factory EP/VC; NOT artwork)
export const CANONICAL = Object.freeze({
  status: STATUS,
  title: GUIDE_STEP.title,
  instructionText: GUIDE_STEP.text,
  visualSubject: "The engine bay of a 2016 Dodge Charger SXT with the 3.6L Pentastar V6, engine cover already removed (guide step 2), showing the intake assembly between the throttle body and the air-cleaner housing with every part that the five actions touch unobstructed in one view.",
  mustShow: Object.freeze([
    { id: "intake-hose-resonator-assembly", role: "hero", rank: 1 }, { id: "throttle-body-clamp", role: "target", rank: 2 }, { id: "air-cleaner-housing-clamp", role: "target", rank: 3 },
    { id: "iat-connector", role: "target", rank: 4 }, { id: "retaining-grommet", role: "target", rank: 5 }, { id: "throttle-body", role: "target", rank: 6 }, { id: "air-cleaner-housing", role: "target", rank: 7 },
  ]),
  maySimplifyDim: Object.freeze(["cowl trough along the top edge", "radiator-support cover along the bottom edge", "inner fender walls", "strut-tower caps as plain domes", "plain engine-top mass", "plain coolant reservoir", "plain washer-fluid bottle", "intake plenum (only if established)", "one plain de-emphasized box for the battery/power-distribution box"]),
  mustNotShow: Object.freeze(["engine cover (removed in step 2)", "the engine-cover fixings of step 2", "breather hose (unless VV-07 shows it is attached to the assembly)", "fresh-air snorkel (unless VV-07 shows it is attached to the assembly)", "wipers", "hood hinges or struts", "wiring looms", "coolant hoses", "ABS unit", "oil cap or dipstick", "engine badges, logos, brand marks, licence plates", "any release/locking/fastener detail not established by evidence", "any part not listed in mustShow or maySimplifyDim", "text of any kind in the image"]),
  callouts: CALLOUT_LABELS, actions: ACTIONS, terminology: TERMS, rules: RULES,
  framing: Object.freeze({ aspect: "16:10", minPx: [1600, 1000], view: "front-elevated, about 50-55 degrees above horizontal, centred at the front of the bay, looking rearward, mild perspective", style: "simplified flat-shaded technical illustration, not photorealistic", clearSpaceTopPct: [3, 17], clearSpaceBottomPct: [83, 97], viewpointCondition: "VV-08: all five callout targets must be unobstructed from this viewpoint; if not, the viewpoint changes, the actions are not hidden" }),
  route: Object.freeze({ id: "generated-raster-text-only", via: "reconstructed Guide Factory (EP → VC → generation → QA → normalization → overlay → approval)", imageInputs: "none; reference evidence is reference-only and never an image input", rejected: ["raw photograph (old manifest route: no source, licence or verification survives)", "original vector artwork (shot-list route: its controlling v3 spec is lost; factory has no SVG path, U-18)"] }),
  evidence: Object.freeze({
    perElement: "ESTABLISHED ledger rows citing real reference ids for existence and location of all seven mustShow elements",
    relationships: "the assembly runs between the throttle body and the air-cleaner housing; each clamp sits at its end; the grommet retains the assembly; the connector's attachment point",
    ifDrawn: ["clamp: hardware-type, fastener-position, fastener-head-type (safety-critical)", "connector: hardware-type, release-mechanism-geometry (safety-critical)", "grommet: hardware-type, relationship (what it retains)", "assembly: fine-detail-geometry of its sections (hose, resonator, join)"],
    never: "an image input, a trace, or any fact taken from an old prompt/manifest/shot list instead of a reference",
  }),
  qa: Object.freeze({
    internal: "claude-qa content-stage review (may fail/pass; never certifies its own output)",
    independent: "Hermes / ChatGPT / GPT-5.6 Sol — actor hermes, GPT/ChatGPT model string, Hermes/ChatGPT/OpenAI system string, sha256 of the raw response; only this PASS admits output",
    contractChecks: ["every mustShow element present and unobstructed", "every mustNotShow item absent", "PROVENANCE", "all five callout targets visible from the chosen viewpoint", "clamp tightening point visible and drawn only from evidence", "connector fully visible; release detail only if established", "retaining grommet shown", "hero composition matches evidence (no invented sections or seams)", "no text anywhere in the image", "16:10, ≥1600x1000, clear-space bands plain"],
    overlay: "hermes confirms each of the five callout arrows touches the component its label names (PASS_OVERLAY, max 3 rounds)",
    disclosure: "Simplified illustration",
    caps: "initial generation + 3 corrections; metadata retry: initial + up to 3 resubmissions, 4th rejection → NEEDS_ANDY (canonical, U-22)",
  }),
  ownership: "Generated Crankcase assets are Redline Origin / Crankcase project assets, subject to the generation provider's applicable usage rights. No ownership claim beyond the rights the provider actually grants.",
});

// ---- facts that REQUIRE VEHICLE-SPECIFIC VERIFICATION (nothing here may be drawn or stated as fact until established)
export const VERIFICATION = Object.freeze([
  { id: "VV-01", fact: "What the 'retaining grommet' is: which part retains the intake assembly, its type and location, and that it is not one of the step-2 engine-cover grommets", blocks: "grommet drawing + callout 4", attributes: "existence, location, hardware-type, relationship" },
  { id: "VV-02", fact: "Composition of the intake hose/resonator assembly on this vehicle: its sections, whether the resonator is a visibly distinct section, and how sections join", blocks: "hero drawing", attributes: "existence, relationship, fine-detail-geometry" },
  { id: "VV-03", fact: "Whether 'air box' and 'air-cleaner housing' are the same component (assumed, unproven) and the customer-facing name the vehicle's own service documentation uses", blocks: "air-cleaner housing drawing + callout 3 label", attributes: "existence, location" },
  { id: "VV-04", fact: "Clamp style on both ends, where each tightening point sits relative to the viewpoint, and its head type", blocks: "clamp drawing + callouts 2-3", attributes: "hardware-type, fastener-position, fastener-head-type (safety-critical)" },
  { id: "VV-05", fact: "IAT connector: where it sits (on the assembly, on a sensor in it, on the housing), connector type, release mechanism, lead", blocks: "connector drawing + callout 1", attributes: "location, hardware-type, release-mechanism-geometry (safety-critical)" },
  { id: "VV-06", fact: "That the guide's action ORDER and completeness are mechanically right for this vehicle (anything attached to the assembly that the five actions omit)", blocks: "acceptance of the step text itself", attributes: "action, relationship" },
  { id: "VV-07", fact: "Whether a breather hose, fresh-air snorkel or other hose is attached to the assembly (if so the step text is incomplete and CF-02/CF-03 reopen)", blocks: "mustNotShow list for breather/snorkel", attributes: "existence, relationship" },
  { id: "VV-08", fact: "That one front-elevated viewpoint can show all five callout targets unobstructed", blocks: "viewpoint / single-image decision", attributes: "orientation, location" },
]);

export const RESOLUTIONS = Object.freeze([
  { id: "CF-01", canonical: "Title 'Remove intake duct' (guide, unchanged). The removable thing is the 'intake hose/resonator assembly' (guide wording, unchanged). 'air inlet duct', 'air intake hose' are legacy aliases and are banned from customer-facing text and the brief.", why: "The guide is the surviving statement of the procedure; the aliases are later visual-pipeline wordings that narrow it (a 'hose' alone drops the resonator the guide removes).", verification: ["VV-02", "VV-03"], regression: "CF-01" },
  { id: "CF-02", canonical: "The retaining grommet is SHOWN and is callout 4 'Retaining grommet'. The old MUST NOT SHOW 'hose grommet' is withdrawn. Step-2 engine-cover grommets stay out of the picture.", why: "Action 4 is 'release the intake assembly from its retaining grommet'. An image that cannot show the grommet cannot illustrate a fifth of the procedure, and the manifest itself lists it as a target.", verification: ["VV-01"], regression: "CF-02" },
  { id: "CF-03", canonical: "The resonator is part of the hero assembly, not a separate part and not prohibited. The hero is drawn only with the sections evidence establishes; 'no seam, joint or ring' is withdrawn.", why: "Action 5 removes a 'hose/resonator assembly'. Forbidding the resonator and mandating a seamless single hose contradicts the guide and asserts a construction nobody has verified.", verification: ["VV-02"], regression: "CF-03" },
  { id: "CF-04", canonical: "Exactly five callouts, in the guide's action order: IAT connector; Throttle-body clamp; Air-cleaner housing clamp; Retaining grommet; Intake hose/resonator.", why: "The recovered callout rule says targets are the components the step text names, in the order they should be called out. The manifest list lacks the assembly, the shot-list lacks the grommet; the union in step-text order satisfies the rule and is under the 6-callout limit.", verification: ["VV-01", "VV-03"], regression: "CF-04" },
  { id: "CF-05", canonical: "Five actions are represented, one per callout, by one image. The shot-list 'Four actions… IAT clip' rationale is withdrawn.", why: "The guide has five actions; dropping the grommet release misstates the procedure.", verification: ["VV-06", "VV-08"], regression: "CF-05" },
  { id: "CF-06", canonical: "'Air-cleaner housing' is canonical (callout 'Air-cleaner housing clamp'). 'Air box' is a banned alias.", why: "The guide and manifest use 'air-cleaner housing'; only the prompt/shot list say 'air box', and nothing proves they mean the same part.", verification: ["VV-03"], regression: "CF-06" },
  { id: "CF-07", canonical: "Clamp tightening point is visible, drawn only from established evidence; hiding it is prohibited. See RULES.clamp.", why: "The action is 'loosen the clamp'. A clamp with its tightening point turned away misrepresents that action; a guessed tightening point would misrepresent safety-critical hardware — so evidence gates it.", verification: ["VV-04"], regression: "CF-07" },
  { id: "CF-08", canonical: "Connector fully visible, never partly hidden; release/locking detail only if established. See RULES.connector.", why: "The action is 'disconnect'; the callout must touch a visible connector and the overlay QA must be able to confirm it. A plain connector is a simplification, not a false claim; an invented latch would be.", verification: ["VV-05"], regression: "CF-08" },
  { id: "CF-09", canonical: "Route: text-only generated raster through the reconstructed Guide Factory; no image inputs. Photo and vector routes rejected for Step 10.", why: "Not a mechanical question: the photo manifest has no source/licence/verification, the vector route's controlling spec is lost and the factory has no SVG path, and the generated-raster route is the only one with implemented, tested gates. Reference evidence still decides every drawn fact.", verification: [], regression: "CF-09" },
]);

// ---- a content bundle derived from CANONICAL (what future Step 10 content is compared against)
export function canonicalContent() {
  return {
    title: CANONICAL.title, instructionText: CANONICAL.instructionText, alt: "Engine bay with the engine cover removed, showing the intake hose/resonator assembly between the throttle body and the air-cleaner housing, its two clamps, the IAT connector and the retaining grommet.",
    callouts: [...CALLOUT_LABELS], actions: ACTIONS.map((a) => ({ n: a.n, sentence: a.sentence, callout: a.callout })),
    mustShowIds: CANONICAL.mustShow.map((m) => m.id), mustNotShowText: [...CANONICAL.mustNotShow], briefText: canonicalBrief(),
    route: CANONICAL.route.id, imageInputs: [],
    clamp: { tighteningPointVisible: true, drawnFromEvidenceOnly: true },
    connector: { fullyVisible: true, releaseDetailOnlyIfEstablished: true },
    hero: { sectionsFromEvidenceOnly: true },
  };
}

/** The deterministic visual BRIEF (input to prompt writing). It is prose about WHAT to show, never about how a part looks. */
export function canonicalBrief() {
  const c = CANONICAL;
  return [
    `SUBJECT: ${c.visualSubject}`,
    `FRAMING: landscape ${c.framing.aspect}, at least ${c.framing.minPx.join("x")} px; ${c.framing.view}; ${c.framing.style}.`,
    `MUST SHOW, in order of importance: ${c.mustShow.map((m) => `${m.rank}. ${m.id}`).join("; ")}. Every part the five actions touch is unobstructed. ${RULES.assembly}`,
    `CLAMPS: ${RULES.clamp}`, `CONNECTOR: ${RULES.connector}`, `GROMMET: ${RULES.grommet}`, `ASSEMBLY: ${RULES.resonator}`,
    `MAY SHOW, SIMPLIFIED AND DIM (background only, never invent detail): ${c.maySimplifyDim.join("; ")}.`,
    `MUST NOT SHOW: ${c.mustNotShow.join("; ")}.`,
    `NO TEXT, labels, numbers, arrows or callout lines in the image; labels are added later in software. Keep the top ${c.framing.clearSpaceTopPct.join("-")}% and bottom ${c.framing.clearSpaceBottomPct.join("-")}% of the height plain and low-contrast.`,
    `If unsure how a real part looks, draw a plain generic shape or leave it out — except where this brief requires the part to be shown, in which case generation is blocked until evidence exists.`,
  ].join("\n");
}

/**
 * Regression oracle: returns problems if Step 10 content reintroduces ANY resolved contradiction. `cf` names the conflict.
 * Content shape = canonicalContent(). Missing fields count as violations (fail closed).
 */
export function step10ContentProblems(c) {
  const bad = []; const P = (cf, code, msg) => bad.push({ cf, code, msg });
  const customer = [c.title, c.instructionText, c.alt, ...(c.callouts ?? [])].join(" \n ").toLowerCase();
  const brief = String(c.briefText ?? "").toLowerCase();
  const mns = (c.mustNotShowText ?? []).join(" | ").toLowerCase();
  // CF-01
  if (c.title !== GUIDE_STEP.title) P("CF-01", "TITLE", `title must be exactly "${GUIDE_STEP.title}"`);
  if (c.instructionText !== GUIDE_STEP.text) P("CF-01", "INSTRUCTION_TEXT", "instruction text must be the guide's step-10 text verbatim");
  for (const a of BANNED_ALIASES) if (customer.includes(a) || brief.includes(a)) P("CF-01", "BANNED_ALIAS", `legacy alias "${a}" appears in customer-facing text or the brief`);
  // CF-02
  if ((c.mustNotShowText ?? []).some((t) => /grommet/i.test(t) && !/engine-cover/i.test(t))) P("CF-02", "GROMMET_PROHIBITED", "the retaining grommet appears in the prohibited list");
  if (!(c.mustShowIds ?? []).includes("retaining-grommet")) P("CF-02", "GROMMET_NOT_SHOWN", "the retaining grommet is not a required visible component");
  if (!(c.callouts ?? []).includes("Retaining grommet")) P("CF-02", "GROMMET_NO_CALLOUT", "no 'Retaining grommet' callout");
  // CF-03
  if (/resonator/.test(mns)) P("CF-03", "RESONATOR_PROHIBITED", "the resonator appears in the prohibited list");
  if (/no seam|no joint|no ring|single hose|one factory air intake hose/.test(brief)) P("CF-03", "SEAMLESS_HERO", "the brief mandates a seamless single hose");
  if (c.hero?.sectionsFromEvidenceOnly !== true) P("CF-03", "HERO_NOT_EVIDENCE_DRIVEN", "hero sections must come from established evidence only");
  // CF-04
  const same = JSON.stringify(c.callouts) === JSON.stringify(CALLOUT_LABELS);
  if (!same) P("CF-04", "CALLOUT_LIST", `callouts must be exactly, in order: ${CALLOUT_LABELS.join(" | ")}`);
  if ((c.callouts ?? []).length > 6) P("CF-04", "CALLOUT_COUNT", "more than 6 callouts");
  // CF-05
  const acts = c.actions ?? [];
  if (acts.length !== 5 || acts.some((a, i) => a.sentence !== ACTIONS[i].sentence || a.callout !== ACTIONS[i].callout)) P("CF-05", "ACTION_SEQUENCE", "the five guide actions must each map, in order, to their callout");
  if (/four actions|iat clip/.test(String(c.rationale ?? "").toLowerCase())) P("CF-05", "FOUR_ACTIONS", "rationale counts four actions");
  // CF-06
  if (!customer.includes("air-cleaner housing") || !(c.callouts ?? []).includes("Air-cleaner housing clamp")) P("CF-06", "AIR_CLEANER_HOUSING", "the guide's 'air-cleaner housing' term and the 'Air-cleaner housing clamp' callout are required");
  // CF-07
  if (/do not show (the )?screw|faces? away from the viewer|plain smooth (metal )?bands only/.test(brief)) P("CF-07", "CLAMP_HARDWARE_HIDDEN", "the brief hides the clamp tightening hardware");
  if (c.clamp?.tighteningPointVisible !== true) P("CF-07", "CLAMP_TIGHTENING_HIDDEN", "clamp tightening point must be visible");
  if (c.clamp?.drawnFromEvidenceOnly !== true) P("CF-07", "CLAMP_NOT_EVIDENCE_GATED", "clamp hardware must be drawn only from established evidence");
  // CF-08
  if (/partly hidden|no locking features|no release tab|plain block only/.test(brief)) P("CF-08", "CONNECTOR_HIDDEN_OR_STRIPPED", "the brief hides the connector or forbids all release detail");
  if (c.connector?.fullyVisible !== true) P("CF-08", "CONNECTOR_NOT_VISIBLE", "connector must be fully visible");
  if (c.connector?.releaseDetailOnlyIfEstablished !== true) P("CF-08", "CONNECTOR_DETAIL_UNGATED", "connector release detail must be evidence-gated");
  // CF-09
  if (c.route !== "generated-raster-text-only") P("CF-09", "ROUTE", "Step 10 route is the text-only generated raster");
  if ((c.imageInputs ?? []).length) P("CF-09", "IMAGE_INPUTS", "no image inputs");
  return bad;
}

/** Canonical Evidence Packet SKELETON: valid structure, EVERY fact not-established. It is a to-do list for evidence, never evidence. */
export function canonicalEPSkeleton() {
  const crit = { "intake-hose-resonator-assembly": "procedure", "throttle-body-clamp": "critical", "air-cleaner-housing-clamp": "critical", "iat-connector": "critical", "retaining-grommet": "critical", "throttle-body": "identification", "air-cleaner-housing": "identification" };
  const elements = CANONICAL.mustShow.map((m) => ({ id: m.id, role: m.role, criticality: crit[m.id] }));
  const note = "C-5 SKELETON: no reference evidence survives; NOT established";
  const ledger = []; const row = (element, attribute) => ledger.push({ element, attribute, status: "not-established", render: "omit", note });
  for (const e of elements) { row(e.id, "existence"); row(e.id, "location"); }
  row("intake-hose-resonator-assembly", "relationship"); row("intake-hose-resonator-assembly", "fine-detail-geometry");
  for (const c of ["throttle-body-clamp", "air-cleaner-housing-clamp"]) { row(c, "hardware-type"); row(c, "fastener-position"); row(c, "fastener-head-type"); }
  row("iat-connector", "hardware-type"); row("iat-connector", "release-mechanism-geometry");
  row("retaining-grommet", "hardware-type"); row("retaining-grommet", "relationship");
  const excl = [["engine-cover", "engine cover (removed in step 2)"], ["breather-hose", "breather hose (VV-07)"], ["fresh-air-snorkel", "fresh-air snorkel (VV-07)"]];
  const exEls = excl.map(([id]) => ({ id, role: "context", criticality: "cosmetic" }));
  for (const [id] of excl) row(id, "existence");
  return {
    canonicalStep: { stepNumber: GUIDE_STEP.number, title: GUIDE_STEP.title, actions: ACTIONS.map((a) => a.sentence) },
    references: [], elements: [...elements, ...exEls], ledger,
    mustNotDepict: excl.map(([id, why]) => ({ id: `excl-${id}`, element: id, reason: `canonical Step 10 prohibition: ${why}`, trace: { element: id, attribute: "existence" } })),
    sufficiencyProposal: { proposedBy: "claude-research", basis: "C-5 SKELETON: proposes INSUFFICIENT; no references exist" },
  };
}

/** What is and is not ready. Honest by construction: derived from the data above, not asserted. */
export function step10Readiness() {
  const blockers = [{ id: "M-01", what: "no reference evidence" }, { id: "M-02", what: "no established ledger rows for the seven mustShow elements" }, ...VERIFICATION.map((v) => ({ id: v.id, what: v.fact }))];
  return { readyToGatherReferenceEvidence: true, readyForImageGeneration: false, blockers, conflictsResolvedByProposal: RESOLUTIONS.length, conflictsOpenInOriginals: CONFLICTS.length };
}
