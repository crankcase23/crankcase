import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import util from "node:util";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

// Database error logging (Build 104-G). Bundles the REAL src/lib/events.ts and src/lib/errors.ts; only the database handle (@/db) is stubbed.
// Failures are shaped exactly like drizzle's DrizzleQueryError: `message` = the SQL text followed by the bound parameters, `query`/`params`
// carry them again, and the real pg error (with its SQLSTATE) sits in `cause`. Today both modules hand that whole object to console.error,
// and errors.ts also STORES message and stack in error_events (shown on the admin System page), so one failed insert puts a customer's
// user id, service-history entry or feedback text in the server log and in a second table.
// Contract:
//   * the log and the stored row keep the subsystem, the event type / source, the error class and the short SQLSTATE or network code
//   * they never carry SQL, bound parameters, user ids, emails, hashes, entry text, connection strings or messages of database errors
//   * ordinary (non-database) errors are recorded exactly as before: same message, same stack, same fingerprint
//   * the recorders still never throw, and still do not report success they did not achieve
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const require = createRequire(import.meta.url);
const esbuild = require("esbuild");

const S = (globalThis.__dbl = { insertError: null, rows: [], tables: [] });
const stubs = {
  "@/db": `
    const S = globalThis.__dbl;
    export const db = { insert(table) { S.tables.push(table); return { values: async (row) => { if (S.insertError) throw S.insertError(row); S.rows.push(row); } }; } };`,
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
const { recordEvent } = await build("src/lib/events.ts");
const { recordError } = await build("src/lib/errors.ts");

const EMAIL = "victim.customer@example.com";
const USER_ID = "f4398701-5a0c-4882-a97e-0411534e417a";
const HASH = "$2b$12$Zx3Q9mWqVbT1uYkE8a1d2eHcLx0pRfGq7sJvNn4oUwYhKiTtPzCyS";
const ENTRY = "OILCHANGE-SENTINEL for the red civic";
const FEEDBACK = "FEEDBACK-SENTINEL my number is 555-0100";
const CONN = ["postgres", "://app:", "pw-sentinel", "@db.internal:5432/crankcase"].join(""); // built in pieces so credential scanners do not flag a literal
const SENTINELS = ["OBJECT-104G-SENTINEL", "PATH-104G-SENTINEL", EMAIL, "victim.customer", USER_ID, HASH, "OILCHANGE-SENTINEL", "FEEDBACK-SENTINEL", "555-0100", "pw-sentinel", "db.internal"];
const LEAK = /Failed query|insert into|select "|from "|params:|\$2[aby]\$|password_hash|postgres(ql)?:\/\//i;

class DrizzleQueryError extends Error {
  constructor(query, params, cause) { super(`Failed query: ${query}\nparams: ${params.join(",")}`); this.name = "DrizzleQueryError"; this.query = query; this.params = params; this.cause = cause; }
}
const pgError = (code, message = "terminating connection due to administrator command") => Object.assign(new Error(message), { name: "error", code, severity: "ERROR" });

let logs;
const realError = console.error, realWarn = console.warn, realLog = console.log;
beforeEach(() => {
  S.insertError = null; S.rows = []; S.tables = []; logs = [];
  const grab = (...a) => logs.push(a.map((x) => (typeof x === "string" ? x : util.inspect(x, { depth: 8, breakLength: Infinity }))).join(" "));
  console.error = grab; console.warn = grab; console.log = grab;
});
const restore = () => { console.error = realError; console.warn = realWarn; console.log = realLog; };
const text = () => logs.join("\n");
const clean = (t, what) => {
  for (const s of SENTINELS) assert.ok(!t.includes(s), `${what}: ${s} leaked:\n${t}`);
  assert.doesNotMatch(t, LEAK, `${what}: SQL / parameters / hash / connection string leaked:\n${t}`);
  assert.doesNotMatch(t, /node_modules|\.next[\\/]/, `${what}: stack frames leaked into the log`);
};

// ---- events.ts -------------------------------------------------------------------------------------------------------------------
test("events: a failed insert logs subsystem, event type, class and code only (no SQL, user id, entry text)", async () => {
  S.insertError = () => new DrizzleQueryError(
    'insert into "app_events" ("id", "type", "user_id", "object_type", "object_id", "path", "metadata") values ($1, $2, $3, $4, $5, $6, $7)',
    ["evt-1", "service.logged", USER_ID, "vehicle", "OBJECT-104G-SENTINEL", "/api/garage/PATH-104G-SENTINEL/service", JSON.stringify({ title: ENTRY, mileage: 42000 })],
    pgError("57P01"),
  );
  try {
    await recordEvent({ type: "service.logged", userId: USER_ID, objectType: "vehicle", objectId: "OBJECT-104G-SENTINEL", path: "/api/garage/PATH-104G-SENTINEL/service", metadata: { title: ENTRY } });
    const t = text();
    assert.match(t, /\[events\]/, "the subsystem tag is kept");
    assert.match(t, /service\.logged/, "the event type is kept");
    assert.match(t, /57P01/, "the database error code is kept");
    clean(t, "events");
  } finally { restore(); }
});

test("events: the recorder still never throws, and a successful insert logs nothing", async () => {
  try {
    S.insertError = () => new DrizzleQueryError('insert into "app_events" values ($1)', [USER_ID], pgError("08006"));
    await assert.doesNotReject(recordEvent({ type: "vehicle.viewed", userId: USER_ID }));
    S.insertError = null; logs.length = 0;
    await recordEvent({ type: "vehicle.viewed", userId: USER_ID });
    assert.equal(S.rows.length, 1, "control: a healthy insert is written");
    assert.equal(logs.length, 0, "a healthy insert logs nothing");
  } finally { restore(); }
});

// ---- errors.ts: the stored row ---------------------------------------------------------------------------------------------------
const feedbackFailure = (params = ["fb-1", USER_ID, "bug", FEEDBACK]) =>
  new DrizzleQueryError('insert into "feedback" ("id", "user_id", "kind", "message") values ($1, $2, $3, $4)', params, pgError("23503", "insert or update on table violates foreign key constraint"));

test("errors: a database error is stored as class + code, with no SQL, parameters or customer text in message or stack", async () => {
  try {
    await recordError({ source: "api/feedback", error: feedbackFailure(), path: "/api/feedback", userId: USER_ID });
    assert.equal(S.rows.length, 1);
    const row = S.rows[0];
    for (const field of ["message", "stack"]) clean(String(row[field]), `stored ${field}`);
    assert.match(row.message, /DrizzleQueryError/, "the class is kept");
    assert.match(row.message, /23503/, "the SQLSTATE is kept");
    assert.match(row.stack ?? "", /\n\s+at /, "the stack FRAMES are kept (no data in them, and they locate the bug)");
    assert.equal(row.source, "api/feedback");
    assert.equal(row.path, "/api/feedback");
    assert.equal(row.userId, USER_ID, "the owner of the row is still recorded in its own column");
    assert.equal(row.level, "error");
  } finally { restore(); }
});

test("errors: the same database failure with different customers' parameters still groups into ONE fingerprint", async () => {
  try {
    await recordError({ source: "api/feedback", error: feedbackFailure() });
    await recordError({ source: "api/feedback", error: feedbackFailure(["fb-2", "another-user", "idea", "a completely different message"]) });
    assert.equal(S.rows.length, 2);
    assert.equal(S.rows[0].fingerprint, S.rows[1].fingerprint, "grouping is by class + code now, not by whatever the customer typed");
  } finally { restore(); }
});

test("errors: different database failures keep DIFFERENT fingerprints (a foreign-key bug and a unique-violation bug are not one row)", async () => {
  try {
    const failure = (code) => new DrizzleQueryError('insert into "feedback" values ($1)', [USER_ID], pgError(code));
    await recordError({ source: "api/feedback", error: failure("23503") });
    await recordError({ source: "api/feedback", error: failure("23505") });
    await recordError({ source: "api/other", error: failure("23503") });
    const fp = S.rows.map((r) => r.fingerprint);
    assert.equal(new Set(fp).size, 3, "code and source both separate groups");
  } finally { restore(); }
});

test("errors: a network error is stored without the database host and port, and a wrapper whose CAUSE is a pg error is sanitized too", async () => {
  try {
    const net = Object.assign(new Error("connect ECONNREFUSED 10.1.2.3:5432"), { code: "ECONNREFUSED", syscall: "connect", address: "10.1.2.3", port: 5432 });
    await recordError({ source: "api/garage", error: net });
    const wrapper = new Error(`lookup failed for ${EMAIL}`, { cause: pgError("08006") });
    await recordError({ source: "api/garage", error: wrapper });
    for (const row of S.rows) {
      const t = row.message + "\n" + (row.stack ?? "");
      assert.ok(!t.includes("10.1.2.3") && !t.includes("5432"), `database address leaked:\n${t}`);
      clean(t, "network / wrapper error");
    }
    assert.match(S.rows[0].message, /ECONNREFUSED/);
    assert.match(S.rows[1].message, /08006/);
  } finally { restore(); }
});

test("errors: a raw pg error (not drizzle-wrapped) is sanitized too, because its message can quote the offending value", async () => {
  try {
    await recordError({ source: "api/admin/users", error: pgError("22P02", `invalid input syntax for type uuid: "${EMAIL}"`) });
    clean(S.rows[0].message + "\n" + (S.rows[0].stack ?? ""), "raw pg error");
    assert.match(S.rows[0].message, /22P02/);
  } finally { restore(); }
});

test("errors: an ordinary (non-database) error is recorded EXACTLY as before: same message, same stack", async () => {
  try {
    const err = new TypeError("Cannot read properties of undefined (reading 'make')");
    await recordError({ source: "api/garage", error: err });
    assert.equal(S.rows[0].message, "Cannot read properties of undefined (reading 'make')");
    assert.equal(S.rows[0].stack, err.stack.slice(0, 8000));
    await recordError({ source: "api/garage", error: "a thrown string" });
    assert.equal(S.rows[1].message, "a thrown string");
    assert.equal(S.rows[1].stack, null);
  } finally { restore(); }
});

// ---- errors.ts: when the recorder itself fails -----------------------------------------------------------------------------------
test("errors: if writing the error row fails, the log has source, class and code only (the failed insert's parameters include the stored text)", async () => {
  S.insertError = (row) => new DrizzleQueryError(
    'insert into "error_events" ("id", "fingerprint", "level", "source", "message", "stack", "path", "user_id") values ($1, $2, $3, $4, $5, $6, $7, $8)',
    [row.id, row.fingerprint, row.level, row.source, row.message, row.stack ?? "", row.path ?? "", row.userId ?? ""],
    Object.assign(pgError("57P03", "the database system is starting up"), { detail: CONN }),
  );
  try {
    // The ORIGINAL error carries customer text; whatever the recorder stores is then echoed back by the failed insert's own message.
    await recordError({ source: "api/feedback", error: feedbackFailure(), path: "/api/feedback/PATH-104G-SENTINEL", userId: USER_ID });
    const t = text();
    assert.match(t, /\[errors\]/, "the subsystem tag is kept");
    assert.match(t, /api\/feedback/, "the source is kept");
    assert.match(t, /57P03/, "the code of the failed write is kept");
    clean(t, "recorder failure");
  } finally { restore(); }
});

test("errors: the recorder never throws, even for hostile input, and never logs the hostile value", async () => {
  try {
    const hostile = { get message() { throw new Error(`boom ${EMAIL}`); }, get stack() { throw new Error("boom"); } };
    Object.setPrototypeOf(hostile, Error.prototype);
    for (const odd of [null, undefined, 0, hostile]) await assert.doesNotReject(recordError({ source: "x", error: odd }));
    clean(text(), "hostile input");
  } finally { restore(); }
});

// ---- review follow-ups (independent review of 104-G) ------------------------------------------------------------------------------
test("errors: customer text on its own lines that LOOKS like a stack frame must not survive into the stored stack", async () => {
  try {
    const spoof = new DrizzleQueryError('insert into "feedback" ("message") values ($1)', [`ok\n    at EMAILSENTINEL ${EMAIL}\n  at x`], pgError("23503"));
    await recordError({ source: "api/feedback", error: spoof });
    const stack = S.rows[0].stack ?? "";
    assert.ok(!stack.includes("EMAILSENTINEL") && !stack.includes("victim.customer"), `parameter text survived the frame filter:\n${stack}`);
    assert.match(stack, /\n\s+at /, "genuine frames are still kept");
    const multi = Object.assign(new Error(`invalid input syntax for type uuid: "line1\n   at the shop 4pm secret\n  at x"`), { name: "error", code: "22P02", severity: "ERROR" });
    await recordError({ source: "api/admin/users", error: multi });
    assert.doesNotMatch(S.rows[1].stack ?? "", /shop 4pm|secret/, "same for a raw pg error whose message quotes multi-line text");
    const reassigned = new DrizzleQueryError('select 1', [EMAIL], pgError("57P01"));
    reassigned.stack = `Error: something else entirely\n    at SPOOF ${EMAIL}`;
    await recordError({ source: "api/x", error: reassigned });
    assert.ok(!(S.rows[2].stack ?? "").includes("victim.customer"), "a stack whose header does not match the message is not trusted: no frames are kept");
  } finally { restore(); }
});

test("errors: each detection signal works ON ITS OWN (query only, params only, message prefix only, a plain-Error cause, a two-level cause)", async () => {
  try {
    const onlyQuery = Object.assign(new Error(`select ${EMAIL}`), { query: "select 1" });
    const onlyParams = Object.assign(new Error(`values ${EMAIL}`), { params: [EMAIL] });
    const onlyPrefix = new Error(`Failed query: select ${EMAIL}`);
    const timeout = new DrizzleQueryError('select 1', [EMAIL], new Error("Connection terminated due to connection timeout"));
    const deep = new Error(`outer ${EMAIL}`, { cause: new Error(`middle ${EMAIL}`, { cause: pgError("08006") }) });
    for (const e of [onlyQuery, onlyParams, onlyPrefix, timeout, deep]) await recordError({ source: "api/x", error: e });
    for (const row of S.rows) clean(row.message + "\n" + (row.stack ?? ""), "single-signal detection");
    assert.match(S.rows[3].message, /class=\w+ code=none/, "a timeout has no SQLSTATE and is summarized as such");
    assert.match(S.rows[4].message, /08006/, "the code two causes down is found");
  } finally { restore(); }
});

test("errors: caps are pinned (ordinary message 1000, ordinary stack 8000, sensitive stack 8000) and ordinary fingerprints use the original grouping", async () => {
  try {
    await recordError({ source: "api/x", error: new Error("m".repeat(5000)) });
    assert.equal(S.rows[0].message.length, 1000);
    const big = new Error("x"); big.stack = "Error: x\n" + "    at f (file.js:1:1)\n".repeat(2000);
    await recordError({ source: "api/x", error: big });
    assert.equal(S.rows[1].stack.length, 8000);
    const sens = new DrizzleQueryError("select 1", [1], pgError("57P01")); sens.stack = sens.stack + "\n" + "    at g (file.js:2:2)".repeat(1) ;
    const frames = Array.from({ length: 2000 }, (_, i) => `    at fn${i} (file.js:${i}:1)`).join("\n");
    sens.stack = `Error: ${sens.message}\n${frames}`;
    await recordError({ source: "api/x", error: sens });
    assert.ok(S.rows[2].stack.length <= 8000, "a sensitive stack is capped too");
    const { createHash } = require("node:crypto");
    const expected = createHash("sha1").update('api/x::' + "Customer 7 saw error code 42 for \"abc\"".replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, "<uuid>").replace(/\b\d+\b/g, "<n>").replace(/"[^"]*"/g, '"<v>"').slice(0, 300)).digest("hex").slice(0, 16);
    await recordError({ source: "api/x", error: new Error('Customer 7 saw error code 42 for "abc"') });
    assert.equal(S.rows[3].fingerprint, expected, "ordinary errors keep the original normaliser");
  } finally { restore(); }
});

test("describeError cannot throw: an error with a throwing name/code getter does not break either recorder", async () => {
  try {
    const e = new DrizzleQueryError("select 1", [EMAIL], pgError("57P01"));
    Object.defineProperty(e, "name", { get() { throw new Error(`boom ${EMAIL}`); } });
    S.insertError = () => e;
    await assert.doesNotReject(recordEvent({ type: "vehicle.viewed", userId: USER_ID }));
    await assert.doesNotReject(recordError({ source: "api/x", error: e }));
    clean(text(), "throwing getters");
  } finally { restore(); }
});

test("a hostile class name cannot inject a log line or smuggle text through the label", async () => {
  try {
    const e = new DrizzleQueryError("select 1", [EMAIL], pgError("57P01"));
    Object.defineProperty(e, "name", { value: `Error\n[auth][error] forged line ${EMAIL}` });
    S.insertError = () => e;
    await recordEvent({ type: "vehicle.viewed", userId: USER_ID });
    const t = text();
    assert.ok(!t.includes("forged line") && !t.includes("victim.customer"), `the class name reached the log:\n${t}`);
    assert.match(t, /class=NonError code=57P01/);
    assert.equal(t.trim().split("\n").length, 1, "exactly one log line");
  } finally { restore(); }
});
