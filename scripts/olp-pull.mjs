// Open Labor Project backfill puller.
//
// Runs a planned, priority-ordered batch of OLP API calls and writes every
// raw response to a JSON file for review. Nothing is written into the app's
// data files by this script — that's a deliberate human-review step, because
// OLP rows have repeatedly come back mismatched to the actual hardware (see
// the open-labor-project-integration project doc).
//
// The API key is read from .env.local / the environment and is never printed,
// never written to the output file, and never placed in a URL — it goes in the
// x-api-key header only, same as src/lib/openLaborProject.ts.
//
// The free Hobbyist tier is 10 requests/day, SHARED with the live site's own
// user traffic. So this script checks X-RateLimit-Remaining-Daily after every
// call and stops the moment the budget is gone, rather than burning retries.
//
//   Usage:  node scripts/olp-pull.mjs
//   Output: olp-pull-<date>.json in the repo root

import fs from "node:fs";
import path from "node:path";

const BASE = "https://openlaborproject.com/api/v1";
const PACE_MS = 7000; // 10 req/min cap — stay well under it

// --- key loading -----------------------------------------------------------

function loadKey() {
  if (process.env.OPEN_LABOR_API_KEY) return process.env.OPEN_LABOR_API_KEY;
  const envPath = path.join(process.cwd(), ".env.local");
  if (!fs.existsSync(envPath)) return null;
  for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*(?:export\s+)?OPEN_LABOR_API_KEY\s*=\s*(.*)\s*$/);
    if (m) return m[1].trim().replace(/^["']|["']$/g, "");
  }
  return null;
}

// --- the planned batch, most valuable first --------------------------------
//
// 1  Sierra oil-change torque. Its current values are hand-copied from the
//    Silverado with no provenance. Correctness, not coverage — goes first.
// 2-7 Front brake torque for all six. Unblocks five new brake guides and
//    verifies the Jeep's existing curated caliper figure.
// 8-10 Fluid re-verify for the three original vehicles, whose Engine Oil rows
//    are tagged open-labor-project/"estimated" — a tier OLP's own docs say is
//    templated by component type, not vehicle-specific.
//
// min_confidence=medium (not high) on purpose: it returns high AND medium rows
// for the same single request, and each row carries its own confidence, so the
// filtering is free. Asking for high and then retrying at medium would cost a
// second request out of a 10/day budget.

const V = {
  jeep:      { make: "jeep",      model: "grand-cherokee",  year: "2014" },
  civic:     { make: "honda",     model: "civic",           year: "2018" },
  f150:      { make: "ford",      model: "f-150",           year: "2015" },
  silverado: { make: "chevrolet", model: "silverado-1500",  year: "2020" },
  sierra:    { make: "gmc",       model: "sierra-1500",     year: "2020" },
  escape:    { make: "ford",      model: "escape",          year: "2021" },
};

const PLAN = [
  { n:  1, label: "sierra / torque / oil-change",        path: "/torque-specs", v: "sierra",    params: { job: "oil-change",       min_confidence: "medium" } },
  { n:  2, label: "sierra / torque / brake-pads-front",  path: "/torque-specs", v: "sierra",    params: { job: "brake-pads-front", min_confidence: "medium" } },
  { n:  3, label: "silverado / torque / brake-pads-front", path: "/torque-specs", v: "silverado", params: { job: "brake-pads-front", min_confidence: "medium" } },
  { n:  4, label: "civic / torque / brake-pads-front",   path: "/torque-specs", v: "civic",     params: { job: "brake-pads-front", min_confidence: "medium" } },
  { n:  5, label: "f150 / torque / brake-pads-front",    path: "/torque-specs", v: "f150",      params: { job: "brake-pads-front", min_confidence: "medium" } },
  { n:  6, label: "escape / torque / brake-pads-front",  path: "/torque-specs", v: "escape",    params: { job: "brake-pads-front", min_confidence: "medium" } },
  { n:  7, label: "jeep / torque / brake-pads-front",    path: "/torque-specs", v: "jeep",      params: { job: "brake-pads-front", min_confidence: "medium" } },
  { n:  8, label: "jeep / fluids",                       path: "/fluid-specs",  v: "jeep",      params: { min_confidence: "medium" } },
  { n:  9, label: "civic / fluids",                      path: "/fluid-specs",  v: "civic",     params: { min_confidence: "medium" } },
  { n: 10, label: "f150 / fluids",                       path: "/fluid-specs",  v: "f150",      params: { min_confidence: "medium" } },
];

// --- run -------------------------------------------------------------------

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const apiKey = loadKey();
  if (!apiKey) {
    console.error("\n  No OPEN_LABOR_API_KEY found.");
    console.error("  Expected it in .env.local in this folder, or as an environment variable.\n");
    process.exit(1);
  }
  console.log(`\n  Key loaded (${apiKey.length} chars). Not printed, not saved to the output file.`);
  console.log(`  ${PLAN.length} calls planned, ~${PACE_MS / 1000}s apart to respect the 10/min cap.\n`);

  const results = [];
  let remaining = null;
  let stoppedEarly = null;

  for (const call of PLAN) {
    const vehicle = V[call.v];
    const url = new URL(BASE + call.path);
    for (const [k, val] of Object.entries({ ...vehicle, ...call.params })) {
      url.searchParams.set(k, val);
    }

    const entry = { n: call.n, label: call.label, vehicle, endpoint: call.path, params: call.params };

    try {
      const res = await fetch(url.toString(), {
        headers: { "x-api-key": apiKey },
        cache: "no-store",
      });

      const rem = res.headers.get("X-RateLimit-Remaining-Daily");
      remaining = rem === null ? remaining : Number(rem);
      entry.status = res.status;
      entry.remainingDaily = remaining;

      const text = await res.text();
      try { entry.body = JSON.parse(text); } catch { entry.bodyRaw = text.slice(0, 2000); }

      if (res.status === 429) {
        entry.note = "RATE LIMITED — daily quota exhausted";
        results.push(entry);
        stoppedEarly = `quota exhausted at call ${call.n}`;
        console.log(`  ${String(call.n).padStart(2)}. ${call.label.padEnd(38)} 429 QUOTA GONE`);
        break;
      }

      const rowCount = countSpecs(entry.body);
      console.log(
        `  ${String(call.n).padStart(2)}. ${call.label.padEnd(38)} ${res.status}  rows:${String(rowCount).padStart(2)}  remaining:${remaining ?? "?"}`
      );
      results.push(entry);

      if (remaining !== null && remaining <= 0) {
        stoppedEarly = `daily budget reached zero after call ${call.n}`;
        console.log(`\n  Daily budget is now zero. Stopping cleanly.`);
        break;
      }
    } catch (err) {
      entry.status = "network_error";
      entry.error = String(err && err.message ? err.message : err);
      results.push(entry);
      console.log(`  ${String(call.n).padStart(2)}. ${call.label.padEnd(38)} NETWORK ERROR — ${entry.error}`);
    }

    if (call.n !== PLAN[PLAN.length - 1].n) await sleep(PACE_MS);
  }

  const stamp = new Date().toISOString().slice(0, 10);
  const outPath = path.join(process.cwd(), `olp-pull-${stamp}.json`);
  fs.writeFileSync(
    outPath,
    JSON.stringify({ pulledAt: new Date().toISOString(), remainingDaily: remaining, stoppedEarly, results }, null, 2)
  );

  console.log(`\n  Wrote ${results.length} response(s) to ${path.basename(outPath)}`);
  if (stoppedEarly) console.log(`  Stopped early: ${stoppedEarly}`);
  console.log(`  Daily requests remaining: ${remaining ?? "unknown"}\n`);
}

// Best-effort count of returned spec rows across the documented nested shape
// (engines[].specsByJob[].specs[]) and a few flatter fallbacks, purely so the
// console line is informative. Never throws.
function countSpecs(body) {
  try {
    const d = body && body.data;
    if (!d) return 0;
    if (Array.isArray(d.engines)) {
      return d.engines.reduce((sum, e) => {
        const byJob = e.specsByJob || e.specs_by_job || [];
        if (Array.isArray(byJob)) return sum + byJob.reduce((s, j) => s + (j.specs?.length || 0), 0);
        return sum + (e.specs?.length || e.fluidSpecs?.length || 0);
      }, 0);
    }
    if (Array.isArray(d.specs)) return d.specs.length;
    if (Array.isArray(d.fluidSpecs)) return d.fluidSpecs.length;
    if (Array.isArray(d)) return d.length;
    return 0;
  } catch {
    return 0;
  }
}

main();
