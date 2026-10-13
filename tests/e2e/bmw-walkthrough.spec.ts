import { test, expect } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { signUpNewUser, validVin } from "./helpers";

// Final customer walkthrough for the 2010 BMW 328i, confirmed Automatic + standard RWD, through the real screens on a
// production build: sign up -> VIN -> Confirm Your Ride -> garage -> vehicle page -> a guide -> Wrench Mode -> save to
// Service History -> log out and back in. Run on a phone and a desktop viewport. Screenshots go to SHOTS_DIR for review.
// NHTSA is not reachable from the test box, so the VIN decode answer is mocked (everything after it is real).

const BMW = "2010-bmw-328i-3.0l";
const OIL = `/vehicles/${BMW}/repairs/bmw-2010-328i-oil-change`;
const SHOTS = process.env.SHOTS_DIR ?? "test-results/walkthrough";
fs.mkdirSync(SHOTS, { recursive: true });

const ROW = { ModelYear: "2010", Make: "BMW", Model: "328i", BodyClass: "Sedan/Saloon", EngineCylinders: "6", DisplacementL: "3.0", FuelTypePrimary: "Gasoline" };

for (const vp of [
  { name: "phone", use: { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true } },
  { name: "desktop", use: { viewport: { width: 1280, height: 900 } } },
]) {
  test.describe(`BMW customer walkthrough, ${vp.name}`, () => {
    test.use(vp.use);

    test("Automatic + RWD, start to finish", async ({ page }) => {
      test.setTimeout(150_000);
      const shot = (n: string) => page.screenshot({ path: path.join(SHOTS, `${vp.name}-${n}.png`), fullPage: true });
      const noOverflow = async (where: string) =>
        expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth), `${where}: horizontal overflow`).toBeLessThanOrEqual(1);
      const openHistory = async () => {
        await page.getByRole("button", { name: /Service History/ }).first().click();
        await expect(page.getByRole("listitem").filter({ hasText: "98,765 mi" }).first()).toBeVisible();
      };
      const errors: string[] = [];
      page.on("pageerror", (e) => errors.push(e.message));

      const email = await signUpNewUser(page);
      await shot("01-empty-garage");

      // VIN -> decode
      await page.route("**/vpic.nhtsa.dot.gov/**", (r) =>
        r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ Count: 1, Results: [{ ErrorCode: "0", ...ROW }] }) }),
      );
      await page.goto("/garage/add");
      await shot("02-add-vehicle");
      const vinText = validVin("WBA");
      await page.getByPlaceholder("Enter 17-character VIN").fill(vinText);
      await page.getByRole("button", { name: "Decode" }).click();
      await expect(page.getByRole("button", { name: "+ Add to garage" })).toBeVisible();
      await noOverflow("decode result");
      await shot("03-decoded");

      // Confirm Your Ride: only builds a 328i came in
      await page.getByRole("button", { name: "+ Add to garage" }).click();
      await expect(page.getByTestId("confirm-your-ride")).toBeVisible();
      const pick = (axis: "Transmission" | "Drivetrain", label: string) =>
        page.getByRole("radiogroup", { name: axis }).getByText(label, { exact: true }).click();
      await pick("Transmission", "Automatic");
      await pick("Drivetrain", "Standard RWD");
      await noOverflow("confirm your ride");
      await shot("04-confirm-your-ride");
      await page.getByRole("button", { name: "Confirm Automatic · Standard RWD and add to garage" }).click();
      // Every garage car has a permanent id (<model>~<row>); the customer lands on it, not on the bare model id.
      await expect(page).toHaveURL(new RegExp(`/vehicles/${BMW}~[^/]+$`));
      const carPath = new URL(page.url()).pathname;

      // Vehicle page: configuration shown, all 16 guides listed and available (none restricted or unavailable)
      await expect(page.getByTestId("config-line")).toHaveText(/Automatic.*Standard RWD/);
      const guideLinks = page.locator(`a[href^="${carPath}/repairs/"]`);
      await expect(guideLinks).toHaveCount(16);
      await expect(page.getByTestId("config-needs-confirmation")).toHaveCount(0);
      await noOverflow("vehicle page");
      await shot("05-vehicle-page");

      // The oil change guide: no xDrive / manual / unconfirmed wording, steps present, Wrench Mode works
      await page.goto(OIL);
      await expect(page.getByTestId("config-applied")).toBeVisible();
      const body = await page.locator("body").innerText();
      expect(body).not.toMatch(/x-?drive|all[- ]wheel|\bmanual[- ](?:trans|gearbox)|transfer case/i);
      expect(body).not.toMatch(/unavailable for your|confirm your transmission/i);
      await noOverflow("oil guide");
      await shot("06-oil-guide");
      await page.getByRole("button", { name: /start wrench mode/i }).click();
      await page.waitForSelector('[aria-label="Wrench Mode"]');
      await shot("07-wrench-step-1");
      for (let i = 0; i < 3; i++) await page.getByRole("button", { name: "Next step" }).click();
      await shot("08-wrench-step-4");
      // go to the end, complete, save
      const next = page.getByRole("button", { name: "Next step" });
      while (await next.isVisible().catch(() => false) && (await next.isEnabled().catch(() => false))) await next.click();
      await page.getByRole("button", { name: "Complete this job" }).click();
      const sheet = page.getByRole("dialog", { name: /add this service/i });
      await expect(sheet).toBeVisible();
      await shot("09-complete-sheet");
      await sheet.getByLabel("Current mileage").fill("98765");
      await sheet.getByRole("button", { name: /save to service history/i }).click();
      await expect(page.getByRole("button", { name: /start wrench mode/i })).toBeVisible({ timeout: 20_000 });

      // Service History shows it on the vehicle page; the garage card reads the build
      await page.goto(`/vehicles/${BMW}`);
      await openHistory();
      await shot("10-vehicle-with-history");
      await page.goto("/garage");
      await expect(page.getByText(/3\.0L inline-six · Automatic · RWD/)).toBeVisible();
      await noOverflow("garage");
      await shot("11-garage-card");

      // Log out and back in: the car, its build and its history are all still there
      const logout = page.getByRole("button", { name: "Log out" });
      if (await logout.isVisible()) {
        await logout.click();
        await expect(page).not.toHaveURL(/\/garage/, { timeout: 20_000 });
      } else {
        await page.context().clearCookies(); // the phone menu is collapsed; end the session the same way
      }
      await page.goto("/garage");
      await expect(page).toHaveURL(/\/login/); // logged out: the garage asks for a login again
      await page.getByLabel("Email").fill(email);
      await page.getByLabel("Password").fill("testpassword123");
      await page.getByRole("button", { name: "Log In" }).click();
      await expect(page).toHaveURL(/\/garage$/, { timeout: 20_000 });
      await expect(page.getByText(/3\.0L inline-six · Automatic · RWD/)).toBeVisible();
      await page.goto(`/vehicles/${BMW}`);
      await openHistory();
      await expect(page.getByTestId("config-line")).toHaveText(/Automatic.*Standard RWD/);

      expect(errors, "page errors").toEqual([]);
    });
  });
}
