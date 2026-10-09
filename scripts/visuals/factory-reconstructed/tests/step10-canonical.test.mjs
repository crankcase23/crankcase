// RECONSTRUCTED TEST suite — C-5 Step 10 CANONICAL CONTRACT: one regression family per resolved conflict (CF-01…CF-09).
// Each regression mutates the canonical content to REINTRODUCE the old contradiction and requires the oracle to name that conflict.
// The legacy sources (old prompt, manifest, shot list) are also run through the oracle: they MUST fail, proving the oracle really detects what it claims.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { fileURLToPath } from "node:url";
import * as C from "../charger-step10/canonical-step10.mjs";
import { CONFLICTS } from "../charger-step10/conflicts.mjs";
import { verifyRecovered } from "../integration/recovered-resolver.mjs";
import { parseVisualSpecPrompt } from "../src/spec-intake.mjs";
import { epProblems, sufficiencyProblems } from "../src/evidence.mjs";
import { makeObject } from "../src/objects.mjs";
import { SAFETY_CRITICAL } from "../src/enums.mjs";
import { FactoryRun } from "../src/machine.mjs";
import { APPLICATION, GUIDE_ID, REGISTRY, makeClock, tmpDir } from "./support/fixtures.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const rec = (p) => fs.readFileSync(path.join(here, "..", "recovered", p), "utf8");
const T = (cf, s) => `RECONSTRUCTED TEST [STEP10 CANONICAL ${cf}]: ${s}`;
const codes = (c, cf) => C.step10ContentProblems(c).filter((p) => !cf || p.cf === cf).map((p) => p.code);
const fresh = () => structuredClone(C.canonicalContent());
const mut = (fn) => { const c = fresh(); fn(c); return c; };

test(T("ANCHOR", "title and instruction text are the guide's step-10 text VERBATIM; recovered originals are unmodified; canonical content passes its own oracle"), () => {
  assert.deepEqual(verifyRecovered(), []);
  const g = rec("src/data/admin-test-guides/charger-2016-sxt-multi-job.ts");
  assert.ok(g.includes(`step(10, P4, "${C.GUIDE_STEP.title}",`));
  assert.ok(g.includes(`"${C.GUIDE_STEP.text}"`));
  assert.deepEqual(C.step10ContentProblems(C.canonicalContent()), []);
  assert.match(C.STATUS, /PROPOSED/); assert.match(C.STATUS, /No artwork generated/);
});

test(T("CF-01", "naming: guide title + 'intake hose/resonator assembly'; legacy aliases are banned everywhere customer-facing or in the brief"), () => {
  assert.ok(codes(mut((c) => { c.title = "Remove the air intake hose"; }), "CF-01").includes("TITLE"));
  assert.ok(codes(mut((c) => { c.instructionText = c.instructionText.replace("hose/resonator assembly", "hose"); }), "CF-01").includes("INSTRUCTION_TEXT"));
  for (const alias of C.BANNED_ALIASES) {
    assert.ok(codes(mut((c) => { c.alt += ` ${alias}`; }), "CF-01").includes("BANNED_ALIAS"), `alt: ${alias}`);
    assert.ok(codes(mut((c) => { c.briefText += ` ${alias}`; }), "CF-01").includes("BANNED_ALIAS"), `brief: ${alias}`);
    assert.ok(C.TERMS.some((t) => t.term.toLowerCase() === alias && /LEGACY/.test(t.status)), `${alias} is in the dictionary as LEGACY`);
  }
});

test(T("CF-02", "retaining grommet: shown, called out, never prohibited"), () => {
  assert.ok(codes(mut((c) => { c.mustNotShowText.push("hose grommet"); }), "CF-02").includes("GROMMET_PROHIBITED"));
  assert.ok(codes(mut((c) => { c.mustShowIds = c.mustShowIds.filter((x) => x !== "retaining-grommet"); }), "CF-02").includes("GROMMET_NOT_SHOWN"));
  assert.ok(codes(mut((c) => { c.callouts = c.callouts.filter((x) => x !== "Retaining grommet"); }), "CF-02").includes("GROMMET_NO_CALLOUT"));
  assert.deepEqual(codes(mut((c) => { c.mustNotShowText.push("the engine-cover fixings of step 2"); }), "CF-02"), [], "the step-2 engine-cover parts may stay prohibited");
});

test(T("CF-03", "resonator: part of the hero assembly, never prohibited, no mandated seamless hose"), () => {
  assert.ok(codes(mut((c) => { c.mustNotShowText.push("resonator"); }), "CF-03").includes("RESONATOR_PROHIBITED"));
  for (const phrase of ["No seam, joint or ring between the two sections.", "ONE factory air intake hose"]) assert.ok(codes(mut((c) => { c.briefText += ` ${phrase}`; }), "CF-03").includes("SEAMLESS_HERO"), phrase);
  assert.ok(codes(mut((c) => { c.hero.sectionsFromEvidenceOnly = false; }), "CF-03").includes("HERO_NOT_EVIDENCE_DRIVEN"));
});

test(T("CF-04", "callouts: exactly the five canonical labels in the guide's action order, never more than six"), () => {
  assert.deepEqual(C.CALLOUT_LABELS, ["IAT connector", "Throttle-body clamp", "Air-cleaner housing clamp", "Retaining grommet", "Intake hose/resonator"]);
  const manifest = ["IAT electrical connector", "Clamp at the throttle body", "Clamp at the air-cleaner housing", "Retaining grommet"], slot = ["IAT connector", "Throttle-body clamp", "Air-box clamp", "Intake hose"];
  for (const list of [manifest, slot, [...C.CALLOUT_LABELS].reverse(), [...C.CALLOUT_LABELS, "Extra"], C.CALLOUT_LABELS.slice(0, 4)]) assert.ok(codes(mut((c) => { c.callouts = list; }), "CF-04").includes("CALLOUT_LIST"));
  assert.ok(codes(mut((c) => { c.callouts = Array(7).fill("x"); }), "CF-04").includes("CALLOUT_COUNT"));
  assert.ok(C.CALLOUT_LABELS.length <= 6);
});

test(T("CF-05", "five actions, one callout each, in order; no 'four actions' / 'IAT clip' rationale"), () => {
  const sentences = C.ACTIONS.map((a) => a.sentence);
  assert.equal(sentences.join(" "), C.GUIDE_STEP.text, "the five action sentences ARE the guide text, in order");
  assert.equal(new Set(C.ACTIONS.map((a) => a.callout)).size, 5);
  assert.ok(codes(mut((c) => { c.actions = c.actions.slice(0, 4); }), "CF-05").includes("ACTION_SEQUENCE"));
  assert.ok(codes(mut((c) => { [c.actions[3], c.actions[4]] = [c.actions[4], c.actions[3]]; }), "CF-05").includes("ACTION_SEQUENCE"));
  assert.ok(codes(mut((c) => { c.rationale = "Four actions on one assembly: IAT clip, two clamps, then lift the hose out."; }), "CF-05").includes("FOUR_ACTIONS"));
});

test(T("CF-06", "air-cleaner housing is the term; 'air box' never appears; its callout is 'Air-cleaner housing clamp'"), () => {
  assert.ok(codes(mut((c) => { c.callouts[2] = "Air-box clamp"; }), "CF-06").includes("AIR_CLEANER_HOUSING"));
  assert.ok(codes(mut((c) => { c.alt = c.alt.replace("air-cleaner housing", "air box"); })).includes("BANNED_ALIAS"));
  assert.ok(C.TERMS.find((t) => t.term === "air box").status.includes("ASSUMED"), "the equivalence is recorded as an assumption, not a fact");
});

test(T("CF-07", "clamps: tightening point visible and evidence-gated; the old 'hide the screw' wording is rejected"), () => {
  for (const phrase of ["Do NOT show the screw, screw head, screw housing, or any tightening hardware", "rotate the clamp so that side faces away from the viewer", "Draw them as plain smooth metal bands only"]) assert.ok(codes(mut((c) => { c.briefText += ` ${phrase}`; }), "CF-07").includes("CLAMP_HARDWARE_HIDDEN"), phrase);
  assert.ok(codes(mut((c) => { c.clamp.tighteningPointVisible = false; }), "CF-07").includes("CLAMP_TIGHTENING_HIDDEN"));
  assert.ok(codes(mut((c) => { c.clamp.drawnFromEvidenceOnly = false; }), "CF-07").includes("CLAMP_NOT_EVIDENCE_GATED"));
  assert.ok(SAFETY_CRITICAL.includes("fastener-position") && SAFETY_CRITICAL.includes("fastener-head-type"), "the factory treats clamp hardware as safety-critical, which is why drawing is evidence-gated");
});

test(T("CF-08", "connector: fully visible, never partly hidden, release detail evidence-gated rather than blanket-banned or invented"), () => {
  for (const phrase of ["partly hidden behind the hose edge", "no release tab, no pins, no colours, no locking features", "Plain block only"]) assert.ok(codes(mut((c) => { c.briefText += ` ${phrase}`; }), "CF-08").includes("CONNECTOR_HIDDEN_OR_STRIPPED"), phrase);
  assert.ok(codes(mut((c) => { c.connector.fullyVisible = false; }), "CF-08").includes("CONNECTOR_NOT_VISIBLE"));
  assert.ok(codes(mut((c) => { c.connector.releaseDetailOnlyIfEstablished = false; }), "CF-08").includes("CONNECTOR_DETAIL_UNGATED"));
  assert.ok(SAFETY_CRITICAL.includes("release-mechanism-geometry"));
});

test(T("CF-09", "route: text-only generated raster through the Guide Factory; photo and vector routes and any image input are rejected"), () => {
  for (const r of ["raw-photograph", "original-vector-artwork", ""]) assert.ok(codes(mut((c) => { c.route = r; }), "CF-09").includes("ROUTE"), r);
  assert.ok(codes(mut((c) => { c.imageInputs = ["raw/step-10-intake-duct.jpg"]; }), "CF-09").includes("IMAGE_INPUTS"));
  assert.equal(C.CANONICAL.route.rejected.length, 2);
});

test(T("LEGACY", "the OLD sources fail the oracle: the legacy prompt, manifest wording and shot-list wording reintroduce CF-01…CF-08 and are detected"), () => {
  const prompt = rec("doc-derived/step-10-handoff-prompt.txt"), spec = parseVisualSpecPrompt(prompt).spec;
  const legacy = { title: "Remove the air intake hose", instructionText: "Remove the air intake hose.", alt: "air box", callouts: ["IAT connector", "Throttle-body clamp", "Air-box clamp", "Intake hose"], actions: C.ACTIONS.slice(0, 4).map((a) => ({ n: a.n, sentence: a.sentence, callout: a.callout })), mustShowIds: ["intake-hose", "iat-connector"], mustNotShowText: spec.mustNotShow, briefText: prompt, route: "generated-raster-text-only", imageInputs: [], rationale: "Four actions on one assembly: IAT clip, two clamps, then lift the hose out.", clamp: { tighteningPointVisible: false, drawnFromEvidenceOnly: true }, connector: { fullyVisible: false, releaseDetailOnlyIfEstablished: false }, hero: { sectionsFromEvidenceOnly: false } };
  const hit = new Set(C.step10ContentProblems(legacy).map((p) => p.cf));
  for (const cf of ["CF-01", "CF-02", "CF-03", "CF-04", "CF-05", "CF-06", "CF-07", "CF-08"]) assert.ok(hit.has(cf), `${cf} not detected in legacy content`);
  const onlyPrompt = C.step10ContentProblems({ ...C.canonicalContent(), briefText: prompt, mustNotShowText: spec.mustNotShow }).map((p) => p.cf);
  for (const cf of ["CF-02", "CF-03", "CF-07", "CF-08"]) assert.ok(onlyPrompt.includes(cf), `the legacy prompt alone must trip ${cf}`);
});

test(T("TERMS", "terminology dictionary covers intake duct / air inlet duct / hose / resonator / air box / air-cleaner housing; canonical terms are statused, legacy aliases are banned"), () => {
  const names = C.TERMS.map((t) => t.term);
  for (const need of ["intake duct", "air inlet duct", "intake hose", "resonator", "air box", "air-cleaner housing", "intake hose/resonator assembly"]) assert.ok(names.includes(need), need);
  assert.equal(new Set(names).size, names.length);
  for (const t of C.TERMS) assert.ok(/CANONICAL|LEGACY/.test(t.status), t.term);
  for (const t of C.TERMS.filter((x) => /LEGACY/.test(x.status))) assert.equal(t.use, "never");
  // the customer-facing words of the canonical content use only canonical terms
  const customer = [C.canonicalContent().title, C.canonicalContent().alt, ...C.CALLOUT_LABELS].join(" ").toLowerCase();
  for (const t of C.TERMS.filter((x) => /LEGACY/.test(x.status))) assert.ok(!customer.includes(t.term.toLowerCase()), t.term);
});

test(T("RESOLUTIONS", "all nine conflicts have exactly one proposed resolution, each with a why, verification ids that exist, and a regression in this file"), () => {
  assert.deepEqual(C.RESOLUTIONS.map((r) => r.id), CONFLICTS.map((c) => c.id));
  const vv = new Set(C.VERIFICATION.map((v) => v.id)); const self = fs.readFileSync(new URL(import.meta.url), "utf8");
  for (const r of C.RESOLUTIONS) { assert.ok(r.canonical.length > 30 && r.why.length > 30, r.id); for (const v of r.verification) assert.ok(vv.has(v), `${r.id} cites unknown ${v}`); assert.ok(self.includes(`T("${r.regression}"`), `${r.id} has no regression test in this file`); }
});

test(T("VV", "unverified vehicle facts are ISOLATED: the contract draws nothing from them; the EP skeleton is valid but every fact is not-established with no references; generation is NOT ready"), () => {
  const spec = C.canonicalEPSkeleton();
  const ep = makeObject("EP", { id: "EP-step-10-intake-duct-v1", visualId: "step-10-intake-duct", application: APPLICATION, createdBy: { actor: "claude-research", role: "c5-skeleton" }, createdAt: "2026-10-04T12:00:00.000Z", refs: [], body: spec });
  assert.deepEqual(epProblems(ep), []);
  assert.deepEqual(spec.references, []); assert.ok(spec.ledger.every((l) => l.status === "not-established" && l.render === "omit"));
  assert.deepEqual(spec.elements.filter((e) => e.role !== "context").map((e) => e.id), C.CANONICAL.mustShow.map((m) => m.id));
  const need = (el, attr) => assert.ok(spec.ledger.some((l) => l.element === el && l.attribute === attr), `${el}/${attr}`);
  for (const c of ["throttle-body-clamp", "air-cleaner-housing-clamp"]) for (const a of ["fastener-position", "fastener-head-type"]) need(c, a);
  need("iat-connector", "release-mechanism-geometry"); need("retaining-grommet", "relationship");
  assert.deepEqual([...new Set(sufficiencyProblems(ep).map((p) => p.code))].sort(), ["EP_HERO_NOT_ESTABLISHED", "EP_NO_REFERENCES"]);
  const r = C.step10Readiness(); assert.equal(r.readyToGatherReferenceEvidence, true); assert.equal(r.readyForImageGeneration, false);
  for (const v of C.VERIFICATION) assert.ok(r.blockers.some((b) => b.id === v.id));
  // the brief states WHAT to show, never what a real part looks like (no invented appearance from the old prompt)
  assert.ok(!/corrugated|ribbed|silver|flange|inlet collar|rigid molded|rounded box/i.test(C.canonicalBrief()));
  // the factory refuses to compile a contract from the skeleton (evidence gate holds)
  const run = new FactoryRun({ dir: path.join(tmpDir("c5"), "step-10-intake-duct"), visualId: "step-10-intake-duct", application: APPLICATION, guideId: GUIDE_ID, registry: REGISTRY, clock: makeClock() });
  run.init(); run.registerEP(spec, { role: "c5-skeleton" }); assert.equal(run.evaluateEP().sufficient, false);
  assert.throws(() => run.compileContract({}), (e) => e.code === "WRONG_STATE");
});

test(T("PRIORITY", "mechanical truth beats old visual wording: every withdrawn constraint is documented with the guide action that overrides it, and none appears in the canonical brief"), () => {
  assert.ok(C.WITHDRAWN.length >= 6);
  const brief = C.canonicalBrief().toLowerCase();
  for (const w of C.WITHDRAWN) { assert.ok(w.because.length > 15, w.cf); }
  for (const phrase of ["hose grommet", "partly hidden", "no seam", "faces away", "air box", "plain block only"]) assert.ok(!brief.includes(phrase), phrase);
  assert.match(C.canonicalBrief(), /MUST SHOW/); assert.match(C.canonicalBrief(), /NO TEXT/);
  assert.equal(C.CANONICAL.ownership.includes("subject to the generation provider's applicable usage rights"), true);
});
