#!/usr/bin/env node
// Re-verifies every finished visual: the file exists, is 1600x1000, and its
// SHA-256 still equals the hash recorded when it was reviewed. A picture that
// was edited after review fails here. Run before every release:
//   node scripts/visuals/check.mjs [--root DIR]
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { FINAL_H, FINAL_W, TREATMENT_VERSION, sha256 } from "./lib.mjs";

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const require = createRequire(path.join(repo, "package.json"));
const sharp = require("sharp");
const a = process.argv.slice(2);
const root = a.includes("--root") ? path.resolve(a[a.indexOf("--root") + 1]) : repo;

const dir = path.join(root, "src/data/guide-visuals");
let bad = 0, n = 0;
for (const f of fs.existsSync(dir) ? fs.readdirSync(dir).filter((x) => x.endsWith(".visuals.json")) : []) {
  const doc = JSON.parse(fs.readFileSync(path.join(dir, f), "utf8"));
  for (const v of doc.visuals) {
    n++;
    const fail = (m) => { bad++; console.error(`FAIL ${f} ${v.id}: ${m}`); };
    const p = path.join(root, "public", v.src);
    if (!fs.existsSync(p)) { fail("file missing"); continue; }
    const buf = fs.readFileSync(p);
    if (sha256(buf) !== v.provenance.finalSha256) fail("file changed since review (hash mismatch)");
    const m = await sharp(buf).metadata();
    if (m.width !== FINAL_W || m.height !== FINAL_H) fail(`size ${m.width}x${m.height}, expected ${FINAL_W}x${FINAL_H}`);
    if (v.provenance.treatment?.version !== TREATMENT_VERSION) fail("treatment version out of date");
    if (v.provenance.license?.status === "unknown") fail("usage rights unknown");
    if (v.provenance.status !== "verified") fail("not verified");
  }
}
console.log(`${n} visual(s) checked, ${bad} problem(s)`);
process.exit(bad ? 1 : 0);
