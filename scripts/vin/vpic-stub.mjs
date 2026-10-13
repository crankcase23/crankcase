// Local stand-in for NHTSA vPIC decodevinvalues, for the NHTSA-outage fallback e2e tests (tests/e2e/vin-fallback.spec.ts).
// The app's server reads its decoder base URL from VPIC_BASE_URL (ignored on Vercel Production, see src/lib/vpicServer.ts).
//
//   node scripts/vin/vpic-stub.mjs [port=3199]
//
// What a VIN gets is decided by its first three characters, so parallel tests use their own VINs without interfering:
//   1C4 Jeep Grand Cherokee 2014 | 1FT Ford F-150 2015 | WBA BMW 328i 2010 | 2HG Honda Civic 2018
//   1G1 HTTP 503 | 3VW 200 with an HTML body | 5YJ never answers | anything else: NHTSA "error 7" (unknown VIN)
// A test can override ONE VIN while it runs:  POST /__mode  {"vin":"...","mode":"down|html|hang|unknown|jeep|f150|bmw|civic"}
import http from "node:http";

const port = Number(process.argv[2] || process.env.VPIC_STUB_PORT || 3199);
const ID = {
  jeep: { ModelYear: "2014", Make: "JEEP", Model: "Grand Cherokee", Trim: "Laredo", EngineCylinders: "6", DisplacementL: "3.6" },
  f150: { ModelYear: "2015", Make: "FORD", Model: "F-150", EngineCylinders: "8", DisplacementL: "5.0" },
  bmw: { ModelYear: "2010", Make: "BMW", Model: "328i", EngineCylinders: "6", DisplacementL: "3.0" },
  civic: { ModelYear: "2018", Make: "HONDA", Model: "Civic", Trim: "LX", EngineCylinders: "4", DisplacementL: "2.0" },
};
const BY_WMI = { "1C4": "jeep", "1FT": "f150", WBA: "bmw", "2HG": "civic", "1G1": "down", "3VW": "html", "5YJ": "hang" };
const overrides = new Map();
const hits = new Map();

const server = http.createServer((req, res) => {
  const url = new URL(req.url, "http://x");
  if (req.method === "POST" && url.pathname === "/__mode") {
    let body = "";
    req.on("data", (c) => (body += c));
    req.on("end", () => {
      const { vin, mode } = JSON.parse(body || "{}");
      if (mode) overrides.set(String(vin).toUpperCase(), mode); else overrides.delete(String(vin).toUpperCase());
      res.end("ok");
    });
    return;
  }
  if (url.pathname.startsWith("/__hits/")) {
    res.end(String(hits.get(decodeURIComponent(url.pathname.slice(8)).toUpperCase()) ?? 0));
    return;
  }
  const vin = decodeURIComponent(url.pathname.split("/").filter(Boolean).pop() || "").toUpperCase();
  hits.set(vin, (hits.get(vin) ?? 0) + 1);
  const mode = overrides.get(vin) ?? BY_WMI[vin.slice(0, 3)] ?? "unknown";
  if (mode === "hang") return; // never answer
  if (mode === "down") { res.writeHead(503, { "content-type": "text/html" }); return res.end("<html>maintenance</html>"); }
  if (mode === "html") { res.writeHead(200, { "content-type": "text/html" }); return res.end("<html>gateway</html>"); }
  const row = ID[mode]
    ? { ...ID[mode], FuelTypePrimary: "Gasoline", ErrorCode: "0", ErrorText: "0 - VIN decoded clean. Check Digit (9th position) is correct" }
    : { ModelYear: "", Make: "", Model: "", ErrorCode: "7", ErrorText: "7 - Manufacturer is not registered with NHTSA for sale or importation in the U.S." };
  res.writeHead(200, { "content-type": "application/json" });
  res.end(JSON.stringify({ Count: 1, Message: "Results returned successfully", Results: [row] }));
});
server.listen(port, "127.0.0.1", () => console.log(`vpic stub on ${port}`));
