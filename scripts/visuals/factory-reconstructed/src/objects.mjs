// RECONSTRUCTED-V1 | NOT the lost original.
// Common envelope + generic validation for the six factory objects (EP, VC, GR, QR, CD, AA) + template.
// Source: VD arch §0 "Common envelope on every object":
//   schema, schemaVersion, id, visualId, application{year,make,model,trim?,engine}, createdBy{actor, role, system?},
//   createdAt, refs[{id,sha256}], contentHash
import { contentHashOf, seal } from "./canon.mjs";
import { ACTORS, ID_PATTERNS, OBJECT_SCHEMAS, SCHEMA_VERSION } from "./enums.mjs";

const isStr = (s) => typeof s === "string" && s.trim().length > 0;
const isIsoDate = (s) => typeof s === "string" && !Number.isNaN(Date.parse(s));

export function makeObject(kind, { id, visualId, application, createdBy, createdAt, refs = [], body }) {
  if (!OBJECT_SCHEMAS[kind]) throw new Error(`unknown object kind ${kind}`);
  return seal({ schema: OBJECT_SCHEMAS[kind], schemaVersion: SCHEMA_VERSION, id, visualId, application, createdBy, createdAt, refs, ...body });
}

export function applicationProblems(a, label = "application") {
  const bad = [];
  if (!a || typeof a !== "object") return [`${label} missing`];
  if (!Number.isInteger(a.year)) bad.push(`${label}.year must be an integer`);
  for (const k of ["make", "model", "engine"]) if (!isStr(a[k])) bad.push(`${label}.${k} missing`);
  if (a.trim !== undefined && !isStr(a.trim)) bad.push(`${label}.trim must be non-empty when present`);
  return bad;
}

/** Envelope-level problems. Empty = envelope is well-formed and its contentHash matches its content. */
export function envelopeProblems(kind, o) {
  const bad = [];
  if (!o || typeof o !== "object") return ["object missing or not an object"];
  if (o.schema !== OBJECT_SCHEMAS[kind]) bad.push(`schema must be ${OBJECT_SCHEMAS[kind]}`);
  if (o.schemaVersion !== SCHEMA_VERSION) bad.push(`schemaVersion must be ${SCHEMA_VERSION}`);
  if (!isStr(o.id) || !ID_PATTERNS[kind].test(o.id)) bad.push(`id ${JSON.stringify(o.id)} does not match ${ID_PATTERNS[kind]}`);
  if (kind !== "TPL" && !isStr(o.visualId)) bad.push("visualId missing");
  bad.push(...applicationProblems(o.application));
  if (!o.createdBy || !ACTORS.includes(o.createdBy.actor) || !isStr(o.createdBy.role)) bad.push("createdBy {actor, role} invalid");
  if (!isIsoDate(o.createdAt)) bad.push("createdAt must be an ISO timestamp");
  if (!Array.isArray(o.refs) || o.refs.some((r) => !isStr(r?.id) || !/^[0-9a-f]{64}$/.test(r?.sha256 ?? ""))) bad.push("refs must be [{id, sha256}]");
  if (!/^[0-9a-f]{64}$/.test(o.contentHash ?? "")) bad.push("contentHash missing");
  else if (o.contentHash !== contentHashOf(o)) bad.push("contentHash does not match content (object was altered)");
  return bad;
}

export const sameApplication = (a, b) => ["year", "make", "model", "engine"].every((k) => String(a?.[k]).toLowerCase() === String(b?.[k]).toLowerCase()) && String(a?.trim ?? "") === String(b?.trim ?? "");
export const norm = (s) => String(s ?? "").toLowerCase().replace(/[^a-z0-9]+/g, ""); // same as recovered lib `norm`
export const applicationMatches = (app, v) => app.year === v.year && norm(app.make) === norm(v.make) && norm(app.model) === norm(v.model) && norm(app.engine) === norm(v.engine) && (!app.trim || norm(app.trim) === norm(v.trim ?? "")); // mirrors recovered lib

/** slug used for /guide-visuals/<slug>/ (mirrors recovered scripts/visuals/lib.mjs slugApplication) */
export const slugApplication = (a) => [a.year, a.make, a.model, a.trim, a.engine].filter(Boolean).map((x) => String(x).toLowerCase().replace(/[^a-z0-9.]+/g, "-").replace(/^-|-$/g, "")).join("-");

/** Verify that every ref in `o.refs` resolves in `store` (id -> object) with the exact hash. */
export function refProblems(o, store) {
  const bad = [];
  for (const r of o.refs ?? []) {
    const t = store.get(r.id);
    if (!t) bad.push(`ref ${r.id} does not resolve`);
    else if (contentHashOf(t) !== r.sha256) bad.push(`ref ${r.id} hash mismatch (referenced object changed)`); // recomputed from content, not trusted from the stored field
  }
  return bad;
}
