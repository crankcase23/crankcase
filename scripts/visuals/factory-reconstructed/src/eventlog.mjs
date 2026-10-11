// RECONSTRUCTED-V1 | NOT the lost original.
// Source: VD arch §2: "events.jsonl line: {seq, ts, actor, type, ref{id,sha256}, from, to, note}"; "append-only";
// Brick A report: "event log is hash-chained". The exact chain construction is UNKNOWN -> INFERRED:
// eventSha256 = sha256(canonical(event without eventSha256)), prevSha256 = previous eventSha256 (null for seq 1).
import fs from "node:fs";
import path from "node:path";
import { canonicalize, sha256 } from "./canon.mjs";
import { ACTORS, EVENT_TYPES } from "./enums.mjs";

export const eventsPath = (dir) => path.join(dir, "events.jsonl");

export function readEvents(dir) {
  const p = eventsPath(dir);
  if (!fs.existsSync(p)) return [];
  const text = fs.readFileSync(p, "utf8");
  if (text === "") return [];
  return text.split("\n").filter((l) => l.length).map((l, i) => { try { return JSON.parse(l); } catch { throw new Error(`events.jsonl line ${i + 1} is not JSON`); } });
}

export function eventHash(ev) { const { eventSha256: _o, ...rest } = ev; return sha256(canonicalize(rest)); }

export function buildEvent(prev, { ts, actor, type, ref = null, from = null, to = null, note = "" }) {
  const ev = { seq: (prev?.seq ?? 0) + 1, ts, actor, type, ref, from, to, note, prevSha256: prev?.eventSha256 ?? null };
  return { ...ev, eventSha256: eventHash(ev) };
}

export function appendEvent(dir, fields) {
  const events = readEvents(dir);
  const ev = buildEvent(events.at(-1), fields);
  fs.appendFileSync(eventsPath(dir), JSON.stringify(ev) + "\n");
  return ev;
}

/** Returns a list of problems; empty = chain intact. */
export function verifyChain(events) {
  const bad = [];
  let prev = null;
  events.forEach((ev, i) => {
    if (ev.seq !== i + 1) bad.push(`event ${i + 1}: seq is ${ev.seq}, expected ${i + 1}`);
    if (ev.prevSha256 !== (prev?.eventSha256 ?? null)) bad.push(`event ${i + 1}: prevSha256 does not match the previous event`);
    if (ev.eventSha256 !== eventHash(ev)) bad.push(`event ${i + 1}: eventSha256 does not match its content`);
    if (!ACTORS.includes(ev.actor)) bad.push(`event ${i + 1}: unknown actor ${ev.actor}`);
    if (!EVENT_TYPES.includes(ev.type)) bad.push(`event ${i + 1}: unknown type ${ev.type}`);
    if (typeof ev.ts !== "string" || Number.isNaN(Date.parse(ev.ts))) bad.push(`event ${i + 1}: bad ts`);
    prev = ev;
  });
  return bad;
}

export const headOf = (events) => events.at(-1) ?? null;
