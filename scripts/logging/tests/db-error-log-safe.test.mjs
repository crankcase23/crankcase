import { test } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import tls from "node:tls";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

// src/lib/dbErrorLogSafe.ts (Build 104-J): TLS / certificate / AggregateError awareness on top of dbErrorLog.ts. Bundles the REAL module (and the
// real dbErrorLog.ts / safeError.ts under it). The audit-logging suite proves the log line; this proves the helpers directly, including
// what error_events would store (recordableError), which the audit path does not exercise.
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const require = createRequire(import.meta.url);
const esbuild = require("esbuild");
const out = await esbuild.build({ entryPoints: [path.join(ROOT, "src/lib/dbErrorLogSafe.ts")], tsconfig: path.join(ROOT, "tsconfig.json"), bundle: true, format: "cjs", platform: "node", write: false, logLevel: "silent" });
const m = { exports: {} };
new Function("module", "exports", "require", out.outputFiles[0].text)(m, m.exports, require);
const { describeError, isSensitiveError, recordableError } = m.exports;

const HOST = "db.internal.example";
const mismatch = () => tls.checkServerIdentity(HOST, { subject: { CN: "other.example" }, subjectaltname: "DNS:other.example" });
const agg = () => new AggregateError([Object.assign(new Error(`connect ECONNREFUSED ${HOST}:5432`), { code: "ECONNREFUSED" })], "");

test("TLS hostname mismatch is sensitive and describes as class + long code", () => {
  const e = mismatch();
  assert.equal(isSensitiveError(e), true);
  assert.equal(describeError(e), "class=Error code=ERR_TLS_CERT_ALTNAME_INVALID");
});

test("certificate failures with codes longer than 16 characters keep their code", () => {
  for (const code of ["UNABLE_TO_VERIFY_LEAF_SIGNATURE", "DEPTH_ZERO_SELF_SIGNED_CERT", "SELF_SIGNED_CERT_IN_CHAIN", "ERR_SSL_WRONG_VERSION_NUMBER", "CERT_HAS_EXPIRED"]) {
    const e = Object.assign(new Error(`${code} ${HOST}`), { code });
    assert.equal(isSensitiveError(e), true, code);
    assert.equal(describeError(e), `class=Error code=${code}`);
  }
});

test("a TLS error is found as a cause and as an inner error, at depth", () => {
  assert.equal(isSensitiveError(new Error("wrapper", { cause: mismatch() })), true);
  assert.equal(isSensitiveError(new Error("a", { cause: new Error("b", { cause: new Error("c", { cause: mismatch() }) }) })), true);
  assert.equal(isSensitiveError(new AggregateError([mismatch()], "x")), true);
  assert.equal(describeError(new Error("wrapper", { cause: mismatch() })), "class=Error code=ERR_TLS_CERT_ALTNAME_INVALID");
});

test("a certificate-verification error is recognised by its reason + host / cert even when its code is unfamiliar", () => {
  const byHost = Object.assign(new Error(`odd failure for ${HOST}`), { code: "ODD", reason: `Host: ${HOST}. is not in the cert's altnames`, host: HOST });
  const byCert = Object.assign(new Error(`odd failure for ${HOST}`), { reason: "x", cert: { subject: { CN: HOST } } });
  assert.equal(isSensitiveError(byHost), true);
  assert.equal(isSensitiveError(byCert), true);
  assert.equal(isSensitiveError(Object.assign(new Error("plain"), { reason: "just a reason" })), false, "a bare `reason` is not enough");
  assert.ok(!recordableError(byHost).message.includes(HOST));
});

test("an AggregateError is sensitive and describes as its inner code", () => {
  assert.equal(isSensitiveError(agg()), true);
  assert.equal(describeError(agg()), "class=AggregateError code=ECONNREFUSED");
});

test("recordableError stores class + code only for these shapes (no message, no host, no stack header)", () => {
  for (const e of [mismatch(), agg(), new Error("w", { cause: mismatch() })]) {
    const r = recordableError(e);
    assert.equal(r.sensitive, true);
    const blob = `${r.message}\n${r.stack}`;
    assert.ok(!blob.includes(HOST) && !blob.includes("other.example") && !blob.includes("altnames"), blob);
    assert.match(r.message, /^class=\w+ code=\w+$/);
  }
});

test("ordinary errors are untouched: message and stack recorded as before", () => {
  const e = new Error("audit sink misconfigured");
  assert.equal(isSensitiveError(e), false);
  const r = recordableError(e);
  assert.equal(r.sensitive, false);
  assert.equal(r.message, "audit sink misconfigured");
  assert.ok(r.stack?.includes("audit sink misconfigured"));
  assert.equal(describeError(e), "class=Error code=none");
  assert.equal(isSensitiveError("a string"), false);
  assert.equal(isSensitiveError(null), false);
});

test("existing sensitive shapes still behave as the base does", () => {
  const pg = Object.assign(new Error("terminating connection"), { code: "57P01", severity: "ERROR" });
  assert.equal(isSensitiveError(pg), true);
  assert.equal(describeError(pg), "class=Error code=57P01");
  assert.equal(recordableError(pg).sensitive, true);
  const net = Object.assign(new Error(`connect ECONNREFUSED ${HOST}:5432`), { code: "ECONNREFUSED", syscall: "connect", address: HOST });
  assert.equal(isSensitiveError(net), true);
  assert.ok(!recordableError(net).message.includes(HOST));
});

test("a circular cause chain and a hostile getter do not throw", () => {
  const a = new Error("a"); const b = new Error("b", { cause: a }); a.cause = b;
  assert.doesNotThrow(() => { isSensitiveError(a); describeError(a); recordableError(a); });
  const hostile = new Error("h"); Object.defineProperty(hostile, "code", { get() { throw new Error("boom"); } });
  assert.equal(isSensitiveError(hostile), true, "fails closed");
  assert.equal(describeError(hostile), "class=NonError code=none");
});

// ---- independent review of 104-J ------------------------------------------------------------------------------------------------------
test("recordableError never throws, whatever the error object does (throwing getters, proxies, null prototypes)", () => {
  const getter = new Error("g"); Object.defineProperty(getter, "message", { get() { throw new Error("boom"); } });
  const code = new Error("c"); Object.defineProperty(code, "code", { get() { throw new Error("boom"); } });
  const proxy = new Proxy(new Error("p"), { get() { throw new Error("boom"); }, getPrototypeOf() { throw new Error("boom"); } });
  const bare = Object.create(null);
  for (const [name, e] of Object.entries({ getter, code, proxy, bare })) {
    let r;
    assert.doesNotThrow(() => { r = recordableError(e); }, name);
    assert.equal(typeof r.message, "string", name);
    assert.doesNotMatch(`${r.message} ${r.stack}`, /boom/, `${name}: a hostile object's own text must not be stored`);
  }
  assert.doesNotThrow(() => { isSensitiveError(proxy); describeError(proxy); });
});

test("a host, hostname, hostName or servername property marks an error sensitive, and a lowercase certificate code is still a certificate error", () => {
  for (const props of [{ hostname: HOST }, { hostName: HOST }, { host: HOST }, { servername: HOST }, { code: "hostname_mismatch" }, { code: "cert_has_expired" }]) {
    const e = Object.assign(new Error(`failure talking to ${HOST}`), props);
    assert.equal(isSensitiveError(e), true, JSON.stringify(props));
    assert.ok(!recordableError(e).message.includes(HOST), JSON.stringify(props));
  }
  assert.equal(isSensitiveError(Object.assign(new Error("plain"), { code: "E_APP_BAD_INPUT" })), false, "an application code is not hidden");
});

test("a sensitive error buried deeper than four causes is still found, and its code is still described", () => {
  let e = Object.assign(new Error(`connect ECONNREFUSED ${HOST}:5432`), { code: "ECONNREFUSED", syscall: "connect", address: HOST });
  for (let i = 0; i < 7; i++) e = new Error(`wrapper ${i}: ${e.message}`, { cause: e });
  assert.equal(isSensitiveError(e), true, "a wrapper chain that copies the inner message must not hide a connection error");
  assert.equal(describeError(e), "class=Error code=ECONNREFUSED");
  assert.ok(!recordableError(e).message.includes(HOST));
});

// 104-J second independent review: the depth cap failed OPEN, the walk was exponential in the width, and the TLS code regex ran on unbounded input
test("a wrapper chain deeper than the walk limit is sensitive (fail closed) and its host text never reaches the stored row", () => {
  let e = new Error(`connect ECONNREFUSED ${HOST}:5432`);
  for (let i = 0; i < 14; i++) e = new Error(e.message, { cause: e });
  assert.equal(isSensitiveError(e), true);
  const r = recordableError(e);
  assert.equal(r.sensitive, true);
  assert.ok(!r.message.includes(HOST) && !(r.stack ?? "").includes(HOST), r.message);
});

test("a wide, deep errors[] tree is walked in bounded time and is sensitive", () => {
  const build = (d) => (d === 0 ? new Error("leaf") : new AggregateError(Array.from({ length: 8 }, () => build(d - 1)), ""));
  const t = Date.now();
  const e = build(5);
  assert.equal(isSensitiveError(e), true);
  recordableError(e);
  assert.ok(Date.now() - t < 1500, `took ${Date.now() - t} ms`);
});

test("a huge hostile code string does not stall the TLS check and is not logged", () => {
  const e = Object.assign(new Error(`bad ${HOST}`), { code: "CERT".repeat(25000) + "!" });
  const t = Date.now();
  const r = recordableError(e);
  assert.ok(Date.now() - t < 300, `took ${Date.now() - t} ms`);
  assert.ok(!r.message.includes(HOST));
});
