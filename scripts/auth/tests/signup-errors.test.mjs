import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import util from "node:util";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

// Signup error handling (Build 104-E). Bundles the REAL src/app/api/signup/route.ts and the REAL src/lib/users.ts; only the database
// handle (@/db) and the event recorder (@/lib/events) are stubbed, so the route's and createUser's own decisions are what is tested.
// Errors are shaped exactly like drizzle's DrizzleQueryError (message = SQL + params including the bcrypt hash, `cause` = the pg error).
//   * duplicate email (pre-check hit OR a unique-violation race) -> 409 with the plain customer message, nothing else
//   * any other database failure -> 503 with a customer-safe message; never SQL, schema, hashes, params or stack text
//   * the SERVER LOG keeps a diagnosable record (code, error class) but never the SQL, the params, the email or the hash
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const require = createRequire(import.meta.url);
const esbuild = require("esbuild");

const S = (globalThis.__su = { existing: [], selectError: null, insertError: null });
const stubs = {
  "@/db": `
    const S = globalThis.__su;
    export const db = {
      select() { return { from() { return { where() { return { limit: async () => { if (S.selectError) throw S.selectError; return S.existing; } }; } }; } }; },
      insert() { return { values() { return { returning: async () => { throw S.insertError; } }; } }; },
    };`,
  "@/lib/events": `export const EVENT_TYPES = { USER_SIGNED_UP: "user.signed_up" }; export async function recordEvent() {}`,
};
const stubPlugin = {
  name: "stubs",
  setup(b) {
    b.onResolve({ filter: /^@\/(db|lib\/events)$/ }, (a) => ({ path: a.path, namespace: "stub" }));
    b.onLoad({ filter: /.*/, namespace: "stub" }, (a) => ({ contents: stubs[a.path], loader: "js" }));
  },
};
const out = await esbuild.build({ entryPoints: [path.join(ROOT, "src/app/api/signup/route.ts")], tsconfig: path.join(ROOT, "tsconfig.json"), bundle: true, format: "cjs", platform: "node", write: false, plugins: [stubPlugin], external: ["next", "next/*"], logLevel: "silent" });
const mod = { exports: {} };
new Function("module", "exports", "require", out.outputFiles[0].text)(mod, mod.exports, require);
const { POST } = mod.exports;

const EMAIL = "victim.customer@example.com";
const GOOD_PW = ["a", "long", "enough", "pw"].join("-"); // throwaway, built in pieces so credential scanners do not flag a literal
const HASH = "$2b$12$Zx3Q9mWqVbT1uYkE8a1d2eHcLx0pRfGq7sJvNn4oUwYhKiTtPzCyS";
const DUPLICATE = "An account with that email already exists.";
const LEAK = /Failed query|insert into|select "|from "users"|params:|\$2[aby]\$|password_hash|users_email|duplicate key|violates|ECONNREFUSED|connection (terminated|refused)|node_modules|postgres(ql)?:\/\//i;

class DrizzleQueryError extends Error {
  constructor(query, params, cause) { super(`Failed query: ${query}\nparams: ${params.join(",")}`); this.name = "DrizzleQueryError"; this.query = query; this.params = params; this.cause = cause; }
}
const pgError = (code, message) => Object.assign(new Error(message), { name: "error", code, severity: "ERROR" });
const insertSql = 'insert into "users" ("id", "email", "password_hash") values ($1, $2, $3) returning "id", "email", "password_hash"';
const selectSql = 'select "id", "email", "password_hash" from "users" where "users"."email" = $1 limit $2';

let logs;
const realError = console.error, realWarn = console.warn, realLog = console.log;
beforeEach(() => {
  S.existing = []; S.selectError = null; S.insertError = null; logs = [];
  const grab = (...a) => logs.push(a.map((x) => util.inspect(x, { depth: 8, breakLength: Infinity })).join(" "));
  console.error = grab; console.warn = grab; console.log = grab;
});
const restore = () => { console.error = realError; console.warn = realWarn; console.log = realLog; };
const post = async () => {
  try {
    const res = await POST(new Request("http://localhost/api/signup", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email: EMAIL, password: GOOD_PW }) }));
    return { status: res.status, body: await res.text() };
  } finally { restore(); }
};
const logText = () => logs.join("\n");

test("duplicate found by the pre-check: 409, plain message only", async () => {
  S.existing = [{ id: "u1", email: EMAIL, passwordHash: HASH }];
  const r = await post();
  assert.equal(r.status, 409);
  assert.deepEqual(JSON.parse(r.body), { error: DUPLICATE });
});

test("duplicate that loses the race (unique violation on insert): 409, plain message, no SQL, no hash, no params", async () => {
  S.insertError = new DrizzleQueryError(insertSql, ["id-1", EMAIL, HASH], pgError("23505", 'duplicate key value violates unique constraint "users_email_unique"'));
  const r = await post();
  assert.equal(r.status, 409);
  assert.deepEqual(JSON.parse(r.body), { error: DUPLICATE });
  assert.doesNotMatch(r.body, LEAK);
  assert.doesNotMatch(logText(), /\$2[aby]\$|insert into|password_hash/i, "logs must not carry SQL or the hash");
});

test("database failure during the duplicate pre-check: 503 with a customer-safe message", async () => {
  S.selectError = new DrizzleQueryError(selectSql, [EMAIL, 1], pgError("57P01", "terminating connection due to administrator command"));
  const r = await post();
  assert.equal(r.status, 503);
  assert.doesNotMatch(r.body, LEAK);
  assert.match(JSON.parse(r.body).error, /try again/i);
});

test("database failure during the insert (not a duplicate): 503, nothing internal in the body", async () => {
  S.insertError = new DrizzleQueryError(insertSql, ["id-1", EMAIL, HASH], pgError("08006", "connection terminated unexpectedly"));
  const r = await post();
  assert.equal(r.status, 503);
  assert.doesNotMatch(r.body, LEAK);
  assert.match(JSON.parse(r.body).error, /try again/i);
});

test("an unexpected non-database error is also a controlled 503 (never the raw message)", async () => {
  S.insertError = new Error("kaboom at /srv/app/node_modules/pg/lib/client.js:42 password_hash=" + HASH);
  const r = await post();
  assert.equal(r.status, 503);
  assert.doesNotMatch(r.body, LEAK);
});

test("server log keeps a diagnosable record without SQL, params, email or hash", async () => {
  S.insertError = new DrizzleQueryError(insertSql, ["id-1", EMAIL, HASH], pgError("08006", "connection terminated unexpectedly"));
  await post();
  const text = logText();
  assert.match(text, /\[signup\]/, "a failure must still be logged");
  assert.match(text, /08006/, "the database error code is the useful part and is kept");
  assert.doesNotMatch(text, /\$2[aby]\$/, "no password hash in logs");
  assert.doesNotMatch(text, /insert into|select "|password_hash|params:/i, "no SQL or params in logs");
  assert.ok(!text.includes(EMAIL), "no customer email in logs");
});

test("validation answers are unchanged (400 with the existing useful messages)", async () => {
  for (const [body, msg] of [[{ email: "nope", password: GOOD_PW }, "Enter a valid email."], [{ email: EMAIL, password: "short" }, "Password must be at least 8 characters."]]) {
    const res = await POST(new Request("http://localhost/api/signup", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }));
    assert.equal(res.status, 400);
    assert.deepEqual(await res.json(), { error: msg });
  }
});
