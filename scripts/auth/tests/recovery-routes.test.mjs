import { test } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

// Account recovery routes (Build 103). Bundles the REAL src/app/api/auth/forgot-password/route.ts and the REAL
// src/lib/passwordResetToken.ts. Only the database lookups (@/lib/users) and the mail sender (@/lib/email) are stubbed, so the
// route's own decisions are what is under test:
//   * a DISABLED account still gets a working reset link (the documented recovery procedure depends on it, docs/auth/SESSION-SECURITY.md)
//   * an unknown address gets no mail and an identical answer
//   * reset-token expiry cannot be extended without invalidating the signature
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const require = createRequire(import.meta.url);
const esbuild = require("esbuild");
process.env.AUTH_SECRET = ["unit", "test", "signing", "value", "0123456789"].join("-"); // throwaway, test-only

const state = { users: new Map(), sent: [] };
const stubs = {
  "@/lib/users": `export async function findUserByEmail(e){ return globalThis.__rec.users.get(String(e).toLowerCase().trim()) ?? null; }`,
  "@/lib/email": `export async function sendEmail(to, subject, html){ globalThis.__rec.sent.push({ to, subject, html }); return { ok: true }; }`,
};
globalThis.__rec = state;
const stubPlugin = {
  name: "stubs",
  setup(b) {
    b.onResolve({ filter: /^@\/lib\/(users|email)$/ }, (a) => ({ path: a.path, namespace: "stub" }));
    b.onLoad({ filter: /.*/, namespace: "stub" }, (a) => ({ contents: stubs[a.path], loader: "js" }));
  },
};
async function load(entry) {
  const out = await esbuild.build({ entryPoints: [path.join(ROOT, entry)], tsconfig: path.join(ROOT, "tsconfig.json"), bundle: true, format: "cjs", platform: "node", write: false, plugins: [stubPlugin], external: ["next", "next/*"], logLevel: "silent" });
  const m = { exports: {} };
  new Function("module", "exports", "require", out.outputFiles[0].text)(m, m.exports, require);
  return m.exports;
}
const Forgot = await load("src/app/api/auth/forgot-password/route.ts");
const Token = await load("src/lib/passwordResetToken.ts");

const HASH = "$2a$12$unit-hash-one";
const post = (email) => Forgot.POST(new Request("http://localhost/api/auth/forgot-password", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email }) }));
const linkToken = (html) => decodeURIComponent(/reset-password\?token=([^"]+)"/.exec(html)[1]);

test("forgot-password: a DISABLED account still receives a reset link that works (recovery procedure depends on it)", async () => {
  state.users.set("held@example.com", { id: "u-held", email: "held@example.com", passwordHash: HASH, status: "disabled" });
  state.sent.length = 0;
  const res = await post("Held@Example.com ");
  assert.equal(res.status, 200);
  assert.equal(state.sent.length, 1, "exactly one mail for the disabled account");
  assert.equal(state.sent[0].to, "held@example.com");
  assert.equal(Token.verifyResetToken(linkToken(state.sent[0].html), HASH), "u-held", "the mailed link verifies against the current hash");
});

test("forgot-password: unknown address sends nothing and answers exactly like a known one", async () => {
  state.users.set("known@example.com", { id: "u-known", email: "known@example.com", passwordHash: HASH, status: "active" });
  state.sent.length = 0;
  const known = await post("known@example.com");
  const knownBody = await known.text();
  const sentForKnown = state.sent.length;
  const unknown = await post("nobody@example.com");
  assert.equal(known.status, unknown.status);
  assert.equal(knownBody, await unknown.text());
  assert.equal(sentForKnown, 1);
  assert.equal(state.sent.length, 1, "no extra mail for the unknown address");
  assert.equal((await post("")).status, 400, "empty email is a plain 400");
});

test("reset token: extending the expiry without re-signing is rejected; the genuine token is accepted", () => {
  const good = Token.makeResetToken("u1", HASH);
  assert.equal(Token.verifyResetToken(good, HASH), "u1", "control: a fresh token verifies");
  const [uid, exp, sig] = Buffer.from(good, "base64url").toString("utf8").split(".");
  const stretched = Buffer.from([uid, String(Number(exp) + 24 * 3600_000), sig].join(".")).toString("base64url");
  assert.equal(Token.verifyResetToken(stretched, HASH), null, "same signature with a later expiry must fail");
  const swappedUser = Buffer.from(["u2", exp, sig].join(".")).toString("base64url");
  assert.equal(Token.verifyResetToken(swappedUser, HASH), null, "another user id under the same signature must fail");
  assert.equal(Token.verifyResetToken(good, "$2a$12$unit-hash-two"), null, "a changed password hash kills the link");
  const realNow = Date.now;
  Date.now = () => realNow() + 61 * 60 * 1000;
  try { assert.equal(Token.verifyResetToken(good, HASH), null, "an hour-old link is expired"); } finally { Date.now = realNow; }
});
