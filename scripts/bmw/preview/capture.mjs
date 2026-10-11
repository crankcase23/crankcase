#!/usr/bin/env node
// Drives the REAL guide components (preview harness) in Chromium across all 16 BMW drafts at desktop and phone widths.
// For each guide x viewport it checks: no console/page errors, no horizontal overflow, Planning Mode shows the key sections,
// Wrench Mode starts, steps forward one at a time to the end with the right "Step N of M", Previous works, Complete is offered.
// Writes screenshots and a JSON receipt. Exit code 1 if any check fails.
//   node scripts/bmw/preview/capture.mjs --dir BUILT_DIR --out OUT_DIR [--slugs a,b] [--shots all|key|none]
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const require = createRequire(path.join(ROOT, "package.json"));
const { chromium } = require("@playwright/test");
const a = process.argv.slice(2);
const arg = (n, d) => { const i = a.indexOf(`--${n}`); return i >= 0 ? a[i + 1] : d; };
const dir = path.resolve(arg("dir", ""));
const out = path.resolve(arg("out", ""));
const shots = arg("shots", "key");
if (!arg("dir") || !arg("out")) { console.error("usage: capture.mjs --dir BUILT --out OUT"); process.exit(2); }
fs.mkdirSync(out, { recursive: true });

const SLUGS = (arg("slugs") ?? "front-brake-pads,fuse-bulb,key-fob-battery,oxygen-sensor,rear-brake-pads,serpentine-belt,battery,coolant,fluid-checks,cabin-air-filter,pcv-valve,engine-air-filter,tire-rotation,wiper-blades,differential-fluid,oil-change").split(",").map((s) => `bmw-2010-328i-${s}`);
const VIEWPORTS = [{ name: "desktop", width: 1280, height: 900 }, { name: "phone", width: 390, height: 844, isMobile: true, hasTouch: true }];
const MIME = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".png": "image/png" };
const server = http.createServer((req, res) => {
  const u = new URL(req.url, "http://x");
  let f = path.join(dir, u.pathname === "/" ? "preview.html" : u.pathname);
  if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) f = path.join(ROOT, "public", u.pathname); // public/ assets (logo, guide-visuals)
  if (!f.startsWith(dir) && !f.startsWith(path.join(ROOT, "public"))) { res.writeHead(403).end(); return; }
  fs.readFile(f, (e, b) => { if (e) { res.writeHead(404).end(); return; } res.writeHead(200, { "content-type": MIME[path.extname(f)] ?? "application/octet-stream" }).end(b); });
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const base = `http://127.0.0.1:${server.address().port}/preview.html`;
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const receipt = { schema: "bmw-preview-receipt.v1", at: new Date().toISOString(), results: [] };
let failed = 0;

for (const slug of SLUGS) {
  for (const vp of VIEWPORTS) {
    const r = { slug, viewport: vp.name, checks: {}, problems: [] };
    const fail = (m) => { r.problems.push(m); };
    const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, isMobile: vp.isMobile, hasTouch: vp.hasTouch });
    const page = await ctx.newPage();
    const errs = [];
    page.on("pageerror", (e) => errs.push(`pageerror: ${e.message}`));
    page.on("console", (m) => { if (m.type() === "error" && !/Failed to load resource/.test(m.text())) errs.push(`console: ${m.text()}`); });
    page.on("response", (rs) => { if (rs.status() >= 400 && !/favicon/.test(rs.url())) errs.push(`http ${rs.status()}: ${rs.url()}`); });
    page.on("requestfailed", (q) => errs.push(`requestfailed: ${q.url()}`));
    try {
      await page.goto(`${base}?slug=${slug}`);
      await page.waitForSelector("h1", { timeout: 8000 });
      const g = await page.evaluate(() => window.__guide);
      r.guide = g;
      if (!g || !g.steps) fail("guide data missing or zero steps");
      const overflow = () => page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      // ---- Planning Mode
      const title = (await page.locator("h1").first().innerText()).trim();
      r.title = title;
      if (!/2010 BMW 328i/i.test(title)) fail(`title does not name the vehicle: ${title}`);
      const body = await page.locator("body").innerText();
      for (const [k, re] of Object.entries({ tools: /tools/i, parts: /parts/i, steps: /steps?/i, startButton: /start wrench mode/i })) {
        if (!re.test(body)) fail(`planning mode missing ${k}`);
      }
      if (g?.torque && !/torque/i.test(body)) fail("planning mode missing torque section");
      r.checks.planningOverflowPx = await overflow();
      if (r.checks.planningOverflowPx > 1) fail(`planning horizontal overflow ${r.checks.planningOverflowPx}px`);
      if (shots !== "none") await page.screenshot({ path: path.join(out, `${slug}.${vp.name}.planning.png`), fullPage: true });
      // ---- Wrench Mode
      await page.getByRole("button", { name: /start wrench mode/i }).click();
      await page.waitForSelector('[aria-label="Wrench Mode"]', { timeout: 5000 });
      const stepOf = async () => {
        const t = await page.locator('[aria-live="polite"].sr-only').first().innerText();
        const m = /Step (\d+) of (\d+): (.*)/.exec(t);
        return m ? { n: +m[1], of: +m[2], title: m[3] } : null;
      };
      const first = await stepOf();
      if (!first || first.n !== 1) fail(`wrench did not open at step 1: ${JSON.stringify(first)}`);
      if (first && g && first.of !== g.steps) fail(`wrench total ${first.of} != guide steps ${g.steps}`);
      const total = first?.of ?? g?.steps ?? 0;
      let maxOverflow = 0, emptyTitles = 0, longestStep = 0;
      for (let i = 1; i <= total; i++) {
        const s = await stepOf();
        if (!s || s.n !== i) { fail(`expected step ${i}, saw ${JSON.stringify(s)}`); break; }
        if (!s.title.trim()) emptyTitles++;
        const o = await overflow(); maxOverflow = Math.max(maxOverflow, o);
        // Clipped content: anything inside the scrolling step area that sticks out past its right edge (scrollWidth alone misses
        // this when a parent clips it, which is how an unbroken URL once ran off the phone screen unnoticed).
        const clipped = await page.evaluate(() => {
          const box = document.querySelector('[aria-label="Step instructions"]')?.closest(".overflow-y-auto");
          if (!box) return -1;
          const lim = box.getBoundingClientRect().right + 1;
          let worst = 0;
          for (const el of box.querySelectorAll("*")) { const r = el.getBoundingClientRect(); if (r.width && r.right > lim) worst = Math.max(worst, Math.round(r.right - lim)); }
          return worst;
        });
        if (clipped > 0) fail(`step ${i}: content runs ${clipped}px past the right edge`);
        const h = await page.locator('[aria-label="Step instructions"]').innerText().then((t) => t.length).catch(() => 0);
        if (!h) fail(`step ${i} has no instructions text`);
        longestStep = Math.max(longestStep, h);
        if (shots === "all" || (shots === "key" && (i === 1 || i === Math.ceil(total / 2) || i === total))) {
          await page.screenshot({ path: path.join(out, `${slug}.${vp.name}.wrench-${String(i).padStart(2, "0")}.png`) });
        }
        if (i < total) {
          await page.getByRole("button", { name: "Next step" }).click();
        }
      }
      if (maxOverflow > 1) fail(`wrench horizontal overflow ${maxOverflow}px`);
      r.checks.wrenchMaxOverflowPx = maxOverflow; r.checks.emptyTitles = emptyTitles; r.checks.longestStepChars = longestStep;
      if (emptyTitles) fail(`${emptyTitles} empty step titles`);
      const completeBtn = page.getByRole("button", { name: "Complete this job" });
      if (!(await completeBtn.isVisible())) fail("last step does not offer Complete");
      // Previous works
      await page.getByRole("button", { name: "Previous step" }).click();
      const back = await stepOf();
      if (!back || back.n !== total - 1) fail(`Previous did not go back: ${JSON.stringify(back)}`);
      // Overall guide returns to planning mode without losing the session
      await page.getByRole("button", { name: /overall guide/i }).first().click();
      if (!(await page.getByRole("button", { name: /resume wrench mode/i }).isVisible())) fail("Resume Wrench Mode not offered after leaving to Overall Guide");
    } catch (e) {
      fail(`exception: ${String(e.message).split("\n")[0]}`);
    }
    if (errs.length) for (const e of errs.slice(0, 5)) fail(e);
    r.pass = r.problems.length === 0;
    if (!r.pass) failed++;
    receipt.results.push(r);
    console.log(`${r.pass ? "PASS" : "FAIL"} ${slug} ${vp.name}${r.pass ? "" : "\n   - " + r.problems.join("\n   - ")}`);
    await ctx.close();
  }
}
// ---- error states (desktop): unknown slug, guide with no steps, no torque data, no tools/parts, a picture that fails to load
const ES = [];
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const run = async (name, url, fn) => {
    const page = await ctx.newPage(); const errs = [];
    page.on("pageerror", (e) => errs.push(e.message));
    const r = { name, problems: [] };
    try { await page.goto(`${base}${url}`); await fn(page, (m) => r.problems.push(m)); } catch (e) { r.problems.push(`exception: ${String(e.message).split("\n")[0]}`); }
    if (errs.length) r.problems.push(...errs.slice(0, 3));
    r.pass = !r.problems.length; if (!r.pass) failed++;
    ES.push(r); console.log(`${r.pass ? "PASS" : "FAIL"} error-state: ${name}${r.pass ? "" : "\n   - " + r.problems.join("\n   - ")}`);
    if (shots !== "none") await page.screenshot({ path: path.join(out, `error-state.${name}.png`) });
    await page.close();
  };
  await run("unknown-slug", "?slug=bmw-2010-328i-nope", async (p, f) => { if (!(await p.getByTestId("not-found").isVisible())) f("no not-found state"); });
  await run("empty-steps", "?fixture=empty-steps", async (p, f) => {
    await p.waitForSelector("h1");
    if (!/0 steps/i.test(await p.locator("body").innerText())) f("empty guide does not say it has 0 steps");
    const btn = p.getByRole("button", { name: /start wrench mode/i });
    if ((await btn.count()) && (await btn.isEnabled())) f("Start Wrench Mode is enabled on a guide with no steps");
  });
  await run("no-torque", "?fixture=no-torque", async (p, f) => {
    await p.waitForSelector("h1");
    await p.getByRole("button", { name: /start wrench mode/i }).click();
    await p.waitForSelector('[aria-label="Wrench Mode"]');
    const html = await p.locator('[aria-label="Wrench Mode"]').innerHTML();
    if (!/Step instructions/i.test(html)) f("Wrench Mode did not render instructions without torque data");
  });
  await run("no-parts-tools", "?fixture=no-parts-tools", async (p, f) => { await p.waitForSelector("h1"); if (!(await p.getByRole("button", { name: /start wrench mode/i }).isVisible())) f("Wrench Mode unavailable when parts/tools lists are empty"); });
  await run("broken-image", "?fixture=broken-image", async (p, f) => {
    await p.waitForSelector('[data-testid="after"]');
    await p.waitForTimeout(500);
    if (await p.getByText("FIXTURE broken picture").count()) f("a picture that failed to load is still shown (floating caption/callouts)");
    if (!(await p.getByTestId("after").isVisible())) f("content after a broken picture is not rendered");
  });
  await ctx.close();
}
receipt.errorStates = ES;
await browser.close(); server.close();
receipt.summary = { total: receipt.results.length + ES.length, passed: receipt.results.length + ES.length - failed, failed, guideViewportRuns: receipt.results.length, errorStateRuns: ES.length };
fs.writeFileSync(path.join(out, "receipt.json"), JSON.stringify(receipt, null, 2) + "\n");
console.log(JSON.stringify(receipt.summary));
process.exit(failed ? 1 : 0);
