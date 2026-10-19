import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import util from "node:util";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

// Session-guard failure logging (Build 104-G). src/lib/sessionGuard.ts is introduced by the session-security PR (#80) and does not exist on
// main yet, so this file is SKIPPED where it is absent and runs (red, then green) on any tree that carries #80. It bundles the REAL module;
// only @/db is stubbed, and the lookup is injected exactly as the app's own callbacks do.
// The account lookup is `select status, password_hash from users where id = $1`, so a drizzle failure's message is that SQL plus the user's
// id, and the guard logs it on EVERY authenticated request while the database is down.
// Contract:
//   * the log keeps the subsystem tag, the "denying this request" wording, and the error class + short code
//   * it never carries SQL, the user id, or any message of the database error
//   * behaviour is unchanged: a failed lookup is "unverified" (access denied for this request, cookie untouched, session returns when the
//     database does); denied and valid verdicts are not affected
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const present = fs.existsSync(path.join(ROOT, "src/lib/sessionGuard.ts"));
const skip = present ? false : "src/lib/sessionGuard.ts is not on this branch (it lands with PR #80); this regression runs on the integrated tree";
const require = createRequire(import.meta.url);

const USER_ID = "f4398701-5a0c-4882-a97e-0411534e417a";
const LEAK = /Failed query|select "|from "users"|params:|password_hash|"users"\."id"|postgres(ql)?:\/\//i;
class DrizzleQueryError extends Error {
  constructor(query, params, cause) { super(`Failed query: ${query}\nparams: ${params.join(",")}`); this.name = "DrizzleQueryError"; this.query = query; this.params = params; this.cause = cause; }
}
const pgError = (code) => Object.assign(new Error("terminating connection due to administrator command"), { name: "error", code, severity: "ERROR" });
const lookupFailure = () => new DrizzleQueryError('select "status", "password_hash" from "users" where "users"."id" = $1 limit $2', [USER_ID, 1], pgError("57P01"));

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
  assert.ok(!t.includes(USER_ID), `the user id leaked:\n${t}`);
  assert.doesNotMatch(t, LEAK, `SQL / parameters leaked:\n${t}`);
  assert.doesNotMatch(t, /node_modules|\.next[\\/]/, `stack frames leaked:\n${t}`);
};

let mod = null;
if (present) {
  const esbuild = require("esbuild");
  const stubPlugin = {
    name: "stubs",
    setup(b) {
      b.onResolve({ filter: /^@\/db$/ }, (a) => ({ path: a.path, namespace: "stub" }));
      b.onLoad({ filter: /.*/, namespace: "stub" }, () => ({ contents: "export const db = {};", loader: "js" }));
    },
  };
  const out = await esbuild.build({ entryPoints: [path.join(ROOT, "src/lib/sessionGuard.ts")], tsconfig: path.join(ROOT, "tsconfig.json"), bundle: true, format: "cjs", platform: "node", write: false, plugins: [stubPlugin], external: ["next", "next/*"], logLevel: "silent" });
  const m = { exports: {} };
  new Function("module", "exports", "require", out.outputFiles[0].text)(m, m.exports, require);
  mod = m.exports;
}

test("session guard: a failed account lookup logs subsystem + class + code only (default logger, no SQL, no user id)", { skip }, async () => {
  try {
    const verdict = await mod.verifySessionToken({ userId: USER_ID, pwv: "stamp" }, async () => { throw lookupFailure(); });
    assert.deepEqual(verdict, { kind: "unverified" }, "fail-closed behaviour is unchanged");
    const t = text();
    assert.match(t, /\[session-guard\]/, "the subsystem tag is kept");
    assert.match(t, /denying this request/, "the operator-facing explanation is kept");
    assert.match(t, /57P01/, "the database error code is kept");
    clean(t);
  } finally { restore(); }
});

test("session guard: through the real jwt + session callbacks the request is still denied and nothing leaks", { skip }, async () => {
  try {
    const cb = mod.createSessionCallbacks(async () => { throw lookupFailure(); });
    const token = { userId: USER_ID, pwv: "stamp" };
    const jwt = await cb.jwt({ token });
    assert.equal(jwt, token, "the cookie/token is left untouched (not signed out by a blip)");
    const session = await cb.session({ session: { expires: "2099-01-01", user: { id: "x" } }, token });
    assert.equal(session.user, undefined, "access is denied for this request: no user");
    clean(text());
  } finally { restore(); }
});

test("session guard: an injected logger receives no raw error object either", { skip }, async () => {
  const seen = [];
  await mod.verifySessionToken({ userId: USER_ID, pwv: "stamp" }, async () => { throw lookupFailure(); }, (...a) => seen.push(a));
  assert.equal(seen.length, 1);
  for (const arg of seen[0]) assert.ok(typeof arg === "string", "every logged argument is a plain string, never the error object");
  clean(seen[0].join(" "));
});

test("session guard: valid and denied verdicts are unchanged and log nothing", { skip }, async () => {
  try {
    const hash = "$2b$12$Zx3Q9mWqVbT1uYkE8a1d2eHcLx0pRfGq7sJvNn4oUwYhKiTtPzCyS";
    const row = { status: "active", passwordHash: hash };
    assert.deepEqual(await mod.verifySessionToken({ userId: USER_ID, pwv: mod.passwordVersion(hash) }, async () => row), { kind: "valid" });
    assert.deepEqual(await mod.verifySessionToken({ userId: USER_ID, pwv: mod.passwordVersion(hash) }, async () => ({ ...row, status: "disabled" })), { kind: "denied", reason: "disabled" });
    assert.deepEqual(await mod.verifySessionToken({ userId: USER_ID, pwv: "old" }, async () => row), { kind: "denied", reason: "password-changed" });
    assert.deepEqual(await mod.verifySessionToken({ userId: USER_ID, pwv: "x" }, async () => null), { kind: "denied", reason: "missing-user" });
    assert.equal(logs.length, 0, "healthy and denied paths log nothing");
  } finally { restore(); }
});
