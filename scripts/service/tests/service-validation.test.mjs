import { test } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

// Bundles the real src/lib/serviceValidation.ts (no copy of the rules lives in this test).
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const require = createRequire(import.meta.url);
const esbuild = require("esbuild");
const out = await esbuild.build({
  entryPoints: [path.join(ROOT, "src/lib/serviceValidation.ts")], bundle: true, format: "esm", platform: "node", write: false,
});
const { validateServiceEntry, isRealIsoDate, SERVICE_LIMITS } = await import("data:text/javascript;base64," + Buffer.from(out.outputFiles[0].text).toString("base64"));

const good = { date: "2026-03-01", mileage: 61000, title: "Tire Rotation" };
const field = (body) => { const r = validateServiceEntry(body); return r.ok ? "ok" : r.field; };

test("SH-4: a normal entry passes and is trimmed", () => {
  const r = validateServiceEntry({ ...good, title: "  Tire Rotation ", notes: "  hi  ", guideId: "g1" });
  assert.deepEqual(r, { ok: true, value: { date: "2026-03-01", mileage: 61000, title: "Tire Rotation", guideId: "g1", notes: "hi" } });
});

test("SH-4: mileage is a whole number 0..9,999,999, as a number or a digit string", () => {
  assert.equal(field({ ...good, mileage: 0 }), "ok");
  assert.equal(field({ ...good, mileage: "62000" }), "ok");
  assert.equal(validateServiceEntry({ ...good, mileage: " 62000 " }).value.mileage, 62000);
  assert.equal(field({ ...good, mileage: 9_999_999 }), "ok");
  for (const bad of [null, undefined, "", " ", true, false, [5], {}, -1, 1.5, "1.5", "-5", "1e3", "1e999", NaN, Infinity, 10_000_000, "10000000", "12abc"]) {
    assert.equal(field({ ...good, mileage: bad }), "mileage", `mileage ${String(bad)} must be rejected`);
  }
});

test("SH-4: date must be a real yyyy-mm-dd calendar day", () => {
  assert.equal(isRealIsoDate("2024-02-29"), true);
  for (const bad of ["2026-02-30", "2026-13-01", "2026-00-10", "2025-02-29", "01/15/2026", "2026-1-5", "yesterday", "", "2026-01-15T00:00:00Z"]) {
    assert.equal(isRealIsoDate(bad), false, bad);
  }
  assert.equal(field({ ...good, date: 20260101 }), "date");
  assert.equal(field({ ...good, date: undefined }), "date");
});

test("SH-4: title and notes are required / bounded text", () => {
  assert.equal(field({ ...good, title: "   " }), "title");
  assert.equal(field({ ...good, title: 5 }), "title");
  assert.equal(field({ ...good, title: "x".repeat(SERVICE_LIMITS.TITLE_MAX) }), "ok");
  assert.equal(field({ ...good, title: "x".repeat(SERVICE_LIMITS.TITLE_MAX + 1) }), "title");
  assert.equal(field({ ...good, notes: "n".repeat(SERVICE_LIMITS.NOTES_MAX + 1) }), "notes");
  assert.equal(field({ ...good, notes: { a: 1 } }), "notes");
  assert.equal(validateServiceEntry({ ...good, notes: "   " }).value.notes, undefined, "blank notes are dropped, not stored");
  assert.equal(validateServiceEntry({ ...good, notes: null }).value.notes, undefined);
});

test("SH-4: guideId must be a short string when present", () => {
  assert.equal(field({ ...good, guideId: 7 }), "guideId");
  assert.equal(field({ ...good, guideId: "g".repeat(SERVICE_LIMITS.GUIDE_ID_MAX + 1) }), "guideId");
  assert.equal(field({ ...good, guideId: null }), "ok");
});

test("SH-4: a body that is not an object is rejected (null, array, string, number)", () => {
  for (const b of [null, undefined, [], "x", 5, true]) assert.equal(field(b), "body");
});

test("SH-4: the form's worst realistic title (every guide + every generic job ticked) fits the limit", () => {
  const sixteenGuides = Array.from({ length: 16 }, (_, i) => `Guide title number ${i} for a long repair name`).join(", ");
  const generic = ["Tire Rotation", "Battery Replacement", "Air Filter Replacement", "Cabin Air Filter Replacement", "Wiper Blade Replacement", "Coolant Flush", "Transmission Fluid Service", "Brake Fluid Flush"].join(", ");
  assert.ok((sixteenGuides + ", " + generic).length < SERVICE_LIMITS.TITLE_MAX, "raise TITLE_MAX or the form can lock a customer out");
});
