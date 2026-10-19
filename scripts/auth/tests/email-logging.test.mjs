import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import util from "node:util";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

// Mail sender logging (Build 104-F). Bundles the REAL src/lib/email.ts; only the network (global fetch) and the console are faked.
// Contract:
//   * the caller still gets the same short result codes ("not_configured", "resend_<status>", "request_failed"), because the
//     forgot-password route logs those for the operator
//   * the LOG never carries the customer's address, the subject (it can name a vehicle), the provider's response body (it can echo the
//     address and the message), the API key, or a thrown error's message; it keeps status codes and error class/code for diagnosis
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const require = createRequire(import.meta.url);
const esbuild = require("esbuild");

const out = await esbuild.build({ entryPoints: [path.join(ROOT, "src/lib/email.ts")], tsconfig: path.join(ROOT, "tsconfig.json"), bundle: true, format: "cjs", platform: "node", write: false, logLevel: "silent" });
const mod = { exports: {} };
new Function("module", "exports", "require", out.outputFiles[0].text)(mod, mod.exports, require);
const { sendEmail } = mod.exports;

const TO = "victim.customer@example.com";
const SUBJECT = "Oil change due for your 2012 Jeep Grand Cherokee";
const KEY = ["re", "unit", "test", "key", "0123456789abcdef"].join("_"); // throwaway, built in pieces so credential scanners do not flag a literal

const realFetch = globalThis.fetch;
const realError = console.error, realWarn = console.warn, realLog = console.log;
let logs;
beforeEach(() => {
  logs = [];
  const grab = (...a) => logs.push(a.map((x) => (typeof x === "string" ? x : util.inspect(x, { depth: 8, breakLength: Infinity }))).join(" "));
  console.error = grab; console.warn = grab; console.log = grab;
  delete process.env.RESEND_API_KEY;
});
const done = () => { console.error = realError; console.warn = realWarn; console.log = realLog; globalThis.fetch = realFetch; delete process.env.RESEND_API_KEY; };
const text = () => logs.join("\n");
const noCustomerData = (t) => {
  assert.ok(!t.includes(TO), "customer address in log: " + t);
  assert.ok(!t.includes("victim.customer"), "customer address fragment in log");
  assert.ok(!t.includes("Jeep") && !t.includes("Oil change"), "subject in log");
  assert.ok(!t.includes(KEY), "API key in log");
  assert.doesNotMatch(t, /Bearer/i, "authorization header in log");
};

test("not configured: result code kept, log has no address and no subject", async () => {
  try {
    const r = await sendEmail(TO, SUBJECT, "<p>x</p>");
    assert.deepEqual(r, { ok: false, error: "not_configured" });
    assert.match(text(), /\[email\]/, "an operator still needs to see that mail was skipped");
    noCustomerData(text());
  } finally { done(); }
});

test("provider rejects the send (422 echoing the address): result code kept, log has status only, never the body", async () => {
  process.env.RESEND_API_KEY = KEY;
  globalThis.fetch = async () => new Response(JSON.stringify({ statusCode: 422, name: "validation_error", message: `Invalid \`to\` field: ${TO} is not allowed. Bearer ${KEY}` }), { status: 422 });
  try {
    const r = await sendEmail(TO, SUBJECT, "<p>x</p>");
    assert.deepEqual(r, { ok: false, error: "resend_422" });
    assert.match(text(), /422/, "the status is the useful part and is kept");
    noCustomerData(text());
    assert.doesNotMatch(text(), /validation_error|not allowed|Invalid/i, "the provider's body must not be logged");
  } finally { done(); }
});

test("network failure whose message names the address and carries the key: result code kept, log has class and code only", async () => {
  process.env.RESEND_API_KEY = KEY;
  globalThis.fetch = async () => { throw Object.assign(new Error(`connect ECONNREFUSED while sending to ${TO} with Bearer ${KEY}`), { name: "TypeError", code: "ECONNREFUSED" }); };
  try {
    const r = await sendEmail(TO, SUBJECT, "<p>x</p>");
    assert.deepEqual(r, { ok: false, error: "request_failed" });
    assert.match(text(), /ECONNREFUSED/, "the error code is diagnosable and kept");
    noCustomerData(text());
  } finally { done(); }
});

test("success path is unchanged and logs nothing", async () => {
  process.env.RESEND_API_KEY = KEY;
  let seen;
  globalThis.fetch = async (url, init) => { seen = { url: String(url), body: JSON.parse(init.body) }; return new Response("{}", { status: 200 }); };
  try {
    const r = await sendEmail(TO, SUBJECT, "<p>x</p>");
    assert.deepEqual(r, { ok: true });
    assert.deepEqual(seen.body.to, [TO], "the mail itself must still go to the customer");
    assert.equal(logs.length, 0);
  } finally { done(); }
});
