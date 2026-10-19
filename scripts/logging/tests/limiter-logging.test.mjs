import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import util from "node:util";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

// Auth-limiter and pool failure logging (Build 104-H). These files are introduced by the auth-throttling PR (#81): src/lib/authGuard.ts,
// src/lib/limiterDb.ts and the idle-error handler in src/db/index.ts. None exist on main yet, so each test is SKIPPED where its file (or
// the handler) is absent and runs, red then green, on any tree that carries #81. They bundle the REAL modules; only `pg` and `@/db` are
// stubbed. Sites covered:
//   authGuard.logLimiterFailure   logged err.message of whatever the limiter threw
//   authGuard.release             logged the raw error object
//   limiterDb.withLimiterClient   wrapped a database error as LimiterStoreError(err.message): the message is drizzle's SQL + parameters
//   limiterDb pool 'error'        logged err.message of an idle-connection failure (a network error names the database host and port)
//   db/index.ts pool 'error'      same, for the application pool
// Contract:
//   * every log keeps its subsystem tag and the wording operators grep for ("FAIL-OPEN flow=login", "FAIL-CLOSED flow=signup", ...)
//   * database / network errors log class + short code only: never SQL, bound parameters, ids, emails, hashes, addresses or credentials
//   * developer-written messages ("no trustworthy client address", "limiter work exceeded 1500 ms") still log in full
//   * behaviour is unchanged: the same error types are thrown, the same policies apply
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const has = (f) => fs.existsSync(path.join(ROOT, f));
const skipFor = (f) => (has(f) ? false : `${f} is not on this branch (it lands with PR #81); this regression runs on the integrated tree`);
const require = createRequire(import.meta.url);

const EMAIL = "victim.customer@example.org";
const USER_ID = "f4398701-5a0c-4882-a97e-0411534e417a";
const HASH = "$2b$12$abcdefghijklmnopqrstuuABCDEFGHIJKLMNOPQRSTUVWXYZ0123456";
const HOST = "db.internal.example";
const CREDS = "s3cretPassw0rd";
const LEAK = /Failed query|select "|insert into|delete from|params:|postgres(ql)?:\/\//i;
class DrizzleQueryError extends Error {
  constructor(query, params, cause) { super(`Failed query: ${query}\nparams: ${params.join(",")}`); this.name = "DrizzleQueryError"; this.query = query; this.params = params; this.cause = cause; }
}
const pgError = (code) => Object.assign(new Error("terminating connection due to administrator command"), { name: "error", code, severity: "ERROR" });
const sqlFailure = (code = "57P01") =>
  new DrizzleQueryError('insert into "app_events" ("id","type","key") values ($1,$2,$3)', [USER_ID, "auth.throttle", `signup:${EMAIL}`, HASH], pgError(code));
const netError = () => Object.assign(new Error(`connect ECONNREFUSED ${HOST}:5432 (user=app password=${CREDS})`), { code: "ECONNREFUSED", syscall: "connect", address: HOST, port: 5432 });

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
  for (const s of [EMAIL, USER_ID, HASH, HOST, CREDS]) assert.ok(!t.includes(s), `"${s}" leaked:\n${t}`);
  assert.doesNotMatch(t, LEAK, `SQL / parameters leaked:\n${t}`);
  assert.doesNotMatch(t, /node_modules|\.next[\\/]/, `stack frames leaked:\n${t}`);
};

// ---- bundle helper ---------------------------------------------------------------------------------------------------------------
const esbuild = require("esbuild");
const POOLS = (globalThis.__lim = { pools: [], connectImpl: null });
const stubPlugin = {
  name: "stubs",
  setup(b) {
    b.onResolve({ filter: /^(pg|@\/db|drizzle-orm\/node-postgres)$/ }, (a) => ({ path: a.path, namespace: "stub" }));
    b.onLoad({ filter: /.*/, namespace: "stub" }, (a) => {
      if (a.path === "pg") {
        return { loader: "js", contents: `
          const S = globalThis.__lim;
          export class Pool { constructor(o) { this.h = {}; this.o = o; S.pools.push(this); this.totalCount = 0; this.idleCount = 0; this.waitingCount = 0; }
            on(e, f) { (this.h[e] ||= []).push(f); return this; }
            async connect() { return S.connectImpl(); } async end() {} }
          export default { Pool };` };
      }
      if (a.path === "drizzle-orm/node-postgres") return { loader: "js", contents: "export const drizzle = (c) => ({ $client: c, delete: () => ({ where: async () => { throw globalThis.__lim.work(); } }), execute: async () => { throw globalThis.__lim.work(); } });" };
      return { loader: "js", contents: "export const db = {};" };
    });
  },
};
async function bundle(entry) {
  const out = await esbuild.build({ entryPoints: [path.join(ROOT, entry)], tsconfig: path.join(ROOT, "tsconfig.json"), bundle: true, format: "cjs", platform: "node", write: false, plugins: [stubPlugin], external: ["next", "next/*", "drizzle-orm", "drizzle-orm/pg-core"], logLevel: "silent" });
  const m = { exports: {} };
  new Function("module", "exports", "require", out.outputFiles[0].text)(m, m.exports, require);
  return m.exports;
}
const fakeClient = () => ({ query: async () => ({ rows: [] }), release() {}, on() {} });

const guardFile = "src/lib/authGuard.ts";
const dbFile = "src/db/index.ts";
// main's db/index.ts has no pool error handler at all; #81 adds it. The test runs only where the handler exists.
const dbHandlerPresent = has(dbFile) && /pool\.on\(\s*"error"/.test(fs.readFileSync(path.join(ROOT, dbFile), "utf8"));
const dbSkip = dbHandlerPresent ? false : "src/db/index.ts has no pool error handler on this branch (it lands with PR #81); this regression runs on the integrated tree";
const guard = has(guardFile) ? await bundle(guardFile) : null;
const limiterMod = has("src/lib/limiterDb.ts") ? await bundle("src/lib/limiterDb.ts") : null;

const poolHandlerAtDb = () => {
  const before = POOLS.pools.length;
  // built from parts: a throwaway test value, and not a credential-shaped literal in the source
  const u = new URL("postgres://placeholder@localhost:5432/crankcase");
  u.username = "app"; u.password = CREDS; u.hostname = HOST;
  Object.assign(process.env, { DATABASE_URL: u.toString() });
  return bundle(dbFile).then(() => POOLS.pools.slice(before));
};

// ---- authGuard -------------------------------------------------------------------------------------------------------------------
test("limiter: logLimiterFailure for a database error keeps the mode, flow and class + code, and nothing else", { skip: skipFor(guardFile) }, () => {
  try {
    guard.logLimiterFailure("signup", "FAIL-CLOSED", sqlFailure("57P01"));
    const t = text();
    assert.match(t, /\[auth-limiter\] FAIL-CLOSED flow=signup/, "the greppable prefix is kept");
    assert.match(t, /57P01/, "the code is kept");
    clean(t);
  } finally { restore(); }
});

test("limiter: logLimiterFailure for a LimiterStoreError that wraps a database error does not log the wrapped SQL", { skip: skipFor("src/lib/limiterDb.ts") }, async () => {
  POOLS.connectImpl = async () => fakeClient();
  POOLS.work = () => sqlFailure("57P01");
  try {
    const err = await limiterMod.withLimiterClient((d) => d.execute("x"), { deadlineMs: 2000 }).then(() => null, (e) => e);
    assert.ok(err instanceof limiterMod.LimiterStoreError, "still reported as a store failure");
    assert.equal(err.kind ?? err.reason ?? err.type ?? "connection", "connection");
    // the thrown error's own message must not carry the SQL (it is what every caller logs)
    assert.doesNotMatch(err.message, LEAK, `the wrapper's message carries SQL: ${err.message}`);
    for (const s of [EMAIL, USER_ID, HASH]) assert.ok(!err.message.includes(s), `"${s}" is in the wrapper's message`);
    guard.logLimiterFailure("login", "FAIL-OPEN", err);
    const t = text();
    assert.match(t, /\[auth-limiter\] FAIL-OPEN flow=login/);
    clean(t);
  } finally { restore(); }
});

test("limiter: logLimiterFailure for a network error does not log the database address or credentials", { skip: skipFor(guardFile) }, () => {
  try {
    guard.logLimiterFailure("login", "FAIL-OPEN", netError());
    const t = text();
    assert.match(t, /\[auth-limiter\] FAIL-OPEN flow=login/);
    assert.match(t, /ECONNREFUSED/);
    clean(t);
  } finally { restore(); }
});

test("limiter: developer-written messages still log in full", { skip: skipFor(guardFile) }, () => {
  try {
    guard.logLimiterFailure("login", "FAIL-OPEN", new Error("no trustworthy client address"));
    guard.logLimiterFailure("signup", "FAIL-CLOSED", new (limiterMod ?? guard).LimiterStoreError("limiter work exceeded 1500 ms", "deadline"));
    const t = text();
    assert.match(t, /FAIL-OPEN flow=login no trustworthy client address/);
    assert.match(t, /FAIL-CLOSED flow=signup limiter work exceeded 1500 ms/);
  } finally { restore(); }
});

test("limiter: a failed release logs the tag and class + code only (no SQL, no reservation ids)", { skip: skipFor("src/lib/limiterDb.ts") }, async () => {
  POOLS.connectImpl = async () => fakeClient();
  POOLS.work = () => sqlFailure("57P01");
  try {
    await assert.doesNotReject(guard.release({ ids: [USER_ID, "c1c2c3c4-0000-4000-8000-000000000001"] }), "release stays best-effort and never throws");
    const t = text();
    assert.match(t, /\[auth-limiter\] release failed; the slots will age out/);
    assert.match(t, /57P01/);
    clean(t);
  } finally { restore(); }
});

// ---- limiterDb pool --------------------------------------------------------------------------------------------------------------
test("limiter pool: an idle-connection error logs class + code only (no host, port or credentials)", { skip: skipFor("src/lib/limiterDb.ts") }, async () => {
  POOLS.connectImpl = async () => fakeClient();
  POOLS.work = () => sqlFailure("57P01");
  try {
    const before = POOLS.pools.length;
    await limiterMod.withLimiterClient((d) => d.execute("x"), { deadlineMs: 2000 }).catch(() => undefined);
    const pool = POOLS.pools.slice(before).at(-1) ?? POOLS.pools.at(-1);
    assert.ok(pool?.h.error?.length, "the pool has an error listener (an unhandled idle error would crash the process)");
    logs.length = 0;
    for (const h of pool.h.error) h(netError());
    const t = text();
    assert.match(t, /\[auth-limiter\] idle connection error \(connection discarded\)/, "the tag and wording are kept");
    assert.match(t, /ECONNREFUSED/);
    clean(t);
  } finally { restore(); }
});

// ---- db/index.ts pool ------------------------------------------------------------------------------------------------------------
test("app pool: an idle-connection error logs class + code only (no host, port or credentials)", { skip: dbSkip }, async () => {
  try {
    const pools = await poolHandlerAtDb();
    const pool = pools.at(-1);
    if (!pool || !pool.h.error?.length) { assert.fail("src/db/index.ts has no pool 'error' listener (an unhandled idle error would crash the process)"); }
    logs.length = 0;
    for (const h of pool.h.error) h(netError());
    const t = text();
    assert.match(t, /\[db\] idle connection error \(connection discarded\)/, "the tag and wording are kept");
    assert.match(t, /ECONNREFUSED/);
    clean(t);
  } finally { restore(); }
});
