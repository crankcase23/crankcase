import { test, expect } from "@playwright/test";
import { signUpNewUser } from "./helpers";

test.describe("garage — add your own vehicle", () => {
  // Each test signs up its own account so garage state doesn't leak between
  // tests running in parallel against the same Postgres database.
  test.beforeEach(async ({ page }) => {
    await signUpNewUser(page);
  });

  test("starts empty and can add a catalog vehicle", async ({ page }) => {
    await page.goto("/garage");
    await expect(page.getByText("Your garage is empty")).toBeVisible();

    await page.getByRole("link", { name: "+ Add your first vehicle" }).click();
    await expect(page).toHaveURL(/\/garage\/add$/);

    await page.getByRole("button", { name: /Jeep Grand Cherokee/i }).click();
    await expect(page).toHaveURL(/\/vehicles\/2014-jeep-grand-cherokee-3\.6l$/);

    await page.goto("/garage");
    await expect(page.getByText("Your garage is empty")).toHaveCount(0);
    await expect(page.getByText("2014").first()).toBeVisible();
  });

  test("can add a custom vehicle we don't have data for and still log service history", async ({ page }) => {
    await page.goto("/garage/add");
    await page.getByLabel("Year").fill("2016");
    await page.getByLabel("Make").fill("Toyota");
    await page.getByLabel("Model").fill("Tacoma");
    await page.getByRole("button", { name: "Add to garage", exact: true }).click();

    await expect(page).toHaveURL(/\/garage\/custom\//);
    await expect(page.getByText(/No curated data for this vehicle yet/i)).toBeVisible();
    await expect(page.getByRole("heading", { name: "Maintenance Reminders" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Service History" })).toBeVisible();

    // Log an entry using only the generic job checklist (no guide titles for a custom vehicle).
    await page.fill("#sh-date", "2026-01-15");
    await page.fill("#sh-mileage", "42000");
    await page.getByText("Tire Rotation", { exact: true }).click();
    await page.getByRole("button", { name: "Add entry" }).click();

    const row = page.getByRole("row").filter({ hasText: "42,000 mi" });
    await expect(row).toBeVisible();
    await expect(row.getByText("Tire Rotation")).toBeVisible();
  });

  test("removing a vehicle takes it out of the garage", async ({ page }) => {
    await page.goto("/garage/add");
    await page.getByRole("button", { name: /Civic/i }).click();
    await expect(page).toHaveURL(/\/vehicles\/2018-honda-civic-1\.5t$/);

    await page.goto("/garage");
    await expect(page.getByText("Civic")).toBeVisible();
    await page.getByRole("button", { name: /Remove.*Civic.*from garage/i }).click();
    await expect(page.getByText("Civic")).toHaveCount(0);
  });
});
