// RECONSTRUCTED-V1 | NOT the lost original.
// Source: VD arch doc §0.1 ("immutable and content-addressed ... SHA-256 of its canonical JSON (sorted keys,
// contentHash and nothing mutable excluded)"). Exact original canonicalization rules: UNKNOWN -> INFERRED here
// (sorted keys, no whitespace, JSON.stringify scalar encoding, undefined object members dropped, non-finite numbers refused).
import { createHash } from "node:crypto";

export const sha256 = (buf) => createHash("sha256").update(buf).digest("hex");

export function canonicalize(v) {
  if (v === null) return "null";
  const t = typeof v;
  if (t === "number") { if (!Number.isFinite(v)) throw new Error("canonicalize: non-finite number"); return JSON.stringify(v); }
  if (t === "string" || t === "boolean") return JSON.stringify(v);
  if (Array.isArray(v)) return "[" + v.map((x) => { if (x === undefined) throw new Error("canonicalize: undefined in array"); return canonicalize(x); }).join(",") + "]";
  if (t === "object") {
    const keys = Object.keys(v).filter((k) => v[k] !== undefined).sort();
    return "{" + keys.map((k) => JSON.stringify(k) + ":" + canonicalize(v[k])).join(",") + "}";
  }
  throw new Error(`canonicalize: unsupported type ${t}`);
}

export const contentHashOf = (obj) => { const { contentHash: _omit, ...rest } = obj; return sha256(canonicalize(rest)); };
export const seal = (obj) => ({ ...obj, contentHash: contentHashOf(obj) });
export const refOf = (o) => ({ id: o.id, sha256: o.contentHash });
export const stable = (o) => JSON.stringify(JSON.parse(canonicalize(o)), null, 2) + "\n"; // pretty, key-sorted, deterministic file form
