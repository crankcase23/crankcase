// RECONSTRUCTED-V1 | NOT the lost original.
// Reference-evidence intake + evidence ledger + EP validation.
// Rules: VD arch §1.1 (Evidence Packet validation) + VC recovered lib `artworkRefusal` ledger checks + VC types.
// Problems are {code, class, msg}. class "malformed" = shape/enum/type errors; "missing" = evidence absent;
// "rule" = a documented evidence rule is violated. Nothing here invents facts about any vehicle.
import { ELEMENT_ROLES, CRITICALITY, LEDGER_ATTRIBUTES, LEDGER_STATUS, LEDGER_RENDER, REFERENCE_KINDS, REFERENCE_USAGE, SAFETY_CRITICAL, STRICT_RENDER_CRITICALITY, ACTORS } from "./enums.mjs";
import { envelopeProblems } from "./objects.mjs";

export const P = (code, cls, msg) => ({ code, class: cls, msg });
const isStr = (s) => typeof s === "string" && s.trim().length > 0;
const isArr = Array.isArray;

/** Reference-evidence intake: ONE reference. */
export function referenceProblems(r, i = 0) {
  const w = `references[${i}]`, bad = [];
  if (!r || typeof r !== "object") return [P("REF_SHAPE", "malformed", `${w} is not an object`)];
  if (!isStr(r.id)) bad.push(P("REF_SHAPE", "malformed", `${w}.id missing`));
  if (!REFERENCE_KINDS.includes(r.kind)) bad.push(P("REF_SHAPE", "malformed", `${w}.kind ${JSON.stringify(r.kind)} not in ${REFERENCE_KINDS.join("|")}`));
  if (!isStr(r.source)) bad.push(P("REF_SHAPE", "malformed", `${w}.source missing`));
  if (!isStr(r.sourceRef)) bad.push(P("REF_SHAPE", "malformed", `${w}.sourceRef missing (must let a reviewer re-open the item)`));
  if (!REFERENCE_USAGE.includes(r.usage)) bad.push(P("REF_USAGE", "rule", `${w}.usage must be reference-only|corroborating-text (a reference is never an image input)`));
  if (r.usedAsImageInput === true || r.imageInput === true) bad.push(P("REF_IMAGE_INPUT", "rule", `${w} is flagged as an image input`));
  if (!isArr(r.establishes) || r.establishes.length === 0 || r.establishes.some((x) => !isStr(x))) bad.push(P("REF_SHAPE", "malformed", `${w}.establishes must be a non-empty string list`));
  if (!isStr(r.rights)) bad.push(P("REF_SHAPE", "malformed", `${w}.rights missing`));
  return bad;
}

export function ledgerRowProblems(row, i, refIds, elementIds) {
  const w = `ledger[${i}]`, bad = [];
  if (!row || typeof row !== "object") return [P("LEDGER_SHAPE", "malformed", `${w} is not an object`)];
  if (!isStr(row.element)) bad.push(P("LEDGER_SHAPE", "malformed", `${w}.element missing`));
  else if (!elementIds.has(row.element)) bad.push(P("LEDGER_ELEMENT_UNKNOWN", "rule", `${w}.element ${row.element} is not in elements[]`));
  if (!LEDGER_ATTRIBUTES.includes(row.attribute)) bad.push(P("LEDGER_SHAPE", "malformed", `${w}.attribute ${JSON.stringify(row.attribute)} invalid`));
  if (!LEDGER_STATUS.includes(row.status)) bad.push(P("LEDGER_SHAPE", "malformed", `${w}.status invalid`));
  if (!LEDGER_RENDER.includes(row.render)) bad.push(P("LEDGER_SHAPE", "malformed", `${w}.render invalid`));
  if (!isStr(row.note)) bad.push(P("LEDGER_SHAPE", "malformed", `${w}.note missing`));
  if (row.status === "established") {
    if (!isArr(row.evidence) || row.evidence.length === 0) bad.push(P("LEDGER_ESTABLISHED_NO_EVIDENCE", "missing", `${w} is established but cites no evidence`));
    else if (!row.evidence.every((id) => refIds.has(id))) bad.push(P("LEDGER_EVIDENCE_UNKNOWN", "rule", `${w} cites a reference id that does not exist`));
  }
  if (row.status === "not-established") {
    if (row.render === "draw") bad.push(P("LEDGER_UNSUPPORTED_DRAWN", "rule", `${w}: unsupported attribute drawn as if known`));
    if (SAFETY_CRITICAL.includes(row.attribute) && row.render !== "omit" && row.render !== "occlude") bad.push(P("LEDGER_SAFETY_SHOWN", "rule", `${w}: unsupported safety-critical geometry shown`));
  }
  return bad;
}

/** Full structural + rule validation of an Evidence Packet. Does NOT decide sufficiency (see sufficiencyProblems). */
export function epProblems(ep) {
  const bad = envelopeProblems("EP", ep).map((m) => P("ENVELOPE", "malformed", m));
  if (!ep || typeof ep !== "object") return bad;
  const cs = ep.canonicalStep;
  if (!cs || !Number.isInteger(cs.stepNumber) || !isStr(cs.title) || !isArr(cs.actions) || cs.actions.some((a) => !isStr(a))) bad.push(P("EP_SHAPE", "malformed", "canonicalStep {stepNumber, title, actions[]} invalid"));
  if (!isArr(ep.references)) bad.push(P("EP_SHAPE", "malformed", "references must be a list"));
  if (!isArr(ep.elements) || ep.elements.length === 0) bad.push(P("EP_SHAPE", "malformed", "elements must be a non-empty list"));
  if (!isArr(ep.ledger)) bad.push(P("EP_SHAPE", "malformed", "ledger must be a list"));
  if (!isArr(ep.mustNotDepict)) bad.push(P("EP_SHAPE", "malformed", "mustNotDepict must be a list (may be empty)"));
  if (bad.some((b) => b.code === "EP_SHAPE")) return bad;

  ep.references.forEach((r, i) => bad.push(...referenceProblems(r, i)));
  const refIds = new Set(ep.references.map((r) => r.id));
  if (refIds.size !== ep.references.length) bad.push(P("REF_DUPLICATE_ID", "malformed", "duplicate reference ids"));

  const elementIds = new Set();
  ep.elements.forEach((e, i) => {
    if (!isStr(e?.id) || !ELEMENT_ROLES.includes(e?.role) || !CRITICALITY.includes(e?.criticality)) bad.push(P("ELEMENT_SHAPE", "malformed", `elements[${i}] {id, role, criticality} invalid`));
    else if (elementIds.has(e.id)) bad.push(P("ELEMENT_SHAPE", "malformed", `duplicate element id ${e.id}`));
    else elementIds.add(e.id);
  });
  const rowKeys = new Set();
  for (const row of ep.ledger) { const k = `${row?.element}\u0000${row?.attribute}`; if (rowKeys.has(k)) bad.push(P("LEDGER_DUPLICATE_ROW", "malformed", `duplicate ledger row for ${row?.element}/${row?.attribute}`)); rowKeys.add(k); }
  const mndIds = new Set();
  for (const m of ep.mustNotDepict) { if (mndIds.has(m?.id)) bad.push(P("MND_DUPLICATE_ID", "malformed", `duplicate mustNotDepict id ${m?.id}`)); mndIds.add(m?.id); }
  const critOf = new Map(ep.elements.map((e) => [e.id, e.criticality]));

  ep.ledger.forEach((row, i) => {
    bad.push(...ledgerRowProblems(row, i, refIds, elementIds));
    if (row?.status === "not-established" && STRICT_RENDER_CRITICALITY.includes(critOf.get(row.element)) && !["omit", "occlude"].includes(row.render))
      bad.push(P("LEDGER_STRICT_RENDER", "rule", `ledger[${i}]: unsupported row on a ${critOf.get(row.element)} element may only be omit|occlude`));
  });

  ep.mustNotDepict.forEach((m, i) => {
    const traced = isArr(ep.ledger) && ep.ledger.some((r) => r.element === m?.trace?.element && r.attribute === m?.trace?.attribute && ["omit", "occlude"].includes(r.render));
    if (!isStr(m?.id) || !isStr(m?.element) || !isStr(m?.reason)) bad.push(P("MND_SHAPE", "malformed", `mustNotDepict[${i}] {id, element, reason, trace} invalid`));
    else if (!traced) bad.push(P("MND_UNTRACED", "rule", `mustNotDepict[${i}] does not trace to an omit|occlude ledger row`));
  });

  const sp = ep.sufficiencyProposal;
  if (!sp || !ACTORS.includes(sp.proposedBy) || !isStr(sp.basis)) bad.push(P("EP_SHAPE", "malformed", "sufficiencyProposal {proposedBy, basis} invalid"));
  if (ep.supersedes && (!ep.deficiencyRef || !isStr(ep.deficiencyRef.qrId) || !isStr(ep.deficiencyRef.findingId))) bad.push(P("EP_SUPERSEDE_NO_DEFICIENCY", "rule", "a superseding EP needs deficiencyRef {qrId, findingId}"));
  if (!ep.supersedes && ep.deficiencyRef) bad.push(P("EP_SHAPE", "malformed", "deficiencyRef only allowed with supersedes"));
  return bad;
}

/**
 * Objective sufficiency (VD arch §1.1 + Brick A "objective EP sufficiency"). Empty = may be declared SUFFICIENT.
 * - there must be references (a packet with no evidence is never sufficient)
 * - every hero and target element needs ESTABLISHED existence and location
 */
export function sufficiencyProblems(ep) {
  const bad = [];
  if (!isArr(ep.references) || ep.references.length === 0) bad.push(P("EP_NO_REFERENCES", "missing", "no reference evidence at all"));
  for (const e of ep.elements ?? []) {
    if (e.role !== "hero" && e.role !== "target") continue;
    for (const attr of ["existence", "location"]) {
      const row = ep.ledger.find((r) => r.element === e.id && r.attribute === attr);
      if (!row || row.status !== "established") bad.push(P("EP_HERO_NOT_ESTABLISHED", "missing", `${e.role} element ${e.id} lacks established ${attr}`));
    }
  }
  return bad;
}

export const isBlockedElement = (ep, elementId) => ep.ledger.filter((r) => r.element === elementId && r.status === "not-established").length > 0;
