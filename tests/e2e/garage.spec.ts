import { test, expect, type Page } from "@playwright/test";
import { signUpNewUser, testVin } from "./helpers";

// Every add now goes through Confirm Your Ride; these tests answer "Not sure" so they stay about the garage itself.
async function confirmNotSure(page: Page) {
  await expect(page.getByTestId("confirm-your-ride")).toBeVisible();
  await page.getByRole("radiogroup", { name: "Transmission" }).getByText("Not sure", { exact: true }).click();
  await page.getByRole("radiogroup", { name: "Drivetrain" }).getByText("Not sure", { exact: true }).click();
  await page.getByRole("button", { name: /and add to garage$/ }).click();
}

async function fillForm(page: Page, year: string, make: string, model: string) {
  await page.goto("/garage/add");
  await page.getByLabel("Year").fill(year);
  await page.getByLabel("Make").fill(make);
  await page.getByLabel("Model").fill(model);
  await page.locator("#manualVin").fill(testVin());
  await page.getByRole("button", { name: "Continue: confirm your ride" }).click();
}

test.describe("garage — add your own vehicle", () => {
  // Each test signs up its own account so garage state doesn't leak between
  // tests running in parallel against the same Postgres database.
  test.beforeEach(async ({ page }) => {
    await signUpNewUser(page);
  });

  test("starts empty and can add a catalog vehicle", async ({ page }) => {
    await page.goto("/garage");
    await expect(page.getByText("Your garage is empty")).toBeVisible();

    await page.getByRole("link", { name: "Add your first vehicle" }).click();
    await expect(page).toHaveURL(/\/garage\/add$/);

    await fillForm(page, "2014", "Jeep", "Grand Cherokee");
    await confirmNotSure(page);
    await expect(page).toHaveURL(/\/vehicles\/2014-jeep-grand-cherokee-3\.6l$/);

    await page.goto("/garage");
    await expect(page.getByText("Your garage is empty")).toHaveCount(0);
    await expect(page.getByText("2014").first()).toBeVisible();
  });

  test("can add a custom vehicle we don't have data for and still log service history", async ({ page }) => {
    await fillForm(page, "2016", "Toyota", "Tacoma");
    await confirmNotSure(page);

    await expect(page).toHaveURL(/\/garage\/custom\//);
    await expect(page.getByText(/We don.t have specs, fluid capacities, or torque values pulled in for this one yet/i)).toBeVisible();
    await expect(page.getByRole("heading", { name: "Maintenance Reminders" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Service History" })).toBeVisible();

    // Service History is a collapsed chapter by default; open it, then log an entry
    // using only the generic job chips (no guide titles for a custom vehicle).
    await page.getByRole("button", { name: /Service History/ }).click();
    await page.fill("#sh-date", "2026-01-15");
    await page.fill("#sh-mileage", "42000");
    await page.getByText("Tire Rotation", { exact: true }).click();
    await page.getByRole("button", { name: "Add entry" }).click();

    const row = page.getByRole("listitem").filter({ hasText: "42,000 mi" }).last();
    await expect(row).toBeVisible();
    await expect(row.getByText("Tire Rotation")).toBeVisible();
  });

  test("removing a vehicle takes it out of the garage", async ({ page }) => {
    await fillForm(page, "2018", "Honda", "Civic");
    await confirmNotSure(page);
    await expect(page).toHaveURL(/\/vehicles\/2018-honda-civic-1\.5t$/);

    await page.goto("/garage");
    await expect(page.getByText("Civic")).toBeVisible();
    await page.getByRole("button", { name: /Remove.*Civic.*from garage/i }).click();
    await expect(page.getByText("Civic")).toHaveCount(0);
  });
});
