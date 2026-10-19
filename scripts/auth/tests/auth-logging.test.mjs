import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import util from "node:util";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

// Auth.js log output (Build 104-F). Bundles the REAL src/auth.ts (so whatever logger the app wires into Auth.js is what is tested) and
// drives it through the real handlers; only the database handle and the user lookup are stubbed.
//   * an EXPIRED session cookie is routine traffic. Auth.js's default logger prints the decoded token (user id, email, password-version
//     stamp, token id) for it: customer data in the logs on ordinary requests
//   * a database failure inside the password check makes the default logger print the thrown error's full stack: drizzle's message is the
//     SQL plus the bound parameters (the email being signed in)
// Contract: the log keeps the Auth.js error type and the cause's class/short code (diagnosable), and nothing else.
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const require = createRequire(import.meta.url);
const esbuild = require("esbuild");
const SECRET = ["unit", "test", "signing", "value", "0123456789"].join("-"); // throwaway, built in pieces so credential scanners do not flag a literal
Object.assign(process.env, { AUTH_SECRET: SECRET, AUTH_TRUST_HOST: "true", AUTH_URL: "http://localhost:3100" });

const S = (globalThis.__al = { verifyError: null });
const stubs = {
  "@/db": `export const db = {};`,
  "@/lib/users": `export async function verifyPassword() { const S = globalThis.__al; if (S.verifyError) throw S.verifyError; return null; }`,
};
const stubPlugin = {
  name: "stubs",
  setup(b) {
    b.onResolve({ filter: /^@\/(db|lib\/users)$/ }, (a) => ({ path: a.path, namespace: "stub" }));
    b.onLoad({ filter: /.*/, namespace: "stub" }, (a) => ({ contents: stubs[a.path], loader: "js" }));
  },
};
const out = await esbuild.build({ entryPoints: [path.join(ROOT, "src/auth.ts")], tsconfig: path.join(ROOT, "tsconfig.json"), bundle: true, format: "cjs", platform: "node", write: false, plugins: [stubPlugin], external: ["next", "next/*"], logLevel: "silent" });
const mod = { exports: {} };
new Function("module", "exports", "require", out.outputFiles[0].text)(mod, mod.exports, require);
const { handlers } = mod.exports;
const { encode } = await import("@auth/core/jwt");
const { NextRequest } = require("next/server");

const EMAIL = "victim.customer@example.com";
const WRONG_PW = ["a", "wrong", "guess", "123"].join("-"); // throwaway, built in pieces so credential scanners do not flag a literal
const OTHER_SECRET = ["some", "other", "signing", "value", "0000"].join("-");
const USER_ID = "f4398701-5a0c-4882-a97e-0411534e417a";
const PWV = "vuBT6K4ds40__E9k";
const HASH = "$2b$12$Zx3Q9mWqVbT1uYkE8a1d2eHcLx0pRfGq7sJvNn4oUwYhKiTtPzCyS";
const COOKIE = "authjs.session-token";

class DrizzleQueryError extends Error {
  constructor(query, params, cause) { super(`Failed query: ${query}\nparams: ${params.join(",")}`); this.name = "DrizzleQueryError"; this.query = query; this.params = params; this.cause = cause; }
}
const pgError = (code, message) => Object.assign(new Error(message), { name: "error", code, severity: "ERROR" });

let logs;
const realError = console.error, realWarn = console.warn, realLog = console.log;
beforeEach(() => {
  S.verifyError = null; logs = [];
  const grab = (...a) => logs.push(a.map((x) => (typeof x === "string" ? x : util.inspect(x, { depth: 8, breakLength: Infinity }))).join(" "));
  console.error = grab; console.warn = grab; console.log = grab;
});
const restore = () => { console.error = realError; console.warn = realWarn; console.log = realLog; };
const text = () => logs.join("\n");
const noCustomerData = (t) => {
  for (const [what, needle] of [["email", EMAIL], ["email fragment", "victim.customer"], ["user id", USER_ID], ["password-version stamp", PWV], ["password hash", HASH]]) assert.ok(!t.includes(needle), `${what} in the log:\n${t}`);
  assert.doesNotMatch(t, /Failed query|select "|params:|"payload"|"jti"|node_modules/i, "SQL, token payload or stack frames in the log");
};

test("an EXPIRED session cookie: the request is refused/anonymous and the log carries no token contents", async () => {
  const jwt = await encode({ token: { userId: USER_ID, email: EMAIL, pwv: PWV }, secret: SECRET, salt: COOKIE, maxAge: -120 });
  try {
    const res = await handlers.GET(new NextRequest("http://localhost:3100/api/auth/session", { headers: { cookie: `${COOKIE}=${jwt}` } }));
    const body = await res.text();
    assert.ok(!body.includes(EMAIL), "an expired session must not be answered with the customer's data");
    assert.match(text(), /\[auth\]/, "the failure is still logged for the operator");
    assert.match(text(), /JWT|ERR_JWT_EXPIRED/, "the error type is the diagnosable part and is kept");
    noCustomerData(text());
  } finally { restore(); }
});

test("a cookie signed with another secret (forged/rotated): logged by type only", async () => {
  const jwt = await encode({ token: { userId: USER_ID, email: EMAIL, pwv: PWV }, secret: OTHER_SECRET, salt: COOKIE });
  try {
    await handlers.GET(new NextRequest("http://localhost:3100/api/auth/session", { headers: { cookie: `${COOKIE}=${jwt}` } }));
    assert.match(text(), /\[auth\]/);
    noCustomerData(text());
  } finally { restore(); }
});

test("a database failure inside the password check: sign-in fails safely and the log has class/code only (no SQL, no email)", async () => {
  S.verifyError = new DrizzleQueryError('select "id", "email", "password_hash" from "users" where "users"."email" = $1 limit $2', [EMAIL, 1], pgError("57P01", "terminating connection due to administrator command"));
  try {
    const csrfRes = await handlers.GET(new NextRequest("http://localhost:3100/api/auth/csrf"));
    const csrf = (await csrfRes.json()).csrfToken;
    const csrfCookie = csrfRes.headers.getSetCookie().map((c) => c.split(";")[0]).join("; ");
    const res = await handlers.POST(new NextRequest("http://localhost:3100/api/auth/callback/credentials", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded", cookie: csrfCookie },
      body: new URLSearchParams({ csrfToken: csrf, email: EMAIL, password: WRONG_PW }).toString(),
      redirect: "manual",
    }));
    assert.ok(res.status < 500 || res.status === 503, "control: the handler answered");
    assert.match(text(), /\[auth\]/, "the failure is still logged");
    assert.match(text(), /57P01/, "the database error code is the diagnosable part and is kept");
    noCustomerData(text());
  } finally { restore(); }
});

test("an ordinary failed sign-in (wrong password) still produces one short, diagnosable line", async () => {
  try {
    const csrfRes = await handlers.GET(new NextRequest("http://localhost:3100/api/auth/csrf"));
    const csrf = (await csrfRes.json()).csrfToken;
    const csrfCookie = csrfRes.headers.getSetCookie().map((c) => c.split(";")[0]).join("; ");
    await handlers.POST(new NextRequest("http://localhost:3100/api/auth/callback/credentials", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded", cookie: csrfCookie },
      body: new URLSearchParams({ csrfToken: csrf, email: EMAIL, password: WRONG_PW }).toString(),
      redirect: "manual",
    }));
    assert.match(text(), /CredentialsSignin/);
    noCustomerData(text());
  } finally { restore(); }
});

// The logger itself, called directly: the paths the integration tests above cannot see (Auth.js's own messages are only "Read more at ...").
const alOut = await esbuild.build({ entryPoints: [path.join(ROOT, "src/lib/authLogger.ts")], tsconfig: path.join(ROOT, "tsconfig.json"), bundle: true, format: "cjs", platform: "node", write: false, logLevel: "silent" });
const alMod = { exports: {} };
new Function("module", "exports", "require", alOut.outputFiles[0].text)(alMod, alMod.exports, require);
const { authLogger } = alMod.exports;

test("authLogger never prints an error's message, stack, String() form or cause details (sentinels)", () => {
  try {
    const inner = Object.assign(new Error("INNER-MESSAGE-SENTINEL victim.customer@example.com"), { name: "JWTExpired", code: "ERR_JWT_EXPIRED", payload: { email: "PAYLOAD-SENTINEL" } });
    const err = Object.assign(new Error("OUTER-MESSAGE-SENTINEL"), { type: "JWTSessionError", cause: { err: inner, extra: "DETAILS-SENTINEL" } });
    err.stack = "Error: STACK-SENTINEL\n    at /srv/app/node_modules/x.js:1:1";
    authLogger.error(err);
    const t = text();
    assert.match(t, /JWTSessionError/);
    assert.match(t, /ERR_JWT_EXPIRED/);
    for (const s of ["INNER-MESSAGE-SENTINEL", "OUTER-MESSAGE-SENTINEL", "STACK-SENTINEL", "PAYLOAD-SENTINEL", "DETAILS-SENTINEL", "victim.customer", "node_modules"]) assert.ok(!t.includes(s), `${s} reached the log: ${t}`);
  } finally { restore(); }
});

test("authLogger cannot throw on odd inputs (null, undefined, a string, a throwing getter)", () => {
  try {
    const hostile = { get type() { throw new Error("boom"); }, get name() { throw new Error("boom"); } };
    for (const odd of [null, undefined, "just a string", 42, {}, hostile]) assert.doesNotThrow(() => authLogger.error(odd));
    assert.match(text(), /\[auth\]\[error\]/);
  } finally { restore(); }
});
