// PERMANENT REGRESSIONS for the 2015 Ford F-150 pilot (Battery, Front Brake Pads, Coolant). Each test names the real defect it guards.
// Nothing here certifies a guide. The pilot guides are unpublished drafts; these tests keep them honest and keep found defects fixed.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { validatePilot, VEHICLE_ID } from "../validate.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const EVID = path.join(ROOT, "docs/f150-pilot/evidence");
const esbuild = createRequire(path.join(ROOT, "package.json"))("esbuild");
async function bundle(entry) {
  const out = await esbuild.build({ entryPoints: [path.join(ROOT, entry)], bundle: true, write: false, format: "esm", platform: "node", logLevel: "silent", alias: { "@": path.join(ROOT, "src") } });
  return import("data:text/javascript;base64," + Buffer.from(out.outputFiles[0].text).toString("base64"));
}
const ledgers = fs.readdirSync(EVID).filter((f) => /^guide-\d\d\.json$/.test(f)).sort().map((f) => JSON.parse(fs.readFileSync(path.join(EVID, f), "utf8")));
const { f150PilotDraftGuides: drafts } = await bundle("src/data/admin-test-guides/f150-2015-drafts.ts");
const { vehicles } = await bundle("src/data/vehicles.ts");
const f150 = vehicles.find((v) => v.id === VEHICLE_ID);

test("the three pilot ledgers exist for the one catalog configuration, and pass the BMW validator plus the pilot checks", () => {
  assert.deepEqual(ledgers.map((g) => g.name), ["Front Brake Pads", "Battery Replacement", "Coolant Drain & Fill"]);
  assert.ok(f150, "catalog entry exists (Atlas: ACTUAL, nothing invented)");
  assert.equal(f150.year, 2015); assert.match(f150.trim, /XLT SuperCrew/); assert.match(f150.engine, /5\.0L/); assert.match(f150.transmission, /6R80/);
  const r = validatePilot(EVID);
  assert.deepEqual(r.errors, []);
});

// ---- mutation tests: each fault was injected into a scratch ledger and PASSED the unchanged BMW validator ----
function mutate(fn) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "f150-mut-"));
  try {
    ledgers.forEach((g, i) => { const c = structuredClone(g); if (i === 0) fn(c); fs.writeFileSync(path.join(dir, `guide-0${i + 1}.json`), JSON.stringify(c)); });
    return validatePilot(dir).errors;
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
}
test("REGRESSION validator gap: a part, tool, fluid or step marked VERIFIED or VERIFIED_SECONDARY with no sources is an error (the BMW validator only checks torque rows)", () => {
  assert.ok(mutate((g) => { g.parts[0].status = "VERIFIED_SECONDARY"; g.parts[0].sources = []; }).some((e) => /VERIFIED_SECONDARY with no source/.test(e)));
  assert.ok(mutate((g) => { g.tools[0].status = "VERIFIED"; g.tools[0].sources = []; }).some((e) => /VERIFIED with no source/.test(e)));
});
test("REGRESSION validator gap: VERIFIED_SECONDARY on any node needs two different hosts", () => {
  assert.ok(mutate((g) => { g.steps[0].status = "VERIFIED_SECONDARY"; g.steps[0].sources = ["https://a.example/x", "https://a.example/y"]; }).some((e) => /needs 2/.test(e)));
});
test("REGRESSION validator gap: a verified torque row whose value has no number is an error", () => {
  assert.ok(mutate((g) => { const t = g.torque[0]; t.status = "VERIFIED_SECONDARY"; t.value = ""; }).some((e) => /value has no number/.test(e)));
});
test("REGRESSION validator gap: hardware elements named nut, pin, clip, spring or hose cannot be cosmetic (the BMW regex missed them)", () => {
  for (const id of ["lug-nuts", "guide-pins", "retaining-clip", "anti-rattle-spring", "brake-hose"]) {
    const errs = mutate((g) => { g.visuals[0].elements[0] = { ...g.visuals[0].elements[0], id, role: "hero", criticality: "cosmetic" }; });
    assert.ok(errs.some((e) => e.includes(id)), `${id} accepted as cosmetic`);
  }
});
test("REGRESSION ledger honesty: VERIFIED and primary:true need primarySourceFound true (guide 1 step 3 and guide 2 parts[4] contradicted their own flag)", () => {
  assert.ok(mutate((g) => { g.primarySourceFound = false; g.steps[0].status = "VERIFIED"; g.steps[0].sources = ["https://ford.example/a"]; }).some((e) => /VERIFIED but primarySourceFound is false/.test(e)));
  assert.ok(mutate((g) => { g.primarySourceFound = false; g.parts[0].primary = true; }).some((e) => /primary:true but primarySourceFound is false/.test(e)));
  for (const g of ledgers) if (g.primarySourceFound) assert.ok(typeof g.primaryScope === "string" && g.primaryScope.length > 40, `guide ${g.guide}: primarySourceFound true needs a primaryScope saying exactly what Ford text was read`);
});
test("every ledger names its one vehicle, and the validator rejects a ledger that does not (Atlas: one exact configuration, no invented coverage)", () => {
  for (const g of ledgers) assert.equal(g.vehicle, VEHICLE_ID);
  assert.ok(mutate((g) => { g.vehicle = "2016-ford-f150-5.0l"; }).some((e) => /"vehicle" must be/.test(e)));
});

// ---- catalog defects found by the pilot (src/data/vehicles.ts, 2015 F-150) ----
test("REGRESSION catalog: the F-150 battery row no longer claims Group 65 / ~750 CCA (no 2015 retailer fitment list shows Group 65; Batteries Plus lists only Group 48 and 94R)", () => {
  const row = f150.specs.find((s) => s.label === "Battery");
  assert.ok(row);
  assert.ok(!/group size 65|\b65\b|750 CCA/i.test(row.value), row.value);
  assert.match(row.value, /label on your current battery/i);
});
test("REGRESSION catalog: the F-150 coolant row no longer states an unsupported 16.6 qt, and pairs spec -D with the concentrate and -D2 with the 50/50 premix", () => {
  const c = f150.fluids.find((f) => f.name === "Engine Coolant");
  assert.ok(!/^~?\s*16\.6/.test(c.capacity), c.capacity); // the old row led with one unsupported number; a range that names 16.6 as one conflicting figure is honest
  assert.match(c.capacity, /not confirmed/i);
  assert.match(c.spec, /VC-3 concentrate is Ford spec WSS-M97B44-D\b(?!2)/);
  assert.match(c.spec, /VC-3DIL-B 50\/50 premix is WSS-M97B44-D2/);
});

// ---- the generated drafts ----
test("the generated pilot drafts are current (build-drafts --check), so no one edits generated guides by hand", () => {
  const r = spawnSync("node", ["scripts/f150-pilot/build-drafts.mjs", "--check"], { cwd: ROOT, encoding: "utf8" });
  assert.equal(r.status, 0, r.stderr);
});
test("every pilot draft is flagged preview and DRAFT, claims nothing is certified, and sits on the one catalog vehicle", () => {
  assert.equal(drafts.length, 3);
  for (const g of drafts) {
    assert.equal(g.vehicleId, VEHICLE_ID); assert.equal(g.preview, true);
    assert.match(g.title, /\(DRAFT\)$/);
    assert.match(g.summary, /not published and not certified/);
    assert.ok(!/(?<!not )(?<!un)certified\b/i.test(g.summary.replace(/not (published and not )?certified/gi, "")), `${g.id}: summary claims certification`);
  }
});
test("REGRESSION phone overflow (same defect as BMW): no raw URL reaches any guide text", () => {
  for (const g of drafts) for (const t of [g.title, g.summary, ...g.safety, ...g.parts, ...g.tools.map((x) => x.name + (x.note ?? "")), ...g.torqueSpecs.flatMap((x) => [x.fastener, x.value, x.notes]), ...g.steps.flatMap((s) => [s.title, s.instructions, s.warning ?? ""])])
    assert.ok(!/https?:\/\//i.test(t), `${g.id}: raw URL in "${t.slice(0, 80)}"`);
});
test("torque rule: a number prints only for VERIFIED or VERIFIED_SECONDARY rows; every other row shows the VERIFY warning or an explicit 'Not a torque value'", () => {
  for (const g of drafts) for (const t of g.torqueSpecs) assert.ok(/^⚠ VERIFY EXACT TORQUE BEFORE SERVICE$/.test(t.value) || /^Not a torque value: /.test(t.value) || /\d/.test(t.value), `${g.id}: ${t.fastener}`);
  for (const g of drafts) for (const t of g.torqueSpecs) if (/\d/.test(t.value)) {
    const row = ledgers.flatMap((l) => l.torque).find((r) => r.fastener === t.fastener);
    assert.ok(row && /^(VERIFIED_SECONDARY|VERIFIED)\b/.test(row.status), `${g.id}: ${t.fastener} prints a number but its ledger status is ${row?.status}`);
  }
  const brake = drafts.find((g) => /brake/i.test(g.id));
  const rotor = brake.torqueSpecs.find((t) => /rotor/i.test(t.fastener));
  assert.ok(!/\d/.test(rotor.value), "rotor minimum thickness was not found and must never be printed as a number");
});
test("one jack-stand policy: every pilot guide that lifts or may lift the truck carries the D5 policy sentences, and publishes no stand position", () => {
  for (const g of drafts.filter((x) => /brake|coolant/.test(x.id))) {
    const text = [...g.safety, ...g.steps.map((s) => s.instructions + " " + (s.warning ?? ""))].join(" ");
    assert.match(text, /held only by a jack/i, `${g.id}: no 'never work under a car held only by a jack' line`);
    assert.match(text, /rated jack stands/i, `${g.id}: no rated jack stands line`);
    assert.match(text, /stop and use a shop lift/i, `${g.id}: no 'stop and use a shop lift' line`);
  }
});
test("brake guide never invents a part number: the pad kit is shown as unresolved, not chosen", () => {
  const brake = drafts.find((g) => /brake/i.test(g.id));
  const kit = brake.parts.find((p) => /pad kit for this exact truck/i.test(p));
  assert.ok(kit && /(sources disagree|not confirmed|one source)/i.test(kit), kit);
});

// ---- cross-catalog defect found while testing the F-150 battery claim (outside the pilot vehicle; reported, not fixed) ----
test("REGRESSION catalog vs guide: a vehicle's Battery spec row names the same BCI group as that vehicle's battery guide (known open mismatches are listed, and the list may only shrink)", async () => {
  const { resolvedRepairs } = await bundle("src/data/repairs.ts");
  const grp = (s) => { const m = /Group(?: size)?\s+(\d{2,3}[A-Z]?R?)\b/i.exec(String(s)); return m ? m[1].toUpperCase() : null; };
  // Open defects, owner decision pending: the 2020 Silverado and Sierra 5.3L catalog rows say Group 78 (H6); the shared GM battery guide says 94R (H7).
  // Also open: 2021 RAV4 2.5L catalog row says Group 35; the RAV4 battery guide says BCI 47 (LN2/H5) and its summary names 24F only as the wrong answer.
  const KNOWN_OPEN = new Set(["2020-chevrolet-silverado-1500-5.3l", "2020-gmc-sierra-1500-5.3l", "2021-toyota-rav4-2.5l"]);
  const mismatched = new Set();
  for (const v of vehicles) {
    const row = v.specs.find((s) => s.label === "Battery");
    const guide = resolvedRepairs.find((g) => g.vehicleId === v.id && g.jobType === "battery");
    if (!row || !guide) continue;
    const a = grp(row.value), b = grp((guide.parts || []).join(" | ")) ?? grp(guide.summary);
    if (a && b && a !== b) mismatched.add(v.id);
  }
  const fresh = [...mismatched].filter((id) => !KNOWN_OPEN.has(id));
  assert.deepEqual(fresh, [], `new catalog/guide battery group mismatch: ${fresh.join(", ")}`);
  const fixedButListed = [...KNOWN_OPEN].filter((id) => !mismatched.has(id));
  assert.deepEqual(fixedButListed, [], `fixed now, remove from KNOWN_OPEN: ${fixedButListed.join(", ")}`);
});
