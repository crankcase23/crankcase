import { test, mock } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

// NHTSA-outage fallback: the pure rules (src/lib/vinFallback.ts) and the server-side NHTSA probe (src/lib/vpicServer.ts).
// These decide who may add a vehicle by typed details and when something may be called VERIFIED, so each rule is pinned.

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const require = createRequire(import.meta.url);
const esbuild = require("esbuild");
const load = async (file) => {
  const out = await esbuild.build({ entryPoints: [path.join(ROOT, file)], bundle: true, format: "esm", platform: "node", write: false });
  return import("data:text/javascript;base64," + Buffer.from(out.outputFiles[0].text).toString("base64"));
};
const { fallbackEnabled, parseFallbackDetails, identityMatches, FALLBACK_DAILY_CAP } = await load("src/lib/vinFallback.ts");
const { probeVin, vpicBase } = await load("src/lib/vpicServer.ts");

test("the fallback is OFF unless VIN_FALLBACK_ENABLED is exactly 'true'", () => {
  assert.equal(fallbackEnabled({}), false);
  for (const v of ["", "1", "TRUE", "True", "yes", "on", "false", " true"]) assert.equal(fallbackEnabled({ VIN_FALLBACK_ENABLED: v }), false, JSON.stringify(v));
  assert.equal(fallbackEnabled({ VIN_FALLBACK_ENABLED: "true" }), true);
});

test("the daily allowance is 5 additions per account", () => assert.equal(FALLBACK_DAILY_CAP, 5));

test("typed details: a complete, sensible vehicle is accepted and trimmed", () => {
  const r = parseFallbackDetails({ year: " 2014 ", make: "  Jeep ", model: "Grand   Cherokee", trim: "Laredo", engine: "3.6L V6" }, new Date("2026-10-12"));
  assert.deepEqual(r, { ok: true, value: { year: "2014", make: "Jeep", model: "Grand Cherokee", trim: "Laredo", engine: "3.6L V6" } });
  assert.deepEqual(parseFallbackDetails({ year: "1999", make: "BMW", model: "328i" }).value, { year: "1999", make: "BMW", model: "328i" });
});

test("typed details: year must be four digits between 1981 and next year", () => {
  const now = new Date("2026-10-12");
  for (const year of ["", "14", "20144", "abcd", "1980", "2028", "2014.5", " "]) assert.equal(parseFallbackDetails({ year, make: "Jeep", model: "X" }, now).ok, false, year);
  assert.equal(parseFallbackDetails({ year: "1981", make: "Jeep", model: "X" }, now).ok, true);
  assert.equal(parseFallbackDetails({ year: "2027", make: "Jeep", model: "X" }, now).ok, true);
});

test("typed details: make and model are required, lengths are capped, markup and control characters are refused", () => {
  const ok = { year: "2014", make: "Jeep", model: "Cherokee" };
  assert.equal(parseFallbackDetails({ ...ok, make: "" }).ok, false);
  assert.equal(parseFallbackDetails({ ...ok, model: "   " }).ok, false);
  assert.equal(parseFallbackDetails({ ...ok, make: "x".repeat(41) }).ok, false);
  assert.equal(parseFallbackDetails({ ...ok, model: "x".repeat(61) }).ok, false);
  assert.equal(parseFallbackDetails({ ...ok, trim: "x".repeat(61) }).ok, false);
  assert.equal(parseFallbackDetails({ ...ok, engine: "x".repeat(61) }).ok, false);
  for (const bad of ["<script>alert(1)</script>", "Jeep\u0000", "Jeep;DROP TABLE users", "{{x}}", "a<b", "Jeep‮evil"]) {
    assert.equal(parseFallbackDetails({ ...ok, make: bad }).ok, false, bad);
    assert.equal(parseFallbackDetails({ ...ok, model: bad }).ok, false, bad);
  }
  assert.equal(parseFallbackDetails({ ...ok, model: "F-150 (Crew Cab) 4x4" }).ok, true);
  assert.equal(parseFallbackDetails({ ...ok, make: "Citroën", model: "2CV" }).ok, true);
  assert.equal(parseFallbackDetails(null).ok, false);
  assert.equal(parseFallbackDetails("2014 Jeep").ok, false);
  assert.equal(parseFallbackDetails({ year: 2014, make: "Jeep", model: "Cherokee" }).ok, false, "a number is not a four-digit string");
});

test("identity match: same year and make, model equal or one extends the other", () => {
  const d = { year: "2014", make: "JEEP", model: "Grand Cherokee" };
  assert.equal(identityMatches({ year: "2014", make: "jeep", model: "grand cherokee" }, d), true);
  assert.equal(identityMatches({ year: "2014", make: "Jeep", model: "Grand-Cherokee" }, d), true);
  assert.equal(identityMatches({ year: "2014", make: "Jeep", model: "Grand Cherokee Laredo" }, d), true);
  assert.equal(identityMatches({ year: "2010", make: "BMW", model: "328i xDrive" }, { year: "2010", make: "BMW", model: "328i" }), true);
});

test("identity match: a different year, make or model is NOT a match (it must never become verified)", () => {
  const d = { year: "2014", make: "JEEP", model: "Grand Cherokee" };
  assert.equal(identityMatches({ year: "2013", make: "Jeep", model: "Grand Cherokee" }, d), false);
  assert.equal(identityMatches({ year: "2014", make: "Dodge", model: "Grand Cherokee" }, d), false);
  assert.equal(identityMatches({ year: "2014", make: "Jeep", model: "Wrangler" }, d), false);
  assert.equal(identityMatches({ year: "2014", make: "Jeep", model: "Cherokee" }, d), false, "Cherokee is not Grand Cherokee");
  assert.equal(identityMatches({ year: "2014", make: "Jeep", model: "G" }, d), false, "a one-letter prefix is not a model");
  assert.equal(identityMatches({ year: "2014", make: "Jeep", model: "" }, d), false);
  assert.equal(identityMatches({ year: "", make: "", model: "" }, { year: "", make: "", model: "" }), false);
  assert.equal(identityMatches({ year: "2014", make: "Chevy", model: "Silverado" }, { year: "2014", make: "CHEVROLET", model: "Silverado 1500" }), false, "different make spelling is refused, not guessed");
});

// ---- the server-side probe ----
const ok = (row) => ({ ok: true, status: 200, json: async () => ({ Count: 1, Results: [row] }) });
const JEEP = { ModelYear: "2014", Make: "JEEP", Model: "Grand Cherokee", Trim: "Laredo", DisplacementL: "3.60", EngineCylinders: "6", ErrorCode: "0" };

test("probe: a clean decode returns the identity NHTSA gave, with the engine tidied", async () => {
  const r = await probeVin("1C4RJFAG8EC123456", async (url) => { assert.match(String(url), /\/1C4RJFAG8EC123456\?format=json$/); return ok(JEEP); });
  assert.deepEqual(r, { kind: "ok", decoded: { year: "2014", make: "JEEP", model: "Grand Cherokee", trim: "Laredo", engine: "3.6L 6-cyl" } });
});

test("probe: NHTSA answering 'I don't know this VIN' (error 7, empty or partial) is UNKNOWN, never an outage", async () => {
  assert.deepEqual(await probeVin("ZZZ", async () => ok({ ModelYear: "", Make: "", Model: "", ErrorCode: "7" })), { kind: "unknown" });
  assert.deepEqual(await probeVin("ZZZ", async () => ok({ ModelYear: "", Make: "JEEP", Model: "Grand Cherokee", ErrorCode: "6" })), { kind: "unknown" });
});

test("probe: network error, HTTP error, bad body and missing Results are all OUTAGE", async () => {
  const kinds = async (impl) => (await probeVin("V", impl)).kind;
  assert.equal(await kinds(async () => { throw new TypeError("fetch failed"); }), "outage");
  assert.equal(await kinds(async () => ({ ok: false, status: 503 })), "outage");
  assert.equal(await kinds(async () => ({ ok: false, status: 404 })), "outage");
  assert.equal(await kinds(async () => ({ ok: true, status: 200, json: async () => { throw new SyntaxError("<"); } })), "outage");
  assert.equal(await kinds(async () => ({ ok: true, status: 200, json: async () => ({}) })), "outage");
  assert.equal(await kinds(async () => ({ ok: true, status: 200, json: async () => ({ Results: [] }) })), "outage");
  assert.equal(await kinds(async () => ({ ok: true, status: 200, json: async () => null })), "outage");
});

test("probe: a connection that never answers, and a body that stalls, are abandoned as OUTAGE after the timeout", async () => {
  mock.timers.enable({ apis: ["setTimeout"] });
  try {
    const stalled = (url, init) => new Promise((_, reject) => init.signal.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError"))));
    const p1 = probeVin("V", stalled, 8000);
    mock.timers.tick(8000);
    assert.deepEqual(await p1, { kind: "outage", reason: "timeout" });

    let signal;
    const bodyStall = async (url, init) => ({ ok: true, status: 200, json: () => new Promise((_, reject) => { signal = init.signal; signal.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError"))); }) });
    const p2 = probeVin("V", bodyStall, 8000);
    await new Promise((r) => setImmediate(r));
    mock.timers.tick(8000);
    assert.deepEqual(await p2, { kind: "outage", reason: "timeout" });
  } finally {
    mock.timers.reset();
  }
});

test("probe base URL: a test override is honored everywhere EXCEPT Vercel Production", () => {
  assert.equal(vpicBase({}), "https://vpic.nhtsa.dot.gov/api/vehicles/decodevinvalues");
  assert.equal(vpicBase({ VPIC_BASE_URL: "http://127.0.0.1:3199/" }), "http://127.0.0.1:3199");
  assert.equal(vpicBase({ VERCEL_ENV: "preview", VPIC_BASE_URL: "http://127.0.0.1:3199" }), "http://127.0.0.1:3199");
  assert.equal(vpicBase({ VERCEL_ENV: "production", VPIC_BASE_URL: "http://evil.example" }), "https://vpic.nhtsa.dot.gov/api/vehicles/decodevinvalues");
});
