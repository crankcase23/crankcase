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
//   node scripts/bmw/hermes-qa.mjs fit --in native.png --drop DIR      (pad native output to exact 16:10, never stretch)
//   node scripts/bmw/hermes-qa.mjs gen-kit --runs DIR --out DIR         (one ready-to-run folder per locked visual)
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
export function buildPacket(run, { fitRecord = null, preview = false } = {}) {
  const s = run.state;
  const isPreview = preview && s.phase === "GEN_REQUESTED";
  if (!QA_PHASES.includes(s.phase) && !isPreview) return fail("WRONG_STATE", `QA packet needs a provenance-valid candidate awaiting QA (phase is ${s.phase})`);
  const store = run.store();
  // PREVIEW: the contract is locked and the prompt is issued, but no candidate exists yet. The packet is complete except for the image.
  const gr = isPreview ? null : store.get(s.pendingGR.id), vc = store.get(s.vc.ref.id), ep = store.get(s.ep.ref.id);
  const bytes = isPreview ? null : readBytes(run.dir, gr.artifact.file);
  if (!isPreview && sha256(bytes) !== gr.artifact.sha256) return fail("CANDIDATE_TAMPERED", "candidate file no longer matches its recorded hash");
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
  const prompt = isPreview ? fs.readFileSync(path.join(run.dir, "generation-prompt.txt"), "utf8") : readBytes(run.dir, gr.promptFile).toString("utf8");
  const technical = [];
  for (const m of vc.mustDepict) {
    const el = ep.elements.find((e) => e.id === m.element);
    const rows = ep.ledger.filter((r) => r.element === m.element);
    technical.push({
      element: m.element, role: m.visibility, criticality: m.criticality, describe: el?.describe ?? null,
      established: rows.filter((r) => r.status === "established").map((r) => ({ attribute: r.attribute, sources: r.evidence.map((id) => ({ url: refById.get(id)?.sourceRef, kind: refById.get(id)?.kind, says: refById.get(id)?.establishes?.[0] })) })),
      notEstablished: rows.filter((r) => r.status === "not-established").map((r) => ({ attribute: r.attribute, render: r.render, note: r.note })),
    });
  }
  const packet = {
    schema: "bmw-image-qa-packet.v1", rubricVersion: RUBRIC_VERSION, visualId: run.visualId, application: run.application,
    status: isPreview ? "AWAITING_CANDIDATE_IMAGE" : "READY_FOR_REVIEW",
    candidate: isPreview ? { generationId: null, file: "candidate.png", sha256: "(set when the image exists)", width: null, height: null, cycle: null } : { generationId: gr.id, file: "candidate.png", sha256: gr.artifact.sha256, width: gr.artifact.width, height: gr.artifact.height, cycle: gr.cycle },
    contract: { id: vc.id, contentHash: vc.contentHash ?? null, frame: vc.output, clearSpace: vc.overlay.clearSpaceRegions },
    fit: fitRecord, items, technical, prompt, attestation: isPreview ? null : gr.attestation, generator: isPreview ? null : { system: gr.generator.system, model: gr.generator.model },
    reviewerIdentityRequired: INDEPENDENT_IDENTITY.canonicalName,
    replyFormat: {
      candidateSha256: isPreview ? "(sha256 of candidate.png)" : gr.artifact.sha256, rubricVersion: RUBRIC_VERSION,
      provenanceCheck: { validated: "true|false", notes: "short" },
      checks: items.map((i) => ({ contractItemId: i.contractItemId, result: `one of ${CHECK_RESULTS.join("|")}` })),
      findings: [{ id: "F1", severity: SEVERITY.join("|"), contractItemRef: "an item id above", element: "element id", attribute: "e.g. location", description: "what is wrong", requiredChange: "what to change", fixType: FIX_TYPES.join("|"), gate: "VISUAL_ACCURACY", evidenceDeficiency: false, regression: false }],
      regressionCheck: [],
    },
  };
  return { ok: true, packet, bytes };
}

const QA_MD = (p) => `# Independent image QA: ${p.visualId}

You are the INDEPENDENT reviewer for an instructional illustration in a DIY car-repair app (${p.application.year} ${p.application.make} ${p.application.model}, ${p.application.trim}). You are not the author of the image or of the contract. ${p.status === "AWAITING_CANDIDATE_IMAGE" ? "**PREVIEW: the contract is locked but the candidate image has not been generated yet. Do not review anything from this file; the final packet is issued with the image.**\n\n" : ""}Review the attached image (candidate.png, sha256 ${p.candidate.sha256}, ${p.candidate.width ? `${p.candidate.width}x${p.candidate.height}` : "size set when the image exists"}) against the contract below and nothing else. Do not give general design feedback. Do not be generous: one failed required item means the image fails.

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

## Technical details to verify independently
For each must-depict part, the facts below were established from the cited sources (the car is a 2010 BMW 328i E90, N52 3.0L inline-6, rear-wheel drive and automatic, halogen headlights and standard key as decoded from its option codes by one free decoder; treat those three as probable, not proven). Check the image against them using your own knowledge and any source you can open. "Not established" attributes must appear only as plain generic shapes; if the image shows specific detail there, that is a finding.
${p.technical.map((t) => `- **${t.element}** (${t.role}, ${t.criticality})${t.describe ? `: ${t.describe}` : ""}
${t.established.map((e) => `  - established ${e.attribute}: ${e.sources.map((x) => `${x.url} (${x.kind}: ${x.says})`).join("; ")}`).join("\n")}
${t.notEstablished.map((e) => `  - NOT established ${e.attribute} (${e.render}): ${e.note}`).join("\n")}`).join("\n")}
${p.fit ? `
## How the image was prepared
The generator's native file (${p.fit.native.width}x${p.fit.native.height}) was padded, not stretched or cropped, to an exact 16:10 canvas (${p.fit.fitted.width}x${p.fit.fitted.height}): padding left ${p.fit.pad.left}, right ${p.fit.pad.right}, top ${p.fit.pad.top}, bottom ${p.fit.pad.bottom} px of edge-replicated background. Judge the illustration, not the padding. Native sha256 ${p.fit.native.sha256}.
` : ""}
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
export function exportPacket(run, outDir, { fitRecord = null, preview = false } = {}) {
  const r = buildPacket(run, { fitRecord, preview });
  if (!r.ok) return r;
  const dir = path.join(outDir, run.visualId);
  fs.mkdirSync(dir, { recursive: true });
  if (r.bytes) fs.writeFileSync(path.join(dir, "candidate.png"), r.bytes);
  fs.writeFileSync(path.join(dir, "packet.json"), JSON.stringify(r.packet, null, 2) + "\n");
  fs.writeFileSync(path.join(dir, r.packet.status === "READY_FOR_REVIEW" ? "QA-PACKET.md" : "QA-PACKET.PREVIEW.md"), QA_MD(r.packet));
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

// ---- Generation kit: everything a person needs to run ONE locked visual through ChatGPT image generation ----
export function writeGenKit(run, outDir) {
  const s = run.state;
  if (s.phase !== "GEN_REQUESTED") return fail("WRONG_STATE", `generation kit needs a locked contract with a generation request (phase is ${s.phase})`);
  const pf = path.join(run.dir, "generation-prompt.txt");
  if (!fs.existsSync(pf)) return fail("NO_PROMPT", "generation-prompt.txt missing from the run");
  const prompt = fs.readFileSync(pf, "utf8");
  const dir = path.join(outDir, run.visualId);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, "PROMPT.txt"), prompt);
  writeDropTemplate(dir);
  const md = `# Generate: ${run.visualId}

Prompt sha256: \`${sha256(Buffer.from(prompt, "utf8"))}\` (the factory records this; do not edit the prompt).

1. Open a NEW ChatGPT chat (image generation). Paste the whole of \`PROMPT.txt\`. Do not attach any image.
2. If ChatGPT asks about size, choose landscape. Native sizes such as 3:2 are fine: the image is padded to 16:10 afterwards, never stretched. Square or portrait will be refused.
3. If the first result shows text, labels, arrows, brand marks, or parts the prompt says not to show, regenerate (each regeneration is a cycle; the factory allows an initial generation plus 3 corrections).
4. Download the image as **PNG** and save it in this folder as \`native.png\`. Keep the C2PA/metadata: do not re-save or edit it.
5. Fill every \`null\` in \`candidate.claims.template.json\` and save it as \`candidate.claims.json\`. The attestation flags are your statement that it is true: text-only prompt, no reference images, no tracing, no other imagery composited, no baked-in text. Put the provider and model that actually made the image (for example system "ChatGPT image generation") and the provider's usage terms in \`licenseTerms.summary\`.
6. Run:
   \`npm run bmw:qa -- fit --in <this folder>/native.png --drop <this folder>\`
   \`npm run bmw:qa -- drop-import --runs <runs dir> --visual ${run.visualId} --drop <this folder>\`
   \`npm run bmw:qa -- export --runs <runs dir> --visual ${run.visualId} --drop <this folder>\`
7. Give the exported \`QA-PACKET.md\` and \`candidate.png\` to Hermes / ChatGPT in a **separate, fresh chat** (not the one that made the image), then save its reply and run \`npm run bmw:qa -- import ... --response reply.txt --model "<model>" --system "<system>"\`.
`;
  fs.writeFileSync(path.join(dir, "INSTRUCTIONS.md"), md);
  return { ok: true, dir, promptSha256: sha256(Buffer.from(prompt, "utf8")) };
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
  const fitRecordOf = (drop) => { const f = drop && path.join(path.resolve(drop), "candidate.fit-record.json"); return f && fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, "utf8")) : null; };
  if (cmd === "export") show(exportPacket(await runFor(), path.resolve(arg("out") ?? path.join(need("runs"), "..", "hermes-qa")), { fitRecord: fitRecordOf(arg("drop")), preview: rest.includes("--preview") }));
  else if (cmd === "fit") {
    const { fitFile } = await import(path.join(ROOT, "scripts/bmw/fit-frame.mjs"));
    const drop = path.resolve(need("drop"));
    const r = fitFile(path.resolve(need("in")), drop);
    show(r.ok ? { ok: true, native: r.record.native, fitted: r.record.fitted, pad: r.record.pad } : r);
  } else if (cmd === "gen-kit") {
    const runs = path.resolve(need("runs")), out = path.resolve(need("out"));
    const rows = [];
    const FIRST = "oil-drain-plug-access"; // most valuable guide, both hero facts established by 2+ hosts: run this one first
    for (const id of fs.readdirSync(runs).filter((d) => fs.existsSync(path.join(runs, d, "template.json"))).sort((a, b) => (b === FIRST) - (a === FIRST) || a.localeCompare(b))) {
      const r = writeGenKit(await openRun({ dir: path.join(runs, id), visualId: id }), out);
      rows.push({ visualId: id, ok: r.ok, ...(r.ok ? { promptSha256: r.promptSha256 } : { skipped: r.message }) });
    }
    fs.writeFileSync(path.join(out, "INDEX.md"), `# Generation kits\n\nOne folder per visual. Follow INSTRUCTIONS.md in each. The first one is the pilot: do it end to end, including the independent review, before spending effort on the rest. "<runs dir>" in the instructions is docs/bmw-e90/image-evidence/output.\n\n${rows.filter((x) => x.ok).map((x, i) => `${i + 1}. ${x.visualId}`).join("\n")}\n\nSkipped (evidence not sufficient yet): ${rows.filter((x) => !x.ok).map((x) => x.visualId).join(", ") || "none"}\n`);
    show({ ok: true, kits: rows.filter((x) => x.ok).length, skipped: rows.filter((x) => !x.ok).length });
  }
  else if (cmd === "import") show(importReview(await runFor(), { rawText: fs.readFileSync(path.resolve(need("response")), "utf8"), packetDir: arg("packet") ? path.resolve(arg("packet")) : null, model: arg("model"), system: arg("system") }));
  else if (cmd === "drop-template") console.log(writeDropTemplate(path.resolve(need("out"))));
  else if (cmd === "drop-import") {
    const run = await runFor();
    const pf = path.join(run.dir, "generation-prompt.txt");
    show(await importDrop(run, { dropDir: path.resolve(need("drop")), promptText: fs.existsSync(pf) ? fs.readFileSync(pf, "utf8") : null }));
  } else { console.error("usage: export | import | drop-template | drop-import (see header)"); process.exit(2); }
}
