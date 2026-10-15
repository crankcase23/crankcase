import { test, expect, type Page, type BrowserContext } from "@playwright/test";
import { signUpNewUser, validVin } from "./helpers";

// Wrench Mode: screen Wake Lock (WL), browser Back (BK) and device-local progress (PR). Customer route, real signed-in garage
// vehicle, phone and desktop emulation. One confirmed failure = one permanent regression; ids below name the behaviour pinned.
//
//   PR  progress survives refresh, browser restart and in-app navigation; scoped to garage vehicle + guide + configuration;
//       stale / incompatible / unreadable / expired progress is rejected; cleared only by confirmed exit, finish or a
//       configuration change, never by ordinary navigation; storage failure degrades to the old in-memory behaviour.
//   BK  Back while the overlay is open closes the overlay (session kept); closed, Back is ordinary navigation.
//   WL  the screen is kept awake only while the overlay is open; unsupported / denied browsers are unaffected.
//
// The admin preview host has no garage id, so it stays in memory by design: bmw-admin-guides.spec.ts still asserts that.

const BMW = "2010-bmw-328i-3.0l";
const SLUG = "bmw-2010-328i-oil-change";
const OTHER_SLUG = "bmw-2010-328i-front-brake-pads";
const BMW_ROW = { ModelYear: "2010", Make: "BMW", Model: "328i", BodyClass: "Sedan/Saloon", EngineCylinders: "6", DisplacementL: "3.0", FuelTypePrimary: "Gasoline" };
const PREFIX = "crankcase:wrench:";

async function addBmwCar(page: Page): Promise<string> {
  await signUpNewUser(page); // each test gets its own throwaway account, so garage and storage state never leak between tests
  await page.route("**/vpic.nhtsa.dot.gov/**", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ Count: 1, Results: [{ ErrorCode: "0", ...BMW_ROW }] }) }),
  );
  await page.goto("/garage/add");
  await page.getByPlaceholder("Enter 17-character VIN").fill(validVin("WBA"));
  await page.getByRole("button", { name: "Decode" }).click();
  await page.getByRole("button", { name: "+ Add to garage" }).click();
  await expect(page.getByTestId("confirm-your-ride")).toBeVisible();
  await page.getByRole("radiogroup", { name: "Transmission" }).getByText("Automatic", { exact: true }).click();
  await page.getByRole("radiogroup", { name: "Drivetrain" }).getByText("Standard RWD", { exact: true }).click();
  await page.getByRole("button", { name: /and add to garage$/ }).click();
  await expect(page).toHaveURL(new RegExp(`/vehicles/${BMW}~[^/]+$`), { timeout: 20_000 });
  return new URL(page.url()).pathname; // /vehicles/<catalog>~<rowId>: the permanent garage id of this car
}

const dialog = (page: Page) => page.getByRole("dialog", { name: "Wrench Mode" });
const startBtn = (page: Page) => page.getByRole("button", { name: /start wrench mode/i });
const resumeBtn = (page: Page) => page.getByRole("button", { name: /resume wrench mode/i });
const next = (page: Page) => page.getByRole("button", { name: "Next step" });
async function stepOf(page: Page): Promise<{ n: number; of: number } | null> {
  const m = /Step\s+(\d+)\s+of\s+(\d+)/i.exec(await dialog(page).innerText().catch(() => ""));
  return m ? { n: Number(m[1]), of: Number(m[2]) } : null;
}
/** SPA navigation (no document load), so history behaves like a customer tapping links. */
const spa = async (page: Page, url: string) => { await page.evaluate((u) => (window as unknown as { next: { router: { push(u: string): void } } }).next.router.push(u), url); };
const guideUrl = (hub: string, slug = SLUG) => `${hub}/repairs/${slug}`;
const garageIdOf = (hub: string) => decodeURIComponent(hub.split("/vehicles/")[1]);
const storedKeys = (page: Page) => page.evaluate((p) => Object.keys(localStorage).filter((k) => k.startsWith(p)), PREFIX);
// Keys are scoped to the signed-in account (an opaque 22-char token the test cannot compute), so assert their shape and look the real one up.
const keyShape = (hub: string, slug = SLUG) => new RegExp(`^${PREFIX}v1:[A-Za-z0-9_-]{22}:${garageIdOf(hub).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}:${slug}$`);
const expectOneKeyFor = async (page: Page, hub: string, message?: string) => {
  const ks = await storedKeys(page);
  expect(ks, message).toHaveLength(1);
  expect(ks[0], message).toMatch(keyShape(hub));
};
const keyFor = async (page: Page, hub: string) => { await expectOneKeyFor(page, hub); return (await storedKeys(page))[0]; };

/** Sign up, add a BMW, land on its guide via in-app navigation (so Back has somewhere to go), open Wrench Mode, advance to step n. */
async function startAtStep(page: Page, n = 3) {
  const hub = await addBmwCar(page);
  await spa(page, guideUrl(hub));
  await expect(startBtn(page)).toBeVisible({ timeout: 30_000 });
  await startBtn(page).click();
  await expect(dialog(page)).toBeVisible();
  for (let i = 1; i < n; i++) await next(page).click();
  expect((await stepOf(page))?.n).toBe(n);
  return hub;
}
const toOverallGuide = async (page: Page) => {
  await page.getByRole("button", { name: /overall guide/i }).first().click();
  await expect(dialog(page)).toHaveCount(0);
  // Closing pops the Back-guard history entry with history.back(), which the browser applies asynchronously; let it settle so a
  // test (or a script) does not navigate within the same millisecond. A person cannot tap that fast.
  await page.waitForTimeout(300);
};

// A controllable Screen Wake Lock. mode: "ok" | "deny" | "none" (API absent).
async function fakeWakeLock(ctx: BrowserContext, mode: "ok" | "deny" | "none") {
  await ctx.addInitScript((m) => {
    const w = window as unknown as { __wl: { requests: number; releases: number; active: number; sentinels: { released: boolean; _drop: () => void }[] } };
    w.__wl = { requests: 0, releases: 0, active: 0, sentinels: [] };
    if (m === "none") { Object.defineProperty(navigator, "wakeLock", { configurable: true, value: undefined }); return; }
    Object.defineProperty(navigator, "wakeLock", {
      configurable: true,
      value: {
        request: async () => {
          w.__wl.requests++;
          if (m === "deny") throw new DOMException("denied", "NotAllowedError");
          const target = new EventTarget();
          const s = {
            released: false,
            addEventListener: (t: string, cb: () => void) => target.addEventListener(t, cb),
            release: async () => s._drop(),
            _drop: () => { if (s.released) return; s.released = true; w.__wl.releases++; w.__wl.active--; target.dispatchEvent(new Event("release")); },
          };
          w.__wl.active++;
          w.__wl.sentinels.push(s);
          return s;
        },
      },
    });
  }, mode);
}
const wl = (page: Page) => page.evaluate(() => (window as unknown as { __wl: { requests: number; releases: number; active: number } }).__wl);

test.beforeAll(async ({ request }) => {
  for (const p of ["/signup", "/login", "/garage"]) await request.get(p, { timeout: 90_000, failOnStatusCode: false });
});

for (const vp of [
  { name: "phone", viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true },
  { name: "desktop", viewport: { width: 1280, height: 800 }, hasTouch: false, isMobile: false },
]) {
  test.describe(`Wrench Mode resume, ${vp.name}`, () => {
    test.use({ viewport: vp.viewport, hasTouch: vp.hasTouch, isMobile: vp.isMobile });

    // ------------------------------------------------------------------------------------------------ Wake Lock
    test.describe("Wake Lock (WL)", () => {
      test("WL-1: requested when Wrench Mode opens, released when it closes, requested again on resume, released on exit", async ({ page, context }) => {
        await fakeWakeLock(context, "ok");
        await startAtStep(page, 2);
        await expect(dialog(page)).toHaveAttribute("data-wake-lock", "active");
        // NET held locks, not raw request counts: React Strict Mode in `next dev` mounts effects twice (2 requests, 1 released).
        expect(await wl(page), "exactly one lock held while open, none leaked").toMatchObject({ active: 1 });
        const afterOpen = (await wl(page)).requests;
        expect(afterOpen).toBeGreaterThanOrEqual(1);

        await toOverallGuide(page);
        expect((await wl(page)).active, "overlay closed: the screen may sleep again").toBe(0);

        await resumeBtn(page).click();
        await expect(dialog(page)).toHaveAttribute("data-wake-lock", "active");
        expect(await wl(page), "resume takes a new lock").toMatchObject({ active: 1 });
        expect((await wl(page)).requests).toBeGreaterThan(afterOpen);

        await toOverallGuide(page);
        await page.getByRole("button", { name: /exit wrench mode/i }).click();
        await page.getByRole("alertdialog").getByRole("button", { name: "Exit Wrench Mode" }).click();
        expect((await wl(page)).active, "no lock left held after exit").toBe(0);
      });

      test("WL-2: the browser dropping the lock (tab hidden) is followed by a new request when the tab is visible again", async ({ page, context }) => {
        await fakeWakeLock(context, "ok");
        await startAtStep(page, 2);
        const before = (await wl(page)).requests;
        // the browser drops the live lock (tab hidden / phone locked)
        await page.evaluate(() => (window as unknown as { __wl: { sentinels: { released: boolean; _drop: () => void }[] } }).__wl.sentinels.find((s) => !s.released)!._drop());
        await expect(dialog(page)).toHaveAttribute("data-wake-lock", "released");
        expect((await wl(page)).active).toBe(0);
        await page.evaluate(() => document.dispatchEvent(new Event("visibilitychange")));
        await expect(dialog(page)).toHaveAttribute("data-wake-lock", "active");
        expect(await wl(page)).toMatchObject({ active: 1 });
        expect((await wl(page)).requests, "re-requested after the drop").toBeGreaterThan(before);
      });

      test("WL-3: a browser without the API runs Wrench Mode normally, with no errors", async ({ page, context }) => {
        const errors: string[] = [];
        page.on("pageerror", (e) => errors.push(e.message));
        await fakeWakeLock(context, "none");
        await startAtStep(page, 2);
        await expect(dialog(page)).toHaveAttribute("data-wake-lock", "unsupported");
        await next(page).click();
        expect((await stepOf(page))?.n).toBe(3);
        expect(errors).toEqual([]);
      });

      test("WL-4: a refused request (battery saver, policy) is swallowed: Wrench Mode keeps working, no retry loop", async ({ page, context }) => {
        const errors: string[] = [];
        page.on("pageerror", (e) => errors.push(e.message));
        await fakeWakeLock(context, "deny");
        await startAtStep(page, 2);
        await expect(dialog(page)).toHaveAttribute("data-wake-lock", "denied");
        await next(page).click();
        expect((await stepOf(page))?.n).toBe(3);
        const settled = (await wl(page)).requests;
        await page.waitForTimeout(1_500);
        expect((await wl(page)).requests, "a refusal is not retried in a loop").toBe(settled);
        expect(settled, "at most one request per mount (two under Strict Mode in dev)").toBeLessThanOrEqual(2);
        expect((await wl(page)).active).toBe(0);
        expect(errors).toEqual([]);
      });
    });

    // ------------------------------------------------------------------------------------------------ Back
    test.describe("Back (BK)", () => {
      test("BK-1: Back inside Wrench Mode closes the overlay and keeps the session; a second Back leaves the page", async ({ page }) => {
        const hub = await startAtStep(page, 3);
        const guide = guideUrl(hub);
        await page.goBack();
        await expect(dialog(page)).toHaveCount(0);
        expect(new URL(page.url()).pathname, "still on the guide page").toBe(guide);
        await expect(resumeBtn(page)).toBeVisible();
        await expect(page.getByText(/Step 3 of \d+/).first()).toBeVisible();
        await resumeBtn(page).click();
        expect((await stepOf(page))?.n).toBe(3);

        await toOverallGuide(page);
        await page.goBack();
        await expect(page).toHaveURL(new RegExp(`${hub.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`));
      });

      test("BK-2: with Wrench Mode never opened, one Back leaves the guide (ordinary navigation is untouched)", async ({ page }) => {
        const hub = await addBmwCar(page);
        await spa(page, guideUrl(hub));
        await expect(startBtn(page)).toBeVisible({ timeout: 30_000 });
        await page.goBack();
        await expect(page).toHaveURL(new RegExp(`${hub.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`));
      });

      test("BK-3: after '← Overall Guide', one Back leaves the guide (no leftover history entry)", async ({ page }) => {
        const hub = await startAtStep(page, 3);
        await toOverallGuide(page);
        await page.waitForTimeout(300); // history.back() that removes the guard entry is asynchronous
        await page.goBack();
        await expect(page).toHaveURL(new RegExp(`${hub.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`));
      });

      test("BK-4: after a confirmed exit, one Back leaves the guide", async ({ page }) => {
        const hub = await startAtStep(page, 3);
        await toOverallGuide(page);
        await page.getByRole("button", { name: /exit wrench mode/i }).click();
        await page.getByRole("alertdialog").getByRole("button", { name: "Exit Wrench Mode" }).click();
        await expect(startBtn(page)).toBeVisible();
        await page.waitForTimeout(300);
        await page.goBack();
        await expect(page).toHaveURL(new RegExp(`${hub.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`));
      });

      test("BK-5: Back never loses the step: close with Back, reopen, keep stepping", async ({ page }) => {
        await startAtStep(page, 4);
        await page.goBack();
        await resumeBtn(page).click();
        await next(page).click();
        expect((await stepOf(page))?.n).toBe(5);
        await page.goBack();
        await page.reload();
        await expect(page.getByText(/Step 5 of \d+/).first()).toBeVisible();
      });
    });

    // ------------------------------------------------------------------------------------------------ Persistence
    test.describe("Persistence (PR)", () => {
      test("PR-1: a refresh mid-job resumes at the same step (and never opens the overlay by itself)", async ({ page }) => {
        const hub = await startAtStep(page, 3);
        await page.reload();
        await expect(resumeBtn(page)).toBeVisible({ timeout: 20_000 });
        await expect(startBtn(page)).toHaveCount(0);
        await expect(dialog(page)).toHaveCount(0);
        await expect(page.getByText(/Step 3 of \d+/).first()).toBeVisible();
        await resumeBtn(page).click();
        expect((await stepOf(page))?.n).toBe(3);
        await expectOneKeyFor(page, hub);
      });

      test("PR-2: progress is saved on every step, so the LATEST step is what comes back", async ({ page }) => {
        await startAtStep(page, 3);
        await next(page).click();
        await next(page).click();
        expect((await stepOf(page))?.n).toBe(5);
        await page.reload();
        await expect(page.getByText(/Step 5 of \d+/).first()).toBeVisible({ timeout: 20_000 });
        await resumeBtn(page).click();
        await page.getByRole("button", { name: "Previous step" }).click();
        expect((await stepOf(page))?.n).toBe(4);
        await toOverallGuide(page);
        await page.reload();
        await expect(page.getByText(/Step 4 of \d+/).first()).toBeVisible({ timeout: 20_000 });
      });

      test("PR-3: a browser restart (new browser context carrying only cookies and localStorage) resumes", async ({ page, browser }) => {
        const hub = await startAtStep(page, 4);
        const state = await page.context().storageState();
        await page.context().close();
        const ctx2 = await browser.newContext({ storageState: state, viewport: vp.viewport, hasTouch: vp.hasTouch, isMobile: vp.isMobile });
        const p2 = await ctx2.newPage();
        await p2.goto(guideUrl(hub));
        await expect(resumeBtn(p2)).toBeVisible({ timeout: 30_000 });
        await expect(p2.getByText(/Step 4 of \d+/).first()).toBeVisible();
        await resumeBtn(p2).click();
        expect((await stepOf(p2))?.n).toBe(4);
        await ctx2.close();
      });

      test("PR-4: navigating away and back inside the app resumes, and does not clear anything", async ({ page }) => {
        const hub = await startAtStep(page, 3);
        await toOverallGuide(page);
        await spa(page, hub);
        await expect(page).toHaveURL(new RegExp(`${hub.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`));
        await expectOneKeyFor(page, hub, "ordinary navigation must not clear progress");
        await spa(page, guideUrl(hub));
        await expect(resumeBtn(page)).toBeVisible({ timeout: 30_000 });
        await expect(page.getByText(/Step 3 of \d+/).first()).toBeVisible();
      });

      test("PR-5: progress is scoped to vehicle AND guide: another guide, and a second car of the same model, start fresh", async ({ page }) => {
        const hubA = await startAtStep(page, 3);
        await toOverallGuide(page);

        await spa(page, guideUrl(hubA, OTHER_SLUG));
        await expect(startBtn(page)).toBeVisible({ timeout: 30_000 });
        await expect(resumeBtn(page)).toHaveCount(0);

        // a second car of the same model on the same account
        await page.goto("/garage/add");
        await page.getByPlaceholder("Enter 17-character VIN").fill(validVin("WBA"));
        await page.getByRole("button", { name: "Decode" }).click();
        await page.getByRole("button", { name: "+ Add to garage" }).click();
        await page.getByRole("radiogroup", { name: "Transmission" }).getByText("Automatic", { exact: true }).click();
        await page.getByRole("radiogroup", { name: "Drivetrain" }).getByText("Standard RWD", { exact: true }).click();
        await page.getByRole("button", { name: /and add to garage$/ }).click();
        await expect(page).toHaveURL(new RegExp(`/vehicles/${BMW}~[^/]+$`), { timeout: 20_000 });
        const hubB = new URL(page.url()).pathname;
        expect(hubB).not.toBe(hubA);
        await spa(page, guideUrl(hubB));
        await expect(startBtn(page)).toBeVisible({ timeout: 30_000 });
        await expect(resumeBtn(page)).toHaveCount(0);

        // and car A's own progress is still there
        await page.goto(guideUrl(hubA));
        await expect(resumeBtn(page)).toBeVisible({ timeout: 30_000 });
        await expect(page.getByText(/Step 3 of \d+/).first()).toBeVisible();
        await expectOneKeyFor(page, hubA);
      });

      test("PR-6: a real configuration change rejects and removes saved progress", async ({ page }) => {
        const hub = await startAtStep(page, 3);
        const r = await page.request.patch(`/api/garage/${encodeURIComponent(garageIdOf(hub))}`, { data: { transmission: "unknown", drivetrain: "unknown" } });
        expect(r.ok()).toBeTruthy();
        await page.goto(guideUrl(hub));
        await expect(page.getByTestId("config-needs-confirmation")).toBeVisible({ timeout: 30_000 });
        await expect(resumeBtn(page)).toHaveCount(0);
        await expect.poll(() => storedKeys(page)).toEqual([]);
      });

      test("PR-7: progress recorded under another configuration, another guide version or another step is rejected and removed", async ({ page }) => {
        const hub = await startAtStep(page, 3);
        const key = await keyFor(page, hub);
        const cases: Array<[string, Record<string, unknown>]> = [
          ["configuration identity differs", { configKey: "manual|awd" }],
          ["guide content changed (plan signature differs)", { planSignature: "stale-signature" }],
          ["step identity differs at that position", { stepId: "some-other-step" }],
          ["step count differs", { total: 999 }],
          ["index outside the guide", { index: 500 }],
          ["recorded for another vehicle", { garageId: "2010-bmw-328i-3.0l~someone-else" }],
          ["recorded for another account", { scope: "someoneElse0000000000000" }],
        ];
        const original = await page.evaluate((k) => localStorage.getItem(k), key);
        expect(original).toBeTruthy();
        for (const [name, patch] of cases) {
          await page.evaluate(([k, v]) => localStorage.setItem(k, v), [key, JSON.stringify({ ...JSON.parse(original!), ...patch })]);
          await page.reload();
          await expect(startBtn(page), name).toBeVisible({ timeout: 20_000 });
          await expect(resumeBtn(page), name).toHaveCount(0);
          // "Start" is in the server HTML, so it is visible before hydration has run the effect that rejects and deletes the record.
          await expect.poll(() => storedKeys(page), { message: `${name}: rejected record removed` }).toEqual([]);
        }
      });

      test("PR-8: unreadable, foreign-version and expired records fall back to Start without errors", async ({ page }) => {
        const errors: string[] = [];
        page.on("pageerror", (e) => errors.push(e.message));
        const hub = await startAtStep(page, 3);
        const key = await keyFor(page, hub);
        const original = (await page.evaluate((k) => localStorage.getItem(k), key))!;
        const variants: Array<[string, string]> = [
          ["corrupt JSON", "{{{not json"],
          ["future version", JSON.stringify({ ...JSON.parse(original), v: 99 })],
          ["expired (saved 15 days ago)", JSON.stringify({ ...JSON.parse(original), savedAt: Date.now() - 15 * 24 * 3600 * 1000 })],
        ];
        for (const [name, value] of variants) {
          await page.evaluate(([k, v]) => localStorage.setItem(k, v), [key, value]);
          await page.reload();
          await expect(startBtn(page), name).toBeVisible({ timeout: 20_000 });
          await expect.poll(() => storedKeys(page), { message: name }).toEqual([]);
        }
        expect(errors).toEqual([]);
      });

      test("PR-9: Keep Wrenching keeps progress; a confirmed exit clears it; Start then begins at step 1", async ({ page }) => {
        const hub = await startAtStep(page, 3);
        await toOverallGuide(page);
        await page.getByRole("button", { name: /exit wrench mode/i }).click();
        await page.getByRole("button", { name: "Keep Wrenching" }).click();
        await expectOneKeyFor(page, hub, "Keep Wrenching changes nothing");
        await page.reload();
        await expect(page.getByText(/Step 3 of \d+/).first()).toBeVisible({ timeout: 20_000 });

        await page.getByRole("button", { name: /exit wrench mode/i }).click();
        await page.getByRole("alertdialog").getByRole("button", { name: "Exit Wrench Mode" }).click();
        await expect(startBtn(page)).toBeVisible();
        expect(await storedKeys(page), "confirmed exit clears progress").toEqual([]);
        await page.reload();
        await expect(startBtn(page)).toBeVisible({ timeout: 20_000 });
        await startBtn(page).click();
        expect((await stepOf(page))?.n, "an explicit restart begins at step 1").toBe(1);
      });

      test("PR-10: finishing the job (saved to Service History) clears progress", async ({ page }) => {
        await startAtStep(page, 2);
        const total = (await stepOf(page))!.of;
        for (let i = 2; i < total; i++) await next(page).click();
        await page.getByRole("button", { name: "Complete this job" }).click();
        const sheet = page.getByRole("dialog", { name: /add this service/i });
        await sheet.getByLabel("Current mileage").fill("54321");
        await sheet.getByRole("button", { name: /save to service history/i }).click();
        await expect(startBtn(page)).toBeVisible({ timeout: 20_000 });
        expect(await storedKeys(page), "a finished job leaves no progress behind").toEqual([]);
        await page.reload();
        await expect(startBtn(page)).toBeVisible({ timeout: 20_000 });
      });

      test("PR-11: a failed save does NOT clear progress (nothing was finished)", async ({ page }) => {
        const hub = await startAtStep(page, 2);
        await page.route("**/api/garage/*/service", (route) => (route.request().method() === "POST" ? route.fulfill({ status: 500, body: "{}" }) : route.fallback()));
        const total = (await stepOf(page))!.of;
        for (let i = 2; i < total; i++) await next(page).click();
        await page.getByRole("button", { name: "Complete this job" }).click();
        const sheet = page.getByRole("dialog", { name: /add this service/i });
        await sheet.getByLabel("Current mileage").fill("54321");
        await sheet.getByRole("button", { name: /save to service history/i }).click();
        await expect(sheet).toContainText(/could not save/i);
        await expectOneKeyFor(page, hub);
      });

      test("PR-12: the legacy bare catalog URL and the car's own URL share one progress record (the page resolves the alias)", async ({ page }) => {
        const hub = await addBmwCar(page);
        await page.goto(`/vehicles/${BMW}/repairs/${SLUG}`);
        await expect(startBtn(page)).toBeVisible({ timeout: 30_000 });
        await startBtn(page).click();
        await next(page).click();
        await next(page).click();
        expect((await stepOf(page))?.n).toBe(3);
        await expectOneKeyFor(page, hub, "saved under the car's permanent id, never under the shared alias");
        await toOverallGuide(page);
        await page.goto(guideUrl(hub));
        await expect(resumeBtn(page)).toBeVisible({ timeout: 30_000 });
        await expect(page.getByText(/Step 3 of \d+/).first()).toBeVisible();
      });

      test("PR-13: storage that throws (private mode, blocked site data) falls back to in-memory Resume with no errors", async ({ page, context }) => {
        const errors: string[] = [];
        page.on("pageerror", (e) => errors.push(e.message));
        await context.addInitScript(() => {
          // Deny only this feature's keys, so the failure under test is Wrench Mode's storage, not unrelated app code.
          const deny = (orig: (...a: string[]) => unknown) =>
            function (this: Storage, k: string, ...rest: string[]) {
              if (String(k).startsWith("crankcase:wrench:")) throw new DOMException("blocked", "SecurityError");
              return orig.call(this, k, ...rest);
            };
          Storage.prototype.setItem = deny(Storage.prototype.setItem as never) as never;
          Storage.prototype.getItem = deny(Storage.prototype.getItem as never) as never;
          Storage.prototype.removeItem = deny(Storage.prototype.removeItem as never) as never;
        });
        await startAtStep(page, 3);
        await toOverallGuide(page);
        await expect(resumeBtn(page)).toBeVisible();
        await resumeBtn(page).click();
        expect((await stepOf(page))?.n).toBe(3);
        await next(page).click();
        expect((await stepOf(page))?.n).toBe(4);
        expect(errors).toEqual([]);
      });
    });
  });
}
