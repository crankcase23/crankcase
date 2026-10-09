// RECONSTRUCTED TEST suite — artifact manifest integrity + event log integrity (tamper detection).
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { verifyRun } from "../src/verify.mjs";
import { verifyChain, readEvents, buildEvent, eventsPath } from "../src/eventlog.mjs";
import { canonicalize, contentHashOf, seal, sha256 } from "../src/canon.mjs";
import { newRun, driveToQaPending, passQA, passAll, independentQA, INDEPENDENT_REVIEWER } from "./support/fixtures.mjs";

async function approvedRun() {
  const run = newRun("integ"); await driveToQaPending(run);
  passAll(run); run.admit(); run.normalize();
  run.approve({ step: 99, presentation: { alt: "a", caption: "c" }, authority: { approvedBy: "andy", approvedOn: "2026-10-04" } });
  return run;
}
const edit = (run, rel, fn) => { const p = `${run.dir}/${rel}`; fs.writeFileSync(p, fn(fs.readFileSync(p, "utf8"))); };
const rewriteEvents = (run, fn) => { const lines = fs.readFileSync(eventsPath(run.dir), "utf8").trim().split("\n").map(JSON.parse); fs.writeFileSync(eventsPath(run.dir), fn(lines).map((l) => JSON.stringify(l)).join("\n") + "\n"); };

test("RECONSTRUCTED TEST: an untouched approved run verifies clean (objects, events, files, manifest)", async () => {
  const v = verifyRun((await approvedRun()).dir);
  assert.deepEqual(v.problems, []); assert.equal(v.ok, true); assert.ok(v.objects >= 6 && v.events === 12);
});

test("RECONSTRUCTED TEST: canonical hashing is order-independent, strict about types, and content-addressed", () => {
  assert.equal(canonicalize({ b: 1, a: [2, { d: 1, c: 2 }] }), canonicalize({ a: [2, { c: 2, d: 1 }], b: 1 }));
  assert.throws(() => canonicalize({ a: NaN }), /non-finite/); assert.throws(() => canonicalize([undefined]), /undefined/);
  const o = seal({ id: "x", v: 1 }); assert.equal(o.contentHash, contentHashOf(o));
  assert.notEqual(seal({ id: "x", v: 2 }).contentHash, o.contentHash);
  assert.equal(contentHashOf({ ...o, contentHash: "ignored" }), o.contentHash);
});

test("RECONSTRUCTED TEST: manifest integrity — altering any recorded object breaks its own hash AND every reference to it", async () => {
  const run = await approvedRun();
  edit(run, "evidence-packet.v1.json", (t) => t.replace('"SYNTHETIC step"', '"EDITED step"'));
  const v = verifyRun(run.dir);
  assert.equal(v.ok, false);
  assert.ok(v.problems.some((p) => /EP-synthetic-fixture-v1: contentHash does not match/.test(p)));
  assert.ok(v.problems.some((p) => /VC-synthetic-fixture-v1: ref EP-synthetic-fixture-v1 hash mismatch/.test(p)));
  assert.ok(v.problems.some((p) => /AA-synthetic-fixture: ref EP-synthetic-fixture-v1/.test(p)));
  assert.ok(v.problems.some((p) => /event \d+: ref EP-synthetic-fixture-v1 hash differs/.test(p)));
});

test("RECONSTRUCTED TEST: manifest integrity — candidate file, prompt file, normalized file and registry preview are each hash-checked", async () => {
  const mutate = async (rel, pattern) => { const run = await approvedRun(); const p = `${run.dir}/${typeof rel === "function" ? rel(run) : rel}`; const b = fs.readFileSync(p); b[b.length > 40 ? b.length - 30 : 0] ^= 1; fs.writeFileSync(p, b); const v = verifyRun(run.dir); assert.ok(v.problems.some((x) => pattern.test(x)), `${pattern}: ${v.problems}`); };
  await mutate("generations/GR-synthetic-fixture-001.png", /candidate file hash differs/);
  await mutate("generations/prompts/GR-synthetic-fixture-001.prompt.txt", /prompt file hash differs/);
  await mutate("normalized/synthetic-fixture.png", /published-candidate file hash differs/);
  await mutate("registry-entry.preview.json", /registry preview hash differs/);
});

test("RECONSTRUCTED TEST: manifest integrity — an AA with a gate flipped to false is detected", async () => {
  const run = await approvedRun();
  edit(run, "approved.json", (t) => t.replace('"contentQaPass": true', '"contentQaPass": false'));
  const v = verifyRun(run.dir);
  assert.ok(v.problems.some((p) => /contentHash does not match/.test(p)) && v.problems.some((p) => /not every gate is true/.test(p)));
});

test("RECONSTRUCTED TEST: event log integrity — deletion, reordering, edits, forged tail and truncation are each detected", async () => {
  const cases = {
    "edited note": (l) => { l[3].note = "tampered"; return l; },
    "deleted middle event": (l) => l.filter((_, i) => i !== 4),
    "reordered events": (l) => { [l[2], l[3]] = [l[3], l[2]]; return l; },
    "edited actor": (l) => { l[1].actor = "andy"; return l; },
    "forged appended event": (l) => [...l, { ...buildEvent({ seq: 11, eventSha256: "0".repeat(64) }, { ts: "2026-10-04T13:00:00.000Z", actor: "factory-code", type: "APPROVED" }) }],
    "unknown type": (l) => { l[0].type = "SELF_APPROVED"; return l; },
  };
  for (const [name, fn] of Object.entries(cases)) { const run = await approvedRun(); rewriteEvents(run, fn); assert.equal(verifyRun(run.dir).ok, false, name); }
  const run = await approvedRun(); rewriteEvents(run, (l) => l.slice(0, 6));
  assert.deepEqual(verifyChain(readEvents(run.dir)), []); // a clean truncation is a valid chain...
  assert.ok(verifyRun(run.dir).problems.some((p) => /APPROVED|approved\.json/.test(p))); // ...but it contradicts the artifacts on disk
});

test("RECONSTRUCTED TEST: event log is hash-chained with seq starting at 1 and prev=null on the first event", async () => {
  const ev = (await approvedRun()).events;
  assert.equal(ev[0].seq, 1); assert.equal(ev[0].prevSha256, null);
  ev.forEach((e, i) => { if (i) assert.equal(e.prevSha256, ev[i - 1].eventSha256); });
  assert.equal(sha256(Buffer.from("x")).length, 64);
});

test("RECONSTRUCTED TEST: the AA records the event-log head it was derived from (registry preview carries eventsSeq/head)", async () => {
  const run = await approvedRun();
  const reg = JSON.parse(fs.readFileSync(`${run.dir}/registry-entry.preview.json`, "utf8"));
  const g = reg.entry.provenance.generatedRaster;
  const at = run.events.find((e) => e.seq === g.eventsSeq);
  assert.equal(at.eventSha256, g.eventsHeadSha256); assert.equal(g.eventsSeq, run.events.length - 1); // head BEFORE the APPROVED event
});
