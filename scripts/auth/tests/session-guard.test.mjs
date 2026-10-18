import { test } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import fs from "node:fs";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

// Session security (PR B). Bundles the REAL src/lib/sessionGuard.ts (no copy of the rules lives here; only the database is stubbed)
// and drives the REAL Auth.js session action with the same callbacks src/auth.ts installs, so cookie behaviour is the library's.
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const require = createRequire(import.meta.url);
const esbuild = require("esbuild");
const stubDb = { name: "stub-db", setup(b) { b.onResolve({ filter: /^@\/db$/ }, () => ({ path: "stub-db", namespace: "stub" })); b.onLoad({ filter: /.*/, namespace: "stub" }, () => ({ contents: "export const db = {};", loader: "js" })); } };
const out = await esbuild.build({
  entryPoints: [path.join(ROOT, "src/lib/sessionGuard.ts")], tsconfig: path.join(ROOT, "tsconfig.json"),
  bundle: true, format: "esm", platform: "node", write: false, plugins: [stubDb],
});
const M = await import("data:text/javascript;base64," + Buffer.from(out.outputFiles[0].text).toString("base64"));
const { Auth } = await import("@auth/core");
const { encode, decode } = await import("@auth/core/jwt");
const { default: Credentials } = await import("@auth/core/providers/credentials");

const SECRET = "test-secret-test-secret-test-secret-1234";
const COOKIE = "authjs.session-token";
const HASH1 = "$2a$12$hash-one";
const HASH2 = "$2a$12$hash-two";
const row = (over = {}) => ({ status: "active", passwordHash: HASH1, ...over });
const goodClaims = (over = {}) => ({ userId: "u1", email: "a@example.com", pwv: M.passwordVersion(HASH1), ...over });
const mint = (claims) => encode({ token: claims, secret: SECRET, salt: COOKIE, maxAge: 3600 });
const cfg = (lookup, log = () => {}) => ({
  secret: SECRET, trustHost: true, basePath: "/api/auth", session: { strategy: "jwt" },
  providers: [Credentials({ credentials: {}, authorize: async () => null })],
  callbacks: M.createSessionCallbacks(lookup, log),
});
async function getSession(cookieValue, config) {
  const res = await Auth(new Request("http://localhost/api/auth/session", { headers: { cookie: `${COOKIE}=${cookieValue}` } }), config);
  const setCookies = res.headers.getSetCookie();
  const mine = setCookies.filter((c) => c.startsWith(`${COOKIE}=`));
  const value = mine[0]?.split(";")[0].slice(COOKIE.length + 1) ?? "";
  const cleared = mine.length > 0 && (value === "" || /max-age=0|expires=thu, 01 jan 1970/i.test(mine.join(";")));
  return { status: res.status, body: await res.json(), cookieValue: value, cleared, touched: mine.length > 0 };
}

// ------------------------------------------------------------------------------------------------ the decision (pure)
test("judgeSession: valid, disabled, deleted, password changed, no stamp, no user id", () => {
  assert.deepEqual(M.judgeSession(goodClaims(), row()), { kind: "valid" });
  assert.deepEqual(M.judgeSession(goodClaims(), row({ status: "disabled" })), { kind: "denied", reason: "disabled" });
  assert.deepEqual(M.judgeSession(goodClaims(), null), { kind: "denied", reason: "missing-user" });
  assert.deepEqual(M.judgeSession(goodClaims(), row({ passwordHash: HASH2 })), { kind: "denied", reason: "password-changed" });
  assert.deepEqual(M.judgeSession(goodClaims({ pwv: undefined }), row()), { kind: "denied", reason: "no-version" });
  assert.deepEqual(M.judgeSession(goodClaims({ pwv: "" }), row()), { kind: "denied", reason: "no-version" });
  for (const bad of [undefined, "", 7, null]) assert.deepEqual(M.judgeSession(goodClaims({ userId: bad }), row()), { kind: "denied", reason: "no-user-id" });
});

test("passwordVersion: stable, differs per hash, never contains the hash", () => {
  assert.equal(M.passwordVersion(HASH1), M.passwordVersion(HASH1));
  assert.notEqual(M.passwordVersion(HASH1), M.passwordVersion(HASH2));
  assert.ok(!M.passwordVersion(HASH1).includes("hash-one"));
  assert.equal(M.passwordVersion(HASH1).length, 16);
});

test("verifySessionToken: a token with no user id is denied without reading the database", async () => {
  let called = 0;
  const v = await M.verifySessionToken({ pwv: "x" }, async () => { called++; return row(); });
  assert.deepEqual(v, { kind: "denied", reason: "no-user-id" });
  assert.equal(called, 0);
});

// ------------------------------------------------------------------------------------------------ the real Auth.js flow
test("R11 valid session: user is returned and the cookie is refreshed", async () => {
  const r = await getSession(await mint(goodClaims()), cfg(async () => row()));
  assert.equal(r.body.user.id, "u1");
  assert.ok(r.touched && !r.cleared);
});

test("R11 disabled account: the existing session is rejected NOW and the cookie is cleared; re-enabled works again for a fresh login", async () => {
  const token = await mint(goodClaims());
  const off = await getSession(token, cfg(async () => row({ status: "disabled" })));
  assert.equal(off.body, null);
  assert.ok(off.cleared, "cookie cleared");
  const on = await getSession(token, cfg(async () => row()));
  assert.equal(on.body.user.id, "u1");
});

test("R11 deleted account: rejected, cookie cleared", async () => {
  const r = await getSession(await mint(goodClaims()), cfg(async () => null));
  assert.equal(r.body, null);
  assert.ok(r.cleared);
});

test("R12 password reset: a session minted before the reset is rejected afterwards; a session minted with the new password works", async () => {
  const before = await mint(goodClaims());
  const afterReset = cfg(async () => row({ passwordHash: HASH2 }));
  const old = await getSession(before, afterReset);
  assert.equal(old.body, null);
  assert.ok(old.cleared);
  const fresh = await getSession(await mint(goodClaims({ pwv: M.passwordVersion(HASH2) })), afterReset);
  assert.equal(fresh.body.user.id, "u1");
});

test("R13 no grandfathering: a token with no password-version stamp (issued before this change) requires one re-login", async () => {
  const r = await getSession(await mint(goodClaims({ pwv: undefined })), cfg(async () => row()));
  assert.equal(r.body, null);
  assert.ok(r.cleared);
});

test("R14 database failure: access denied for the request, cookie NOT cleared, token not altered, failure logged, recovers by itself", async () => {
  const logged = [];
  const original = goodClaims();
  const token = await mint(original);
  const down = await getSession(token, cfg(async () => { throw new Error("db down"); }, (...a) => logged.push(a)));
  assert.equal(down.body?.user, undefined, "no user while the account cannot be verified");
  assert.ok(down.touched && !down.cleared, "cookie kept, not deleted");
  assert.ok(down.cookieValue.length > 20, "cookie re-signed with a real value");
  const claims = await decode({ token: down.cookieValue, secret: SECRET, salt: COOKIE });
  assert.equal(claims.userId, "u1");
  assert.equal(claims.pwv, original.pwv);
  assert.deepEqual(Object.keys(claims).filter((k) => !["iat", "exp", "jti", "userId", "pwv", "email"].includes(k)), [], "nothing extra persisted into the token");
  assert.equal(logged.length, 1);
  // the same cookie works again once the database is back
  const up = await getSession(down.cookieValue, cfg(async () => row()));
  assert.equal(up.body.user.id, "u1");
});

test("R14 database failure never grants access to a session that would have been denied (disabled + outage still shows no user)", async () => {
  const r = await getSession(await mint(goodClaims()), cfg(async () => { throw new Error("db down"); }));
  assert.ok(!r.body?.user);
});

// ------------------------------------------------------------------------------------------------ wiring (static)
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), "utf8");
test("wiring: auth.ts installs the guard callbacks, stamps the password version at sign-in, and exports a null-safe auth()", () => {
  const a = read("src/auth.ts");
  assert.ok(a.includes("createSessionCallbacks()"));
  assert.ok(/pwv:\s*passwordVersion\(user\.passwordHash\)/.test(a));
  assert.ok(/session\?\.user\?\.id \? session : null/.test(a));
});

test("wiring: only src/auth.ts builds a NextAuth instance, and every caller uses the wrapped auth()", () => {
  const hits = [];
  const walk = (dir) => { for (const n of fs.readdirSync(dir)) { const f = path.join(dir, n); if (fs.statSync(f).isDirectory()) walk(f); else if (/\.(ts|tsx)$/.test(n)) { const t = fs.readFileSync(f, "utf8"); const rel = path.relative(ROOT, f).split(path.sep).join("/"); if (/from\s+["']next-auth["']/.test(t) && /NextAuth\(/.test(t)) hits.push(rel); if (/\bauth\([^)]/.test(t) && !/requireAuth|\/\/.*auth\(/.test(t)) hits.push("auth-with-args:" + rel); } } };
  walk(path.join(ROOT, "src"));
  assert.deepEqual(hits, ["src/auth.ts"]);
});

test("wiring: the password-reset flow rewrites the stored hash (that is what revokes old sessions)", () => {
  assert.ok(/passwordHash/.test(read("src/lib/users.ts").split("export async function updatePassword")[1] ?? ""));
  assert.ok(read("src/app/api/auth/reset-password/route.ts").includes("updatePassword(userId, password)"));
});
