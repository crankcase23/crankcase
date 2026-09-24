import { test, expect } from "@playwright/test";

test.describe("marketing site", () => {
  test("home page: first screen says what it does, has one primary CTA, and previews a real guide", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toContainText(/Fix your own car/i);
    // The three-step path is on the first screen, not behind a click.
    await expect(page.getByText("Your exact vehicle", { exact: true })).toBeVisible();
    await expect(page.getByText("Pick the job", { exact: true })).toBeVisible();
    await expect(page.getByText("Do it right", { exact: true })).toBeVisible();
    // One primary action in the hero (the same CTA repeats further down the
    // page, in the vehicle-data section), plus the how-it-works path.
    await expect(page.getByRole("link", { name: /Add your vehicle/i }).first()).toBeVisible();
    await expect(page.getByRole("link", { name: /See how it works/i })).toBeVisible();
    // The preview card renders from a real guide with real torque figures.
    const preview = page.getByRole("complementary", { name: /Example guide/i });
    await expect(preview).toBeVisible();
    await expect(preview.getByText(/ft-lb/)).toHaveCount(2);
    // The vehicle data sheet renders from the demo vehicle's real catalog entry.
    const sheet = page.getByRole("region", { name: /Vehicle data sheet/i });
    await expect(sheet).toBeVisible();
    await expect(sheet.getByText("Engine oil", { exact: true })).toBeVisible();
    await expect(sheet.getByText(/ft-lb/)).toHaveCount(1);
    // Scope callout is still on the page.
    await expect(page.getByText(/see a professional mechanic/i)).toBeVisible();
  });

  test("terms page includes a Scope of Service section", async ({ page }) => {
    await page.goto("/terms");
    await expect(page.getByRole("heading", { name: "Scope of Service" })).toBeVisible();
    await expect(page.getByText(/not.*intended for engine rebuilds/i)).toBeVisible();
  });

  test("signup page shows the routine-maintenance warning and creates a real account into the garage", async ({ page }) => {
    await page.goto("/signup");
    await expect(page.getByText(/built for routine maintenance/i)).toBeVisible();
    const email = `e2e-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`;
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password").fill("password123");
    await page.getByRole("button", { name: "Create Account" }).click();
    await expect(page).toHaveURL(/\/garage$/);
  });
});
