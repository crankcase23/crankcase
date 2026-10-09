// RECONSTRUCTED TEST suite — reference evidence, ledger, EP, spec intake.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { makeObject } from "../src/objects.mjs";
import { epProblems, sufficiencyProblems, referenceProblems } from "../src/evidence.mjs";
import { parseVisualSpecPrompt } from "../src/spec-intake.mjs";
import { Refused } from "../src/store.mjs";
import { APPLICATION, fixtureEPBody, newRun } from "./support/fixtures.mjs";

const epObj = (over = {}, id = "EP-synthetic-fixture-v1") => makeObject("EP", { id, visualId: "synthetic-fixture", application: APPLICATION, createdBy: { actor: "claude-research", role: "evidence-author" }, createdAt: "2026-10-04T12:00:00.000Z", refs: [], body: fixtureEPBody(over) });
const codes = (ps) => ps.map((p) => p.code);

test("RECONSTRUCTED TEST: valid reference evidence is accepted (no problems, sufficient)", () => {
  const ep = epObj();
  assert.deepEqual(epProblems(ep), []);
  assert.deepEqual(sufficiencyProblems(ep), []);
});

test("RECONSTRUCTED TEST: missing evidence is rejected — no references at all is never sufficient", () => {
  const ep = epObj({ references: [], ledger: fixtureEPBody().ledger.map((r) => (r.status === "established" ? { ...r, status: "not-established", evidence: undefined, render: "omit" } : r)) });
  assert.ok(codes(sufficiencyProblems(ep)).includes("EP_NO_REFERENCES"));
  assert.ok(codes(sufficiencyProblems(ep)).includes("EP_HERO_NOT_ESTABLISHED"));
});

test("RECONSTRUCTED TEST: missing evidence is rejected — an established ledger row must cite evidence", () => {
  const body = fixtureEPBody(); body.ledger[0] = { ...body.ledger[0], evidence: [] };
  assert.ok(codes(epProblems(epObj(body))).includes("LEDGER_ESTABLISHED_NO_EVIDENCE"));
});

test("RECONSTRUCTED TEST: missing evidence is rejected — citing a reference id that does not exist", () => {
  const body = fixtureEPBody(); body.ledger[0] = { ...body.ledger[0], evidence: ["ref-404"] };
  assert.ok(codes(epProblems(epObj(body))).includes("LEDGER_EVIDENCE_UNKNOWN"));
});

test("RECONSTRUCTED TEST: hero/target without ESTABLISHED existence+location is insufficient", () => {
  const body = fixtureEPBody(); body.ledger = body.ledger.filter((r) => !(r.element === "fixture-clamp" && r.attribute === "location"));
  const c = codes(sufficiencyProblems(epObj(body)));
  assert.deepEqual(c, ["EP_HERO_NOT_ESTABLISHED"]);
});

test("RECONSTRUCTED TEST: malformed reference evidence is rejected (enum, sourceRef, usage, establishes, rights)", () => {
  const good = fixtureEPBody().references[0];
  assert.deepEqual(referenceProblems(good), []);
  assert.ok(referenceProblems({ ...good, kind: "blog-post" }).length);
  assert.ok(referenceProblems({ ...good, sourceRef: "" }).length);
  assert.ok(codes(referenceProblems({ ...good, usage: "image-input" })).includes("REF_USAGE"));
  assert.ok(referenceProblems({ ...good, establishes: [] }).length);
  assert.ok(referenceProblems({ ...good, rights: undefined }).length);
  assert.ok(referenceProblems("not an object").length);
});

test("RECONSTRUCTED TEST: a reference flagged as an image input is rejected", () => {
  const body = fixtureEPBody(); body.references[0] = { ...body.references[0], usedAsImageInput: true };
  assert.ok(codes(epProblems(epObj(body))).includes("REF_IMAGE_INPUT"));
});

test("RECONSTRUCTED TEST: malformed packet shapes are rejected (non-list ledger, bad element, unknown ledger element, bad envelope)", () => {
  assert.ok(codes(epProblems(epObj({ ledger: "nope" }))).includes("EP_SHAPE"));
  assert.ok(codes(epProblems(epObj({ elements: [{ id: "x", role: "boss", criticality: "critical" }] }))).includes("ELEMENT_SHAPE"));
  const body = fixtureEPBody(); body.ledger.push({ element: "ghost", attribute: "existence", status: "not-established", render: "omit", note: "n" });
  assert.ok(codes(epProblems(epObj(body))).includes("LEDGER_ELEMENT_UNKNOWN"));
  const ep = epObj(); ep.contentHash = "0".repeat(64);
  assert.ok(epProblems(ep).some((p) => /contentHash/.test(p.msg)));
  assert.ok(epProblems({}).length);
});

test("RECONSTRUCTED TEST: unsupported attributes may never be drawn; safety-critical geometry only omit/occlude", () => {
  const a = fixtureEPBody(); a.ledger.push({ element: "fixture-bg", attribute: "fine-detail-geometry", status: "not-established", render: "draw", note: "n" });
  assert.ok(codes(epProblems(epObj(a))).includes("LEDGER_UNSUPPORTED_DRAWN"));
  const b = fixtureEPBody(); b.ledger.push({ element: "fixture-bg", attribute: "fastener-head-type", status: "not-established", render: "simplify", note: "n" });
  assert.ok(codes(epProblems(epObj(b))).includes("LEDGER_SAFETY_SHOWN"));
});

test("RECONSTRUCTED TEST: unsupported rows on critical/identification/procedure elements may only be omit|occlude", () => {
  const body = fixtureEPBody(); body.ledger.push({ element: "fixture-hose", attribute: "orientation", status: "not-established", render: "simplify", note: "n" });
  assert.ok(codes(epProblems(epObj(body))).includes("LEDGER_STRICT_RENDER"));
  const ok = fixtureEPBody(); ok.ledger.push({ element: "fixture-bg", attribute: "orientation", status: "not-established", render: "simplify", note: "cosmetic may simplify" });
  assert.deepEqual(epProblems(epObj(ok)), []);
});

test("RECONSTRUCTED TEST: mustNotDepict must trace to an omit|occlude ledger row", () => {
  const body = fixtureEPBody(); body.mustNotDepict = [{ id: "x", element: "fixture-cover", reason: "r", trace: { element: "fixture-hose", attribute: "existence" } }];
  assert.ok(codes(epProblems(epObj(body))).includes("MND_UNTRACED"));
});

test("RECONSTRUCTED TEST: first EP cannot supersede; superseding without a QR deficiency finding is refused", () => {
  const run = newRun("sup");
  assert.throws(() => run.registerEP(fixtureEPBody({ supersedes: { id: "EP-x-v1", sha256: "a".repeat(64) }, deficiencyRef: { qrId: "QR-x-001", findingId: "F1" } })), (e) => e instanceof Refused && e.code === "EP_INVALID");
  assert.equal(run.events.length, 0);
});

test("RECONSTRUCTED TEST: criticality — hardware-looking elements cannot be cosmetic (template rule)", () => {
  const run = newRun("crit");
  const body = fixtureEPBody(); body.elements.push({ id: "fixture-clamp-extra", role: "context", criticality: "cosmetic" });
  body.ledger.push({ element: "fixture-clamp-extra", attribute: "existence", status: "not-established", render: "omit", note: "n" });
  run.registerEP(body);
  const r = run.evaluateEP();
  assert.equal(r.sufficient, false);
  assert.ok(codes(r.problems).includes("CRITICALITY_COSMETIC_HARDWARE"));
  assert.equal(run.state.phase, "EP_INSUFFICIENT"); // terminal for that version
});

test("RECONSTRUCTED TEST: registerEP refuses invalid evidence and writes nothing", () => {
  const run = newRun("reg");
  const body = fixtureEPBody(); body.ledger[0] = { ...body.ledger[0], evidence: [] };
  assert.throws(() => run.registerEP(body), (e) => e instanceof Refused && e.code === "EP_INVALID");
  assert.equal(run.events.length, 0);
});

const PROMPT = fs.readFileSync(new URL("../recovered/doc-derived/step-10-handoff-prompt.txt", import.meta.url), "utf8");
test("RECONSTRUCTED TEST: visual specification intake parses the surviving Step 10 prompt", () => {
  const r = parseVisualSpecPrompt(PROMPT);
  assert.equal(r.ok, true);
  assert.deepEqual(r.spec.framing, { aspect: [16, 10], minPx: [1600, 1000] });
  assert.equal(r.spec.mustShow.length, 6);
  assert.equal(r.spec.mustNotShow.length, 16);
  assert.ok(r.spec.mustNotShow.includes("hose grommet") && r.spec.mustNotShow.includes("resonator"));
  assert.deepEqual(r.spec.clearSpace, [{ band: "top", fromPct: 3, toPct: 17 }, { band: "bottom", fromPct: 83, toPct: 97 }]);
  assert.equal(r.spec.noText, true);
  assert.equal(r.spec.textOnly, true);
});

test("RECONSTRUCTED TEST: spec intake rejects a prompt with a missing section or no NO-TEXT clause", () => {
  const noMustNot = PROMPT.replace(/MUST NOT SHOW[\s\S]*?\n\nNO TEXT/, "NO TEXT");
  assert.equal(parseVisualSpecPrompt(noMustNot).ok, false);
  assert.equal(parseVisualSpecPrompt(PROMPT.replace("NO TEXT of any kind", "text is fine")).ok, false);
  assert.equal(parseVisualSpecPrompt("garbage").ok, false);
});

test("RECONSTRUCTED TEST: spec intake is deterministic and hashes the source prompt", () => {
  assert.deepEqual(parseVisualSpecPrompt(PROMPT), parseVisualSpecPrompt(PROMPT));
  assert.match(parseVisualSpecPrompt(PROMPT).spec.sourcePromptSha256, /^[0-9a-f]{64}$/);
});
