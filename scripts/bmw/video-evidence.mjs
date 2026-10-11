#!/usr/bin/env node
// Video-evidence records for the BMW guides (YouTube = approved visual-evidence source, owner 2026-10-10).
//   node scripts/bmw/video-evidence.mjs [DIR]    validate docs/bmw-e90/video-evidence/guide-NN.json, exit 1 on error
// Hard rules enforced here:
//   * Video NEVER certifies torque, capacity, interval or safety. Observations of those kinds are rejected.
//   * A video record starts as an UNVIEWED candidate. Only a viewed basis (chapter-title, description, transcript, frame-viewed)
//     can carry observations, a config match or confidence above "candidate".
//   * A config match of MATCH needs evidence and cannot rest on a search-listing title, and not when the title carries a
//     conflicting generation/engine signal (N54, F30, M3, xDrive ...).
//   * No frames or video files are stored. Third-party imagery is never published.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
export const DEFAULT_DIR = path.join(ROOT, "docs/bmw-e90/video-evidence");
const BASES = new Set(["search-listing-title", "chapter-title", "description", "transcript", "frame-viewed"]);
const VIEWED = new Set(["chapter-title", "description", "transcript", "frame-viewed"]);
const CONF = new Set(["candidate", "low", "medium", "high"]);
const MATCH = new Set(["UNVERIFIED", "MATCH", "PARTIAL", "MISMATCH"]);
const FORBIDDEN_KINDS = new Set(["torque", "capacity", "interval", "safety", "spec"]);
const KINDS = new Set(["component", "location", "fastener", "action", "orientation", "tool"]);
const TS = /^\d{1,2}:\d{2}(:\d{2})?$/;

export function validateVideoEvidence(dir = DEFAULT_DIR) {
  const errors = [], warnings = [];
  const files = fs.existsSync(dir) ? fs.readdirSync(dir).filter((f) => /^guide-\d\d\.json$/.test(f)).sort() : [];
  if (files.length !== 16) errors.push(`expected 16 video-evidence files, found ${files.length}`);
  const summary = [];
  for (const f of files) {
    const no = Number(f.slice(6, 8));
    const err = (m) => errors.push(`guide ${no}: ${m}`);
    let d; try { d = JSON.parse(fs.readFileSync(path.join(dir, f), "utf8")); } catch (e) { err(`invalid JSON: ${e.message}`); continue; }
    if (d.guide !== no) err("guide field does not match filename");
    if (!Array.isArray(d.videos) || d.videos.length === 0) { err("no videos"); continue; }
    const seen = new Set();
    let viewed = 0;
    for (const v of d.videos) {
      const at = `video ${v.id ?? "?"}`;
      if (!v.id || seen.has(v.id)) err(`${at}: missing or duplicate id`); seen.add(v.id);
      if (!/^https:\/\/www\.youtube\.com\/watch\?v=[\w-]{11}$/.test(v.url ?? "")) err(`${at}: url must be a canonical youtube watch url`);
      if (!BASES.has(v.basis)) err(`${at}: bad basis ${v.basis}`);
      if (!CONF.has(v.confidence)) err(`${at}: bad confidence ${v.confidence}`);
      if (v.channel != null && typeof v.channel !== "string") err(`${at}: channel must be string or null`);
      const isViewed = VIEWED.has(v.basis);
      if (isViewed) viewed++;
      if (v.viewed !== isViewed) err(`${at}: viewed=${v.viewed} contradicts basis ${v.basis}`);
      if (!isViewed && v.confidence !== "candidate") err(`${at}: unviewed record cannot have confidence ${v.confidence}`);
      const cm = v.configMatch ?? {};
      if (!MATCH.has(cm.status)) err(`${at}: bad configMatch.status`);
      if (cm.status === "MATCH") {
        if (!isViewed) err(`${at}: MATCH cannot rest on a search-listing title`);
        if (!cm.evidence) err(`${at}: MATCH needs evidence`);
        if ((v.titleConflictSignals ?? []).length) err(`${at}: MATCH despite conflicting title signals ${v.titleConflictSignals}`);
      }
      if (cm.status !== "UNVERIFIED" && !isViewed) err(`${at}: configMatch ${cm.status} needs a viewed basis`);
      for (const o of v.observations ?? []) {
        if (!isViewed) err(`${at}: observation without a viewed basis`);
        if (FORBIDDEN_KINDS.has(o.kind)) err(`${at}: video cannot certify ${o.kind}`);
        else if (!KINDS.has(o.kind)) err(`${at}: bad observation kind ${o.kind}`);
        if (!o.component) err(`${at}: observation needs a component`);
        if (!TS.test(o.timestamp ?? "")) err(`${at}: observation needs a timestamp mm:ss`);
        if (/\b\d+(\.\d+)?\s?(nm|n·m|ft[- ]?lb|lbf|lb[- ]?ft|psi|qt|quarts?|liters?|litres?|ml)\b/i.test(JSON.stringify(o))) err(`${at}: observation carries a torque/capacity/pressure figure`);
      }
    }
    summary.push({ guide: no, videos: d.videos.length, viewed });
    if (viewed === 0) warnings.push(`guide ${no}: ${d.videos.length} candidate(s), none viewed`);
  }
  return { errors, warnings, summary };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { errors, warnings, summary } = validateVideoEvidence(process.argv[2] ? path.resolve(process.argv[2]) : DEFAULT_DIR);
  for (const w of warnings) console.log("WARN ", w);
  for (const e of errors) console.log("ERROR", e);
  const total = summary.reduce((a, s) => a + s.videos, 0), viewed = summary.reduce((a, s) => a + s.viewed, 0);
  console.log(`${summary.length} guides, ${total} candidate videos, ${viewed} viewed, ${errors.length} error(s)`);
  process.exit(errors.length ? 1 : 0);
}
