import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import util from "node:util";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

// Forgot-password route (Build 104-E). Bundles the REAL src/app/api/auth/forgot-password/route.ts and the REAL
// src/lib/passwordResetToken.ts; the user lookup (@/lib/users) and the mailer (@/lib/email) are stubbed.
//   * known and unknown addresses: identical status and body (no account oracle)
//   * a database failure is a controlled 503 with a fixed message, identical for known/unknown, nothing internal in body or logs
//   * a mail failure stays a generic 200 (answering differently would reveal the account exists) but is logged for the operator
//     without the customer's address
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const require = createRequire(import.meta.url);
const esbuild = require("esbuild");
process.env.AUTH_SECRET = ["unit", "test", "signing", "value", "0123456789"].join("-");

const S = (globalThis.__fp = { user: null, lookupError: null, mailResult: { ok: true }, sent: [] });
const stubs = {
  "@/lib/users": `export async function findUserByEmail() { const S = globalThis.__fp; if (S.lookupError) throw S.lookupError; return S.user; }`,
  "@/lib/email": `export async function sendEmail(to, subject, html) { const S = globalThis.__fp; S.sent.push({ to, subject }); return S.mailResult; }`,
};
const stubPlugin = {
  name: "stubs",
  setup(b) {
    b.onResolve({ filter: /^@\/lib\/(users|email)$/ }, (a) => ({ path: a.path, namespace: "stub" }));
    b.onLoad({ filter: /.*/, namespace: "stub" }, (a) => ({ contents: stubs[a.path], loader: "js" }));
  },
};
const out = await esbuild.build({ entryPoints: [path.join(ROOT, "src/app/api/auth/forgot-password/route.ts")], tsconfig: path.join(ROOT, "tsconfig.json"), bundle: true, format: "cjs", platform: "node", write: false, plugins: [stubPlugin], external: ["next", "next/*"], logLevel: "silent" });
const mod = { exports: {} };
new Function("module", "exports", "require", out.outputFiles[0].text)(mod, mod.exports, require);
const { POST } = mod.exports;

const EMAIL = "victim.customer@example.com";
const HASH = "$2b$12$Zx3Q9mWqVbT1uYkE8a1d2eHcLx0pRfGq7sJvNn4oUwYhKiTtPzCyS";
const LEAK = /Failed query|insert into|select "|from "users"|params:|\$2[aby]\$|password_hash|ECONNREFUSED|connection (terminated|refused)|node_modules|postgres(ql)?:\/\//i;
class DrizzleQueryError extends Error {
  constructor(query, params, cause) { super(`Failed query: ${query}\nparams: ${params.join(",")}`); this.name = "DrizzleQueryError"; this.cause = cause; }
}
const pgError = (code, message) => Object.assign(new Error(message), { name: "error", code });

let logs;
const realError = console.error, realWarn = console.warn, realLog = console.log;
beforeEach(() => {
  S.user = null; S.lookupError = null; S.mailResult = { ok: true }; S.sent.length = 0; logs = [];
  const grab = (...a) => logs.push(a.map((x) => util.inspect(x, { depth: 8, breakLength: Infinity })).join(" "));
  console.error = grab; console.warn = grab; console.log = grab;
});
const post = async (email = EMAIL) => {
  try {
    const res = await POST(new Request("http://localhost/api/auth/forgot-password", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email }) }));
    return { status: res.status, body: await res.text() };
  } finally { console.error = realError; console.warn = realWarn; console.log = realLog; }
};

test("known and unknown addresses: identical status and body", async () => {
  S.user = { id: "u1", email: EMAIL, passwordHash: HASH, status: "active" };
  const known = await post();
  S.user = null;
  const unknown = await post("nobody@example.com");
  assert.equal(known.status, 200);
  assert.equal(known.status, unknown.status);
  assert.equal(known.body, unknown.body);
});

test("database failure on lookup: 503, fixed customer-safe message, nothing internal, identical for any address", async () => {
  S.lookupError = new DrizzleQueryError('select "id", "email", "password_hash" from "users" where "users"."email" = $1 limit $2', [EMAIL, 1], pgError("57P01", "terminating connection due to administrator command"));
  const a = await post(EMAIL);
  S.lookupError = new DrizzleQueryError('select "id" from "users" where "users"."email" = $1', ["other@example.com", 1], pgError("57P01", "terminating connection"));
  const b = await post("other@example.com");
  for (const r of [a, b]) {
    assert.equal(r.status, 503);
    assert.doesNotMatch(r.body, LEAK);
    assert.match(JSON.parse(r.body).error, /try again/i);
  }
  assert.equal(a.body, b.body, "the failure answer must not depend on the address");
  assert.equal(S.sent.length, 0, "no mail on a failed lookup");
});

test("database failure is logged with class and code only (no SQL, params, email, hash)", async () => {
  S.lookupError = new DrizzleQueryError('select "id", "password_hash" from "users" where "users"."email" = $1', [EMAIL, 1], pgError("08006", "connection terminated unexpectedly"));
  await post();
  const text = logs.join("\n");
  assert.match(text, /\[forgot-password\]/);
  assert.match(text, /08006/);
  assert.doesNotMatch(text, /select "|password_hash|params:|\$2[aby]\$/i);
  assert.ok(!text.includes(EMAIL), "no customer email in logs");
});

test("mail failure stays a generic 200 (no account oracle) and is logged for the operator without the address", async () => {
  S.user = { id: "u1", email: EMAIL, passwordHash: HASH, status: "active" };
  S.mailResult = { ok: false, error: "resend_422" };
  const r = await post();
  assert.equal(r.status, 200);
  assert.deepEqual(JSON.parse(r.body), { ok: true });
  const text = logs.join("\n");
  assert.match(text, /\[forgot-password\]/, "an undelivered reset mail must be visible to the operator");
  assert.match(text, /resend_422/);
  assert.ok(!text.includes(EMAIL), "no customer email in the log line");
});

test("empty email is still a plain 400 and sends nothing", async () => {
  const r = await post("");
  assert.equal(r.status, 400);
  assert.deepEqual(JSON.parse(r.body), { error: "Email is required." });
  assert.equal(S.sent.length, 0);
});
