import { test, expect } from "@playwright/test";
import { signUpNewUser } from "./helpers";

// Vehicle Home (visual pass 2). Seeds through the real API.
const JEEP = "2014-jeep-grand-cherokee-3.6l";

test.describe("Vehicle Home", () => {
  test.beforeEach(async ({ page }) => {
    await signUpNewUser(page);
  });

  test("minimal data: hub renders, nothing claims to be tracked, Keys button is inert", async ({ page }) => {
    await page.goto(`/vehicles/${JEEP}`);
    await expect(page.getByRole("heading", { level: 1 })).toContainText(/Grand Cherokee/i);
    await expect(page.getByRole("heading", { name: "What are we doing today?" })).toBeVisible();
    await expect(page.getByText("Nothing logged to track yet")).toBeVisible();
    await expect(page.getByRole("region", { name: "Recent work" }).getByText("No service logged yet")).toBeVisible();
    // Keys is presentation only: disabled, no checkout, content still reachable.
    await expect(page.getByRole("button", { name: "Get the Keys" })).toBeDisabled();
    await expect(page.getByText("$20").first()).toBeVisible();
    // Existing sections still present.
    for (const name of ["Vehicle Specs", "Fluid Capacities", "Maintenance Reminders", "Service History"]) {
      await expect(page.getByRole("heading", { name })).toBeVisible();
    }
    await expect(page.getByRole("link", { name: /Print spec sheet/ })).toBeVisible();
  });

  test("attention state + recent work reflect the real log and odometer", async ({ page }) => {
    await page.goto("/garage");
    await page.request.post("/api/garage", { data: { kind: "catalog", vehicleId: JEEP } });
    await page.request.put(`/api/garage/${JEEP}/odometer`, { data: { value: 90000 } });
    await page.request.post(`/api/garage/${JEEP}/service`, { data: { date: "2025-01-10", mileage: 40000, title: "Engine Oil & Filter Change" } });
    await page.goto(`/vehicles/${JEEP}`);
    await expect(page.getByText("90,000 mi")).toBeVisible();
    await expect(page.getByRole("region", { name: "What needs attention" }).getByText(/Overdue by about/).first()).toBeVisible();
    await expect(page.getByRole("region", { name: "Recent work" }).getByText("Engine Oil & Filter Change")).toBeVisible();
    await expect(page.getByRole("region", { name: "Recent work" }).getByText("40,000 mi")).toBeVisible();
  });

  test("tiles jump to their sections; no horizontal overflow on a phone (catalog + custom)", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`/vehicles/${JEEP}`);
    await page.getByRole("link", { name: /Service history/i }).first().click();
    await expect(page).toHaveURL(/#history$/);
    const over = () => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(await over()).toBeLessThanOrEqual(0);

    const add = await page.request.post("/api/garage", { data: { kind: "custom", custom: { year: "2013", make: "Nissan", model: "Pathfinder", engine: "3.5L V6" } } });
    const { entry } = await add.json();
    await page.goto(`/garage/custom/${entry.id}`);
    await expect(page.getByRole("heading", { level: 1 })).toContainText(/Pathfinder/i);
    await expect(page.getByRole("heading", { name: "Maintenance Reminders" })).toBeVisible();
    expect(await over()).toBeLessThanOrEqual(0);
  });
});
