import { test, expect } from "@playwright/test";
import { signUpNewUser } from "./helpers";

// My Garage dashboard (visual pass 1). Seeds through the real API so it does not
// depend on the add-vehicle page's layout.
test.describe("My Garage dashboard", () => {
  test.beforeEach(async ({ page }) => {
    await signUpNewUser(page);
  });

  test("empty state, then vehicle cards with status, add card last, remove works", async ({ page }) => {
    await page.goto("/garage");
    await expect(page.getByRole("heading", { name: "My Garage" })).toBeVisible();
    await expect(page.getByText("Your garage is empty")).toBeVisible();
    await expect(page.getByRole("link", { name: /Add your first vehicle/ })).toBeVisible();

    const add = await page.request.post("/api/garage", { data: { kind: "catalog", vehicleId: "2018-honda-civic-1.5t" } });
    expect(add.ok()).toBeTruthy();
    await page.request.post("/api/garage", { data: { kind: "custom", custom: { year: "2013", make: "Nissan", model: "Pathfinder", engine: "3.5L V6" } } });
    await page.request.put("/api/garage/2018-honda-civic-1.5t/odometer", { data: { value: 48800 } });

    await page.goto("/garage");
    await expect(page.getByText("Your garage is empty")).toHaveCount(0);
    await expect(page.getByText("48,800 mi")).toBeVisible();
    // Owner-facing status, not developer language.
    await expect(page.getByText("Guides available")).toBeVisible();
    await expect(page.getByText("Added to your garage")).toBeVisible();
    await expect(page.getByText("Specs & guides coming soon")).toBeVisible();
    await expect(page.getByText(/NO GUIDE DATA|ADDED, NO/i)).toHaveCount(0);

    // The whole card is reachable through one link; the Add tile and the
    // "Don't see your vehicle?" panel close the grid.
    await page.getByRole("link", { name: /Open vehicle/ }).click();
    await expect(page).toHaveURL(/\/vehicles\/2018-honda-civic-1\.5t$/);
    await page.goto("/garage");
    const tiles = page.getByRole("region", { name: "Your vehicles" }).locator("> *");
    await expect(tiles.last()).toContainText("Don't see your vehicle?");
    await expect(tiles.nth(-2)).toContainText("Add a vehicle");

    await page.getByRole("button", { name: /Remove 2018 Honda Civic from garage/ }).click();
    await expect(page.getByText("Civic")).toHaveCount(0);
  });

  test("no horizontal overflow on a phone", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.request.post("/api/garage", { data: { kind: "catalog", vehicleId: "2018-honda-civic-1.5t" } });
    await page.goto("/garage");
    await expect(page.getByText("Guides available")).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(0);
  });
});
