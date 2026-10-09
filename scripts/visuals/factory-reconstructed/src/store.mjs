// RECONSTRUCTED-V1 | NOT the lost original.
// On-disk layout follows VD arch §2 (visual-sources/<application>/<visualId>/...), rooted at a caller-chosen directory.
import fs from "node:fs";
import path from "node:path";
import { stable } from "./canon.mjs";

export class Refused extends Error {
  constructor(code, message, problems = []) { super(`${code}: ${message}`); this.code = code; this.problems = problems; }
}

export const LAYOUT = {
  ep: (v) => `evidence-packet.v${v}.json`, vc: (v) => `visual-contract.v${v}.json`, template: "template.json",
  gr: (id) => `generations/${id}.record.json`, grFile: (id) => `generations/${id}.png`, prompt: (id) => `generations/prompts/${id}.prompt.txt`,
  qr: (id) => `qa/${id}.result.json`, cd: (id) => `deltas/${id}.delta.json`, normalized: (visualId) => `normalized/${visualId}.png`,
  aa: "approved.json", policy: "policy.json", registryPreview: "registry-entry.preview.json", spec: "visual-spec.json",
};

export const abs = (dir, rel) => path.join(dir, rel);
export function writeFileOnce(dir, rel, data) {
  const p = abs(dir, rel);
  if (fs.existsSync(p)) throw new Refused("IMMUTABLE", `${rel} already exists (objects are immutable)`);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, data, { flag: "wx" });
}
export const writeJsonOnce = (dir, rel, obj) => writeFileOnce(dir, rel, stable(obj));
export const readJson = (dir, rel) => JSON.parse(fs.readFileSync(abs(dir, rel), "utf8"));
export const exists = (dir, rel) => fs.existsSync(abs(dir, rel));
export const readBytes = (dir, rel) => fs.readFileSync(abs(dir, rel));

/** [{rel, obj}] for every factory object file on disk (duplicates and filename/id mismatches are visible to the verifier). */
export function listObjectFiles(dir) {
  const out = [];
  const walk = (sub, test) => { const d = abs(dir, sub); if (!fs.existsSync(d)) return; for (const f of fs.readdirSync(d).sort()) if (test(f)) out.push({ rel: sub === "." ? f : `${sub}/${f}`, obj: JSON.parse(fs.readFileSync(path.join(d, f), "utf8")) }); };
  walk(".", (f) => /^evidence-packet\.v\d+\.json$|^visual-contract\.v\d+\.json$|^template\.json$|^approved\.json$/.test(f));
  walk("generations", (f) => f.endsWith(".record.json"));
  walk("qa", (f) => f.endsWith(".result.json"));
  walk("deltas", (f) => f.endsWith(".delta.json"));
  return out;
}

/** id -> object for every factory object on disk. */
export function loadStore(dir) {
  const m = new Map();
  const walk = (sub, test) => { const d = abs(dir, sub); if (!fs.existsSync(d)) return; for (const f of fs.readdirSync(d).sort()) if (test(f)) { const o = JSON.parse(fs.readFileSync(path.join(d, f), "utf8")); m.set(o.id, o); } };
  walk(".", (f) => /^evidence-packet\.v\d+\.json$|^visual-contract\.v\d+\.json$|^template\.json$|^approved\.json$/.test(f));
  walk("generations", (f) => f.endsWith(".record.json"));
  walk("qa", (f) => f.endsWith(".result.json"));
  walk("deltas", (f) => f.endsWith(".delta.json"));
  return m;
}

/** Deterministic byte snapshot of a directory (for "refused commands leave the directory byte-identical" tests). */
export function snapshot(dir) {
  const out = {};
  const walk = (d) => { for (const f of fs.readdirSync(d).sort()) { const p = path.join(d, f); fs.statSync(p).isDirectory() ? walk(p) : (out[path.relative(dir, p)] = fs.readFileSync(p).toString("base64")); } };
  if (fs.existsSync(dir)) walk(dir);
  return out;
}
