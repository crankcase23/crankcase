// RECONSTRUCTED-V1 INTEGRATION HARNESS (isolated). Runs the RECOVERED, UNMODIFIED `src/lib/guideVisuals.ts` (from the tgz) against
// records produced by the reconstruction. It copies the recovered files into a temp dir (never writes into recovered/), adds ONE
// stub (`types/vehicle.ts`: type-only, erased at build; the real Vehicle/ResolvedGuide types are NOT recovered) and bundles with esbuild.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import { pathToFileURL, fileURLToPath } from "node:url";
import { createHash } from "node:crypto";

const here = path.dirname(fileURLToPath(import.meta.url));
const defaultRoot = path.join(here, "..", "recovered");

export function findEsbuild() {
  const req = createRequire(import.meta.url);
  const cands = [process.env.ESBUILD_PATH, "esbuild", "/home/claude/work/crankcase-main/node_modules/esbuild", "/home/claude/work/charger/node_modules/esbuild", "/home/claude/work/sim/node_modules/esbuild"].filter(Boolean);
  for (const c of cands) { try { return req(c); } catch { /* next */ } }
  return null;
}

/** C-4: verify the recovered evidence tree against its SHA256SUMS.txt BEFORE anything is bundled from it. Returns problems (empty = intact). */
export function verifyRecovered(root = defaultRoot) {
  const bad = [];
  const sumsFile = path.join(root, "SHA256SUMS.txt");
  if (!fs.existsSync(sumsFile)) return ["SHA256SUMS.txt missing"];
  const listed = new Map();
  for (const line of fs.readFileSync(sumsFile, "utf8").trim().split("\n")) { const m = line.match(/^([0-9a-f]{64})\s+\.\/(.+)$/); if (!m) { bad.push(`unparseable SHA256SUMS line: ${line.slice(0, 80)}`); continue; } listed.set(m[2], m[1]); }
  for (const [rel, h] of listed) {
    const f = path.join(root, rel);
    if (!fs.existsSync(f)) bad.push(`${rel}: listed but missing`);
    else if (createHash("sha256").update(fs.readFileSync(f)).digest("hex") !== h) bad.push(`${rel}: content differs from SHA256SUMS.txt (recovered file was mutated, or its listed hash is corrupted)`);
  }
  const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(d, e.name)) : [path.relative(root, path.join(d, e.name))]));
  for (const rel of walk(root)) if (rel !== "SHA256SUMS.txt" && !listed.has(rel)) bad.push(`${rel}: present but not listed in SHA256SUMS.txt`);
  return bad;
}

export async function loadRecoveredResolver({ root = defaultRoot } = {}) {
  const integrity = verifyRecovered(root);
  if (integrity.length) return { available: false, reason: `recovered-tree integrity check FAILED: ${integrity.join("; ")}`, integrity };
  const recovered = path.join(root, "src");
  const esbuild = findEsbuild();
  if (!esbuild) return { available: false, reason: "esbuild not found (set ESBUILD_PATH)" };
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "gfr1-resolver-"));
  const copy = (rel) => { const to = path.join(tmp, "src", rel); fs.mkdirSync(path.dirname(to), { recursive: true }); fs.copyFileSync(path.join(recovered, rel), to); };
  ["types/guideVisuals.ts", "lib/guideVisuals.ts", "data/guide-visuals/charger-2016-sxt-multi-job.ts", "data/guide-visuals/charger-2016-sxt-multi-job.visuals.json"].forEach(copy);
  fs.mkdirSync(path.join(tmp, "src/types"), { recursive: true });
  fs.writeFileSync(path.join(tmp, "src/types/vehicle.ts"), "// STUB (reconstruction harness). Type-only; the real file is NOT recovered.\nexport interface Vehicle { year: number; make: string; model: string; trim?: string; engine: string }\nexport interface ResolvedGuide { id: string }\n");
  fs.writeFileSync(path.join(tmp, "entry.ts"), 'export * from "@/lib/guideVisuals";\nexport { chargerVisuals } from "@/data/guide-visuals/charger-2016-sxt-multi-job";\n');
  fs.writeFileSync(path.join(tmp, "tsconfig.json"), JSON.stringify({ compilerOptions: { baseUrl: ".", paths: { "@/*": ["./src/*"] }, resolveJsonModule: true } }));
  const outfile = path.join(tmp, "out.mjs");
  await esbuild.build({ entryPoints: [path.join(tmp, "entry.ts")], bundle: true, format: "esm", platform: "node", outfile, tsconfig: path.join(tmp, "tsconfig.json"), logLevel: "silent", define: { "process.env.NODE_ENV": '"production"' } });
  const mod = await import(pathToFileURL(outfile).href);
  return { available: true, ...mod, tmp };
}
