import { test, expect, type Page } from "@playwright/test";
import { Pool } from "pg";
import { bmwDraftGuides } from "../../src/data/admin-test-guides/bmw-2010-328i-drafts";

// REAL-ROUTE test for the 16 BMW draft guides: /admin/guides/test/<slug>, signed in through the normal login form.
//
// SAFETY: this spec only runs against a THROWAWAY LOCAL database. It refuses (skips) unless DATABASE_URL points at
// localhost/127.0.0.1, because the one setup step it needs is flipping users.is_admin on its own freshly signed-up test
// account. It never touches an existing account, never reads secrets, and never runs against a deployed database.
//   Set DATABASE_URL to a local scratch Postgres on 127.0.0.1 (no password) and AUTH_SECRET to any throwaway, then: npx playwright test bmw-admin-guides
const DB = process.env.DATABASE_URL ?? "";
const LOCAL_DB = /^postgres(ql)?:\/\/[^/@]*@?(127\.0\.0\.1|localhost)(:\d+)?\//.test(DB);
test.skip(!LOCAL_DB, "needs a throwaway LOCAL DATABASE_URL (127.0.0.1/localhost); refusing to touch any other database");

const BLOCK = "⛔ BLOCKED — ";
let pool: Pool;
test.beforeAll(async ({ request }) => {
  pool = new Pool({ connectionString: DB });
  // Cold dev-server compiles race the first sign-ups (Auth.js reports a missing CSRF token). Warm the routes once.
  for (const p of ["/signup", "/login", "/garage", "/admin/guides", "/admin/guides/test/bmw-2010-328i-oil-change"]) await request.get(p, { timeout: 90_000, failOnStatusCode: false });
});
test.afterAll(async () => { await pool.end(); });

/** Sign up through the normal form (retrying through the normal login form if the dev server was still compiling). */
async function signUpNew(page: Page) {
  const email = `e2e-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`;
  const password = "testpassword123";
  await page.goto("/signup");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Create Account" }).click();
  await page.waitForURL(/\/(garage|login)(\?.*)?$/, { timeout: 30_000 });
  if (/\/login/.test(page.url())) {
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password").fill(password);
    await page.getByRole("button", { name: /sign in|log in/i }).click();
  }
  await expect(page).toHaveURL(/\/garage$/, { timeout: 30_000 });
  return email;
}

async function signUpAdmin(page: Page) {
  const email = await signUpNew(page);
  await pool.query("update users set is_admin = true where email = $1", [email]);
  return email;
}

/** Content inside the scrolling step area that sticks out past its right edge (a parent can hide this from scrollWidth). */
async function clippedPx(page: Page) {
  return page.evaluate(() => {
    const box = document.querySelector('[aria-label="Step instructions"]')?.closest(".overflow-y-auto");
    if (!box) return -1;
    const lim = box.getBoundingClientRect().right + 1;
    let worst = 0;
    for (const el of box.querySelectorAll("*")) { const r = el.getBoundingClientRect(); if (r.width && r.right > lim) worst = Math.max(worst, Math.round(r.right - lim)); }
    return worst;
  });
}
const stepOf = async (page: Page) => {
  const t = await page.locator('[aria-live="polite"].sr-only').first().innerText();
  const m = /Step (\d+) of (\d+): (.*)/.exec(t);
  return m ? { n: +m[1], of: +m[2], title: m[3] } : null;
};

for (const vp of [
  { name: "desktop", use: { viewport: { width: 1280, height: 900 } } },
  { name: "phone", use: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true } },
]) {
  test.describe(`real admin route, ${vp.name}`, () => {
    test.use(vp.use);

    for (const { slug, guide } of bmwDraftGuides) {
      test(`${slug}: planning, wrench walk, blocked steps, completion, recovery`, async ({ page }) => {
        test.setTimeout(120_000);
        await signUpAdmin(page);
        const errors: string[] = [];
        page.on("pageerror", (e) => errors.push(e.message));

        // ---- Planning Mode on the real route
        await page.goto(`/admin/guides/test/${slug}`);
        await expect(page.getByRole("heading", { level: 1 }).first()).toContainText("2010 BMW 328i");
        await expect(page.getByText("Admin test guide — not published")).toBeVisible();
        const body = await page.locator("body").innerText();
        for (const re of [/tools/i, /parts/i, /steps/i, /safety/i]) expect(body).toMatch(re);
        expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);

        // ---- Wrench Mode: every step, forward
        const total = guide.steps.length;
        await page.getByRole("button", { name: /start wrench mode/i }).click();
        await page.waitForSelector('[aria-label="Wrench Mode"]');
        for (let i = 1; i <= total; i++) {
          const s = await stepOf(page);
          expect(s, `step ${i}`).toMatchObject({ n: i, of: total });
          expect(await clippedPx(page), `step ${i} clipped`).toBeLessThanOrEqual(0);
          const expected = guide.steps[i - 1];
          if (expected.title.startsWith(BLOCK)) {
            // blocked-step behaviour: loud title, a warning module, and no way to mistake it for a procedure
            await expect(page.getByRole("dialog", { name: "Wrench Mode" }).getByRole("heading", { level: 2 })).toContainText("BLOCKED");
            await expect(page.getByLabel("Warning for this step")).toContainText("BLOCKED");
            await expect(page.getByLabel("Step instructions")).toContainText("This step is blocked");
          }
          if (i < total) await page.getByRole("button", { name: "Next step" }).click();
        }

        // ---- Completion: sheet opens, saving is honestly unavailable on the admin route, Back returns to the last step
        await page.getByRole("button", { name: "Complete this job" }).click();
        const sheet = page.getByRole("dialog", { name: /add this service/i });
        await expect(sheet).toBeVisible();
        await expect(sheet).toContainText("Saving is unavailable here");
        await expect(sheet.getByRole("button", { name: /save to service history/i })).toBeDisabled();
        await sheet.getByRole("button", { name: "Back to the last step" }).click();
        expect((await stepOf(page))?.n).toBe(total);
        // finish without saving -> confirmation -> back to a clean Planning Mode
        await page.getByRole("button", { name: "Complete this job" }).click();
        await page.getByRole("dialog", { name: /add this service/i }).getByRole("button", { name: "Not now" }).click();
        await page.getByRole("button", { name: "Finish Without Saving" }).click();
        await expect(page.getByRole("button", { name: /start wrench mode/i })).toBeVisible();

        // ---- Recovery: leave to Overall Guide mid-job and resume at the same step; Exit dialog; reload
        await page.getByRole("button", { name: /start wrench mode/i }).click();
        const target = Math.min(3, total);
        for (let i = 1; i < target; i++) await page.getByRole("button", { name: "Next step" }).click();
        await page.getByRole("button", { name: /overall guide/i }).first().click();
        await expect(page.getByRole("button", { name: /resume wrench mode/i })).toBeVisible();
        await expect(page.getByText(new RegExp(`Step ${target} of ${total}`)).first()).toBeVisible();
        await page.getByRole("button", { name: /resume wrench mode/i }).click();
        expect((await stepOf(page))?.n).toBe(target);
        if (vp.name === "desktop") {
          await page.keyboard.press("ArrowRight");
          expect((await stepOf(page))?.n).toBe(Math.min(target + 1, total));
          await page.keyboard.press("ArrowLeft");
          expect((await stepOf(page))?.n).toBe(target);
        }
        await page.getByRole("button", { name: /overall guide/i }).first().click();
        await page.getByRole("button", { name: /exit wrench mode/i }).click();
        await page.getByRole("button", { name: "Keep Wrenching" }).click();
        await expect(page.getByRole("button", { name: /resume wrench mode/i })).toBeVisible(); // Keep changes nothing
        await page.getByRole("button", { name: /exit wrench mode/i }).click();
        await page.getByRole("alertdialog").getByRole("button", { name: "Exit Wrench Mode" }).click();
        await expect(page.getByRole("button", { name: /start wrench mode/i })).toBeVisible();
        // reload mid-session: the session lives in memory by design, so a reload must come back clean, not crash
        await page.getByRole("button", { name: /start wrench mode/i }).click();
        await page.reload();
        await expect(page.getByRole("button", { name: /start wrench mode/i })).toBeVisible();

        expect(errors, "page errors").toEqual([]);
      });
    }
  });
}

test.describe("real admin route: access control is unchanged", () => {
  test("a signed-out visitor cannot reach a BMW draft", async ({ page }) => {
    await page.goto("/admin/guides/test/bmw-2010-328i-oil-change");
    await expect(page).toHaveURL(/\/login/);
  });

  test("a signed-in NON-admin is bounced and never sees the guide", async ({ page }) => {
    await signUpNew(page);
    await page.goto("/admin/guides/test/bmw-2010-328i-oil-change");
    await expect(page).not.toHaveURL(/\/admin/);
    await expect(page.getByText("Admin test guide — not published")).toHaveCount(0);
  });

  test("an admin gets a 404 for an unknown BMW slug", async ({ page }) => {
    await signUpAdmin(page);
    const res = await page.goto("/admin/guides/test/bmw-2010-328i-nope");
    expect(res?.status()).toBe(404);
  });

  test("the admin guide list links all 16 BMW drafts", async ({ page }) => {
    await signUpAdmin(page);
    await page.goto("/admin/guides");
    for (const { slug } of bmwDraftGuides) await expect(page.locator(`a[href="/admin/guides/test/${slug}"]`)).toHaveCount(1);
  });

  test("the customer side never exposes a BMW draft", async ({ page }) => {
    await signUpNew(page);
    const res = await page.goto("/vehicles/2010-bmw-328i-3.0l");
    expect(res?.status()).toBeLessThan(500);
    const html = await page.content();
    expect(html).not.toContain("admin-draft-bmw");
    expect(html).not.toContain("/admin/guides/test/bmw");
  });
});
