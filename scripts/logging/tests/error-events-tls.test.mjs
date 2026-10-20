import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import tls from "node:tls";
import util from "node:util";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

// What error_events STORES for a TLS / AggregateError (Build 104-J). src/lib/errors.ts and events.ts use the sanitizer only after PR #88; on main (and on #89
// alone) every test here is SKIPPED. On the integrated tree they run: recordError() stores message + stack in a table the
// admin System page shows, so a TLS hostname-mismatch message ("Host: db.internal.example. is not in the cert's altnames: ...") would be written
// to the database and displayed. Bundles the REAL errors.ts / events.ts; only @/db is stubbed.
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const has = (f) => fs.existsSync(path.join(ROOT, f));
// errors.ts / events.ts exist on main but only use dbErrorLog.ts once PR #88 lands; before that they store and log raw messages (that is #88's
// defect, covered by its own tests), so this suite runs only where they already import the sanitizer.
const wired = (f) => has(f) && /from\s+["'][^"']*dbErrorLog(Safe)?["']/.test(fs.readFileSync(path.join(ROOT, f), "utf8"));
const skip = wired("src/lib/errors.ts") && wired("src/lib/events.ts") ? false : "src/lib/errors.ts / events.ts do not use dbErrorLog yet (that lands with PR #88); this regression runs on the integrated tree";
// CC_REQUIRE_INTEGRATED=1 (set when verifying the integrated tree): not being wired is a FAILURE, not a silent skip.
if (skip && process.env.CC_REQUIRE_INTEGRATED === "1") throw new Error(`CC_REQUIRE_INTEGRATED=1 but ${skip}`);
const require = createRequire(import.meta.url);
const HOST = "db.internal.example";
const S = (globalThis.__etls = { insertError: null, rows: [] });

let recordError, recordEvent;
if (!skip) {
  const esbuild = require("esbuild");
  const stubPlugin = {
    name: "stubs",
    setup(b) {
      b.onResolve({ filter: /^@\/db$/ }, (a) => ({ path: a.path, namespace: "stub" }));
      b.onLoad({ filter: /.*/, namespace: "stub" }, () => ({ loader: "js", contents: "const S = globalThis.__etls; export const db = { insert() { return { values: async (row) => { if (S.insertError) throw S.insertError(); S.rows.push(row); } }; } };" }));
    },
  };
  const build = async (entry) => {
    const out = await esbuild.build({ entryPoints: [path.join(ROOT, entry)], tsconfig: path.join(ROOT, "tsconfig.json"), bundle: true, format: "cjs", platform: "node", write: false, plugins: [stubPlugin], external: ["next", "next/*", "drizzle-orm", "drizzle-orm/*", "pg"], logLevel: "silent" });
    const m = { exports: {} };
    new Function("module", "exports", "require", out.outputFiles[0].text)(m, m.exports, require);
    return m.exports;
  };
  ({ recordError } = await build("src/lib/errors.ts"));
  ({ recordEvent } = await build("src/lib/events.ts"));
}

let logs;
const realError = console.error, realWarn = console.warn, realLog = console.log;
beforeEach(() => {
  S.insertError = null; S.rows = []; logs = [];
  const grab = (...a) => logs.push(a.map((x) => (typeof x === "string" ? x : util.inspect(x, { depth: 8, breakLength: Infinity }))).join(" "));
  console.error = grab; console.warn = grab; console.log = grab;
});
const restore = () => { console.error = realError; console.warn = realWarn; console.log = realLog; };
const mismatch = () => tls.checkServerIdentity(HOST, { subject: { CN: "other.example" }, subjectaltname: "DNS:other.example" });
const aggregate = () => new AggregateError([Object.assign(new Error(`connect ECONNREFUSED ${HOST}:5432`), { code: "ECONNREFUSED" })], "");
const noHost = (s, what) => { for (const x of [HOST, "other.example", "altnames", "10.0.0.9"]) assert.ok(!String(s).includes(x), `${what}: "${x}" leaked:\n${s}`); };

test("error_events: a recorded TLS hostname mismatch stores class + code, not the host, the certificate names or the message", { skip }, async () => {
  try {
    await recordError({ source: "api/garage", error: mismatch() });
    assert.equal(S.rows.length, 1);
    const row = S.rows[0];
    noHost(row.message, "message"); noHost(row.stack, "stack");
    assert.match(row.message, /ERR_TLS_CERT_ALTNAME_INVALID/, "the code is the diagnosis and is kept");
  } finally { restore(); }
});

test("error_events: a recorded AggregateError stores no addresses, and a TLS cause inside a wrapper is also hidden", { skip }, async () => {
  try {
    await recordError({ source: "api/garage", error: aggregate() });
    await recordError({ source: "api/garage", error: new Error("wrapper", { cause: mismatch() }) });
    assert.equal(S.rows.length, 2);
    for (const r of S.rows) { noHost(r.message, "message"); noHost(r.stack, "stack"); }
    assert.match(S.rows[0].message, /ECONNREFUSED/);
    assert.match(S.rows[1].message, /ERR_TLS_CERT_ALTNAME_INVALID/);
  } finally { restore(); }
});

test("error_events: an ordinary error is still stored with its own message and stack", { skip }, async () => {
  try {
    await recordError({ source: "api/garage", error: new Error("catalog row 12 is missing a torque value") });
    assert.equal(S.rows[0].message, "catalog row 12 is missing a torque value");
    assert.ok(String(S.rows[0].stack).includes("catalog row 12"));
  } finally { restore(); }
});

test("recorders: when the insert itself fails with a TLS error, the console log carries the code only", { skip }, async () => {
  S.insertError = () => mismatch();
  try {
    await recordError({ source: "api/garage", error: new Error("original") });
    await recordEvent({ type: "x.y", userId: null, metadata: {} });
    const t = logs.join("\n");
    noHost(t, "log");
    assert.match(t, /\[errors\] failed to record error from api\/garage/);
    assert.match(t, /\[events\] failed to record x\.y/);
    assert.match(t, /ERR_TLS_CERT_ALTNAME_INVALID/);
  } finally { restore(); }
});
