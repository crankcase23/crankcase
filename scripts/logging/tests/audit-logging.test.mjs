import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import util from "node:util";
import tls from "node:tls";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

// Admin audit log failure logging (Build 104-H). recordAudit() swallows a failed insert so an admin action is never lost to an audit
// outage, and logs the failure. It used to log the raw error object: a drizzle failure's message is the full INSERT text plus every bound
// parameter, here the admin's user id, their IP address, their user agent and the action's metadata. That copied personal data into the
// server log on every failed audit write. This bundles the REAL src/lib/admin/audit.ts; only @/db is stubbed.
// Contract:
//   * the log keeps "[audit]", the action name and the error class + short code (diagnosable)
//   * it never carries SQL, the admin id, IP, user agent, metadata values or any message of the database error
//   * behaviour is unchanged: recordAudit still resolves (never throws) and the caller's action is not affected
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const require = createRequire(import.meta.url);

const ADMIN_ID = "9d1c2a40-6f0e-4b7a-8a55-0c3f2b9e7d11";
const ADMIN_IP = "203.0.113.77";
const UA = "Mozilla/5.0 (X11; Linux x86_64) SecretBrowser/9.9";
const META = "customer-jane.doe@example.org";
const LEAK = /Failed query|insert into|"admin_audit_log"|params:|postgres(ql)?:\/\//i;
class DrizzleQueryError extends Error {
  constructor(query, params, cause) { super(`Failed query: ${query}\nparams: ${params.join(",")}`); this.name = "DrizzleQueryError"; this.query = query; this.params = params; this.cause = cause; }
}
const pgError = (code) => Object.assign(new Error("terminating connection due to administrator command"), { name: "error", code, severity: "ERROR" });
const insertFailure = (code = "57P01") => new DrizzleQueryError(
  'insert into "admin_audit_log" ("id","admin_user_id","action","summary","metadata","ip","user_agent") values ($1,$2,$3,$4,$5,$6,$7)',
  ["uuid", ADMIN_ID, "user.disable", "disabled a user", JSON.stringify({ email: META }), ADMIN_IP, UA], pgError(code));

let logs;
const realError = console.error, realWarn = console.warn, realLog = console.log;
beforeEach(() => {
  logs = [];
  const grab = (...a) => logs.push(a.map((x) => (typeof x === "string" ? x : util.inspect(x, { depth: 8, breakLength: Infinity }))).join(" "));
  console.error = grab; console.warn = grab; console.log = grab;
});
const restore = () => { console.error = realError; console.warn = realWarn; console.log = realLog; };
const text = () => logs.join("\n");
const clean = (t) => {
  for (const s of [ADMIN_ID, ADMIN_IP, UA, META]) assert.ok(!t.includes(s), `"${s}" leaked:\n${t}`);
  assert.doesNotMatch(t, LEAK, `SQL / parameters leaked:\n${t}`);
  assert.doesNotMatch(t, /node_modules|\.next[\\/]/, `stack frames leaked:\n${t}`);
};

const esbuild = require("esbuild");
const stubPlugin = {
  name: "stubs",
  setup(b) {
    b.onResolve({ filter: /^@\/db$/ }, (a) => ({ path: a.path, namespace: "stub" }));
    b.onLoad({ filter: /.*/, namespace: "stub" }, () => ({
      contents: "export const db = { insert: () => ({ values: async () => { if (globalThis.__auditFail) throw globalThis.__auditFail(); } }) };",
      loader: "js",
    }));
  },
};
const out = await esbuild.build({ entryPoints: [path.join(ROOT, "src/lib/admin/audit.ts")], tsconfig: path.join(ROOT, "tsconfig.json"), bundle: true, format: "cjs", platform: "node", write: false, plugins: [stubPlugin], external: ["next", "next/*", "drizzle-orm", "drizzle-orm/*", "pg"], logLevel: "silent" });
const m = { exports: {} };
new Function("module", "exports", "require", out.outputFiles[0].text)(m, m.exports, require);
const { recordAudit } = m.exports;

const ctx = { userId: ADMIN_ID };
const request = () => new Request("https://example.test/api/admin/x", { headers: { "x-forwarded-for": `${ADMIN_IP}, 10.0.0.1`, "user-agent": UA } });
const input = (extra = {}) => ({ ctx, action: "user.disable", summary: "disabled a user", metadata: { email: META }, request: request(), ...extra });

test("audit: a failed audit write logs tag + action + class + code only (no SQL, admin id, IP, user agent or metadata)", async () => {
  globalThis.__auditFail = () => insertFailure("57P01");
  try {
    await assert.doesNotReject(recordAudit(input()), "an audit outage must never break the admin action");
    const t = text();
    assert.match(t, /\[audit\] failed to record admin action/, "the operator-facing message is kept");
    assert.match(t, /user\.disable/, "the action name is kept");
    assert.match(t, /57P01/, "the database error code is kept");
    assert.match(t, /DrizzleQueryError/, "the error class is kept");
    clean(t);
  } finally { restore(); delete globalThis.__auditFail; }
});

test("audit: a network failure (connection refused) logs only its code, not the database address", async () => {
  globalThis.__auditFail = () => Object.assign(new Error("connect ECONNREFUSED 10.9.8.7:5432"), { code: "ECONNREFUSED", syscall: "connect", address: "10.9.8.7", port: 5432 });
  try {
    await assert.doesNotReject(recordAudit(input()));
    const t = text();
    assert.match(t, /ECONNREFUSED/);
    assert.ok(!t.includes("10.9.8.7"), `the database address leaked:\n${t}`);
    clean(t);
  } finally { restore(); delete globalThis.__auditFail; }
});

// Build 104-J: a TLS verification failure is a REAL Node error (built here by tls.checkServerIdentity, not by hand). Its message and its
// `reason` / `host` properties name the database host: "Host: db.internal.example. is not in the cert's altnames: DNS:other.example". It has
// no `syscall`, no `address` and a non-SQLSTATE code, so the sensitivity check used to wave it through and log err.message verbatim.
const DB_HOST = "db.internal.example";
const tlsHostMismatch = () => tls.checkServerIdentity(DB_HOST, { subject: { CN: "other.example" }, subjectaltname: "DNS:other.example" });
test("audit: a TLS hostname mismatch logs its code, not the database host named in the message", async () => {
  const err = tlsHostMismatch();
  assert.ok(err.message.includes(DB_HOST), "sanity: the real error does carry the host");
  globalThis.__auditFail = () => err;
  try {
    await assert.doesNotReject(recordAudit(input()));
    const t = text();
    assert.match(t, /\[audit\] failed to record admin action/);
    assert.match(t, /user\.disable/);
    assert.match(t, /ERR_TLS_CERT_ALTNAME_INVALID/, "the code stays: it is the diagnosis");
    assert.ok(!t.includes(DB_HOST), `the database host leaked:\n${t}`);
    assert.ok(!t.includes("other.example"), `the certificate's names leaked:\n${t}`);
    clean(t);
  } finally { restore(); delete globalThis.__auditFail; }
});

test("audit: a TLS failure wrapped as the cause of another error is also kept out of the log", async () => {
  const wrapped = new Error("audit insert failed", { cause: tlsHostMismatch() });
  globalThis.__auditFail = () => wrapped;
  try {
    await assert.doesNotReject(recordAudit(input()));
    const t = text();
    assert.ok(!t.includes(DB_HOST), `the database host leaked through the cause:\n${t}`);
    assert.match(t, /ERR_TLS_CERT_ALTNAME_INVALID/);
  } finally { restore(); delete globalThis.__auditFail; }
});

test("audit: other certificate failures (self-signed, expired, unknown issuer) log their code only", async () => {
  for (const code of ["DEPTH_ZERO_SELF_SIGNED_CERT", "CERT_HAS_EXPIRED", "UNABLE_TO_VERIFY_LEAF_SIGNATURE", "SELF_SIGNED_CERT_IN_CHAIN", "ERR_SSL_WRONG_VERSION_NUMBER"]) {
    globalThis.__auditFail = () => Object.assign(new Error(`${code} while connecting to ${DB_HOST}:5432 as app`), { code });
    try {
      logs.length = 0;
      await assert.doesNotReject(recordAudit(input()));
      const t = text();
      assert.ok(!t.includes(DB_HOST), `${code}: the database host leaked:\n${t}`);
      assert.match(t, new RegExp(code), `${code}: the code is kept`);
    } finally { delete globalThis.__auditFail; }
  }
  restore();
});

test("audit: an AggregateError (several connection attempts failed, empty message) logs the inner code, not the addresses", async () => {
  const inner = [Object.assign(new Error(`connect ECONNREFUSED ${DB_HOST}:5432`), { code: "ECONNREFUSED" }), Object.assign(new Error("connect ECONNREFUSED 10.0.0.9:5432"), { code: "ECONNREFUSED" })];
  globalThis.__auditFail = () => new AggregateError(inner, "");
  try {
    await assert.doesNotReject(recordAudit(input()));
    const t = text();
    assert.ok(!t.includes(DB_HOST) && !t.includes("10.0.0.9"), `an address leaked:\n${t}`);
    assert.match(t, /ECONNREFUSED/, "the inner code is the diagnosis");
  } finally { restore(); delete globalThis.__auditFail; }
});

test("audit: an ordinary developer-written error keeps its message (nothing sensitive to hide)", async () => {
  globalThis.__auditFail = () => new Error("audit sink misconfigured");
  try {
    await assert.doesNotReject(recordAudit(input()));
    assert.match(text(), /audit sink misconfigured/);
  } finally { restore(); delete globalThis.__auditFail; }
});

test("audit: a successful write logs nothing", async () => {
  try {
    await recordAudit(input());
    assert.equal(text(), "");
  } finally { restore(); }
});
