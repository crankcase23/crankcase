// RECONSTRUCTED TEST suite — restored-file integrity (cleanup pass, finding 1). Not derived from the lost suites.
// Enforces scripts/visuals/RESTORED-FILES.SHA256 against the live repo files, and that live source files still equal the
// frozen recovered/ copies. Skips (labeled) only when this folder is run standalone, outside the Crankcase repo.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { sha256 } from "../src/canon.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const fr = path.join(here, "..");
const repo = path.join(fr, "../../..");
const listFile = path.join(repo, "scripts/visuals/RESTORED-FILES.SHA256");
const inRepo = fs.existsSync(listFile) && fs.existsSync(path.join(repo, "package.json"));
const skip = inRepo ? false : "SKIPPED (not passed): standalone copy, not inside the Crankcase repo; run via `npm run factory:test` at the repo root.";
const read = (p) => fs.readFileSync(p);
const entries = () => fs.readFileSync(listFile, "utf8").trim().split("\n").map((l) => { const m = l.match(/^([0-9a-f]{64})  (.+)$/); assert.ok(m, `malformed line: ${l}`); return { hash: m[1], file: m[2] }; });

test("RECONSTRUCTED TEST: every file in RESTORED-FILES.SHA256 matches its recorded SHA256", { skip }, () => {
  const e = entries();
  assert.ok(e.length >= 13, `expected >= 13 entries, got ${e.length}`);
  for (const { hash, file } of e) assert.equal(sha256(read(path.join(repo, file))), hash, `${file} drifted from RESTORED-FILES.SHA256`);
});

test("RECONSTRUCTED TEST: RESTORED-FILES.SHA256 covers every restored script, manifest and contract file (no unlisted file)", { skip }, () => {
  const listed = new Set(entries().map((x) => x.file));
  const disk = ["scripts/visuals/build-visual.mjs", "scripts/visuals/check.mjs", "scripts/visuals/lib.mjs", "visual-sources/applications.json", "src/types/guideVisuals.ts", "src/lib/guideVisuals.ts", "src/data/guide-visuals/charger-2016-sxt-multi-job.ts"];
  const dir = path.join(repo, "visual-sources/2016-dodge-charger-sxt-36");
  for (const f of fs.readdirSync(dir)) disk.push(`visual-sources/2016-dodge-charger-sxt-36/${f}`);
  for (const f of disk) assert.ok(listed.has(f), `${f} is not recorded in RESTORED-FILES.SHA256`);
  for (const f of listed) assert.ok(disk.includes(f), `${f} is recorded but not an expected restored file`);
});

test("RECONSTRUCTED TEST: live src/ contract files equal their frozen recovered/ copies byte for byte", { skip }, () => {
  for (const f of ["src/types/guideVisuals.ts", "src/lib/guideVisuals.ts", "src/data/guide-visuals/charger-2016-sxt-multi-job.ts"])
    assert.ok(read(path.join(repo, f)).equals(read(path.join(fr, "recovered", f))), `${f} differs from recovered/${f}`);
});

test("RECONSTRUCTED TEST: live visual scripts and sources equal their frozen recovered/ copies byte for byte", { skip }, () => {
  const pairs = [["scripts/visuals/lib.mjs", "scripts-visuals/lib.mjs"], ["visual-sources/applications.json", "visual-sources/applications.json"], ["visual-sources/2016-dodge-charger-sxt-36/step-10-intake-duct.manifest.json", "visual-sources/2016-dodge-charger-sxt-36/step-10-intake-duct.manifest.json"]];
  for (const [live, frozen] of pairs) assert.ok(read(path.join(repo, live)).equals(read(path.join(fr, "recovered", frozen))), `${live} differs from recovered/${frozen}`);
});

test("RECONSTRUCTED TEST: editing a restored file together with its own list line is still caught by the frozen recovered/ copy", { skip }, () => {
  // The list file alone is self-certifying; recovered/SHA256SUMS.txt is the second, independent anchor for the overlapping files.
  const anchor = new Map(fs.readFileSync(path.join(fr, "recovered/SHA256SUMS.txt"), "utf8").trim().split("\n").map((l) => { const [h, f] = l.split(/\s+/); return [f.replace(/^\.\//, ""), h]; }));
  const map = { "src/types/guideVisuals.ts": "src/types/guideVisuals.ts", "src/lib/guideVisuals.ts": "src/lib/guideVisuals.ts", "src/data/guide-visuals/charger-2016-sxt-multi-job.ts": "src/data/guide-visuals/charger-2016-sxt-multi-job.ts", "scripts/visuals/lib.mjs": "scripts-visuals/lib.mjs", "visual-sources/applications.json": "visual-sources/applications.json", "visual-sources/2016-dodge-charger-sxt-36/step-10-intake-duct.manifest.json": "visual-sources/2016-dodge-charger-sxt-36/step-10-intake-duct.manifest.json" };
  const listed = new Map(entries().map((x) => [x.file, x.hash]));
  for (const [live, a] of Object.entries(map)) { assert.ok(anchor.has(a), `${a} missing from recovered/SHA256SUMS.txt`); assert.equal(listed.get(live), anchor.get(a), `${live}: list line disagrees with the recovered/ anchor`); }
});
