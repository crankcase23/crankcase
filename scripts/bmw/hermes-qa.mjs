#!/usr/bin/env node
// Independent-QA (Hermes / ChatGPT) export/import workflow + FileDrop candidate import, for the BMW image pipeline.
//
// Why this exists: the Guide Factory only admits an image after an INDEPENDENT review by Hermes / ChatGPT (never Claude).
// Claude can build the packet and validate the answer; the review itself has to come from ChatGPT. So:
//   export        build a QA packet (candidate image + contract + rubric + exact reply format) for a human to give to ChatGPT.
//                 The packet never contains Claude's internal QA verdict, so the independent reviewer is not primed.
//   import        take ChatGPT's raw reply, validate it, hash the raw text, and record it as the independent review.
//                 Identity is asserted by the human (--model / --system); the factory refuses Claude-looking identities and
//                 relabelling, and records the sha256 of the raw reply so Andy can audit it against the real transcript.
//   drop-template write the claims template for a candidate image someone else generated (nothing is pre-attested).
//   drop-import   validate and submit a dropped candidate (candidate.png + candidate.claims.json) as the generation.
// Nothing here spends money, calls any API, or certifies anything. A PASS here still needs normalisation, overlay QA where
// applicable, and Andy's sign-off before an image is approved.
//
//   node scripts/bmw/hermes-qa.mjs export --runs DIR --visual ID [--out DIR]
//   node scripts/bmw/hermes-qa.mjs import --runs DIR --visual ID --response FILE --model "GPT-..." --system "ChatGPT" [--packet DIR]
//   node scripts/bmw/hermes-qa.mjs drop-template --out DIR
//   node scripts/bmw/hermes-qa.mjs drop-import --runs DIR --visual ID --drop DIR
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const FACT = path.join(ROOT, "scripts/visuals/factory-reconstructed");
const { FactoryRun } = await import(path.join(FACT, "src/machine.mjs"));
const { FileDropGenerator, ActorUnavailable } = await import(path.join(FACT, "src/actors.mjs"));
const { Refused, readBytes } = await import(path.join(FACT, "src/store.mjs"));
const { sha256 } = await import(path.join(FACT, "src/canon.mjs"));
const { RUBRIC_VERSION, INDEPENDENT_IDENTITY, CHECK_RESULTS, SEVERITY, FIX_TYPES } = await import(path.join(FACT, "src/enums.mjs"));
const { contractItemIds } = await import(path.join(FACT, "src/qa.mjs"));
const { ATTESTATION_FLAGS } = await import(path.join(FACT, "src/provenance.mjs"));

const QA_PHASES = ["QA_PENDING", "INTERNAL_QA_PASSED"];
const fail = (code, message, problems = []) => ({ ok: false, code, message, problems });

/** Open an existing run directory. `visual` supplies the guide/application mapping (see pipeline-visuals.mjs). */
export async function openRun({ dir, visualId, clock = () => new Date().toISOString() }) {
  const { loadVisuals, guideIdOf, APPLICATION } = await import(path.join(ROOT, "scripts/bmw/pipeline-visuals.mjs"));
  const v = loadVisuals().find((x) => x.id === visualId);
  if (!v) throw new Error(`unknown visual ${visualId}`);
  const guideId = guideIdOf(v.guideNo);
  return new FactoryRun({ dir, visualId, application: APPLICATION, guideId, registry: { [guideId]: APPLICATION }, clock });
}

/** Everything the independent reviewer needs, derived from the locked contract. No internal-QA content. */
export function buildPacket(run) {
  const s = run.state;
  if (!QA_PHASES.includes(s.phase)) return fail("WRONG_STATE", `QA packet needs a provenance-valid candidate awaiting QA (phase is ${s.phase})`);
  const store = run.store();
  const gr = store.get(s.pendingGR.id), vc = store.get(s.vc.ref.id), ep = store.get(s.ep.ref.id);
  const bytes = readBytes(run.dir, gr.artifact.file);
  if (sha256(bytes) !== gr.artifact.sha256) return fail("CANDIDATE_TAMPERED", "candidate file no longer matches its recorded hash");
  const refById = new Map(ep.references.map((r) => [r.id, r]));
  const items = [];
  for (const m of vc.mustDepict) {
    items.push({
      contractItemId: m.id, kind: "must-depict", element: m.element, criticality: m.criticality, visibility: m.visibility,
      describe: ep.elements.find((e) => e.id === m.element)?.describe ?? undefined,
      requirements: m.requirements.map((r) => ({ attribute: r.attribute, render: r.render, sources: r.evidence.map((id) => refById.get(id)?.sourceRef).filter(Boolean) })),
    });
  }
  for (const m of vc.mustNotDepict) items.push({ contractItemId: m.id, kind: "must-not-depict", element: m.element, reason: m.reason });
  items.push({ contractItemId: "PROVENANCE", kind: "provenance", rule: "Answer PASS only if the image shows no sign of copied/traced source imagery, and contains no baked-in text. The generator's attestation is in the packet." });
  const prompt = readBytes(run.dir, gr.promptFile).toString("utf8");
  const packet = {
    schema: "bmw-image-qa-packet.v1", rubricVersion: RUBRIC_VERSION, visualId: run.visualId, application: run.application,
    candidate: { generationId: gr.id, file: "candidate.png", sha256: gr.artifact.sha256, width: gr.artifact.width, height: gr.artifact.height, cycle: gr.cycle },
    contract: { id: vc.id, contentHash: vc.contentHash ?? null, frame: vc.output, clearSpace: vc.overlay.clearSpaceRegions },
    items, prompt, attestation: gr.attestation, generator: { system: gr.generator.system, model: gr.generator.model },
    reviewerIdentityRequired: INDEPENDENT_IDENTITY.canonicalName,
    replyFormat: {
      candidateSha256: gr.artifact.sha256, rubricVersion: RUBRIC_VERSION,
      provenanceCheck: { validated: "true|false", notes: "short" },
      checks: items.map((i) => ({ contractItemId: i.contractItemId, result: `one of ${CHECK_RESULTS.join("|")}` })),
      findings: [{ id: "F1", severity: SEVERITY.join("|"), contractItemRef: "an item id above", element: "element id", attribute: "e.g. location", description: "what is wrong", requiredChange: "what to change", fixType: FIX_TYPES.join("|"), gate: "VISUAL_ACCURACY", evidenceDeficiency: false, regression: false }],
      regressionCheck: [],
    },
  };
  return { ok: true, packet, bytes };
}

const QA_MD = (p) => `# Independent image QA: ${p.visualId}

You are the INDEPENDENT reviewer for an instructional illustration in a DIY car-repair app (${p.application.year} ${p.application.make} ${p.application.model}, ${p.application.trim}). You are not the author of the image or of the contract. Review the attached image (candidate.png, sha256 ${p.candidate.sha256}, ${p.candidate.width}x${p.candidate.height}) against the contract below and nothing else. Do not give general design feedback. Do not be generous: one failed required item means the image fails.

## How to judge
- Every **must-depict** item must be clearly visible and plausible as described. FAIL if absent. NOT_VISIBLE if present but too small/occluded to judge.
- Every **must-not-depict** item must NOT appear in any recognisable form. FAIL if it does.
- Parts the contract lists as not established must be plain generic shapes, with no invented detail (head shapes, brand marks, fastener types, orientation).
- No text, letters, numbers, arrows, labels or watermarks anywhere. The top 3%-17% and bottom 83%-97% bands of the height must be plain.
- PROVENANCE: PASS only if there is no sign of copied or traced imagery and no baked-in text.
- A FAIL on a must-depict, must-not-depict or PROVENANCE item needs a finding with severity CRITICAL or CONTRACT citing that item id. Cosmetic issues are severity COSMETIC and do not fail the image.

## Contract items (answer every one)
${p.items.map((i) => {
  if (i.kind === "must-depict") return `- **${i.contractItemId}** MUST DEPICT ${i.element} (${i.visibility}, ${i.criticality}).${i.describe ? ` ${i.describe}` : ""}${i.requirements.length ? ` Established attributes: ${i.requirements.map((r) => r.attribute).join(", ")}.` : ""}`;
  if (i.kind === "must-not-depict") return `- **${i.contractItemId}** MUST NOT DEPICT ${i.element}: ${i.reason}`;
  return `- **PROVENANCE** ${i.rule}`;
}).join("\n")}

## Prompt the image was generated from
\`\`\`
${p.prompt.trim()}
\`\`\`

## Reply format
Reply with ONE JSON object in a single \`\`\`json block and nothing else. Copy candidateSha256 exactly. Every item id above needs exactly one entry in "checks".

\`\`\`json
${JSON.stringify(p.replyFormat, null, 2)}
\`\`\`
`;

/** Write the packet folder: QA-PACKET.md, packet.json, candidate.png, response.template.json. */
export function exportPacket(run, outDir) {
  const r = buildPacket(run);
  if (!r.ok) return r;
  const dir = path.join(outDir, run.visualId);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, "candidate.png"), r.bytes);
  fs.writeFileSync(path.join(dir, "packet.json"), JSON.stringify(r.packet, null, 2) + "\n");
  fs.writeFileSync(path.join(dir, "QA-PACKET.md"), QA_MD(r.packet));
  fs.writeFileSync(path.join(dir, "response.template.json"), JSON.stringify(r.packet.replyFormat, null, 2) + "\n");
  return { ok: true, dir, packet: r.packet };
}

/** Pull the JSON object out of a pasted reply (fenced block or bare). */
export function extractReplyJson(raw) {
  const text = String(raw);
  const fenced = [...text.matchAll(/```(?:json)?\s*([\s\S]*?)```/gi)].map((m) => m[1]);
  const candidates = fenced.length ? fenced : [text];
  const parsed = [];
  for (const c of candidates) { try { const o = JSON.parse(c.trim()); if (o && typeof o === "object" && !Array.isArray(o)) parsed.push(o); } catch { /* try next */ } }
  if (parsed.length !== 1) return fail("REPLY_JSON", parsed.length ? "reply contains more than one JSON object" : "no single JSON object found in the reply");
  return { ok: true, reply: parsed[0] };
}

/**
 * Validate a raw ChatGPT reply against the exported packet and record it as the INDEPENDENT review.
 * `reviewer` = {model, system} as asserted by the human who ran the review. Nothing is written unless every check passes.
 */
export function importReview(run, { rawText, packetDir = null, model, system }) {
  const x = extractReplyJson(rawText);
  if (!x.ok) return x;
  const { reply } = x;
  const built = buildPacket(run);
  if (!built.ok) return built;
  const { packet } = built;
  if (reply.candidateSha256 !== packet.candidate.sha256) return fail("WRONG_CANDIDATE", "reply is for a different image: candidateSha256 does not match the candidate awaiting review");
  if (!model || !system) return fail("REVIEWER_IDENTITY", "--model and --system are required (who actually produced this review)");
  const ids = new Set(contractItemIds(run.store().get(run.state.vc.ref.id)));
  if (!Array.isArray(reply.checks)) return fail("REPLY_SHAPE", "checks must be a list");
  const unknown = reply.checks.filter((c) => !ids.has(c.contractItemId));
  if (unknown.length) return fail("REPLY_SHAPE", `checks cite unknown contract items: ${unknown.map((c) => c.contractItemId).join(", ")}`);
  const sub = {
    reviewer: { actor: "hermes", model, system, rawResponseSha256: sha256(Buffer.from(String(rawText), "utf8")) },
    rubricVersion: reply.rubricVersion, provenanceCheck: reply.provenanceCheck ?? { validated: false, notes: "" },
    checks: reply.checks, findings: reply.findings ?? [], regressionCheck: reply.regressionCheck ?? [],
  };
  if (typeof sub.provenanceCheck.validated === "string") sub.provenanceCheck = { ...sub.provenanceCheck, validated: sub.provenanceCheck.validated === "true" };
  let res;
  try { res = run.submitIndependentReview(sub); }
  catch (e) { if (e instanceof Refused) return fail(e.code, e.message, e.problems); throw e; }
  if (packetDir) {
    const rdir = path.join(packetDir, run.visualId, "responses");
    fs.mkdirSync(rdir, { recursive: true });
    fs.writeFileSync(path.join(rdir, `${sub.reviewer.rawResponseSha256}.txt`), String(rawText));
  }
  return { ok: true, verdict: res.qr.verdict, qr: res.qr, delta: res.cd, rawResponseSha256: sub.reviewer.rawResponseSha256 };
}

// ---- FileDrop candidate import (a person or another system produced the image; this only validates and submits) ----
export function writeDropTemplate(outDir) {
  fs.mkdirSync(outDir, { recursive: true });
  const t = {
    _readme: "Copy to candidate.claims.json next to candidate.png after filling EVERY null. The attestation must be true: it is a statement by whoever generated the image. If any flag is not true the image is refused and the cycle may be spent. Do not attest to something that did not happen.",
    generator: { system: null, model: null, provider: null },
    requestId: null, generationId: null,
    attestation: { ...Object.fromEntries(ATTESTATION_FLAGS.map((f) => [f, null])), attestedBy: "image-generator", attestedOn: null, statement: null },
    imageInputs: [], inputHashes: [],
    contractAck: { mustNotDepictAcknowledged: null },
    licenseTerms: { summary: null },
  };
  fs.writeFileSync(path.join(outDir, "candidate.claims.template.json"), JSON.stringify(t, null, 2) + "\n");
  return path.join(outDir, "candidate.claims.template.json");
}

const nulls = (o, p = "") => Object.entries(o ?? {}).flatMap(([k, v]) => (v === null ? [p + k] : v && typeof v === "object" && !Array.isArray(v) ? nulls(v, `${p}${k}.`) : []));

export async function importDrop(run, { dropDir, promptText }) {
  const png = path.join(dropDir, "candidate.png"), claimsFile = path.join(dropDir, "candidate.claims.json");
  if (!fs.existsSync(png) || !fs.existsSync(claimsFile)) return fail("NO_CANDIDATE", "need candidate.png and candidate.claims.json in the drop folder");
  let claims;
  try { claims = JSON.parse(fs.readFileSync(claimsFile, "utf8")); } catch (e) { return fail("CLAIMS_JSON", `candidate.claims.json is not valid JSON: ${e.message}`); }
  const open = nulls(claims);
  if (open.length) return fail("CLAIMS_INCOMPLETE", `unfilled claim fields: ${open.join(", ")}`);
  const phase = run.state.phase;
  if (!["VC_LOCKED", "GEN_REQUESTED", "DELTA_ISSUED", "PROVENANCE_REJECTED"].includes(phase)) return fail("WRONG_STATE", `cannot accept a candidate in phase ${phase}`);
  try {
    let req;
    if (phase === "GEN_REQUESTED") req = { prompt: promptText, deltaRef: run.state.openDelta ?? undefined };
    else req = run.requestGeneration({ promptText });
    const out = await new FileDropGenerator(dropDir, path.basename(dropDir)).generate(req);
    const r = run.submitGeneration(out, { promptText: req.prompt });
    return { ok: true, provenance: r.provenance, problems: r.problems ?? [], needsAndy: !!r.needsAndy, burned: !!r.burned, generationId: r.gr.id };
  } catch (e) {
    if (e instanceof Refused) return fail(e.code, e.message, e.problems);
    if (e instanceof ActorUnavailable) return fail("NO_CANDIDATE", e.message);
    throw e;
  }
}

// ---------------------------------------------------------------- CLI
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [cmd, ...rest] = process.argv.slice(2);
  const arg = (n) => { const i = rest.indexOf(`--${n}`); return i >= 0 ? rest[i + 1] : undefined; };
  const need = (n) => { const v = arg(n); if (!v) { console.error(`missing --${n}`); process.exit(2); } return v; };
  const show = (r) => { console.log(JSON.stringify(r, (k, v) => (k === "qr" || k === "delta" || k === "packet" ? undefined : v), 2)); process.exitCode = r.ok ? 0 : 1; };
  const runFor = () => openRun({ dir: path.resolve(need("runs"), need("visual")), visualId: need("visual") });
  if (cmd === "export") show(exportPacket(await runFor(), path.resolve(arg("out") ?? path.join(need("runs"), "..", "hermes-qa"))));
  else if (cmd === "import") show(importReview(await runFor(), { rawText: fs.readFileSync(path.resolve(need("response")), "utf8"), packetDir: arg("packet") ? path.resolve(arg("packet")) : null, model: arg("model"), system: arg("system") }));
  else if (cmd === "drop-template") console.log(writeDropTemplate(path.resolve(need("out"))));
  else if (cmd === "drop-import") {
    const run = await runFor();
    const pf = path.join(run.dir, "generation-prompt.txt");
    show(await importDrop(run, { dropDir: path.resolve(need("drop")), promptText: fs.existsSync(pf) ? fs.readFileSync(pf, "utf8") : null }));
  } else { console.error("usage: export | import | drop-template | drop-import (see header)"); process.exit(2); }
}
