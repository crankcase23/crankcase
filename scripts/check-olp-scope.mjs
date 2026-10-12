#!/usr/bin/env node
/**
 * Build rail: Open Labor Project may only be claimed as a source for
 * wheel lug nut and oil drain plug torque.
 *
 * Why this exists, in one paragraph, because the next person to touch the
 * backfill will need it: openlaborproject.com is genuinely good data for the
 * two fasteners above and nothing else. Its filter-fastener figures have been
 * wrong here twice, both times reading "high confidence" — a 2018 Civic
 * spin-on filter at 16 ft-lb against Honda's own 12 Nm (9 ft-lb), and a 2021
 * CR-V entry that acquired the same 16 ft-lb figure a day after the Civic one
 * was pulled. Over-tightening a spin-on filter rolls the gasket, which shows
 * up later as oil on the road. Its maintenance-schedule and battery-location
 * endpoints have their own known problems (see AGENTS/Claude Project notes) —
 * neither belongs in this app either.
 *
 * So the rule stops being something a human has to remember at 7am: if a
 * provenance tag of "open-labor-project" is attached to anything other than a
 * drain plug or a lug nut, the build fails here, before next build runs.
 *
 * A number that came from somewhere else is not blocked — it just has to stop
 * claiming this source. Set provenance to { source: "curated" } and say in the
 * notes where the figure actually came from.
 */

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const DATA_DIR = join(ROOT, "src", "data");
const TAG = "open-labor-project";

/** Fasteners this source is allowed to stand behind. */
const ALLOWED_FASTENER = /(drain plug|lug nut)/i;

/**
 * Map every character of the file to whether it is executable code, so that a
 * brace inside a string literal or a comment can never be mistaken for object
 * nesting. Notes fields in the data files are long English prose; they will
 * contain punctuation we do not want to parse.
 */
function codeMask(src) {
  const mask = new Uint8Array(src.length);
  let i = 0;
  while (i < src.length) {
    const c = src[i];
    const next = src[i + 1];
    if (c === "/" && next === "/") {
      while (i < src.length && src[i] !== "\n") i++;
      continue;
    }
    if (c === "/" && next === "*") {
      i += 2;
      while (i < src.length && !(src[i] === "*" && src[i + 1] === "/")) i++;
      i += 2;
      continue;
    }
    if (c === '"' || c === "'" || c === "`") {
      const quote = c;
      i++;
      while (i < src.length) {
        if (src[i] === "\\") { i += 2; continue; }
        if (src[i] === quote) { i++; break; }
        i++;
      }
      continue;
    }
    mask[i] = 1;
    i++;
  }
  return mask;
}

/** Matching { } pairs, counted over code characters only. */
function bracePairs(src, mask) {
  const stack = [];
  const pairs = [];
  for (let i = 0; i < src.length; i++) {
    if (!mask[i]) continue;
    if (src[i] === "{") stack.push(i);
    else if (src[i] === "}" && stack.length) pairs.push([stack.pop(), i]);
  }
  return pairs;
}

/**
 * The object's own keys, with anything nested inside it blanked out, so that
 * `fastener` is read from the entry itself and never from a sibling.
 */
function ownKeys(src, mask, open, close) {
  let depth = 0;
  let flat = "";
  for (let i = open + 1; i < close; i++) {
    const isCode = mask[i] === 1;
    if (isCode && (src[i] === "{" || src[i] === "[")) { depth++; flat += " "; continue; }
    if (isCode && (src[i] === "}" || src[i] === "]")) { depth--; flat += " "; continue; }
    flat += depth === 0 ? src[i] : " ";
  }
  const keys = {};
  const re = /(\w+)\s*:\s*"((?:[^"\\]|\\.)*)"/g;
  let m;
  while ((m = re.exec(flat))) if (!(m[1] in keys)) keys[m[1]] = m[2];
  return keys;
}

function tsFiles(dir) {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) return tsFiles(full);
    return name.endsWith(".ts") || name.endsWith(".tsx") ? [full] : [];
  });
}

const violations = [];
let tagCount = 0;

for (const file of tsFiles(DATA_DIR)) {
  const src = readFileSync(file, "utf8");
  if (!src.includes(TAG)) continue;
  const mask = codeMask(src);
  const pairs = bracePairs(src, mask).sort((a, b) => b[0] - a[0]);

  const tagRe = new RegExp(`source\\s*:\\s*["']${TAG}["']`, "g");
  let hit;
  while ((hit = tagRe.exec(src))) {
    tagCount++;
    const at = hit.index;
    // Walk outward from the provenance object to the entry that owns it.
    const ancestors = pairs.filter(([o, c]) => o < at && c > at).sort((a, b) => b[0] - a[0]);
    let entry = null;
    for (const [o, c] of ancestors) {
      const keys = ownKeys(src, mask, o, c);
      if ("fastener" in keys || "name" in keys || "capacity" in keys) {
        entry = { keys, open: o };
        break;
      }
    }
    const line = src.slice(0, at).split("\n").length;
    const where = `${relative(ROOT, file)}:${line}`;

    if (!entry) {
      violations.push(`${where} — Open Labor Project tag on something this check could not identify. Name the fastener, or drop the tag.`);
      continue;
    }
    if (!("fastener" in entry.keys)) {
      const what = entry.keys.name ?? "unnamed entry";
      violations.push(`${where} — "${what}" is not a torque spec. Open Labor Project is not a source for fluid capacities or anything else; only lug nut and drain plug torque.`);
      continue;
    }
    const fastener = entry.keys.fastener;
    if (!ALLOWED_FASTENER.test(fastener)) {
      violations.push(`${where} — "${fastener}" (${entry.keys.value ?? "no value"}) claims Open Labor Project. That source is only good for lug nuts and oil drain plugs; it has been wrong about filter fasteners before, at high confidence.`);
    }
  }
}

if (violations.length) {
  console.error(`\nOpen Labor Project tags outside what that source is good for (${violations.length} of ${tagCount}):\n`);
  for (const v of violations) console.error(`  ${v}`);
  console.error(
    `\nFix: keep the figure if you trust it, but set provenance to { source: "curated" } and\n` +
      `say in the notes where the number actually came from. Only a manufacturer source\n` +
      `belongs on a filter fastener.\n`,
  );
  process.exit(1);
}

console.log(`Open Labor Project provenance: ${tagCount} tag${tagCount === 1 ? "" : "s"}, all on lug nuts or drain plugs.`);
