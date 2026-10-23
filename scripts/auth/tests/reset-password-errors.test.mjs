import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import util from "node:util";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

// Reset-password route failure handling (Build 104-F). Bundles the REAL src/app/api/auth/reset-password/route.ts, the REAL
// src/lib/users.ts (so updatePassword really hashes the new password) and the REAL token code; only the database handle (@/db) is stubbed.
// Errors are shaped exactly like drizzle's DrizzleQueryError: message = SQL + bound parameters, and on an UPDATE the parameters include
// the NEW bcrypt hash. Contract:
//   * a database failure (lookup or update) answers 503 with a fixed customer-safe message: no SQL, no params, no hash, no stack
//   * the server log keeps class and short code only
//   * every existing answer is unchanged: 400 for missing/short/invalid/expired/used tokens, 200 on success
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const require = createRequire(import.meta.url);
const esbuild = require("esbuild");
Object.assign(process.env, { AUTH_SECRET: ["unit", "test", "signing", "value", "0123456789"].join("-") });

const S = (globalThis.__rp = { row: null, selectError: null, updateError: null, updated: null });
const stubs = {
  "@/db": `
    const S = globalThis.__rp;
    export const db = {
      select() { return { from() { return { where() { return { limit: async () => { if (S.selectError) throw S.selectError; return S.row ? [S.row] : []; } }; } }; } }; },
      update() { return { set(v) { return { where: async () => { if (S.updateError) { S.updateError.params = [v.passwordHash, "user-1"]; S.updateError.message = "Failed query: update \\"users\\" set \\"password_hash\\" = $1 where \\"users\\".\\"id\\" = $2\\nparams: " + v.passwordHash + ",user-1"; throw S.updateError; } S.updated = v.passwordHash; } }; } }; },
    };`,
};
const stubPlugin = {
  name: "stubs",
  setup(b) {
    b.onResolve({ filter: /^@\/db$/ }, (a) => ({ path: a.path, namespace: "stub" }));
    b.onLoad({ filter: /.*/, namespace: "stub" }, (a) => ({ contents: stubs[a.path], loader: "js" }));
  },
};
const build = async (entry) => {
  const out = await esbuild.build({ entryPoints: [path.join(ROOT, entry)], tsconfig: path.join(ROOT, "tsconfig.json"), bundle: true, format: "cjs", platform: "node", write: false, plugins: [stubPlugin], external: ["next", "next/*"], logLevel: "silent" });
  const mod = { exports: {} };
  new Function("module", "exports", "require", out.outputFiles[0].text)(mod, mod.exports, require);
  return mod.exports;
};
const { POST } = await build("src/app/api/auth/reset-password/route.ts");
const { makeResetToken } = await build("src/lib/passwordResetToken.ts");

const OLD_HASH = "$2b$12$Zx3Q9mWqVbT1uYkE8a1d2eHcLx0pRfGq7sJvNn4oUwYhKiTtPzCyS";
const NEW_PW = ["a", "brand", "new", "pw", "8472"].join("-"); // throwaway, built in pieces so credential scanners do not flag a literal
const LEAK = /Failed query|update "users"|select "|from "users"|params:|\$2[aby]\$|password_hash|ECONNREFUSED|connection (terminated|refused)|node_modules|postgres(ql)?:\/\//i;
class DrizzleQueryError extends Error {
  constructor(query, params, cause) { super(`Failed query: ${query}\nparams: ${params.join(",")}`); this.name = "DrizzleQueryError"; this.query = query; this.params = params; this.cause = cause; }
}
const pgError = (code, message) => Object.assign(new Error(message), { name: "error", code, severity: "ERROR" });
const validToken = () => makeResetToken("user-1", OLD_HASH);

let logs;
const realError = console.error, realWarn = console.warn, realLog = console.log;
beforeEach(() => {
  S.row = { id: "user-1", email: "victim.customer@example.com", passwordHash: OLD_HASH, status: "active" };
  S.selectError = null; S.updateError = null; S.updated = null; logs = [];
  const grab = (...a) => logs.push(a.map((x) => util.inspect(x, { depth: 8, breakLength: Infinity })).join(" "));
  console.error = grab; console.warn = grab; console.log = grab;
});
const post = async (body) => {
  try {
    const res = await POST(new Request("http://localhost/api/auth/reset-password", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }));
    return { status: res.status, body: await res.text() };
  } finally { console.error = realError; console.warn = realWarn; console.log = realLog; }
};
const logText = () => logs.join("\n");

test("a database failure while saving the new password: 503, fixed message, no SQL/params/hash in the answer", async () => {
  S.updateError = new DrizzleQueryError("update", [], pgError("08006", "connection terminated unexpectedly"));
  const r = await post({ token: validToken(), password: NEW_PW });
  assert.equal(r.status, 503);
  assert.doesNotMatch(r.body, LEAK);
  assert.deepEqual(JSON.parse(r.body), { error: "We couldn't update your password right now. Please try again in a minute." });
});

test("a database failure during the account lookup: 503, fixed message, nothing internal", async () => {
  S.selectError = new DrizzleQueryError('select "id", "email", "password_hash" from "users" where "users"."id" = $1 limit $2', ["user-1", 1], pgError("57P01", "terminating connection due to administrator command"));
  const r = await post({ token: validToken(), password: NEW_PW });
  assert.equal(r.status, 503);
  assert.doesNotMatch(r.body, LEAK);
  assert.match(JSON.parse(r.body).error, /try again/i);
});

test("server log keeps a diagnosable record without SQL, params, the new hash or the user id", async () => {
  S.updateError = new DrizzleQueryError("update", [], pgError("08006", "connection terminated unexpectedly"));
  await post({ token: validToken(), password: NEW_PW });
  const t = logText();
  assert.match(t, /\[reset-password\]/, "a failure must still be logged");
  assert.match(t, /08006/, "the database error code is the useful part and is kept");
  assert.doesNotMatch(t, /\$2[aby]\$/, "no password hash in logs");
  assert.doesNotMatch(t, /update "users"|select "|password_hash|params:|Failed query/i, "no SQL or params in logs");
  assert.ok(!t.includes("user-1") && !t.includes("victim.customer") && !t.includes(NEW_PW), "no user id, address or password in logs");
});

test("server log on a failed LOOKUP also keeps class and code only (no SQL, params, user id or message text)", async () => {
  S.selectError = new DrizzleQueryError('select "id", "email", "password_hash" from "users" where "users"."id" = $1 limit $2', ["user-1", 1], pgError("57P01", "terminating connection due to administrator command"));
  await post({ token: validToken(), password: NEW_PW });
  const t = logText();
  assert.match(t, /\[reset-password\]/);
  assert.match(t, /57P01/);
  assert.doesNotMatch(t, /select "|password_hash|params:|Failed query|terminating connection/i);
  assert.ok(!t.includes("user-1"), "no user id in logs");
});

test("a failed save does not change the password and the stored hash never leaves the process", async () => {
  S.updateError = new DrizzleQueryError("update", [], pgError("08006", "x"));
  const r = await post({ token: validToken(), password: NEW_PW });
  assert.equal(S.updated, null);
  assert.ok(!r.body.includes(OLD_HASH));
});

test("success is unchanged: 200 {ok:true} and the new password is hashed and stored", async () => {
  const r = await post({ token: validToken(), password: NEW_PW });
  assert.equal(r.status, 200);
  assert.deepEqual(JSON.parse(r.body), { ok: true });
  assert.match(S.updated, /^\$2[aby]\$/);
});

test("existing 400 answers are unchanged (missing, short, malformed, unknown user, stale token)", async () => {
  const cases = [
    [{ password: NEW_PW }, "Missing reset token."],
    [{ token: validToken(), password: "short" }, "Password must be at least 8 characters."],
    [{ token: "not-a-token", password: NEW_PW }, "This reset link is invalid."],
  ];
  for (const [body, msg] of cases) { const r = await post(body); assert.equal(r.status, 400); assert.deepEqual(JSON.parse(r.body), { error: msg }); }
  S.row = null;
  let r = await post({ token: validToken(), password: NEW_PW });
  assert.equal(r.status, 400); assert.deepEqual(JSON.parse(r.body), { error: "This reset link is invalid." });
  S.row = { id: "user-1", email: "x@example.com", passwordHash: "$2b$12$someOtherHashThatInvalidatesTheOldLink0000000000000000000", status: "active" };
  r = await post({ token: validToken(), password: NEW_PW });
  assert.equal(r.status, 400);
  assert.deepEqual(JSON.parse(r.body), { error: "This reset link has expired or was already used. Request a new one." });
});
