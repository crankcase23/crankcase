import { test, expect, type Page } from "@playwright/test";
import { signUpNewUser } from "./helpers";

// /garage/add is VIN decode plus type-to-search Year/Make/Model fields (no catalog
// button list). Model options come from NHTSA vPIC; stub it so the tests never
// depend on the network. The catalog match is local (src/data/vehicles.ts).
async function stubVpicModels(page: Page) {
  await page.route("**/vpic.nhtsa.dot.gov/**", (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        Results: [
          { Model_Name: "Grand Cherokee" },
          { Model_Name: "Civic" },
          { Model_Name: "Tacoma" },
        ],
      }),
    })
  );
}

// Fill the manual form and submit. A year/make/model we have curated data for
// goes straight to /vehicles/<id>; anything else becomes a custom entry.
async function addViaManualForm(page: Page, year: string, make: string, model: string) {
  await page.goto("/garage/add");
  await page.getByLabel("Year").fill(year);
  await page.getByLabel("Make").fill(make);
  await page.getByLabel("Model").fill(model);
  await page.getByRole("button", { name: "+ Add to garage", exact: true }).click();
}

test.describe("garage — add your own vehicle", () => {
  // Each test signs up its own account so garage state doesn't leak between
  // tests running in parallel against the same Postgres database.
  test.beforeEach(async ({ page }) => {
    await stubVpicModels(page);
    await signUpNewUser(page);
  });

  test("starts empty and can add a catalog vehicle", async ({ page }) => {
    await page.goto("/garage");
    await expect(page.getByText("Your garage is empty")).toBeVisible();

    await page.getByRole("link", { name: "Add your first vehicle" }).click();
    await expect(page).toHaveURL(/\/garage\/add$/);

    await addViaManualForm(page, "2014", "Jeep", "Grand Cherokee");
    await expect(page).toHaveURL(/\/vehicles\/2014-jeep-grand-cherokee-3\.6l$/);

    await page.goto("/garage");
    await expect(page.getByText("Your garage is empty")).toHaveCount(0);
    await expect(page.getByText("2014").first()).toBeVisible();
  });

  test("can add a custom vehicle we don't have data for and still log service history", async ({ page }) => {
    await addViaManualForm(page, "2016", "Toyota", "Tacoma");

    await expect(page).toHaveURL(/\/garage\/custom\//);
    await expect(page.getByText(/We're working on getting full data for this car/i)).toBeVisible();
    await expect(page.getByRole("heading", { name: "Maintenance Reminders" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Service History" })).toBeVisible();

    // Service History is a collapsed chapter by default; open it, then log an entry
    // using only the generic job chips (no guide titles for a custom vehicle).
    await page.getByRole("button", { name: /Service History/ }).click();
    await page.fill("#sh-date", "2026-01-15");
    await page.fill("#sh-mileage", "42000");
    await page.getByText("Tire Rotation", { exact: true }).click();
    await page.getByRole("button", { name: "Add entry" }).click();

    // Scope to the Service History list: "Recent work" on the hub echoes the same entry.
    const row = page.locator("#history").getByRole("listitem").filter({ hasText: "42,000 mi" });
    await expect(row).toBeVisible();
    await expect(row.getByText("Tire Rotation")).toBeVisible();
  });

  test("removing a vehicle takes it out of the garage", async ({ page }) => {
    await addViaManualForm(page, "2018", "Honda", "Civic");
    await expect(page).toHaveURL(/\/vehicles\/2018-honda-civic-1\.5t$/);

    await page.goto("/garage");
    await expect(page.getByText("Civic")).toBeVisible();
    await page.getByRole("button", { name: /Remove.*Civic.*from garage/i }).click();
    await expect(page.getByText("Civic")).toHaveCount(0);
  });
});
