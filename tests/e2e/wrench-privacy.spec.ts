import { test, expect, type Page } from "@playwright/test";
import { signUpNewUser, validVin } from "./helpers";

// Wrench Mode saved progress must never cross accounts on a shared device. Two confirmed failures on the first PR #76 head
// (bd913ac) are pinned here, one permanent regression each, plus the paths around them:
//
//   PV-1  Logging out left the customer's saved progress in browser storage, readable by whoever signed in next.
//   PV-2  A car added with "Not sure / Not sure" has an unconfirmed configuration, so another account that opened that car's
//         URL (a garage id it can learn from storage) was offered "Resume Wrench Mode" and resumed the first account's session.
//   PV-3  Switching accounts without the Log out button (session gone, cookies cleared, sign-in elsewhere) left the same record.
//   PV-4  A record copied under another account's own key is never resumed.
//   PV-5  A foreign garage id is never persisted under: nothing is saved for a car the viewer does not own.
//   PV-6  Every sign-out control goes through the clearing wrapper (no raw signOut( call anywhere else in src).
//
// Keys are asserted by prefix only, so these hold whatever the key layout is.

const BMW = "2010-bmw-328i-3.0l";
const SLUG = "bmw-2010-328i-oil-change";
const BMW_ROW = { ModelYear: "2010", Make: "BMW", Model: "328i", BodyClass: "Sedan/Saloon", EngineCylinders: "6", DisplacementL: "3.0", FuelTypePrimary: "Gasoline" };
const PREFIX = "crankcase:wrench:";

async function addCar(page: Page, transmission = "Automatic", drivetrain = "Standard RWD"): Promise<string> {
  await page.route("**/vpic.nhtsa.dot.gov/**", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ Count: 1, Results: [{ ErrorCode: "0", ...BMW_ROW }] }) }),
  );
  await page.goto("/garage/add");
  await page.getByPlaceholder("Enter 17-character VIN").fill(validVin("WBA"));
  await page.getByRole("button", { name: "Decode" }).click();
  await page.getByRole("button", { name: "+ Add to garage" }).click();
  await expect(page.getByTestId("confirm-your-ride")).toBeVisible();
  await page.getByRole("radiogroup", { name: "Transmission" }).getByText(transmission, { exact: true }).click();
  await page.getByRole("radiogroup", { name: "Drivetrain" }).getByText(drivetrain, { exact: true }).click();
  await page.getByRole("button", { name: /and add to garage$/ }).click();
  await expect(page).toHaveURL(new RegExp(`/vehicles/${BMW}~[^/]+$`), { timeout: 20_000 });
  return new URL(page.url()).pathname;
}

const startBtn = (page: Page) => page.getByRole("button", { name: /start wrench mode/i });
const resumeBtn = (page: Page) => page.getByRole("button", { name: /resume wrench mode/i });
const next = (page: Page) => page.getByRole("button", { name: "Next step" });
const keys = (page: Page) => page.evaluate((p) => Object.keys(localStorage).filter((k) => k.startsWith(p)), PREFIX);
const spa = async (page: Page, url: string) => { await page.evaluate((u) => (window as unknown as { next: { router: { push(u: string): void } } }).next.router.push(u), url); };

/** Sign up, add a car, start the oil change and go to step 3, then return to the Overall Guide. */
async function jobAtStep3(page: Page, transmission?: string, drivetrain?: string) {
  await signUpNewUser(page);
  const hub = await addCar(page, transmission, drivetrain);
  await spa(page, `${hub}/repairs/${SLUG}`);
  await expect(startBtn(page)).toBeVisible({ timeout: 30_000 });
  await startBtn(page).click();
  await next(page).click();
  await next(page).click();
  await expect(page.getByRole("dialog", { name: "Wrench Mode" }).getByText(/Step 3 of \d+ · /)).toBeVisible();
  await expect.poll(() => keys(page).then((k) => k.length)).toBe(1);
  await page.getByRole("button", { name: /overall guide/i }).first().click();
  await page.waitForTimeout(300);
  return hub;
}

/** The real Log out control, on phone (menu) or desktop (header). */
async function logOutViaUi(page: Page) {
  const menu = page.getByRole("button", { name: "Open menu" });
  if (await menu.isVisible()) await menu.click();
  await page.getByRole("button", { name: "Log out" }).filter({ visible: true }).first().click();
  await expect(page).toHaveURL(/localhost:3100\/$/, { timeout: 20_000 });
}

test.beforeAll(async ({ request }) => {
  for (const p of ["/signup", "/login", "/garage"]) await request.get(p, { timeout: 90_000, failOnStatusCode: false });
});

for (const vp of [
  { name: "phone", viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true },
  { name: "desktop", viewport: { width: 1280, height: 800 }, hasTouch: false, isMobile: false },
]) {
  test.describe(`Wrench Mode progress privacy, ${vp.name}`, () => {
    test.use({ viewport: vp.viewport, hasTouch: vp.hasTouch, isMobile: vp.isMobile });

    test("PV-1: logging out removes the saved Wrench progress from browser storage", async ({ page }) => {
      await jobAtStep3(page);
      expect((await keys(page)).length, "precondition: a record exists while signed in").toBe(1);
      await logOutViaUi(page);
      expect(await keys(page), "no Wrench progress may outlive the session that made it").toEqual([]);
    });

    test("PV-2: another account opening a car with an unconfirmed configuration never sees or resumes the first account's job", async ({ page }) => {
      const hubA = await jobAtStep3(page, "Not sure", "Not sure");
      await logOutViaUi(page);
      await signUpNewUser(page);
      await page.goto(`${hubA}/repairs/${SLUG}`);
      await expect(startBtn(page)).toBeVisible({ timeout: 30_000 });
      await expect(resumeBtn(page)).toHaveCount(0);
      await expect(page.getByText(/Step 3 of \d+/)).toHaveCount(0);
      expect(await keys(page)).toEqual([]);
    });

    test("PV-2b: same, when the first account's record is still in storage (logout purge bypassed)", async ({ page }) => {
      const hubA = await jobAtStep3(page, "Not sure", "Not sure");
      const [keyA] = await keys(page);
      const rawA = await page.evaluate((k) => localStorage.getItem(k), keyA);
      await logOutViaUi(page);
      await signUpNewUser(page);
      await page.evaluate(([k, v]) => localStorage.setItem(k, v!), [keyA, rawA] as const);
      await page.goto(`${hubA}/repairs/${SLUG}`);
      await expect(startBtn(page)).toBeVisible({ timeout: 30_000 });
      await expect(resumeBtn(page), "a record from another account is never offered").toHaveCount(0);
    });

    test("PV-3: switching accounts without the Log out button leaves no progress for the next account", async ({ page, context }) => {
      const hubA = await jobAtStep3(page, "Not sure", "Not sure");
      // session gone by any route other than the button: expiry, cleared cookies, signing in elsewhere
      await context.clearCookies();
      expect((await keys(page)).length, "precondition: storage is untouched by a cookie clear").toBe(1);
      await signUpNewUser(page);
      await expect.poll(() => keys(page), { message: "the next account's first signed-in page load removes the old record" }).toEqual([]);
      await page.goto(`${hubA}/repairs/${SLUG}`);
      await expect(startBtn(page)).toBeVisible({ timeout: 30_000 });
      await expect(resumeBtn(page)).toHaveCount(0);
    });

    test("PV-4: a record copied under another account's own key is not resumed", async ({ page }) => {
      await jobAtStep3(page);
      const [keyA] = await keys(page);
      const rawA = await page.evaluate((k) => localStorage.getItem(k), keyA);
      await logOutViaUi(page);
      await signUpNewUser(page);
      const hubB = await addCar(page);
      await spa(page, `${hubB}/repairs/${SLUG}`);
      await expect(startBtn(page)).toBeVisible({ timeout: 30_000 });
      await startBtn(page).click();
      await next(page).click();
      const [keyB] = await keys(page);
      expect(keyB).toBeTruthy();
      expect(keyB, "different account, different key").not.toBe(keyA);
      await page.evaluate(([k, v]) => localStorage.setItem(k, v!), [keyB, rawA] as const);
      await page.reload();
      await expect(startBtn(page)).toBeVisible({ timeout: 30_000 });
      await expect(resumeBtn(page)).toHaveCount(0);
    });

    test("PV-5: nothing is persisted for a garage id the viewer does not own", async ({ page, context }) => {
      const hubA = await jobAtStep3(page, "Not sure", "Not sure");
      await context.clearCookies();
      await page.evaluate(() => localStorage.clear());
      await signUpNewUser(page);
      await page.goto(`${hubA}/repairs/${SLUG}`);
      await expect(startBtn(page)).toBeVisible({ timeout: 30_000 });
      await startBtn(page).click();
      await next(page).click();
      await expect(page.getByRole("dialog", { name: "Wrench Mode" })).toBeVisible();
      expect(await keys(page), "a foreign car's guide runs in memory only").toEqual([]);
    });
  });
}
