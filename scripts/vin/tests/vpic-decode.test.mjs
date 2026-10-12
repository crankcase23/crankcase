import { test, mock } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

// decodeVin() against responses recorded from the LIVE NHTSA vPIC service (decodevinvalues, 2026-10-11, fetched from the
// production site's origin so CORS matched what the app sees), trimmed to the fields the app reads. A VIN is required
// to add a vehicle, so this decoder is the front door: if its parsing or its failure behavior regresses, onboarding stops.

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const require = createRequire(import.meta.url);
const esbuild = require("esbuild");
const out = await esbuild.build({ entryPoints: [path.join(ROOT, "src/lib/vpic.ts")], bundle: true, format: "esm", platform: "node", write: false });
const { decodeVin, VPIC_TIMEOUT_MS } = await import("data:text/javascript;base64," + Buffer.from(out.outputFiles[0].text).toString("base64"));

const CLEAN = "0 - VIN decoded clean. Check Digit (9th position) is correct";
const LIVE = {
  "WBAPH5C53AA123456": { ModelYear: "2010", Make: "BMW", Model: "328i", BodyClass: "Sedan/Saloon", EngineCylinders: "6", DisplacementL: "3.0", FuelTypePrimary: "Gasoline", ErrorCode: "0", ErrorText: CLEAN },
  "1C4RJFAG8EC123456": { ModelYear: "2014", Make: "JEEP", Model: "Grand Cherokee", Trim: "Laredo", BodyClass: "Sport Utility Vehicle [SUV]/Multipurpose Vehicle [MPV]", Doors: "4", EngineCylinders: "6", DisplacementL: "3.6", FuelTypePrimary: "Gasoline", DriveType: "4WD/4-Wheel Drive/4x4", ErrorCode: "0", ErrorText: CLEAN },
  "2HGFC2F50JH123456": { ModelYear: "2018", Make: "HONDA", Model: "Civic", Trim: "LX", BodyClass: "Sedan/Saloon", BodyCabType: "Not Applicable", Doors: "4", EngineCylinders: "4", DisplacementL: "2.0", FuelTypePrimary: "Gasoline", DriveType: "4x2", TransmissionStyle: "Continuously Variable Transmission (CVT)", ErrorCode: "0", ErrorText: CLEAN },
  "1GCUYDED2LZ123456": { ModelYear: "2020", Make: "CHEVROLET", Model: "Silverado 1500", Trim: "LT", EngineCylinders: "8", DisplacementL: "5.3", FuelTypePrimary: "Gasoline", ErrorCode: "0", ErrorText: CLEAN },
  "1FTEW1EF6FF123456": { ModelYear: "2015", Make: "FORD", Model: "F-150", EngineCylinders: "8", DisplacementL: "5.0", FuelTypePrimary: "Gasoline", ErrorCode: "0", ErrorText: CLEAN },
};
const NOT_REGISTERED = { ModelYear: "", Make: "", Model: "", ErrorCode: "7", ErrorText: "7 - Manufacturer is not registered with NHTSA for sale or importation in the U.S." };

const json = (row) => ({ ok: true, status: 200, json: async () => ({ Count: 1, Message: "Results returned successfully", Results: [row] }) });
const withFetch = async (impl, fn) => {
  const real = globalThis.fetch;
  globalThis.fetch = impl;
  try { return await fn(); } finally { globalThis.fetch = real; }
};

for (const [vin, row] of Object.entries(LIVE)) {
  test(`live response for ${vin} decodes to year, make, model and engine`, async () => {
    const d = await withFetch(async (url) => { assert.match(String(url), new RegExp(`/decodevinvalues/${vin}\\?format=json$`)); return json(row); }, () => decodeVin(vin));
    assert.equal(d.vin, vin);
    assert.equal(d.year, row.ModelYear);
    assert.equal(d.make, row.Make);
    assert.equal(d.model, row.Model);
    assert.equal(d.displacementL, String(Number(row.DisplacementL))); // app tidies "3.0" to "3"
    assert.equal(d.engineCylinders, row.EngineCylinders);
    assert.equal(d.errorText, undefined, "a clean decode must not surface vPIC's '0 - VIN decoded clean' text as an error");
  });
}

test("a VIN NHTSA does not know comes back with no year/make/model and the error text, never invented values", async () => {
  const d = await withFetch(async () => json(NOT_REGISTERED), () => decodeVin("ZZZZZ5AG8EC123456"));
  assert.equal(d.year, undefined);
  assert.equal(d.make, undefined);
  assert.equal(d.model, undefined);
  assert.match(d.errorText, /not registered/);
});

test("HTTP errors and non-JSON bodies reject (the add page turns a rejection into its plain outage message)", async () => {
  await assert.rejects(withFetch(async () => ({ ok: false, status: 503 }), () => decodeVin("1C4RJFAG8EC123456")), /503/);
  await assert.rejects(withFetch(async () => ({ ok: true, status: 200, json: async () => { throw new SyntaxError("Unexpected token <"); } }), () => decodeVin("1C4RJFAG8EC123456")), SyntaxError);
});

test("a connection that never answers is abandoned after the timeout instead of hanging the add page forever", async () => {
  mock.timers.enable({ apis: ["setTimeout"] });
  try {
    const stalled = (url, init) => new Promise((_, reject) => init.signal.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError"))));
    const p = withFetch(stalled, () => decodeVin("1C4RJFAG8EC123456"));
    const settled = assert.rejects(p, /abort/i);
    mock.timers.tick(VPIC_TIMEOUT_MS - 1);
    mock.timers.tick(1);
    await settled;
  } finally {
    mock.timers.reset();
  }
});

test("a response whose body stalls after the headers arrive is also abandoned", async () => {
  mock.timers.enable({ apis: ["setTimeout"] });
  try {
    let signal;
    const bodyStall = async (url, init) => {
      signal = init.signal;
      return { ok: true, status: 200, json: () => new Promise((_, reject) => signal.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")))) };
    };
    const settled = assert.rejects(withFetch(bodyStall, () => decodeVin("1C4RJFAG8EC123456")), /abort/i);
    await new Promise((r) => setImmediate(r)); // let the headers 'arrive' and the body read begin
    mock.timers.tick(VPIC_TIMEOUT_MS);
    await settled;
  } finally {
    mock.timers.reset();
  }
});

test("a prompt answer is not cut off by the timeout and leaves no timer running", async () => {
  mock.timers.enable({ apis: ["setTimeout"] });
  try {
    const d = await withFetch(async () => json(LIVE["WBAPH5C53AA123456"]), () => decodeVin("WBAPH5C53AA123456"));
    assert.equal(d.model, "328i");
    mock.timers.tick(VPIC_TIMEOUT_MS * 2); // would throw or abort nothing: the timer was cleared
  } finally {
    mock.timers.reset();
  }
});
