import { test, expect } from "@playwright/test";

test.describe("marketing site", () => {
  test("home page shows hero, demo link, and the routine-maintenance scope callout", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Fix your own car");
    await expect(page.getByRole("link", { name: /Try the live demo/i })).toBeVisible();
    await expect(page.getByText(/Built for routine maintenance/i)).toBeVisible();
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
