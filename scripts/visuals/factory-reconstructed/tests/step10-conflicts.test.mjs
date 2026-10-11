// RECONSTRUCTED TEST suite — Step 10 conflict table: every quoted requirement must exist VERBATIM in its recovered source file.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { CONFLICTS, AGREEMENTS, SOURCES, DECIDER, STATUS_ALL } from "../charger-step10/conflicts.mjs";
import { verifyRecovered } from "../integration/recovered-resolver.mjs";

const rec = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "recovered");
const flat = (t) => t.replace(/\s*\n\s*\*?\s*/g, " ").replace(/\s+/g, " "); // collapse line breaks and block-comment stars
const text = (f) => flat(fs.readFileSync(path.join(rec, f), "utf8"));

test("RECONSTRUCTED TEST [STEP10 CONFLICTS]: the recovered files the table quotes are intact (hashes match SHA256SUMS)", () => assert.deepEqual(verifyRecovered(), []));

test("RECONSTRUCTED TEST [STEP10 CONFLICTS]: every quote in every conflict and agreement row appears VERBATIM in its recovered source file", () => {
  for (const row of [...CONFLICTS, ...AGREEMENTS]) for (const p of row.positions) {
    assert.ok(SOURCES[p.source], `${row.id}: unknown source ${p.source}`);
    assert.ok(text(p.file).includes(flat(p.quote)), `${row.id} [${p.source}] quote not found verbatim in ${p.file}: ${p.quote}`);
  }
});

test("RECONSTRUCTED TEST [STEP10 CONFLICTS]: every conflict row has source, exact requirement, contradiction and decision required; ids unique; all OPEN; none resolved or altered", () => {
  const ids = new Set();
  for (const c of CONFLICTS) {
    assert.ok(!ids.has(c.id)); ids.add(c.id);
    assert.ok(c.positions.length >= 2, `${c.id}: a conflict needs at least two quoted positions`);
    assert.ok(new Set(c.positions.map((p) => p.source)).size >= 2, `${c.id}: needs at least two different sources`);
    assert.ok(c.contradiction.length > 40 && c.decisionRequired.length > 20, c.id);
    assert.equal(c.status, undefined, "status is not stored per row; the table is wholesale OPEN");
  }
  assert.equal(STATUS_ALL, "OPEN"); assert.equal(DECIDER, "Andy / Hermes");
  for (const c of CONFLICTS) assert.ok(!/RESOLVED|DECIDED|we will use|should be/i.test(c.decisionRequired.replace(/Decide|Pick|Choose|Confirm/g, "")), `${c.id} must not pre-empt the decision`);
});

test("RECONSTRUCTED TEST [STEP10 CONFLICTS]: the table covers all five requested sources", () => {
  const used = new Set(CONFLICTS.flatMap((c) => c.positions.map((p) => p.source)));
  assert.deepEqual([...used].sort(), ["CALLOUT_SPEC", "GUIDE", "MANIFEST", "PROMPT", "SHOTLIST"]);
});

test("RECONSTRUCTED TEST [STEP10 CONFLICTS]: canonical Step 10 requirements are UNALTERED — the recovered Step 10 prompt/manifest/slot files still match their SHA256SUMS entries", () => {
  const bad = verifyRecovered(); assert.deepEqual(bad, []);
  assert.ok(fs.readFileSync(path.join(rec, "doc-derived/step-10-handoff-prompt.txt"), "utf8").includes("MUST NOT SHOW (leave these out entirely, do not substitute): engine cover, hose grommet, resonator,"));
});
