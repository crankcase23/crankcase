#!/usr/bin/env node
// Screenshots of the REAL authenticated admin routes (/admin/guides/test/<slug>) for the owner preview.
// Same safety rule as tests/e2e/bmw-admin-guides.spec.ts: refuses to run unless DATABASE_URL is a throwaway LOCAL database.
//   (DATABASE_URL = a local scratch Postgres on 127.0.0.1, no password)  node scripts/bmw/preview/real-route-shots.mjs --out DIR [--base http://localhost:3100]
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const require = createRequire(path.join(ROOT, "package.json"));
const { chromium } = require("@playwright/test");
const { Pool } = require("pg");
const a = process.argv.slice(2);
const arg = (n, d) => { const i = a.indexOf(`--${n}`); return i >= 0 ? a[i + 1] : d; };
const DB = process.env.DATABASE_URL ?? "";
if (!/^postgres(ql)?:\/\/[^/@]*@?(127\.0\.0\.1|localhost)(:\d+)?\//.test(DB)) { console.error("refusing: DATABASE_URL must be a throwaway LOCAL database"); process.exit(2); }
const out = path.resolve(arg("out", ""));
if (!arg("out")) { console.error("usage: --out DIR"); process.exit(2); }
fs.mkdirSync(out, { recursive: true });
const base = arg("base", "http://localhost:3100");
const SLUGS = "front-brake-pads,fuse-bulb,key-fob-battery,oxygen-sensor,rear-brake-pads,serpentine-belt,battery,coolant,fluid-checks,cabin-air-filter,pcv-valve,engine-air-filter,tire-rotation,wiper-blades,differential-fluid,oil-change".split(",").map((s) => `bmw-2010-328i-${s}`);
const pool = new Pool({ connectionString: DB });
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const shot = (page, name) => page.screenshot({ path: path.join(out, name), type: "jpeg", quality: 72 });

async function signUpAdmin(ctx) {
  const page = await ctx.newPage();
  const email = `shots-${Date.now()}-${Math.random().toString(36).slice(2, 7)}@example.com`;
  await page.goto(`${base}/signup`);
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill("testpassword123");
  await page.getByRole("button", { name: "Create Account" }).click();
  await page.waitForURL(/\/(garage|login)/, { timeout: 30000 });
  if (/\/login/.test(page.url())) { await page.getByLabel("Email").fill(email); await page.getByLabel("Password").fill("testpassword123"); await page.getByRole("button", { name: /sign in|log in/i }).click(); }
  await page.waitForURL(/\/garage$/, { timeout: 30000 });
  await pool.query("update users set is_admin = true where email = $1", [email]);
  return page;
}

for (const vp of [{ name: "desktop", width: 1280, height: 900 }, { name: "phone", width: 390, height: 844, isMobile: true, hasTouch: true }]) {
  const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, isMobile: vp.isMobile, hasTouch: vp.hasTouch });
  const page = await signUpAdmin(ctx);
  for (const slug of SLUGS) {
    const short = slug.replace("bmw-2010-328i-", "");
    await page.goto(`${base}/admin/guides/test/${slug}`);
    await page.getByRole("heading", { level: 1 }).first().waitFor();
    await shot(page, `${short}.${vp.name}.1-planning.jpg`);
    await page.getByRole("button", { name: /start wrench mode/i }).click();
    await page.waitForSelector('[aria-label="Wrench Mode"]');
    await shot(page, `${short}.${vp.name}.2-wrench-first.jpg`);
    // the first step that has a torque or warning module, else step 2
    const total = +(/of (\d+)/.exec(await page.locator('[aria-live="polite"].sr-only').first().innerText())?.[1] ?? 1);
    let shown = false;
    for (let i = 1; i < total && !shown; i++) {
      await page.getByRole("button", { name: "Next step" }).click();
      if (i >= 3 && (await page.getByLabel("Warning for this step").count())) { await shot(page, `${short}.${vp.name}.3-wrench-warning.jpg`); shown = true; }
    }
    while (!shown || (await page.getByRole("button", { name: "Complete this job" }).count()) === 0) {
      if (await page.getByRole("button", { name: "Complete this job" }).count()) break;
      await page.getByRole("button", { name: "Next step" }).click();
    }
    await page.getByRole("button", { name: "Complete this job" }).click();
    await shot(page, `${short}.${vp.name}.4-complete.jpg`);
    await page.getByRole("dialog", { name: /add this service/i }).getByRole("button", { name: "Not now" }).click();
    await page.getByRole("button", { name: "Finish Without Saving" }).click();
    console.log("shot", vp.name, short);
  }
  await ctx.close();
}
// blocked steps, real route, phone
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
const page = await signUpAdmin(ctx);
for (const slug of ["bmw-2010-328i-fuse-bulb", "bmw-2010-328i-serpentine-belt"]) {
  await page.goto(`${base}/admin/guides/test/${slug}`);
  await page.getByRole("button", { name: /start wrench mode/i }).click();
  for (let n = 0; n < 40; n++) {
    const t = await page.getByRole("dialog", { name: "Wrench Mode" }).getByRole("heading", { level: 2 }).innerText();
    if (/BLOCKED/.test(t)) { await shot(page, `${slug.replace("bmw-2010-328i-", "")}.phone.5-blocked-${n + 1}.jpg`); }
    if (await page.getByRole("button", { name: "Complete this job" }).count()) break;
    await page.getByRole("button", { name: "Next step" }).click();
  }
}
await browser.close(); await pool.end();
console.log("done", out);
