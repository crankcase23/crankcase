import { test } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

// Bundles the REAL src/lib/wrenchProgress.ts and wrenchSteps.ts (no copy of the rules lives in this test).
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const require = createRequire(import.meta.url);
const esbuild = require("esbuild");
const out = await esbuild.build({
  stdin: {
    contents: `export * from "./src/lib/wrenchProgress.ts"; export * from "./src/lib/wrenchSteps.ts";`,
    resolveDir: ROOT, sourcefile: "entry.ts", loader: "ts",
  },
  tsconfig: path.join(ROOT, "tsconfig.json"), bundle: true, format: "esm", platform: "node", write: false,
});
const M = await import("data:text/javascript;base64," + Buffer.from(out.outputFiles[0].text).toString("base64"));
const { buildWrenchPlan, loadProgress, saveProgress, clearProgress, progressKey, persistableGarageId, planSignature, stepFingerprint, PROGRESS_TTL_MS } = M;

const mem = () => {
  const m = new Map();
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => void m.set(k, String(v)), removeItem: (k) => void m.delete(k), _m: m };
};
const steps = (n = 5) => Array.from({ length: n }, (_, i) => ({ number: i + 1, title: `Step ${i + 1} title`, instructions: `Do thing ${i + 1}. Then check it.` }));
const plan = (st = steps()) => buildWrenchPlan({ id: "g1", title: "G", steps: st });
const G = "2010-bmw-328i-3.0l~row-abc";
const ctx = (over = {}) => ({ garageId: G, guideId: "g1", configKey: "automatic|rwd", plan: plan(), now: 1_000_000, ...over });

test("round trip: what was saved resumes at the same step", () => {
  const s = mem();
  saveProgress(s, ctx(), 3);
  assert.deepEqual(loadProgress(s, ctx()), { status: "resume", index: 3 });
});

test("nothing saved: status none, nothing created", () => {
  const s = mem();
  assert.deepEqual(loadProgress(s, ctx()), { status: "none" });
  assert.equal(s._m.size, 0);
});

test("scope: progress is keyed by garage vehicle AND guide; other cars and other guides see nothing", () => {
  const s = mem();
  saveProgress(s, ctx(), 2);
  assert.equal(loadProgress(s, ctx({ garageId: "2010-bmw-328i-3.0l~row-OTHER" })).status, "none", "second car of the same model");
  assert.equal(loadProgress(s, ctx({ guideId: "g2" })).status, "none", "another guide");
  assert.ok(progressKey(G, "g1").includes(G) && progressKey(G, "g1").includes("g1"));
});

test("scope: a record stored under the right key but carrying another vehicle's identity is rejected and removed", () => {
  const s = mem();
  saveProgress(s, ctx({ garageId: "x~other" }), 1);
  s.setItem(progressKey(G, "g1"), s.getItem(progressKey("x~other", "g1")));
  assert.deepEqual(loadProgress(s, ctx()), { status: "rejected", reason: "scope" });
  assert.equal(s.getItem(progressKey(G, "g1")), null);
});

test("configuration: progress saved under another build is rejected and removed", () => {
  const s = mem();
  saveProgress(s, ctx({ configKey: "manual|awd" }), 2);
  assert.deepEqual(loadProgress(s, ctx()), { status: "rejected", reason: "configuration" });
  assert.equal(s._m.size, 0);
});

test("content: ANY change to ANY step rejects saved progress (so a position can never land on a different step)", () => {
  const edit = (f) => plan(f(steps()));
  const cases = {
    "instruction text edited": edit((st) => (st[1].instructions += " New sentence.", st)),
    "title edited": edit((st) => (st[4].title = "Different", st)),
    "warning added": edit((st) => (st[0].warning = "Careful", st)),
    "torque changed": edit((st) => (st[2].torque = [{ label: "Drain plug", value: "25 Nm" }], st)),
    "step removed": edit((st) => st.slice(0, 4)),
    "step inserted": edit((st) => [st[0], { number: 99, title: "New", instructions: "Added." }, ...st.slice(1)]),
    "steps reordered": edit((st) => [st[1], st[0], ...st.slice(2)]),
  };
  for (const [name, changed] of Object.entries(cases)) {
    const s = mem();
    saveProgress(s, ctx(), 3);
    const r = loadProgress(s, ctx({ plan: changed }));
    assert.equal(r.status, "rejected", name);
    assert.ok(["content-changed", "step-mismatch"].includes(r.reason), `${name}: ${r.reason}`);
    assert.equal(s._m.size, 0, `${name}: stale record removed, never retried`);
  }
});

test("content: an unchanged plan rebuilt from a fresh object still resumes (identity is content, not object identity)", () => {
  const s = mem();
  saveProgress(s, ctx(), 4);
  assert.deepEqual(loadProgress(s, ctx({ plan: plan(steps()) })), { status: "resume", index: 4 });
  assert.equal(planSignature(plan()), planSignature(plan(steps())));
  assert.notEqual(stepFingerprint(plan().steps[0]), stepFingerprint(plan().steps[1]));
});

test("step identity: a record whose step id does not match the step now at that position is rejected", () => {
  const s = mem();
  saveProgress(s, ctx(), 2);
  const k = progressKey(G, "g1");
  const r = JSON.parse(s.getItem(k));
  r.stepId = "not-this-step";
  s.setItem(k, JSON.stringify(r));
  assert.deepEqual(loadProgress(s, ctx()), { status: "rejected", reason: "step-mismatch" });
});

test("index outside the plan is rejected", () => {
  const s = mem();
  saveProgress(s, ctx(), 2);
  const k = progressKey(G, "g1");
  const r = JSON.parse(s.getItem(k));
  for (const bad of [-1, 5, 99]) {
    s.setItem(k, JSON.stringify({ ...r, index: bad }));
    assert.equal(loadProgress(s, ctx()).status, "rejected", `index ${bad}`);
  }
});

test("unreadable, foreign-version and incomplete records are rejected, never crash, and are removed", () => {
  const k = progressKey(G, "g1");
  const base = (() => { const s = mem(); saveProgress(s, ctx(), 1); return JSON.parse(s.getItem(k)); })();
  const bad = {
    "not json": "{{{",
    "json null": "null",
    "json number": "5",
    "empty string": "",
    "future version": JSON.stringify({ ...base, v: 2 }),
    "missing index": JSON.stringify({ ...base, index: undefined }),
    "string index": JSON.stringify({ ...base, index: "1" }),
    "missing config": JSON.stringify({ ...base, configKey: undefined }),
  };
  for (const [name, raw] of Object.entries(bad)) {
    const s = mem();
    s.setItem(k, raw);
    const r = loadProgress(s, ctx());
    assert.equal(r.status, "rejected", name);
    assert.equal(s.getItem(k), null, `${name}: removed`);
  }
});

test("expiry: 14 days from the last save; older (or impossibly future) records are rejected", () => {
  const s = mem();
  saveProgress(s, ctx({ now: 0 }), 2);
  assert.equal(loadProgress(s, ctx({ now: PROGRESS_TTL_MS - 1 })).status, "resume");
  const s2 = mem();
  saveProgress(s2, ctx({ now: 0 }), 2);
  assert.deepEqual(loadProgress(s2, ctx({ now: PROGRESS_TTL_MS + 1 })), { status: "rejected", reason: "expired" });
  const s3 = mem();
  saveProgress(s3, ctx({ now: 10 * 24 * 3600 * 1000 }), 2);
  assert.equal(loadProgress(s3, ctx({ now: 0 })).status, "rejected", "saved far in the future (clock tampering)");
});

test("clear removes only that vehicle+guide, nothing else", () => {
  const s = mem();
  saveProgress(s, ctx(), 2);
  saveProgress(s, ctx({ guideId: "g2" }), 1);
  clearProgress(s, G, "g1");
  assert.equal(loadProgress(s, ctx()).status, "none");
  assert.equal(loadProgress(s, ctx({ guideId: "g2" })).status, "resume");
});

test("save clamps an out-of-range index into the plan", () => {
  const s = mem();
  saveProgress(s, ctx(), 99);
  assert.deepEqual(loadProgress(s, ctx()), { status: "resume", index: 4 });
  saveProgress(s, ctx(), -5);
  assert.deepEqual(loadProgress(s, ctx()), { status: "resume", index: 0 });
});

test("unavailable storage (null, or one that throws on every call) never throws and just means no persistence", () => {
  const boom = { getItem() { throw new Error("denied"); }, setItem() { throw new Error("denied"); }, removeItem() { throw new Error("denied"); } };
  for (const s of [null, boom]) {
    assert.doesNotThrow(() => saveProgress(s, ctx(), 2));
    assert.doesNotThrow(() => clearProgress(s, G, "g1"));
    assert.deepEqual(loadProgress(s, ctx()), { status: "none" });
  }
});

test("an empty plan saves nothing", () => {
  const s = mem();
  saveProgress(s, ctx({ plan: plan([]) }), 0);
  assert.equal(s._m.size, 0);
});

test("only a composite garage id is persisted: a bare catalog id is a shared legacy alias and stays in memory", () => {
  assert.equal(persistableGarageId("2010-bmw-328i-3.0l~row-abc"), "2010-bmw-328i-3.0l~row-abc");
  for (const no of ["2010-bmw-328i-3.0l", "", undefined, null, "custom-row-id", "cat~"]) assert.equal(persistableGarageId(no), null, String(no));
});
