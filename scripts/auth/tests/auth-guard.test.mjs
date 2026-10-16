import { test, after } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import fs from "node:fs";
import util from "node:util";
import pg from "pg";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

// AUTH THROTTLING (PR A), regressions R1..R10 plus the concurrency and recovery checks.
// Bundles the REAL src/lib/authGuard.ts and the REAL four route handlers against a REAL Postgres (DATABASE_URL; the limiter's
// whole job is locking and counting in the database, so a stub would prove nothing). Only things that are not the subject are
// replaced: the password check / user store (in-memory, counts every password check), the mailer (records sends) and next/server's
// after(). A second bundle swaps the database for one that always errors, to prove each flow's failure mode.
if (!process.env.DATABASE_URL) {
  throw new Error("auth-guard.test.mjs needs DATABASE_URL (a throwaway Postgres with the app_events table). A test that cannot run is a failure, not a pass.");
}
process.env.AUTH_SECRET ||= "local-throwaway-secret";
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const require = createRequire(import.meta.url);
const esbuild = require("esbuild");
const g = globalThis;

const virtual = (filter, contents) => ({
  name: "virtual-" + String(filter),
  setup(b) {
    b.onResolve({ filter }, (a) => ({ path: a.path, namespace: "virt-" + String(filter) }));
    b.onLoad({ filter: /.*/, namespace: "virt-" + String(filter) }, () => ({ contents, loader: "js" }));
  },
});
const stubs = [
  virtual(/^next\/server$/, `
    export const NextRequest = Request;
    export const NextResponse = { json: (b, init = {}) => new Response(JSON.stringify(b), { ...init, headers: { "content-type": "application/json", ...(init.headers || {}) } }) };
    export const after = (fn) => { (globalThis.__after ??= []).push(fn); };`),
  virtual(/^@\/lib\/email$/, `
    export async function sendEmail(to) { (globalThis.__mail ??= []).push(to); if (globalThis.__mailDelay) await new Promise((r) => setTimeout(r, globalThis.__mailDelay)); return { ok: true }; }`),
  virtual(/^@\/lib\/users$/, `
    const g = globalThis;
    const wait = (ms) => ms ? new Promise((r) => setTimeout(r, ms)) : null;
    export async function createUser(email) { (g.__created ??= []).push(email); if (g.__existing?.has(email.toLowerCase())) throw new Error("An account with that email already exists."); return { id: crypto.randomUUID(), email }; }
    export async function findUserByEmail(e) { await wait(g.__lookupDelay); return g.__users?.[e.toLowerCase()] ?? null; }
    export async function findUserById(id) { return Object.values(g.__users ?? {}).find((u) => u.id === id) ?? null; }
    export async function updatePassword(id) { (g.__updated ??= []).push(id); }`),
  virtual(/^@\/auth$/, `
    const g = globalThis;
    // Faithful to @auth/core: the body is parsed by getBody() (lib/utils/web.js) and authorize() only runs the password check
    // when email and password are strings. Whatever identity it actually used is recorded in __authSaw, so a test can compare
    // it with what the limiter counted.
    export const handlers = {
      GET: async () => new Response("ok"),
      POST: async (req) => {
        const ct = req.headers.get("content-type");
        let body;
        if (req.body && ct?.includes("application/json")) body = await req.json();
        else if (req.body && ct?.includes("application/x-www-form-urlencoded")) body = Object.fromEntries(new URLSearchParams(await req.text()));
        const u = new URL(req.url);
        const email = body?.email, password = body?.password;
        const fail = () => new Response(JSON.stringify({ url: u.origin + "/login?error=CredentialsSignin" }), { headers: { "content-type": "application/json" } });
        if (typeof email !== "string" || typeof password !== "string") return fail();   // authorize() returns null before any password check
        (g.__authSaw ??= []).push({ email, password });
        g.__pwChecks = (g.__pwChecks ?? 0) + 1;            // every call that gets here is one full password check
        const ok = g.__accounts?.[email.toLowerCase().trim()] === password;
        return ok
          ? new Response(JSON.stringify({ url: u.origin + "/" }), { headers: { "set-cookie": "authjs.session-token=abc123; Path=/; HttpOnly", "content-type": "application/json" } })
          : fail();
      },
    };`),
];
const downDb = virtual(/^@\/db$/, `export const db = new Proxy({}, { get: () => () => { throw new Error("db down"); } });`);
const entry = `
  export * as guard from "@/lib/authGuard";
  export * as signup from "@/app/api/signup/route";
  export * as forgot from "@/app/api/auth/forgot-password/route";
  export * as reset from "@/app/api/auth/reset-password/route";
  export * as login from "@/app/api/auth/[...nextauth]/route";
  export { db } from "@/db";
  export { appEvents } from "@/db/schema";
  export { makeResetToken } from "@/lib/passwordResetToken";`;
const tmpDirs = [];
async function bundle(extra = []) {
  const out = await esbuild.build({
    stdin: { contents: entry, resolveDir: ROOT, loader: "ts" }, tsconfig: path.join(ROOT, "tsconfig.json"),
    bundle: true, format: "esm", platform: "node", write: false, external: ["pg", "drizzle-orm", "drizzle-orm/*", "node:*", "bcryptjs"],
    plugins: [...extra, ...stubs],
  });
  // Written under node_modules/.cache so the bare imports (pg, drizzle-orm) resolve exactly as they do for the app.
  const dir = path.join(ROOT, "node_modules", ".cache");
  fs.mkdirSync(dir, { recursive: true });
  const tmp = fs.mkdtempSync(path.join(dir, "authguard-"));
  tmpDirs.push(tmp);
  const file = path.join(tmp, "bundle.mjs");
  fs.writeFileSync(file, out.outputFiles[0].text);
  return import(file);
}
// The stub user store hands out ids that are not rows in users, so the real recordEvent (signup funnel) logs a harmless FK
// error per signup. Drop exactly that line so a real failure is not buried in it.
const realError = console.error;
console.error = (...a) => { if (!util.inspect(a, { depth: 6 }).includes("app_events_user_id_users_id_fk")) realError(...a); };
const M = await bundle();
const D = await bundle([downDb]);
after(async () => { await M.db.$client.end(); for (const d of tmpDirs) fs.rmSync(d, { recursive: true, force: true }); });

// ----------------------------------------------------------------------------------------------------------------- helpers
const rnd = () => Math.random().toString(36).slice(2, 10);
const ipOf = () => `10.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}`;
const emailOf = () => `t-${rnd()}@example.com`;
const reset_ = () => { g.__mail = []; g.__after = []; g.__created = []; g.__updated = []; g.__existing = new Set(); g.__users = {}; g.__accounts = {}; g.__pwChecks = 0; g.__authSaw = []; g.__mailDelay = 0; g.__lookupDelay = 0; };
const headers = (ip, extra = {}) => ({ ...(ip ? { "x-forwarded-for": ip } : {}), ...extra });
const loginReq = (email, password, ip) => new Request("http://localhost:3100/api/auth/callback/credentials", {
  method: "POST", headers: headers(ip, { "content-type": "application/x-www-form-urlencoded" }), body: new URLSearchParams({ email, password, csrfToken: "x" }),
});
const jsonReq = (p, body, ip) => new Request("http://localhost:3100" + p, { method: "POST", headers: headers(ip, { "content-type": "application/json" }), body: JSON.stringify(body) });
const doLogin = (B, email, password, ip) => B.login.POST(loginReq(email, password, ip));
const doSignup = (B, email, ip) => B.signup.POST(jsonReq("/api/signup", { email, password: "Passw0rd-test" }, ip));
const doForgot = (B, email, ip) => B.forgot.POST(jsonReq("/api/auth/forgot-password", { email }, ip));
const doReset = (B, token, ip) => B.reset.POST(jsonReq("/api/auth/reset-password", { token, password: "Passw0rd-new1" }, ip));
const statuses = async (ps) => (await Promise.all(ps)).map((r) => r.status);
const count = (a, s) => a.filter((x) => x === s).length;
const maskDigits = (s) => s.replace(/\d+/g, "N");
async function rowsFor(email, ip) {
  const keys = [...M.guard.loginRules(email, ip), ...M.guard.signupRules(email, ip), ...M.guard.forgotRules(email, ip)].map((r) => r.key);
  const r = await M.db.$client.query("select id, object_type, object_id from app_events where type = 'auth.throttle' and object_id = any($1)", [keys]);
  return r.rows;
}
const goodReset = (userId, hash) => M.makeResetToken(userId, hash);

// ============================================================================================================== R1 login limit
test("R1 login: 8 failures per (account, address) then 429 + Retry-After BEFORE any password check; generic and identical for a nonexistent email", async () => {
  for (const exists of [true, false]) {
    reset_();
    const email = emailOf(), ip = ipOf();
    if (exists) g.__accounts[email] = "right-password";
    const first = [];
    for (let i = 0; i < 8; i++) first.push((await doLogin(M, email, "wrong", ip)).status);
    assert.deepEqual(first, Array(8).fill(200), "the first 8 failures are ordinary Auth.js failures");
    assert.equal(g.__pwChecks, 8);
    const blocked = await doLogin(M, email, exists ? "right-password" : "wrong", ip);
    assert.equal(blocked.status, 429);
    assert.ok(Number(blocked.headers.get("retry-after")) >= 1);
    assert.equal(g.__pwChecks, 8, "no password check happens once throttled, not even for the right password");
    const body = await blocked.json();
    assert.match(body.url, /^http:\/\/localhost:3100\/login\?error=RateLimited&code=\d+$/);
    g[exists ? "__bodyReal" : "__bodyGhost"] = maskDigits(JSON.stringify(body)) + blocked.status;
  }
  assert.equal(g.__bodyReal, g.__bodyGhost, "a real and a non-existent email get the identical throttle answer");
});

test("R1 login: per-address (40) and per-account (30/h) limits exist too", async () => {
  reset_();
  const ip = ipOf();
  const s = [];
  for (let i = 0; i < 41; i++) s.push((await doLogin(M, emailOf(), "wrong", ip)).status); // 41 different accounts, one address
  assert.equal(count(s, 200), 40);
  assert.equal(s[40], 429);
  reset_();
  const email = emailOf();
  const t = [];
  for (let i = 0; i < 31; i++) t.push((await doLogin(M, email, "wrong", ipOf())).status); // one account from 31 different addresses
  assert.equal(count(t, 200), 30);
  assert.equal(t[30], 429);
});

// ================================================================================================ R2 the real user is not locked out by an attacker elsewhere
test("R2 failures from address A do not block the real user on address B", async () => {
  reset_();
  const email = emailOf();
  g.__accounts[email] = "right-password";
  const attacker = ipOf(), home = ipOf();
  for (let i = 0; i < 12; i++) await doLogin(M, email, "guess" + i, attacker);
  assert.equal((await doLogin(M, email, "guess", attacker)).status, 429);
  const ok = await doLogin(M, email, "right-password", home);
  assert.equal(ok.status, 200);
  assert.match(ok.headers.get("set-cookie") ?? "", /authjs\.session-token=abc123/);
});

// ============================================================================================================ R3 success gives its slot back
test("R3 successful logins release their slots; failures keep theirs", async () => {
  reset_();
  const email = emailOf(), ip = ipOf();
  g.__accounts[email] = "right-password";
  for (let i = 0; i < 25; i++) assert.equal((await doLogin(M, email, "right-password", ip)).status, 200, `login ${i}`);
  assert.equal((await rowsFor(email, ip)).length, 0, "25 successes leave no counted slots");
  for (let i = 0; i < 7; i++) await doLogin(M, email, "wrong", ip);
  assert.equal((await doLogin(M, email, "right-password", ip)).status, 200, "8th attempt, correct, still allowed");
  assert.equal((await rowsFor(email, ip)).length, 7 * 3, "only the 7 failures remain (3 keys each)");
});

// ============================================================================================================ denied attempts hold nothing
test("denied attempts write nothing, so a flood cannot extend or hold the lock", async () => {
  reset_();
  const email = emailOf(), ip = ipOf();
  for (let i = 0; i < 8; i++) await doLogin(M, email, "wrong", ip);
  const before = (await rowsFor(email, ip)).length;
  for (let i = 0; i < 50; i++) assert.equal((await doLogin(M, email, "wrong", ip)).status, 429);
  assert.equal((await rowsFor(email, ip)).length, before);
});

test("the window rolls: when the old rows age out the attempt is allowed again", async () => {
  reset_();
  const email = emailOf(), ip = ipOf();
  for (let i = 0; i < 8; i++) await doLogin(M, email, "wrong", ip);
  assert.equal((await doLogin(M, email, "wrong", ip)).status, 429);
  const keys = M.guard.loginRules(email, ip).filter((r) => r.scope === "login.account_ip").map((r) => r.key);
  await M.db.$client.query("update app_events set created_at = now() - interval '16 minutes' where type = 'auth.throttle' and object_id = any($1)", [keys]);
  assert.equal((await doLogin(M, email, "wrong", ip)).status, 200);
});

// ================================================================================================================ R4 login store failure
test("R4 login: limiter store down -> fail open for throttling only; the password is still fully checked", async () => {
  reset_();
  const email = emailOf(), ip = ipOf();
  g.__accounts[email] = "right-password";
  const logged = [];
  const orig = console.error;
  console.error = (...a) => logged.push(a.join(" "));
  try {
    const wrong = await doLogin(D, email, "wrong", ip);
    assert.equal(wrong.status, 200);
    assert.ok(!(wrong.headers.get("set-cookie") ?? "").includes("session-token"), "wrong password gets no session");
    assert.equal(g.__pwChecks, 1, "the password WAS checked");
    const right = await doLogin(D, email, "right-password", ip);
    assert.match(right.headers.get("set-cookie") ?? "", /session-token=abc123/);
    for (let i = 0; i < 30; i++) await doLogin(D, email, "wrong", ip);
    assert.equal(g.__pwChecks, 32, "throttling is off during the outage, checking is not");
  } finally { console.error = orig; }
  assert.ok(logged.some((l) => l.includes("[auth-limiter] FAIL-OPEN flow=login")), "the outage is logged");
});

// ============================================================================================================================ R5 signup
test("R5 signup: burst -> 429 + Retry-After (per email 3, per address 10); store down -> 503 and no account created", async () => {
  reset_();
  const email = emailOf(), ip = ipOf();
  const same = [];
  for (let i = 0; i < 5; i++) same.push(await doSignup(M, email, ip));
  assert.deepEqual(same.map((r) => r.status), [200, 200, 200, 429, 429]);
  assert.ok(Number(same[3].headers.get("retry-after")) >= 1);
  assert.equal(g.__created.length, 3, "only admitted attempts reach account creation (the expensive part)");
  reset_();
  const ip2 = ipOf();
  const many = [];
  for (let i = 0; i < 12; i++) many.push((await doSignup(M, emailOf(), ip2)).status);
  assert.equal(count(many, 200), 10);
  assert.equal(many[10], 429);
  reset_();
  const down = await doSignup(D, emailOf(), ipOf());
  assert.equal(down.status, 503);
  assert.equal(down.headers.get("retry-after"), "30");
  assert.equal(g.__created.length, 0, "fail closed: nothing was created");
});

test("signup keeps its explicit duplicate-email answer (documented residual risk)", async () => {
  reset_();
  const email = emailOf();
  g.__existing.add(email);
  const r = await doSignup(M, email, ipOf());
  assert.equal(r.status, 409);
  assert.match((await r.json()).error, /already exists/);
});

// ================================================================================================================= R6 forgot-password
test("R6 forgot-password: identical response for an existing and an unknown email; mail goes out after the response", async () => {
  reset_();
  const known = emailOf(), unknown = emailOf();
  g.__users[known] = { id: crypto.randomUUID(), email: known, passwordHash: "h" };
  g.__lookupDelay = 400; // a slow account lookup must not show up in the response time
  const t0 = Date.now();
  const a = await doForgot(M, known, ipOf());
  const b = await doForgot(M, unknown, ipOf());
  assert.ok(Date.now() - t0 < 300, "the response does not wait for the account lookup or the send");
  assert.equal(a.status, b.status);
  assert.equal(await a.text(), await b.text());
  assert.deepEqual(g.__mail, [], "nothing sent yet: it happens after the response");
  await Promise.all(g.__after.map((f) => f()));
  assert.deepEqual(g.__mail, [known], "mail only for the account that exists");
});

test("R6 forgot-password: per-address 5/h -> 429 + Retry-After; per-email 3/h -> same generic 200 and no more mail", async () => {
  reset_();
  const ip = ipOf();
  const s = [];
  for (let i = 0; i < 7; i++) s.push(await doForgot(M, emailOf(), ip));
  assert.deepEqual(s.map((r) => r.status), [200, 200, 200, 200, 200, 429, 429]);
  assert.ok(Number(s[5].headers.get("retry-after")) >= 1);
  reset_();
  const email = emailOf();
  g.__users[email] = { id: crypto.randomUUID(), email, passwordHash: "h" };
  const outs = [];
  for (let i = 0; i < 6; i++) outs.push(await doForgot(M, email, ipOf())); // six different addresses, one account
  assert.deepEqual(outs.map((r) => r.status), Array(6).fill(200));
  assert.equal(new Set(await Promise.all(outs.map((r) => r.text()))).size, 1, "silent limit: same body");
  await Promise.all(g.__after.map((f) => f()));
  assert.equal(g.__mail.length, 3, "at most the per-email limit of mails");
  const ghost = emailOf();
  const g1 = [];
  for (let i = 0; i < 6; i++) g1.push(await doForgot(M, ghost, ipOf()));
  assert.deepEqual(g1.map((r) => r.status), Array(6).fill(200), "an unknown email behaves the same at the same point");
});

test("R6 forgot-password: store down -> generic 503, no mail", async () => {
  reset_();
  const email = emailOf();
  g.__users[email] = { id: crypto.randomUUID(), email, passwordHash: "h" };
  const r = await doForgot(D, email, ipOf());
  assert.equal(r.status, 503);
  await Promise.all((g.__after ?? []).map((f) => f()));
  assert.deepEqual(g.__mail, []);
});

// ================================================================================================================== R7 reset-password
test("R7 reset-password: per-address 10/h -> 429; store down -> 503, password unchanged (per-user budget: see R19)", async () => {
  reset_();
  const ip = ipOf();
  const s = [];
  for (let i = 0; i < 12; i++) s.push((await doReset(M, "garbage-token-" + i, ip)).status);
  assert.equal(count(s, 400), 10, "garbage tokens use up the address budget too");
  assert.deepEqual(s.slice(10), [429, 429]);
  reset_();
  const fresh = { id: crypto.randomUUID(), email: emailOf(), passwordHash: "hash-2" };
  g.__users.x = fresh;
  const down = await doReset(D, goodReset(fresh.id, fresh.passwordHash), ipOf());
  assert.equal(down.status, 503);
  assert.deepEqual(g.__updated, [], "fail closed: the password was not changed");
  const ok = await doReset(M, goodReset(fresh.id, fresh.passwordHash), ipOf());
  assert.equal(ok.status, 200);
  assert.deepEqual(g.__updated, [fresh.id]);
});

// =============================================================================================================== R8 concurrency/recovery
test("R8 parallel burst: exactly the limit is admitted (no over-admit, no over-deny) and the next legitimate attempt works", async () => {
  reset_();
  const email = emailOf(), ip = ipOf(), other = emailOf();
  g.__accounts[other] = "right-password";
  const s = await statuses(Array.from({ length: 80 }, () => doLogin(M, email, "wrong", ip)));
  assert.equal(count(s, 200), 8, "admitted exactly 8 of 80");
  assert.equal(count(s, 429), 72);
  assert.equal(g.__pwChecks, 8, "only the admitted ones reached the password check");
  assert.equal((await doLogin(M, other, "right-password", ip)).status, 200, "another account on the same address is untouched");
  reset_();
  const ip2 = ipOf();
  const sg = await statuses(Array.from({ length: 300 }, () => doSignup(M, emailOf(), ip2)));
  assert.equal(count(sg, 200), 10, "admitted exactly 10 of 300");
  assert.equal(g.__created.length, 10);
  reset_();
  const fp = ipOf();
  const ff = await statuses(Array.from({ length: 40 }, () => doForgot(M, emailOf(), fp)));
  assert.equal(count(ff, 200), 5);
  assert.equal(count(ff, 429), 35);
});

test("R8 recovery: after the window passes the same account and address work again, and the store recovers by itself", async () => {
  reset_();
  const email = emailOf(), ip = ipOf();
  g.__accounts[email] = "right-password";
  await Promise.all(Array.from({ length: 30 }, () => doLogin(M, email, "wrong", ip)));
  assert.equal((await doLogin(M, email, "right-password", ip)).status, 429);
  await M.db.$client.query("update app_events set created_at = now() - interval '2 hours' where type = 'auth.throttle' and object_id = any($1)", [M.guard.loginRules(email, ip).map((r) => r.key)]);
  assert.equal((await doLogin(M, email, "right-password", ip)).status, 200);
  // a store outage ends: the very next request is throttled normally again, no restart, no stuck state
  assert.equal((await doLogin(D, email, "wrong", ip)).status, 200);
  assert.equal(count(await statuses(Array.from({ length: 10 }, () => doLogin(M, email, "wrong", ip))), 429) > 0, true);
});

// ====================================================================================================================== R9 only hashes
test("R9 only salted hashes are stored: no email, no address, no raw secret", async () => {
  reset_();
  const email = "Hash.Check." + rnd() + "@Example.com", ip = ipOf();
  await doLogin(M, email, "wrong-password-xyz", ip);
  await doSignup(M, email, ip);
  await doForgot(M, email, ip);
  await doReset(M, "tok-" + rnd(), ip);
  const rows = (await M.db.$client.query("select * from app_events where type = 'auth.throttle' order by created_at desc limit 60")).rows;
  assert.ok(rows.length > 0);
  const blob = JSON.stringify(rows).toLowerCase();
  for (const secret of [email.toLowerCase(), "hash.check", ip, "wrong-password-xyz", ip.split(".").join("")]) assert.ok(!blob.includes(secret), `leaked ${secret}`);
  for (const r of rows) {
    assert.match(r.object_id, /^[0-9a-f]{32}$/);
    assert.equal(r.user_id, null);
    assert.equal(r.metadata, null);
    assert.equal(r.path, null);
  }
  assert.equal(M.guard.loginRules("A@X.com ", "1.2.3.4")[0].key, M.guard.loginRules("a@x.com", "1.2.3.4")[0].key, "email is normalised");
});

test("no address -> no address keys and no shared 'unknown' bucket", async () => {
  reset_();
  assert.deepEqual(M.guard.loginRules("a@x.com", null).map((r) => r.scope), ["login.account"]);
  assert.deepEqual(M.guard.signupRules("a@x.com", null).map((r) => r.scope), ["signup.email"]);
  assert.deepEqual(M.guard.forgotRules("a@x.com", null).map((r) => r.scope), ["forgot.email"]);
  assert.deepEqual(M.guard.resetRules(null, null), []);
  assert.deepEqual(M.guard.loginRules("", "1.2.3.4").map((r) => r.scope), ["login.ip"], "an empty email gets no shared account bucket");
  const s = await statuses(Array.from({ length: 50 }, () => doLogin(M, emailOf(), "wrong", null)));
  assert.equal(count(s, 429), 0, "fifty strangers with no address do not throttle one another");
});

test("housekeeping: old counter rows are pruned, recent ones are not", async () => {
  const keyOld = "ffffffffffffffffffffffffffffff01", keyNew = "ffffffffffffffffffffffffffffff02";
  await M.db.$client.query("insert into app_events (id, type, object_type, object_id, created_at) values ($1,'auth.throttle','t',$2, now() - interval '4 hours'), ($3,'auth.throttle','t',$4, now())", [crypto.randomUUID(), keyOld, crypto.randomUUID(), keyNew]);
  await M.guard.pruneThrottleRows();
  const left = (await M.db.$client.query("select object_id from app_events where object_id = any($1)", [[keyOld, keyNew]])).rows.map((r) => r.object_id);
  assert.deepEqual(left, [keyNew]);
  await M.db.$client.query("delete from app_events where object_id = $1", [keyNew]);
});

// ===================================================================================================================== R10 wiring
test("R10 every credential route calls the guard; login only guards the credentials callback", () => {
  const read = (p) => fs.readFileSync(path.join(ROOT, p), "utf8");
  const routes = {
    "src/app/api/signup/route.ts": /signupRules\(/,
    "src/app/api/auth/forgot-password/route.ts": /forgotRules\(/,
    "src/app/api/auth/reset-password/route.ts": /resetRules\(/,
    "src/app/api/auth/[...nextauth]/route.ts": /loginRules\(/,
  };
  for (const [file, rule] of Object.entries(routes)) {
    const src = read(file);
    assert.match(src, /from "@\/lib\/authGuard"/, `${file} imports the guard`);
    assert.match(src, rule, `${file} builds its rules`);
    assert.match(src, /await reserve\(/, `${file} reserves before doing the work`);
  }
  const login = read("src/app/api/auth/[...nextauth]/route.ts");
  assert.match(login, /endsWith\("\/callback\/credentials"\)/);
  assert.match(login, /FAIL-OPEN/);
  assert.ok(login.indexOf("await reserve(") < login.indexOf("await handlers.POST(new NextRequest("), "reserve happens before the password check is delegated");
  assert.ok(!/handlers\.POST\(req\)\s*;?\s*\n\s*(let|const|try)/.test(login.slice(login.indexOf("parseLoginBody(req)"))), "Auth.js is never handed the original request body after parsing");
  for (const f of ["src/app/api/signup/route.ts", "src/app/api/auth/forgot-password/route.ts", "src/app/api/auth/reset-password/route.ts"]) {
    assert.match(read(f), /temporarilyUnavailable\(/, `${f} fails closed`);
  }
  assert.match(read("src/app/api/auth/forgot-password/route.ts"), /after\(async/, "forgot-password mails after the response");
});


// =====================================================================================================================================
// REMEDIATION (review findings H1, H2 and the abuse-resistance items). Each test below is the permanent regression for one confirmed
// failure; every one of them was run red against e057809 first (docs/auth/ABUSE-CONTROLS.md, "Review remediation").
// =====================================================================================================================================
const LOGIN_URL = "http://localhost:3100/api/auth/callback/credentials";
const rawLogin = (body, contentType, ip) => new Request(LOGIN_URL, { method: "POST", headers: headers(ip, contentType ? { "content-type": contentType } : {}), body });
const FORM = "application/x-www-form-urlencoded";
const formPairs = (pairs, ip) => M.login.POST(rawLogin(new URLSearchParams(pairs).toString(), FORM, ip));
const jsonBody = (obj, ip) => M.login.POST(rawLogin(JSON.stringify(obj), "application/json", ip));
const guessJson = (email, n, ip) => jsonBody({ csrfToken: "x", email, password: "guess" + n }, ip);
const guessForm = (email, n, ip) => formPairs([["csrfToken", "x"], ["email", email], ["password", "guess" + n]], ip);

test("R16 a JSON login body is counted against the account like a form body (was: skipped every account limit)", async () => {
  reset_();
  const email = emailOf(), ip = ipOf();
  g.__accounts[email] = "right-password";
  const s = [];
  for (let i = 0; i < 12; i++) s.push((await guessJson(email, i, ip)).status);
  assert.equal(count(s, 429), 4, "the 9th JSON guess onward is throttled, exactly like form guesses");
  assert.equal(g.__pwChecks, 8, "only 8 reached the password check");
  const ok = await jsonBody({ csrfToken: "x", email, password: "right-password" }, ipOf());
  assert.match(ok.headers.get("set-cookie") ?? "", /session-token=abc123/, "the real owner on another address still gets in");
});

test("R16 JSON and form attempts share ONE budget for the account", async () => {
  reset_();
  const email = emailOf(), ip = ipOf();
  for (let i = 0; i < 4; i++) await guessJson(email, i, ip);
  for (let i = 4; i < 8; i++) await guessForm(email, i, ip);
  assert.equal((await guessForm(email, 9, ip)).status, 429);
  assert.equal((await guessJson(email, 9, ip)).status, 429);
  assert.equal(g.__pwChecks, 8);
});

test("R16 per-account limit (30/h) holds across addresses for JSON bodies (the distributed attack from the review)", async () => {
  reset_();
  const email = emailOf();
  const s = [];
  for (let i = 0; i < 35; i++) s.push((await guessJson(email, i, ipOf())).status);
  assert.equal(count(s, 429), 5);
  assert.equal(g.__pwChecks, 30);
});

test("R17 a duplicate email field cannot split what the limiter counts from what Auth.js authenticates", async () => {
  reset_();
  const victim = emailOf(), ip = ipOf();
  g.__accounts[victim] = "right-password";
  const s = [];
  for (let i = 0; i < 12; i++) s.push((await formPairs([["csrfToken", "x"], ["email", emailOf()], ["email", victim], ["password", "guess" + i]], ip)).status);
  assert.equal(g.__authSaw.filter((a) => a.email.toLowerCase() === victim).length, 0, "Auth.js never authenticates an ambiguous request");
  assert.equal(count(s, 400), 12, "every ambiguous request is rejected, never evaluated");
  assert.equal((await M.db.$client.query("select count(*) n from app_events where type='auth.throttle' and object_id = any($1)", [M.guard.loginRules("", ip).map((r) => r.key)])).rows[0].n, "12", "and each is charged to the address, so they cannot be sprayed");
  reset_();
  const s2 = [];
  for (let i = 0; i < 4; i++) s2.push((await formPairs([["csrfToken", "x"], ["email", victim], ["email", emailOf()], ["password", "g" + i]], ipOf())).status);
  assert.deepEqual(s2, [400, 400, 400, 400], "first-wins and last-wins orderings are both refused");
  assert.equal(g.__pwChecks, 0);
});

test("limiter and Auth.js operate on the same canonical identity (case, whitespace, encoding)", async () => {
  reset_();
  const base = emailOf(), ip = ipOf();
  g.__accounts[base] = "right-password";
  const variants = [base.toUpperCase(), ` ${base} `, base[0].toUpperCase() + base.slice(1), base, `\t${base}\n`, base.toUpperCase(), base, base];
  for (let i = 0; i < variants.length; i++) await (i % 2 ? guessForm : guessJson)(variants[i], i, ip);
  assert.equal(g.__pwChecks, 8);
  assert.ok(g.__authSaw.every((a) => a.email === base), "Auth.js is handed the canonical (trimmed, lower-cased) email, not the raw spelling");
  assert.equal((await guessForm(base.toUpperCase(), 99, ip)).status, 429, "every spelling is the same account");
  assert.equal((await rowsFor(base, ip)).length, 8 * 3);
});

test("ambiguous or unreadable login bodies are refused safely: generic 400, no password check, charged to the address", async () => {
  const bad = [
    ["duplicate password", () => formPairs([["csrfToken", "x"], ["email", "a@x.com"], ["password", "p"], ["password", "q"]], ip)],
    ["duplicate csrfToken", () => formPairs([["csrfToken", "x"], ["csrfToken", "y"], ["email", "a@x.com"], ["password", "p"]], ip)],
    ["JSON email is an array", () => jsonBody({ csrfToken: "x", email: ["a@x.com", "b@x.com"], password: "p" }, ip)],
    ["JSON email is an object", () => jsonBody({ csrfToken: "x", email: { v: "a@x.com" }, password: "p" }, ip)],
    ["JSON email is a number", () => jsonBody({ csrfToken: "x", email: 5, password: "p" }, ip)],
    ["JSON password is not a string", () => jsonBody({ csrfToken: "x", email: "a@x.com", password: ["p"] }, ip)],
    ["JSON body is an array", () => jsonBody([{ email: "a@x.com", password: "p" }], ip)],
    ["JSON is invalid", () => M.login.POST(rawLogin("{not json", "application/json", ip))],
    ["multipart", () => M.login.POST(rawLogin("--b\r\ncontent-disposition: form-data; name=\"email\"\r\n\r\na@x.com\r\n--b--", "multipart/form-data; boundary=b", ip))],
    ["text/plain", () => M.login.POST(rawLogin("email=a@x.com&password=p", "text/plain", ip))],
    ["no content type", () => M.login.POST(rawLogin("email=a@x.com&password=p", null, ip))],
    ["empty body", () => M.login.POST(rawLogin("", FORM, ip))],
    ["email missing", () => formPairs([["csrfToken", "x"], ["password", "p"]], ip)],
    ["email only whitespace", () => formPairs([["csrfToken", "x"], ["email", "   "], ["password", "p"]], ip)],
    ["oversized body", () => M.login.POST(rawLogin("email=a%40x.com&password=" + "p".repeat(40_000), FORM, ip))],
  ];
  var ip;
  for (const [name, send] of bad) {
    reset_();
    ip = ipOf();
    const r = await send();
    assert.equal(r.status, 400, name);
    assert.match((await r.json()).url, /\/login\?error=CredentialsSignin$/, `${name}: same generic shape as a failed login`);
    assert.equal(g.__pwChecks, 0, `${name}: no password check`);
    assert.equal(g.__authSaw.length, 0, `${name}: never handed to Auth.js`);
  }
  reset_();
  ip = ipOf();
  const s = [];
  for (let i = 0; i < 43; i++) s.push((await formPairs([["csrfToken", "x"], ["password", "p"]], ip)).status);
  assert.equal(count(s, 400), 40, "malformed requests spend the per-address budget (40)");
  assert.deepEqual(s.slice(40), [429, 429, 429]);
});

test("a well-formed request in every accepted encoding still reaches Auth.js with the right identity", async () => {
  reset_();
  const email = emailOf();
  g.__accounts[email] = "right-password";
  const ok1 = await jsonBody({ csrfToken: "x", email, password: "right-password", callbackUrl: "/garage", json: "true" }, ipOf());
  const ok2 = await formPairs([["csrfToken", "x"], ["email", email], ["password", "right-password"], ["json", "true"]], ipOf());
  const ok3 = await M.login.POST(rawLogin(new URLSearchParams({ csrfToken: "x", email: email.toUpperCase(), password: "right-password" }).toString(), "Application/X-WWW-Form-Urlencoded; charset=UTF-8", ipOf()));
  for (const r of [ok1, ok2, ok3]) assert.match(r.headers.get("set-cookie") ?? "", /session-token=abc123/);
  assert.equal((await rowsFor(email, null)).length, 0, "successes released");
  assert.deepEqual(g.__authSaw.map((a) => a.email), [email, email, email]);
});

test("R19 reset-password: forged tokens never spend a user's budget; verified tokens do (10/h)", async () => {
  reset_();
  const user = { id: crypto.randomUUID(), email: emailOf(), passwordHash: "hash-1" };
  g.__users[user.email] = user;
  for (let i = 0; i < 15; i++) assert.equal((await doReset(M, goodReset(user.id, "forged-hash-" + i), ipOf())).status, 400);
  const real = await doReset(M, goodReset(user.id, user.passwordHash), ipOf());
  assert.equal(real.status, 200, "the real owner is not locked out by someone forging tokens that name their id");
  assert.deepEqual(g.__updated, [user.id]);
  reset_();
  const user2 = { id: crypto.randomUUID(), email: emailOf(), passwordHash: "hash-2" };
  g.__users.k = user2; // updatePassword is a stub here, so the same token keeps verifying: the per-user budget is observable
  const t = [];
  for (let i = 0; i < 12; i++) t.push((await doReset(M, goodReset(user2.id, user2.passwordHash), ipOf())).status);
  assert.deepEqual(t, [...Array(10).fill(200), 429, 429], "verified resets are capped at 10/h per user");
});

test("R19 reset-password: store down at either step still fails closed", async () => {
  reset_();
  const user = { id: crypto.randomUUID(), email: emailOf(), passwordHash: "hash-3" };
  g.__users.k = user;
  assert.equal((await doReset(D, goodReset(user.id, user.passwordHash), ipOf())).status, 503);
  assert.deepEqual(g.__updated, []);
});

// ---- bounded waiting: lock timeout, in-process queues, pool footprint ---------------------------------------------------------
async function holdLock(key) {
  const c = new pg.Client({ connectionString: process.env.DATABASE_URL });
  await c.connect();
  await c.query("select pg_advisory_lock(hashtextextended($1, 0))", [key]);
  return async () => { await c.query("select pg_advisory_unlock_all()"); await c.end(); };
}

test("R20 a lock held elsewhere is bounded by lock_timeout and DENIES (never fails open, never hangs)", async () => {
  for (const flow of ["login", "signup", "forgot", "reset"]) {
    reset_();
    const email = emailOf(), ip = ipOf();
    g.__accounts[email] = "right-password";
    const user = { id: crypto.randomUUID(), email, passwordHash: "h" };
    g.__users[email] = user;
    const rules = { login: M.guard.loginRules(email, ip), signup: M.guard.signupRules(email, ip), forgot: M.guard.forgotRules(email, ip), reset: M.guard.resetRules(null, ip) }[flow];
    const unlock = await holdLock(rules[0].key);
    try {
      const t0 = Date.now();
      const r = { login: () => doLogin(M, email, "right-password", ip), signup: () => doSignup(M, email, ip), forgot: () => doForgot(M, email, ip), reset: () => doReset(M, goodReset(user.id, "h"), ip) }[flow]();
      const res = await r;
      const took = Date.now() - t0;
      assert.equal(res.status, 429, `${flow}: contention denies`);
      assert.ok(Number(res.headers.get("retry-after")) >= 1, `${flow}: Retry-After present`);
      assert.ok(took >= 1000 && took < 6000, `${flow}: waited about lock_timeout, not forever (took ${took} ms)`);
      assert.equal(g.__pwChecks, 0, `${flow}: no password check while the limiter could not decide`);
      assert.deepEqual(g.__created, [], `${flow}: nothing created`);
      assert.deepEqual(g.__updated, [], `${flow}: nothing changed`);
      await Promise.all((g.__after ?? []).map((f) => f()));
      assert.deepEqual(g.__mail, [], `${flow}: no mail`);
    } finally { await unlock(); }
    if (flow === "login") assert.equal((await doLogin(M, email, "right-password", ip)).status, 200, "recovers the moment the lock is gone");
  }
});

test("R20 a flood on ONE key queues in memory: bounded database footprint, exact admission, unrelated users unaffected", async () => {
  reset_();
  M.guard.resetLimiterStats();
  const email = emailOf(), ip = ipOf(), other = emailOf();
  g.__accounts[other] = "right-password";
  const flood = Array.from({ length: 150 }, () => doLogin(M, email, "wrong", ip));
  await new Promise((r) => setTimeout(r, 30));
  const t0 = Date.now();
  const unrelated = await doLogin(M, other, "right-password", ipOf());
  const unrelatedMs = Date.now() - t0;
  const s = await statuses(flood);
  assert.equal(unrelated.status, 200);
  assert.ok(unrelatedMs < 400, `an unrelated user is not queued behind the flood (took ${unrelatedMs} ms)`);
  assert.equal(count(s, 200), 8, "still exactly the limit admitted");
  const st = M.guard.limiterStats();
  assert.ok(st.maxConcurrentTx <= M.guard.BOUNDS.maxConcurrentTx, `database transactions in flight never exceed the cap (saw ${st.maxConcurrentTx})`);
  assert.ok(M.guard.BOUNDS.maxConcurrentTx < 10, "the cap leaves headroom in the default pool of 10");
});

test("R20 beyond the per-key waiting room the answer is an immediate, bounded denial", async () => {
  reset_();
  M.guard.resetLimiterStats();
  const email = emailOf(), ip = ipOf();
  const n = M.guard.BOUNDS.maxWaitersPerKey + 120;
  const s = await statuses(Array.from({ length: n }, () => doLogin(M, email, "wrong", ip)));
  assert.equal(count(s, 200), 8, "admission is still never above the limit");
  assert.equal(count(s, 200) + count(s, 429), n, "every request gets an answer");
  assert.ok(M.guard.limiterStats().busyDenials > 0, "the overflow was shed as busy, not queued without bound");
});

// ---- growth -----------------------------------------------------------------------------------------------------------------
test("pruning is bounded per call and eventually clears old rows", async () => {
  const total = M.guard.PRUNE_BATCH * 2 + 123;
  const tag = "ffffffff" + rnd();
  await M.db.$client.query("insert into app_events (id, type, object_type, object_id, created_at) select $1 || g, 'auth.throttle', 't', $2, now() - interval '5 hours' from generate_series(1, $3) g", [tag, tag.padEnd(32, "0").slice(0, 32), total]);
  const left = async () => Number((await M.db.$client.query("select count(*) n from app_events where id like $1", [tag + "%"])).rows[0].n);
  assert.equal(await left(), total);
  await M.guard.pruneThrottleRows();
  assert.ok((await left()) >= total - M.guard.PRUNE_BATCH, "one call deletes at most one batch");
  for (let i = 0; i < 4; i++) await M.guard.pruneThrottleRows();
  assert.equal(await left(), 0);
});
