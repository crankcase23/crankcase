// RECONSTRUCTED-V1 | NOT the lost original.  CHARGER #001 / STEP 10 — SOURCE CONFLICT TABLE (C-4, Andy lock #4).
// "Do not guess. Produce one conflict table from: guide step text; Step 10 image prompt; old manifest; shot list; recovered callout
// specification. For each disagreement show: source; exact requirement; contradiction; decision required. Do not alter canonical
// Step 10 requirements until Andy/Hermes decides."
//
// Every `quote` below is a VERBATIM substring of a surviving recovered file (tests/step10-conflicts.test.mjs re-reads the files and
// fails on any quote that is not found, after collapsing line breaks and leading "*" of block comments). Nothing here is paraphrased
// into a requirement. NOTHING in this table changes any requirement: every row is OPEN, every decision belongs to Andy/Hermes.
// The five sources (S = short code used in the table):
export const SOURCES = {
  GUIDE: { label: "Guide step text", file: "src/data/admin-test-guides/charger-2016-sxt-multi-job.ts", tag: "RECOVERED (surviving code)" },
  PROMPT: { label: "Step 10 image prompt", file: "doc-derived/step-10-handoff-prompt.txt", tag: "RECOVERED-FROM-DOCUMENTATION (the original prompt file itself is lost; this is the text a report quoted)" },
  MANIFEST: { label: "Old manifest", file: "visual-sources/2016-dodge-charger-sxt-36/step-10-intake-duct.manifest.json", tag: "RECOVERED (surviving file; status PENDING, mostly empty)" },
  SHOTLIST: { label: "Shot list (slot)", file: "src/data/guide-visuals/charger-2016-sxt-multi-job.ts", tag: "RECOVERED (surviving code)" },
  CALLOUT_SPEC: { label: "Recovered callout specification", file: "src/types/guideVisuals.ts", tag: "RECOVERED (surviving code); see also scripts-visuals/lib.mjs and src/lib/guideVisuals.ts" },
};
const q = (source, quote, file) => ({ source, file: file ?? SOURCES[source].file, quote });

export const CONFLICTS = [
  { id: "CF-01", topic: "What the step / hero part is called",
    positions: [
      q("GUIDE", 'step(10, P4, "Remove intake duct",'),
      q("GUIDE", "Remove the intake hose/resonator assembly."),
      q("PROMPT", 'Step: "Remove the air intake hose."'),
      q("MANIFEST", '"component": "Air inlet duct, IAT connector, clamps, grommet"'),
      q("SHOTLIST", '"Intake hose",'),
    ],
    contradiction: "Four different names for the hero part: 'intake duct' (guide title), 'intake hose/resonator assembly' (guide action), 'air intake hose' (prompt), 'Air inlet duct … grommet' (manifest), 'Intake hose' (shot list). The prompt's own hero is a single hose, the guide's removal target is a hose/resonator ASSEMBLY.",
    decisionRequired: "Pick the one canonical customer-facing name for the hero part, and say whether it is a hose, a duct, or a hose+resonator assembly. (Feeds CF-03.)" },

  { id: "CF-02", topic: "Retaining grommet — required by the step, banned by the prompt, split between manifest and shot list",
    positions: [
      q("GUIDE", "Release the intake assembly from its retaining grommet."),
      q("PROMPT", "engine cover, hose grommet, resonator, any second or red locking feature on the connector"),
      q("MANIFEST", '"Retaining grommet"', SOURCES.MANIFEST.file),
      q("SHOTLIST", "Every callout target below is a component the step's own text names; none is added by us."),
    ],
    contradiction: "The guide's fourth action is to release the assembly from its retaining grommet, and the old manifest lists 'Retaining grommet' as a callout target. The prompt lists 'hose grommet' under MUST NOT SHOW (leave out entirely, do not substitute). The shot list has no grommet target at all, although its own header says every target is a component the step text names. An image that obeys the prompt cannot show, let alone call out, the part the guide's action 4 acts on. (Guide step 2 also says 'retaining grommets', plural, for the engine cover — a different part.)",
    decisionRequired: "Decide: is the step-10 grommet shown (and called out), or is action 4 left un-illustrated? If shown, the prompt's MUST NOT SHOW must be amended and evidence for the grommet must exist. If not shown, the manifest's callout target must be dropped." },

  { id: "CF-03", topic: "Resonator — named in the step text, banned by the prompt",
    positions: [
      q("GUIDE", "Remove the intake hose/resonator assembly."),
      q("PROMPT", "MUST NOT SHOW (leave these out entirely, do not substitute): engine cover, hose grommet, resonator,"),
      q("PROMPT", "No seam, joint or ring between the two sections."),
    ],
    contradiction: "The guide's last action removes a 'hose/resonator assembly'; the prompt requires the hero to be ONE hose with no seam and forbids the resonator entirely.",
    decisionRequired: "Decide whether the resonator is part of the pictured assembly. This must be settled together with CF-01 (what the hero is) before any evidence ledger row for the hero can be written." },

  { id: "CF-04", topic: "Callout target set and order (manifest vs shot list vs step text vs callout spec)",
    positions: [
      q("MANIFEST", '"IAT electrical connector",'),
      q("MANIFEST", '"Clamp at the throttle body",'),
      q("MANIFEST", '"Clamp at the air-cleaner housing",'),
      q("SHOTLIST", '"IAT connector",'),
      q("SHOTLIST", '"Air-box clamp",'),
      q("SHOTLIST", "Four actions on one assembly: IAT clip, two clamps, then lift the hose out."),
      q("CALLOUT_SPEC", "Components the step text itself names, in the order they should be called out."),
    ],
    contradiction: "Manifest targets: IAT electrical connector / Clamp at the throttle body / Clamp at the air-cleaner housing / Retaining grommet (no hose). Shot-list targets: IAT connector / Throttle-body clamp / Air-box clamp / Intake hose (no grommet). The recovered callout spec says targets are components the step text names, in the step text's order — the step text names five things (IAT connector, throttle-body clamp, air-cleaner-housing clamp, retaining grommet, intake hose/resonator assembly). The two lists agree on three, disagree on the fourth and omit the fifth/fourth respectively, and use different wording for the same targets.",
    decisionRequired: "Decide the final callout list (count ≤ 6 per the callout rules), its order, and the exact label wording. Until then no callout geometry can be requested." },

  { id: "CF-05", topic: "Number of actions illustrated",
    positions: [
      q("GUIDE", "Disconnect the IAT electrical connector. Loosen the clamp at the throttle body. Loosen the clamp at the air-cleaner housing. Release the intake assembly from its retaining grommet. Remove the intake hose/resonator assembly."),
      q("SHOTLIST", "Four actions on one assembly: IAT clip, two clamps, then lift the hose out."),
    ],
    contradiction: "The guide step has five actions; the shot list's rationale counts four and omits the grommet release. It also calls the connector an 'IAT clip' where the guide says 'IAT electrical connector'.",
    decisionRequired: "Confirm the number of actions the single image must support (four or five) — a restatement of CF-02 for the shot list's 'why'." },

  { id: "CF-06", topic: "'Air-cleaner housing' vs 'air box'",
    positions: [
      q("GUIDE", "Loosen the clamp at the air-cleaner housing."),
      q("MANIFEST", '"_needs": "Air-inlet system from the throttle body back to the air-cleaner housing, all clamps and the connector in view."'),
      q("PROMPT", "Air box: a low rounded box with a ribbed lid and an inlet collar on its engine-side end"),
      q("SHOTLIST", '"Air-box clamp",'),
    ],
    contradiction: "Guide and manifest say 'air-cleaner housing'; prompt and shot list say 'air box'. Nothing surviving says they are the same component or fixes the customer-facing label.",
    decisionRequired: "Confirm they are the same component and fix ONE label (the label is shown on the image and in the legend)." },

  { id: "CF-07", topic: "Clamps — step says loosen them, prompt forbids drawing the loosening hardware",
    positions: [
      q("GUIDE", "Loosen the clamp at the throttle body."),
      q("PROMPT", "Do NOT show the screw, screw head, screw housing, or any tightening hardware"),
      q("MANIFEST", "all clamps and the connector in view"),
    ],
    contradiction: "The action is loosening a clamp; the prompt requires plain smooth bands with the tightening side turned away, so the part a reader must act on is hidden, while the manifest asks for all clamps 'in view'.",
    decisionRequired: "Decide whether clamp hardware may be shown (needs fastener-position / fastener-head-type evidence — a safety-critical ledger attribute) or the callout is allowed to point at a band whose loosening point is not visible." },

  { id: "CF-08", topic: "IAT connector — 'disconnect' vs 'no release/locking features'; 'partly hidden' vs 'in view' vs a callout that must touch it",
    positions: [
      q("GUIDE", "Disconnect the IAT electrical connector."),
      q("PROMPT", "Plain block only: no release tab, no pins, no colours, no locking features."),
      q("PROMPT", "partly hidden behind the hose edge"),
      q("MANIFEST", "all clamps and the connector in view"),
      q("CALLOUT_SPEC", "someone must confirm each arrow points at its component", "scripts-visuals/lib.mjs"),
    ],
    contradiction: "The step has the reader disconnect the connector; the prompt draws it with no release feature at all and partly hidden. The manifest wants it in view and the callout rules require a reviewer to confirm each arrow lands on the component it names, which a partly hidden, featureless block makes unverifiable.",
    decisionRequired: "Decide the minimum visibility of the connector and whether any release feature may be drawn (needs release-mechanism-geometry evidence if so). Where it sits on the hose is also stated only by the prompt — see MISSING evidence M-02." },

  { id: "CF-09", topic: "How the image is produced — photo vs vector artwork vs text-only generated raster",
    positions: [
      q("MANIFEST", '"file": "raw/step-10-intake-duct.jpg"'),
      q("MANIFEST", "The pipeline refuses this manifest until every field below is real."),
      q("SHOTLIST", "Original Crankcase artwork (vector), engine cover already removed:"),
      q("SHOTLIST", "see visual-sources/.../artwork/step-10-intake-duct.v3.spec.md."),
      q("PROMPT", "Text-only prompt: do not use, request or trace any reference image."),
    ],
    contradiction: "Three incompatible production routes, each governed by a different recovered rule set: a raw photograph with source/licence/verification (manifest), original vector artwork with a no-source-pixels attestation (shot list), and a text-only generated raster with a generator attestation (prompt; the route the reconstructed factory implements). The shot list's controlling spec (v3.spec.md) is not among the recovered files.",
    decisionRequired: "Choose the route for Step 10. The reconstructed factory implements ONLY the generated-raster route; choosing photo or vector means different gates and, for vector, a lost spec." },
];

/** Things the sources AGREE on (listed so a reader can see the table is not "everything conflicts"). */
export const AGREEMENTS = [
  { id: "AG-01", topic: "Vehicle", positions: [q("PROMPT", "2016 Dodge Charger SXT with the 3.6L Pentastar V6"), q("MANIFEST", '"engine": "3.6L Pentastar V6"')], note: "Same application as recovered visual-sources/applications.json (asserted in tests)." },
  { id: "AG-02", topic: "Engine cover is already off", positions: [q("PROMPT", "engine cover already removed"), q("SHOTLIST", "engine cover already removed"), q("GUIDE", "remove the decorative engine cover")], note: "Step 2 removes the cover; step 10 follows." },
  { id: "AG-03", topic: "Labels/callouts are applied later in software, not drawn in the image", positions: [q("PROMPT", "Labels will be added later in software."), q("CALLOUT_SPEC", "Shown on the image AND in the legend")], note: "Prompt's NO TEXT rule and the callout overlay do not conflict." },
  { id: "AG-04", topic: "Output form", positions: [q("PROMPT", "deliver 1600x1000 px or larger at 16:10"), q("SHOTLIST", "step-10-intake-duct.png")], note: "PNG at 16:10; the reconstruction normalizes to exactly 1600x1000." },
];

export const DECIDER = "Andy / Hermes";
export const STATUS_ALL = "OPEN";
