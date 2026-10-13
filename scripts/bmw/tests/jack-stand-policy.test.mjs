// REGRESSIONS for owner decision D5 (jack-stand policy), approved 2026-10-12, applied to every BMW 328i guide that lifts the car.
//   One policy sentence set, no stand location published (no source we read gives one), no "stand under the X pad" text,
//   and no guide that mentions stands/jacking lacks the policy. Checks the CUSTOMER catalog (through the real resolver) AND the admin drafts.
import { test } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const esbuild = createRequire(path.join(ROOT, "package.json"))("esbuild");
async function bundle(entry) {
  const out = await esbuild.build({ entryPoints: [path.isAbsolute(entry) ? entry : path.join(ROOT, entry)], bundle: true, write: false, format: "esm", platform: "node", logLevel: "silent", alias: { "@": path.join(ROOT, "src") } });
  return import("data:text/javascript;base64," + Buffer.from(out.outputFiles[0].text).toString("base64"));
}
// BMW_TEST_CATALOG / BMW_TEST_DRAFTS point the suite at an older copy to prove it fails there.
const { bmwE90Guides } = await bundle(process.env.BMW_TEST_CATALOG ?? "src/data/repairs-bmw-e90.ts");
const { bmwDraftGuides } = await bundle(process.env.BMW_TEST_DRAFTS ?? "src/data/admin-test-guides/bmw-2010-328i-drafts.ts");
const { resolveGuideForConfig } = await bundle("src/lib/guideConfig.ts");

const CONFIRMED = { transmission: "automatic", drivetrain: "rwd", confirmedAt: "2026-10-12T00:00:00Z" };
const POLICY = "Never work under, or take a wheel off, a car held only by a jack. Support it on rated jack stands on hard, level ground, or use a lift or drive-on ramps where the job allows. Use the jacking points shown in the jacking illustration in your owner's manual, with a pad or adapter between the jack and the plastic pad. If you cannot identify a safe place for the stand from your manual, stop and use a shop lift.";
const LIFTING = ["brake-pads-front", "fuse-bulb", "o2-sensor", "brake-pads-rear", "serpentine-belt", "coolant", "tire-rotation", "driveline-fluid", "oil-change"];
const SLUG = { "brake-pads-front": "front-brake-pads", "fuse-bulb": "fuse-and-bulb", "o2-sensor": "oxygen-sensor", "brake-pads-rear": "rear-brake-pads", "serpentine-belt": "serpentine-belt", coolant: "coolant", "tire-rotation": "tire-rotation", "driveline-fluid": "differential-fluid", "oil-change": "oil-change" };

const customer = (job) => resolveGuideForConfig(bmwE90Guides.find((g) => g.jobType === job), CONFIRMED, "BMW");
const draftsAll = bmwDraftGuides.map((d) => d.guide);
const draftFor = (job) => {
  const hit = bmwDraftGuides.find((d) => d.slug === `bmw-2010-328i-${SLUG[job]}`) ?? bmwDraftGuides.find((d) => d.guide.jobType === job);
  assert.ok(hit, `draft for ${job} exists`);
  return hit.guide;
};
const text = (g) => [g.title, g.summary, ...g.safety, ...g.parts, ...g.steps.flatMap((s) => [s.title, s.instructions, s.warning ?? ""])].join("\n");
const both = (job) => [["customer", customer(job)], ["draft", draftFor(job)]];
const allCustomer = () => bmwE90Guides.map((g) => resolveGuideForConfig(g, CONFIRMED, "BMW"));

test("POLICY-01 every lifting guide carries the approved jack-stand policy verbatim in its safety notes (customer and draft)", () => {
  for (const job of LIFTING) for (const [who, g] of both(job)) assert.ok(g.safety.includes(POLICY), `${who} ${job}: approved policy missing`);
});

test("POLICY-02 no guide publishes a stand location or the old per-pad stand wording", () => {
  const BAD = [
    /stands? (under|at|on|beneath) the (side |rear |front )?(jack|jacking|sill|pad|point)/i,
    /(jack )?stands? at the side jacking points/i,
    /side jacking points only/i,
    /four side (jack(ing)? )?points/i,
    // 'just behind the front-centre jack point' is the oil drain hatch landmark, not a lifting instruction.
    /(?<!do not use the rear or )(?<!just behind the )front[- ]cent(er|re) jack point/i,
    /place (a |the )?stands?/i,
    /stands? (on|under) (the )?(frame|subframe|crossmember|axle)/i,
  ];
  for (const job of LIFTING) for (const [who, g] of both(job)) {
    const t = text(g);
    for (const re of BAD) assert.ok(!re.test(t), `${who} ${job}: matches ${re}: ${(t.match(re) ?? [])[0]}`);
  }
});

test("POLICY-03 any guide (all 16, customer and draft) that mentions stands or jacking carries the policy; none relies on a jack alone", () => {
  const MENTION = /jack stand|\bstands?\b|jacking|\bjack\b|lift the (front|rear|car)|raise the car/i;
  const guides = [...allCustomer().map((g) => ["customer", g]), ...draftsAll.map((g) => ["draft", g])];
  for (const [who, g] of guides) {
    const t = text(g);
    if (MENTION.test(t)) assert.ok(g.safety.includes(POLICY), `${who} "${g.title}" mentions stands or jacking but lacks the policy`);
    assert.ok(!/(held|supported) (only )?by (a|the) jack\b(?! stand)/i.test(t.replace(/Never work (under|with)[^.]*\./g, "")), `${who} "${g.title}": text relies on a jack`);
  }
});

test("POLICY-04 the policy itself keeps its required clauses, and lift steps point to the owner's manual", () => {
  for (const re of [/held only by a jack/, /rated jack stands/, /hard, level ground/, /owner's manual/, /pad or adapter/, /stop and use a shop lift/]) assert.match(POLICY, re);
  for (const job of ["brake-pads-front", "brake-pads-rear", "tire-rotation", "oil-change"]) for (const [who, g] of both(job)) {
    const lift = g.steps.find((s) => /stands|lift/i.test(s.title) && /(owner's manual|shop lift)/i.test(s.instructions));
    assert.ok(lift, `${who} ${job}: lift step does not point to the owner's manual`);
  }
});
