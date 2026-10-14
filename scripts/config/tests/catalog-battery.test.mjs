// REGRESSIONS: unsupported battery group claims in the vehicle catalog.
// 2020 Silverado 1500 / Sierra 1500 5.3L said "Group size 78 (H6), ~730 CCA" and the 2021 RAV4 2.5L said "Group size 35, ~500 CCA".
// Neither had a source; the GM and Toyota battery guides and every fitment page found say otherwise (94R for the GM trucks, 47/LN2 for
// the RAV4). The rows were REMOVED, not replaced: no authoritative replacement value has been read yet. A replacement may only come
// back with a cited OEM or OEM-branded source, and when it does these tests are updated with it (see docs on the evidence ledger).
import { test } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const esbuild = createRequire(path.join(ROOT, "package.json"))("esbuild");
async function bundle(entry) {
  const out = await esbuild.build({ entryPoints: [path.join(ROOT, entry)], bundle: true, write: false, format: "esm", platform: "node", logLevel: "silent", alias: { "@": path.join(ROOT, "src") } });
  return import("data:text/javascript;base64," + Buffer.from(out.outputFiles[0].text).toString("base64"));
}
const { vehicles } = await bundle("src/data/vehicles.ts");
const { resolvedRepairs } = await bundle("src/data/repairs.ts");
const byId = (id) => vehicles.find((v) => v.id === id);
const battery = (v) => v.specs.find((s) => s.label === "Battery");

const UNSUPPORTED = [
  ["2020-chevrolet-silverado-1500-5.3l", /\b78\b|H6|730/],
  ["2020-gmc-sierra-1500-5.3l", /\b78\b|H6|730/],
  ["2021-toyota-rav4-2.5l", /\b35\b|\b500\b/],
];

for (const [id, bad] of UNSUPPORTED) {
  test(`REGRESSION ${id}: the unsupported battery group/CCA claim stays out of the catalog, and nothing unverified replaces it`, () => {
    const v = byId(id);
    assert.ok(v, "vehicle still in the catalog");
    const row = battery(v);
    assert.equal(row, undefined, `Battery row must stay absent until an authoritative source is cited; found "${row?.value}"`);
    assert.doesNotMatch(JSON.stringify(v.specs), bad);
  });
}

test("a vehicle that keeps a Battery spec row names the same BCI group as its battery guide's parts list (new mismatches fail)", () => {
  const grp = (s) => { const m = /Group(?: size)?\s+(\d{2,3}[A-Z]?R?)\b/i.exec(String(s)); return m ? m[1].toUpperCase() : null; };
  // None open today. Anything added here needs an owner decision; the list can only shrink.
  const KNOWN_OPEN = new Set();
  const mismatched = [];
  for (const v of vehicles) {
    const row = battery(v);
    const guide = resolvedRepairs.find((g) => g.vehicleId === v.id && g.jobType === "battery");
    if (!row || !guide) continue;
    const a = grp(row.value), b = grp((guide.parts || []).join(" | ")) ?? grp(guide.summary);
    if (a && b && a !== b) mismatched.push(v.id);
  }
  const fresh = mismatched.filter((id) => !KNOWN_OPEN.has(id));
  assert.deepEqual(fresh, [], `new catalog/guide battery group mismatch: ${fresh.join(", ")}`);
  const stale = [...KNOWN_OPEN].filter((id) => !mismatched.includes(id));
  assert.deepEqual(stale, [], `fixed now, remove from KNOWN_OPEN: ${stale.join(", ")}`);
});
