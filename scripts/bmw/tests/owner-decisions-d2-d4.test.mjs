// REGRESSIONS for the owner decisions D2-D4 on the 2010 BMW 328i guides (2026-10-12).
//   D2  Rear Brake Pads: replacement stays RESTRICTED. The caliper release/refit steps are BLOCKED, no unsupported size or torque
//       (13 mm / 15 mm back-up / 35 Nm) and no "preferred method" reaches a customer, and the parking brake hold test is present.
//   D3  Battery: no hard-coded battery part number and no "probable 80 Ah" claim; the customer buys by the old battery's label.
//   D4  PCV: inspect-only. Hose removal is a BLOCKED shop-only step; the hose part is not sold and no removal procedure is given.
// Also: every guide has exactly one review classification (READY FOR OWNER REVIEW or RESTRICTED) and nothing is labelled certified.
// Each test checks the CUSTOMER catalog resolved through the real configuration resolver AND the admin drafts, so the two copies cannot drift.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const esbuild = createRequire(path.join(ROOT, "package.json"))("esbuild");
async function bundle(entry) {
  const out = await esbuild.build({ entryPoints: [path.isAbsolute(entry) ? entry : path.join(ROOT, entry)], bundle: true, write: false, format: "esm", platform: "node", logLevel: "silent", alias: { "@": path.join(ROOT, "src") } });
  return import("data:text/javascript;base64," + Buffer.from(out.outputFiles[0].text).toString("base64"));
}
// BMW_TEST_CATALOG / BMW_TEST_DRAFTS let a reviewer point the suite at an older copy to prove the tests fail on it.
const { bmwE90Guides } = await bundle(process.env.BMW_TEST_CATALOG ?? "src/data/repairs-bmw-e90.ts");
const { bmwDraftGuides } = await bundle(process.env.BMW_TEST_DRAFTS ?? "src/data/admin-test-guides/bmw-2010-328i-drafts.ts");
const { resolveGuideForConfig } = await bundle("src/lib/guideConfig.ts");

const CONFIRMED = { transmission: "automatic", drivetrain: "rwd", confirmedAt: "2026-10-12T00:00:00Z" };
const customer = (job, cfg = CONFIRMED) => resolveGuideForConfig(bmwE90Guides.find((g) => g.jobType === job), cfg, "BMW");
const draft = (slug) => bmwDraftGuides.find((d) => d.slug === `bmw-2010-328i-${slug}`).guide;
const allText = (g) => [g.title, g.summary, ...g.safety, ...g.parts, ...g.tools.map((t) => t.name + " " + (t.note ?? "")), ...g.torqueSpecs.map((t) => `${t.fastener} ${t.value} ${t.notes ?? ""}`), ...g.steps.flatMap((s) => [s.title, s.instructions, s.warning ?? ""])].join("\n");
const BLOCK = "⛔ BLOCKED — ";
const pairs = (job, slug) => [["customer", customer(job)], ["draft", draft(slug)]];
const step = (g, re) => g.steps.find((s) => re.test(s.title.replace(BLOCK, "")));

// ---------------------------------------------------------------- D2 Rear Brake Pads
test("D2-01 rear caliper release and refit are BLOCKED and carry no size, torque or method", () => {
  for (const [who, g] of pairs("brake-pads-rear", "rear-brake-pads")) {
    for (const re of [/^Release the caliper/, /^Refit the caliper and torque/]) {
      const s = step(g, re);
      assert.ok(s, `${who}: step ${re} exists`);
      assert.ok(s.title.startsWith(BLOCK), `${who}: "${s.title}" must be blocked`);
      assert.match(s.instructions, /This step is blocked/);
      assert.ok(!/\b\d+(\.\d+)?\s*(mm|Nm|lb-ft)\b|hex|socket|Method [AB]|preferred/i.test(s.instructions), `${who}: blocked step leaks a size, torque or method: ${s.instructions.slice(0, 160)}`);
    }
    if (who === "customer") assert.ok(g.safety.some((x) => /BLOCKED in this guide/.test(x)), "customer: blocked-steps warning present");
  }
});

test("D2-02 unsupported rear-brake figures (13 mm / 15 mm back-up / 35 Nm / carrier size) never reach a customer; the carrier and guide-screw torques show the VERIFY warning", () => {
  for (const [who, g] of pairs("brake-pads-rear", "rear-brake-pads")) {
    const t = allText(g);
    assert.ok(!/13 mm|15 mm|16 mm|\b35 Nm\b|\b30 Nm\b|\b65 Nm\b|Method B|Method A|preferred method/i.test(t), `${who}: unsupported rear caliper figure or method text present`);
    for (const row of g.torqueSpecs.filter((r) => /caliper (carrier|guide)/i.test(r.fastener))) {
      assert.match(row.value, /VERIFY EXACT TORQUE/, `${who}: "${row.fastener}" prints a figure`);
      assert.ok(!/\d\s*Nm/.test(row.notes ?? ""), `${who}: "${row.fastener}" notes leak a torque number`);
    }
    for (const tool of g.tools) assert.ok(!/\b(13|15|16) mm\b/.test(tool.name), `${who}: rear caliper tool size listed: ${tool.name}`);
  }
});

test("D2-03 parking brake: hold test, no adjustment by notch count, shop referral; automatic left in Park", () => {
  for (const [who, g] of pairs("brake-pads-rear", "rear-brake-pads")) {
    // a long first step is split in two ("part 1 of 2"); the Park line may sit in either half
    const prep = g.steps.filter((s) => /^Confirm parts, prepare and chock/.test(s.title)).map((s) => s.instructions).join(" ");
    assert.ok(prep, `${who}: prepare step exists`);
    assert.match(prep, /P \(Park\)/, `${who}: no Park instruction`);
    // the step is long, so it is shown in two parts ("part 1 of 2"); judge the parts together
    const parts = g.steps.filter((x) => /^Test the parking brake and bed in/.test(x.title.replace(BLOCK, "")));
    assert.ok(parts.length, `${who}: parking brake step exists`);
    const hold = { instructions: parts.map((x) => x.instructions).join(" "), warning: parts.map((x) => x.warning ?? "").join(" ") };
    assert.match(hold.instructions, /check that the parking brake still holds/i);
    assert.match(hold.instructions, /do not drive it and do not rely on the handbrake/i);
    assert.match(hold.instructions, /BMW-qualified shop/);
    assert.ok(!/notch|teeth|click/i.test(hold.instructions + hold.warning), `${who}: adjustment notch count leaked`);
    assert.ok(!/32 1 030/.test(allText(g)), `${who}: special-tool number published`);
  }
});

// ---------------------------------------------------------------- D3 Battery
const FORBIDDEN_BATTERY_NUMBERS = ["61216806755", "61212353803", "61212353804", "61212353806", "61212353808", "61212353810", "61212353813", "61215A40E19", "61215A40E29", "61217586960", "61217586961", "61217586962", "61218381738", "61218381749", "61218381762", "61217553951", "61216946334"];

test("D3-01 no battery part number is published; the customer buys by the old battery's label", () => {
  for (const [who, g] of pairs("battery", "battery")) {
    const t = allText(g);
    for (const n of FORBIDDEN_BATTERY_NUMBERS) assert.ok(!t.includes(n), `${who}: battery number ${n} published`);
    assert.ok(g.parts.some((p) => /match the label on the old battery/i.test(p)), `${who}: parts list lacks the match-the-label line`);
    assert.ok(!g.parts.some((p) => /Original BMW AGM|92 Ah/i.test(p)), `${who}: AGM 92 Ah part still listed`);
  }
});

test("D3-02 no 'probable 80 Ah' conclusion and no size-from-capacity guess in the battery guide", () => {
  for (const [who, g] of pairs("battery", "battery")) {
    const t = allText(g);
    assert.ok(!/probable original|probable configuration|80 Ah flooded battery is the probable|94R\/H7 is the expected/i.test(t), `${who}: unsupported capacity or size conclusion present`);
    const choose = step(g, /^Choose the replacement battery/);
    assert.match(choose.instructions, /Read the label of the battery in the car/);
    assert.match(choose.instructions, /Do not choose by year or by a size name/);
  }
});

test("D3-03 registration is worded as needed (BMW service bulletin copy), never as a no-start or an alternator-damage claim", () => {
  for (const [who, g] of pairs("battery", "battery")) {
    const reg = step(g, /^Register the new battery/);
    assert.ok(reg, `${who}: registration step exists`);
    assert.match(reg.instructions, /check-control messages/);
    assert.match(reg.instructions, /needed, not optional/);
    assert.ok(!/fail to start|won't start|will not start|alternator damage|damage the alternator/i.test(allText(g)), `${who}: overclaim about registration consequences`);
  }
});

// ---------------------------------------------------------------- D4 PCV
test("D4-01 PCV hose removal is a BLOCKED shop-only step with no removal procedure", () => {
  for (const [who, g] of pairs("pcv-valve", "pcv-valve")) {
    const s = step(g, /^Remove the breather hose only if replacing it/);
    assert.ok(s, `${who}: hose step exists`);
    assert.ok(s.title.startsWith(BLOCK), `${who}: hose removal must be blocked`);
    assert.match(s.instructions, /This step is blocked/);
    assert.match(s.instructions, /BMW-qualified shop/);
    assert.ok(!/squeeze|depress|tabs?\b|pull the hose off|refit until/i.test(s.instructions), `${who}: removal procedure leaked into the blocked step`);
  }
});

test("D4-02 the breather hose part is not sold, and nothing tells the owner to replace it", () => {
  for (const [who, g] of pairs("pcv-valve", "pcv-valve")) {
    const t = allText(g);
    assert.ok(!t.includes("11157559528"), `${who}: hose part number published`);
    assert.ok(!/Hose-tab release|finger pressure on the side tabs/i.test(t), `${who}: hose-tab tool still listed`);
    assert.ok(!/replace hose|replace the hose|replace with part/i.test(t), `${who}: still tells the owner to replace the hose`);
    assert.match(step(g, /^Decide what happens next/).instructions, /shop replace it/);
  }
});

test("D4-03 PCV inspection is look-only, with a stop line when the hose cannot be seen", () => {
  for (const [who, g] of pairs("pcv-valve", "pcv-valve")) {
    const s = step(g, /^Inspect the breather hose and connection/);
    assert.match(s.instructions, /Look only: do not pull, twist or unplug/);
    assert.match(s.instructions, /cannot see the hose and its connection[^.]*stop and have a shop inspect it/);
    assert.match(s.warning ?? "", /Do not disturb it/);
    assert.ok(!/user-serviceable:[^.]*breather hose to the back/i.test(allText(g)), `${who}: breather hose still listed as user-serviceable`);
  }
});

// ---------------------------------------------------------------- sweep across saved configurations
const CONFIGS = [
  { name: "automatic+rwd", cfg: CONFIRMED },
  { name: "not set", cfg: null },
  { name: "never confirmed", cfg: { transmission: "automatic", drivetrain: "rwd" } },
  { name: "not sure", cfg: { transmission: "unknown", drivetrain: "unknown", confirmedAt: "2026-10-12T00:00:00Z" } },
  { name: "automatic+awd", cfg: { transmission: "automatic", drivetrain: "awd", confirmedAt: "2026-10-12T00:00:00Z" } },
  { name: "manual+rwd", cfg: { transmission: "manual", drivetrain: "rwd", confirmedAt: "2026-10-12T00:00:00Z" } },
];
test("D2-D4 SWEEP: whatever the saved configuration, the removed figures never appear in the three corrected guides", () => {
  const LEAK = {
    "brake-pads-rear": /13 mm|15 mm|16 mm|\b(30|35|65) Nm\b|Method [AB]|preferred method/i,
    battery: /61216806755|probable original|94R\/H7 is the expected|80 Ah flooded battery is the probable/i,
    "pcv-valve": /11157559528|finger pressure on the side tabs|Hose-tab release/i,
  };
  for (const job of Object.keys(LEAK)) {
    for (const { name, cfg } of CONFIGS) {
      const r = customer(job, cfg ?? undefined);
      const g = r.guide ?? r;
      assert.ok(g && g.steps, `${job}/${name}: resolved guide`);
      assert.ok(!LEAK[job].test(allText(g)), `${job}/${name}: removed figure leaked`);
      for (const s of g.steps.filter((x) => x.title.startsWith(BLOCK))) assert.match(s.instructions, /This step is blocked/, `${job}/${name}: blocked step "${s.title}" lost its stop`);
    }
  }
});

// ---------------------------------------------------------------- classification
const CLASS_FILE = path.join(ROOT, "docs/bmw-e90/certification/owner-review-classification.json");
test("CLASS-01 every BMW guide has exactly one classification, READY FOR OWNER REVIEW or RESTRICTED, and none is called certified", () => {
  const cls = JSON.parse(fs.readFileSync(CLASS_FILE, "utf8"));
  assert.equal(cls.guides.length, 16);
  const ledgers = fs.readdirSync(path.join(ROOT, "docs/bmw-e90/evidence")).filter((f) => /^guide-\d\d\.json$/.test(f)).sort().map((f) => JSON.parse(fs.readFileSync(path.join(ROOT, "docs/bmw-e90/evidence", f), "utf8")));
  assert.deepEqual(cls.guides.map((x) => x.guide), ledgers.map((l) => l.guide), "classification covers guides 1..16 in order");
  for (const [i, c] of cls.guides.entries()) {
    assert.equal(c.name, ledgers[i].name, `guide ${c.guide}: name matches the ledger`);
    assert.ok(["READY FOR OWNER REVIEW", "RESTRICTED"].includes(c.status), `guide ${c.guide}: status "${c.status}"`);
    assert.ok(c.ownerChecks?.length > 0, `guide ${c.guide}: lists what the owner must confirm`);
    assert.ok(c.why && c.why.length > 20, `guide ${c.guide}: has a reason`);
    assert.ok(!/certified/i.test(c.status), `guide ${c.guide}: status claims certification`);
    if (c.status === "RESTRICTED") assert.ok(c.blockers?.length > 0, `guide ${c.guide}: RESTRICTED without named blockers`);
  }
  assert.equal(cls.certifiedCount, 0, "no guide is mechanically certified");
  assert.ok(!/mechanically certified/i.test(JSON.stringify(cls.guides.map((g) => g.status))));
});

test("CLASS-02 a guide classified RESTRICTED really has restricted steps in the app, and the restricted guide set matches the blocked-step guides it names", () => {
  const cls = JSON.parse(fs.readFileSync(CLASS_FILE, "utf8"));
  const restricted = cls.guides.filter((c) => c.status === "RESTRICTED");
  assert.deepEqual(restricted.map((c) => c.guide), [5], "only Rear Brake Pads is restricted");
  const g = customer("brake-pads-rear");
  assert.ok(g.steps.some((s) => s.title.startsWith(BLOCK)), "restricted guide has a blocked step");
  const ids = new Set(cls.guides.map((c) => c.guide));
  for (let n = 1; n <= 16; n++) assert.ok(ids.has(n), `guide ${n} classified`);
});
