// RECONSTRUCTED TEST SUPPORT — attack helpers (same method as hardening.test.mjs): re-seal objects and re-chain events so structural hash checks pass.
import fs from "node:fs";
import { readEvents, eventsPath, buildEvent } from "../../src/eventlog.mjs";
import { listObjectFiles, abs } from "../../src/store.mjs";
import { seal, stable } from "../../src/canon.mjs";
export function rechain(run, fn) {
  const list = fn(readEvents(run.dir).map((e) => structuredClone(e))); let prev = null; const out = [];
  for (const e of list) { const ev = buildEvent(prev, { ts: e.ts, actor: e.actor, type: e.type, ref: e.ref, from: e.from, to: e.to, note: e.note }); out.push(ev); prev = ev; }
  fs.writeFileSync(eventsPath(run.dir), out.map((e) => JSON.stringify(e)).join("\n") + "\n");
}
export function forge(run, id, mutate) {
  const byId = new Map(listObjectFiles(run.dir).map((f) => [f.obj.id, f])); const touched = new Set();
  const apply = (oid, fn) => { const f = byId.get(oid); const o = seal(fn(structuredClone(f.obj))); f.obj = o; touched.add(oid); fs.writeFileSync(abs(run.dir, f.rel), stable(o));
    for (const g of byId.values()) if (g.obj.refs?.some((r) => r.id === oid)) apply(g.obj.id, (x) => ({ ...x, refs: x.refs.map((r) => (r.id === oid ? { ...r, sha256: o.contentHash } : r)) })); };
  apply(id, mutate);
  rechain(run, (evs) => evs.map((e) => (e.ref && touched.has(e.ref.id) ? { ...e, ref: { id: e.ref.id, sha256: byId.get(e.ref.id).obj.contentHash } } : e)));
}
