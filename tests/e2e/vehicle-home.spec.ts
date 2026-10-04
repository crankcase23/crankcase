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
    await expect(page.getByText("$20 to get your first set of Keys")).toBeVisible();
    // The Garage Rewards ladder lives on Pricing, not on Vehicle Home.
    for (const rung of ["$18", "$16", "$15"]) await expect(page.getByText(rung)).toHaveCount(0);
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
    await expect(page.locator('a[href="#odo"]').first()).toContainText("90,000 mi");
    await expect(page.getByRole("region", { name: "What needs attention" }).getByText(/Overdue by about/).first()).toBeVisible();
    await expect(page.getByRole("region", { name: "Recent work" }).getByText("Engine Oil & Filter Change")).toBeVisible();
    await expect(page.getByRole("region", { name: "Recent work" }).getByText("40,000 mi")).toBeVisible();
  });

  test("tiles jump to their sections; no horizontal overflow on a phone (catalog + custom)", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`/vehicles/${JEEP}`);
    await page.getByRole("link", { name: /Service history/i }).first().click();
    await expect(page).toHaveURL(/#history$/);
    await expect(page.getByRole("button", { name: /Service History/ })).toHaveAttribute("aria-expanded", "true");
    const over = () => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(await over()).toBeLessThanOrEqual(0);

    const add = await page.request.post("/api/garage", { data: { kind: "custom", custom: { year: "2013", make: "Nissan", model: "Pathfinder", engine: "3.5L V6" } } });
    const { entry } = await add.json();
    await page.goto(`/garage/custom/${entry.id}`);
    await expect(page.getByRole("heading", { level: 1 })).toContainText(/Pathfinder/i);
    await expect(page.getByRole("heading", { name: "Maintenance Reminders" })).toBeVisible();
    expect(await over()).toBeLessThanOrEqual(0);
  });

  test("accordion: defaults, one pattern, keyboard, real summaries, remembers state", async ({ page }) => {
    await page.goto("/garage");
    await page.request.post("/api/garage", { data: { kind: "catalog", vehicleId: JEEP } });
    await page.request.post(`/api/garage/${JEEP}/service`, { data: { date: "2026-03-01", mileage: 20000, title: "Tire Rotation" } });
    await page.goto(`/vehicles/${JEEP}`);
    const sec = (name: RegExp) => page.getByRole("button", { name });

    // Defaults: Specs, Manufacturer Service, Reminders open; the rest collapsed.
    await expect(sec(/Vehicle Specs/)).toHaveAttribute("aria-expanded", "true");
    await expect(sec(/Manufacturer Service/)).toHaveAttribute("aria-expanded", "true");
    await expect(sec(/Maintenance Reminders/)).toHaveAttribute("aria-expanded", "true");
    await expect(sec(/Fluid Capacities/)).toHaveAttribute("aria-expanded", "false");
    await expect(sec(/Repair Guides/)).toHaveAttribute("aria-expanded", "false");
    await expect(sec(/Service History/)).toHaveAttribute("aria-expanded", "false");

    // Collapsed chapters still say something real.
    await expect(sec(/Fluid Capacities/)).toContainText(/\d+ capacities/);
    await expect(sec(/Repair Guides/)).toContainText(/\d+ guides available/);
    await expect(sec(/Service History/)).toContainText("1 record");
    await expect(sec(/Vehicle Specs/)).toContainText(/\d+ specs available/);

    // Keyboard: Enter opens, Space closes, focus stays on the row.
    const fluids = sec(/Fluid Capacities/);
    await fluids.focus();
    await page.keyboard.press("Enter");
    await expect(fluids).toHaveAttribute("aria-expanded", "true");
    await expect(page.getByText("Engine Oil", { exact: true }).first()).toBeVisible();
    await page.keyboard.press("Space");
    await expect(fluids).toHaveAttribute("aria-expanded", "false");
    await expect(fluids).toBeFocused();

    // Remembered on this device: open Guides, reload, still open.
    await sec(/Repair Guides/).click();
    await page.reload();
    await expect(sec(/Repair Guides/)).toHaveAttribute("aria-expanded", "true");
  });

  test("next manufacturer service: one tile from real mileage, full grid hidden", async ({ page }) => {
    await page.goto("/garage");
    await page.request.post("/api/garage", { data: { kind: "catalog", vehicleId: JEEP } });
    await page.goto(`/vehicles/${JEEP}`);
    await expect(page.getByText("Log your mileage to see your next manufacturer-recommended service.")).toBeVisible();
    await page.request.put(`/api/garage/${JEEP}/odometer`, { data: { value: 26900 } });
    await page.reload();
    const tile = page.locator("#service");
    await expect(tile.getByText("Next manufacturer-recommended service", { exact: true })).toBeVisible();
    await expect(tile.getByText("30,000").first()).toBeVisible();
    await expect(tile.getByText("3,100 mi to go")).toBeVisible();
    // The grid is secondary: closed until asked for.
    await expect(page.getByText("View full factory schedule")).toBeVisible();
    await expect(page.getByText("Not on a mileage")).toBeHidden();
    await page.getByText("View full factory schedule").click();
    await expect(page.getByText("Not on a mileage")).toBeVisible();
  });

  test("phone: Log a job is one button until tapped; sticky bar + jump nav work", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/garage");
    await page.request.post("/api/garage", { data: { kind: "catalog", vehicleId: JEEP } });
    await page.goto(`/vehicles/${JEEP}`);

    // Jump nav lands on a visible, opened chapter.
    await page.getByRole("navigation", { name: "Jump to section" }).getByRole("link", { name: "History" }).click();
    await expect(page.getByRole("button", { name: /Service History/ })).toHaveAttribute("aria-expanded", "true");
    const logBtn = page.getByRole("button", { name: "Log a job" });
    await expect(logBtn).toBeVisible();
    await expect(page.locator("#sh-date")).toBeHidden();
    await logBtn.click();
    await expect(page.locator("#sh-date")).toBeVisible();
    await page.fill("#sh-date", "2026-02-02");
    await page.fill("#sh-mileage", "31000");
    await page.locator("#sh-form").getByText("Tire Rotation", { exact: true }).click();
    await page.getByRole("button", { name: "Add entry" }).click();
    await expect(page.getByRole("listitem").filter({ hasText: "31,000 mi" }).first()).toBeVisible();
    await expect(page.locator("#sh-date")).toBeHidden();

    // Sticky strip: hidden at the top, shown deep in the page, never overflowing.
    await page.evaluate(() => window.scrollTo(0, 0));
    const bar = page.getByText("Garage", { exact: true }).locator("xpath=ancestor::div[contains(@class,'fixed')]");
    await expect(bar).toHaveCSS("opacity", "0");
    await page.evaluate(() => window.scrollTo(0, 1800));
    await expect(bar).toHaveCSS("opacity", "1");
    await expect(bar).toContainText("Grand Cherokee");
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);
  });

  test("regression: no duplicate React key warnings on vehicle pages", async ({ page }) => {
    const bad: string[] = [];
    page.on("console", (m) => {
      const t = m.text();
      if (/same key|unique "key"/i.test(t)) bad.push(t.slice(0, 200));
    });
    page.on("pageerror", (e) => bad.push(e.message));
    await page.goto("/garage");
    const ids = [JEEP, "2020-chevrolet-silverado-1500-5.3l", "2021-honda-accord-1.5t"];
    for (const id of ids) await page.request.post("/api/garage", { data: { kind: "catalog", vehicleId: id } });
    for (const id of ids) {
      await page.goto(`/vehicles/${id}`);
      await page.getByRole("button", { name: /Service History/ }).waitFor();
      // open everything so every list actually renders its rows
      for (const name of [/Fluid Capacities/, /Repair Guides/, /Service History/]) {
        const b = page.getByRole("button", { name });
        if ((await b.getAttribute("aria-expanded")) === "false") await b.click();
      }
      await page.waitForTimeout(400);
    }
    expect(bad).toEqual([]);
  });
});
