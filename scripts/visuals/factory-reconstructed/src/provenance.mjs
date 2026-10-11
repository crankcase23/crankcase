// RECONSTRUCTED-V1 | NOT the lost original.
// Provenance checks for a generation (GR) + the no-source-pixels attestation.
// Sources: VD arch §1.3 GR validation list; VC recovered lib `rasterRefusal` (attestation flags, attestedBy ===
// "image-generator", empty imageInputs); VC recovered lib `artworkRefusal` + types `OriginalArtworkRecord.noSourcePixels`.
import { sha256 } from "./canon.mjs";
import { P } from "./evidence.mjs";
import { FRAME, MAX_GENERATIONS, MEDIA_TYPES_SUPPORTED, GENERATED_ASSET_CLASS, RIGHTS_BASIS } from "./enums.mjs";
import { hasPngMagic, parsePng, isAnimated, c2paInfo, MalformedPng } from "./png.mjs";
import { envelopeProblems } from "./objects.mjs";

const isStr = (s) => typeof s === "string" && s.trim().length > 0;
export const ATTESTATION_FLAGS = ["generatedFromTextOnly", "noReferenceImageInputs", "noTracing", "noThirdPartyCompositing", "noBakedText"]; // VC types
const SUBSTANTIVE_FLAGS = ["generatedFromTextOnly", "noReferenceImageInputs", "noTracing", "noThirdPartyCompositing"]; // INFERRED split, see policy.mjs

/** NO-SOURCE-PIXELS attestation for ORIGINAL ARTWORK (VC types `OriginalArtworkRecord.noSourcePixels`). */
export function noSourcePixelsProblems(n) {
  const bad = [];
  if (!n || n.attested !== true || !isStr(n.by) || !isStr(n.on)) return [P("NSP_MISSING", "metadata", "no-source-pixels attestation missing")];
  if (!isStr(n.statement)) bad.push(P("NSP_MISSING", "metadata", "no-source-pixels statement missing"));
  if (!Array.isArray(n.referenceImageInputs) || !Array.isArray(n.tracedFrom)) bad.push(P("NSP_MISSING", "metadata", "referenceImageInputs/tracedFrom must be lists"));
  else if (n.referenceImageInputs.length || n.tracedFrom.length) bad.push(P("NSP_DERIVED", "substantive", "artwork was derived from reference pixels"));
  return bad;
}

/** Attestation for a GENERATED RASTER (VC types `GeneratedRasterRecord.attestation`). */
export function attestationProblems(at) {
  if (!at || typeof at !== "object") return [P("ATT_MISSING", "metadata", "generator attestation missing")];
  const bad = [];
  for (const f of ATTESTATION_FLAGS) {
    if (at[f] === false) bad.push(P("ATT_FLAG_FALSE", SUBSTANTIVE_FLAGS.includes(f) ? "substantive" : "metadata", `attestation.${f} is false`));
    else if (at[f] !== true) bad.push(P("ATT_INCOMPLETE", "metadata", `attestation.${f} missing`));
  }
  if (at.attestedBy !== "image-generator") bad.push(P("ATT_ATTESTER", "metadata", "attestedBy must be image-generator"));
  if (!isStr(at.attestedOn) || Number.isNaN(Date.parse(at.attestedOn))) bad.push(P("ATT_INCOMPLETE", "metadata", "attestedOn missing"));
  if (!isStr(at.statement)) bad.push(P("ATT_INCOMPLETE", "metadata", "attestation statement missing"));
  return bad;
}

/** Build the code-filled artifact record from the actual bytes (VD: "The code fills these in from the actual file; the generator does not."). */
export function describeRaster(bytes, mediaType = "png") {
  const base = { mediaType, sha256: sha256(bytes), bytes: bytes.length };
  if (!hasPngMagic(bytes)) return { ...base, width: 0, height: 0, metadataChunks: [], c2pa: { present: false }, animated: false, parseError: "not a PNG (magic bytes)" };
  try {
    const p = parsePng(bytes);
    return { ...base, width: p.width, height: p.height, metadataChunks: [...new Set(p.chunks.map((c) => c.type))].filter((t) => !["IHDR", "PLTE", "IDAT", "IEND", "tRNS"].includes(t)), c2pa: c2paInfo(p.chunks), animated: isAnimated(p.chunks) };
  } catch (e) {
    return { ...base, width: 0, height: 0, metadataChunks: [], c2pa: { present: false }, animated: false, parseError: e instanceof MalformedPng ? e.message : String(e) };
  }
}

/**
 * Check a GR against the real bytes. Returns {ok, problems, substantive}. `substantive` = at least one problem is of
 * class "substantive" (evidence that source pixels/tracing/compositing/image inputs were used); used by the cycle policy.
 */
export function checkGeneration({ gr, bytes, vc, promptText = null, qaActor = null }) {
  const bad = envelopeProblems("GR", gr).map((m) => P("ENVELOPE", "metadata", m));
  const a = gr?.artifact;
  if (!a) bad.push(P("GR_NO_ARTIFACT", "metadata", "artifact record missing"));
  else {
    if (!MEDIA_TYPES_SUPPORTED.includes(a.mediaType)) bad.push(P("GR_MEDIA_TYPE", "metadata", `media type ${a.mediaType} not supported in this reconstruction (png only)`));
    if (a.sha256 !== sha256(bytes)) bad.push(P("GR_HASH", "metadata", "artifact.sha256 does not equal the file hash"));
    const d = describeRaster(bytes, a.mediaType);
    if (d.parseError) bad.push(P("GR_MAGIC", "metadata", d.parseError));
    else {
      if (d.width !== a.width || d.height !== a.height) bad.push(P("GR_DIMENSIONS_RECORD", "metadata", "recorded dimensions differ from the file"));
      if (d.width * FRAME.aspectH !== d.height * FRAME.aspectW) bad.push(P("GR_ASPECT", "metadata", `${d.width}x${d.height} is not exactly 16:10`));
      if (d.width < FRAME.width || d.height < FRAME.height) bad.push(P("GR_TOO_SMALL", "metadata", `${d.width}x${d.height} is smaller than ${FRAME.width}x${FRAME.height}`));
      if (d.animated) bad.push(P("GR_ANIMATED", "metadata", "animated image refused"));
    }
    if (vc && bytes.length > vc.output.maxBytes) bad.push(P("GR_TOO_LARGE", "metadata", `file is ${bytes.length} bytes, over the contract cap ${vc.output.maxBytes}`));
  }
  if (!Array.isArray(gr?.imageInputs) || !Array.isArray(gr?.inputHashes)) bad.push(P("GR_IMAGE_INPUTS_SHAPE", "metadata", "imageInputs/inputHashes must be lists"));
  else if (gr.imageInputs.length || gr.inputHashes.length) bad.push(P("GR_IMAGE_INPUTS", "substantive", "generation used image inputs"));
  bad.push(...attestationProblems(gr?.attestation));
  if (gr?.contractAck?.mustNotDepictAcknowledged !== true) bad.push(P("GR_CONTRACT_ACK", "metadata", "contractAck.mustNotDepictAcknowledged missing"));
  if (!isStr(gr?.promptSha256)) bad.push(P("GR_PROMPT", "metadata", "promptSha256 missing"));
  else if (promptText !== null && gr.promptSha256 !== sha256(Buffer.from(promptText, "utf8"))) bad.push(P("GR_PROMPT", "metadata", "promptSha256 does not match the stored prompt"));
  // C-5 lock #3: generated assets are project assets subject to the provider's rights. Record exactly that; never claim more.
  const lic = gr?.license;
  if (!isStr(lic?.terms?.summary)) bad.push(P("GR_LICENSE_TERMS", "metadata", "the generation provider's usage-rights terms must be recorded (license.terms.summary)"));
  if (lic?.ownershipAsserted !== false) bad.push(P("GR_OWNERSHIP_CLAIM", "metadata", "ownership may not be asserted beyond the provider-granted rights (ownershipAsserted must be false)"));
  if (lic?.assetClass !== GENERATED_ASSET_CLASS || lic?.rightsBasis !== RIGHTS_BASIS) bad.push(P("GR_ASSET_CLASS", "metadata", "license.assetClass/rightsBasis must state the canonical project-asset classification"));
  if (!gr?.generator?.system || !gr?.generator?.model) bad.push(P("GR_GENERATOR", "metadata", "generator {system, model} missing"));
  if (!Number.isInteger(gr?.cycle) || gr.cycle < 1 || gr.cycle > MAX_GENERATIONS) bad.push(P("GR_CYCLE", "metadata", `cycle must be 1..${MAX_GENERATIONS}`));
  if (qaActor && gr?.attestation?.attestedBy === qaActor) bad.push(P("GR_ATTESTER_IS_QA", "metadata", "attestation by the QA actor"));
  return { ok: bad.length === 0, problems: bad, substantive: bad.some((b) => b.class === "substantive") };
}
