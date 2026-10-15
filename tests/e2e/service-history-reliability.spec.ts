import { test, expect, type Page } from "@playwright/test";
import { signUpNewUser, validVin } from "./helpers";

// Service History reliability. One confirmed failure = one permanent regression; each test names the failure it pins.
//
//   SH-1  a failed save used to clear and close the form, so the customer's entry vanished with no message
//   SH-2  a failed delete used to remove the row from the screen anyway
//   SH-3  delete used to fire on a single tap with no confirmation
//   SH-4  the API accepted junk (null mileage became 0, negatives, decimals) and 500'd on what the DB column could not hold

const TACOMA_ROW = { ModelYear: "2016", Make: "Toyota", Model: "Tacoma", EngineCylinders: "6", DisplacementL: "3.5", FuelTypePrimary: "Gasoline" };

async function addTacoma(page: Page): Promise<string> {
  await page.route("**/vpic.nhtsa.dot.gov/**", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ Count: 1, Results: [{ ErrorCode: "0", ...TACOMA_ROW }] }) }),
  );
  await page.goto("/garage/add");
  await page.getByPlaceholder("Enter 17-character VIN").fill(validVin("5TF"));
  await page.getByRole("button", { name: "Decode" }).click();
  await page.getByRole("button", { name: /^\+ Add (this vehicle )?to (my )?garage$/i }).first().click();
  await expect(page.getByTestId("confirm-your-ride")).toBeVisible();
  await page.getByRole("radiogroup", { name: "Transmission" }).getByText("Not sure", { exact: true }).click();
  await page.getByRole("radiogroup", { name: "Drivetrain" }).getByText("Not sure", { exact: true }).click();
  await page.getByRole("button", { name: /and add to garage$/ }).click();
  await expect(page).toHaveURL(/\/garage\/custom\//, { timeout: 20_000 });
  return decodeURIComponent(page.url().split("/garage/custom/")[1].split(/[?#]/)[0]);
}

// Entry rows inside the Service History section only. (Not getByRole("listitem") page-wide: ancestors can be list items too.)
const rowsWith = (page: Page, text: string) => page.locator("#history li").filter({ hasText: text });

async function openHistory(page: Page) {
  // Idempotent: after a reload the chapter can already be open, and a blind click would close it.
  const form = page.locator("#sh-date");
  const toggle = page.getByRole("button", { name: /Service History/ });
  await expect(toggle).toBeVisible();
  await expect(async () => {
    if (!(await form.isVisible())) await toggle.click();
    await expect(form).toBeVisible({ timeout: 1500 });
  }).toPass({ timeout: 15_000 });
}

async function fillForm(page: Page, date = "2026-01-15", mileage = "42000", notes = "") {
  await page.fill("#sh-date", date);
  await page.fill("#sh-mileage", mileage);
  await page.getByText("Tire Rotation", { exact: true }).click();
  if (notes) await page.fill("#sh-notes", notes);
}

test.describe("service history — save reliability (SH-1)", () => {
  let id = "";
  test.beforeEach(async ({ page }) => {
    await signUpNewUser(page);
    id = await addTacoma(page);
    await openHistory(page);
  });

  test("SH-1a: a server error keeps the entry in the form, says so, and adds no row", async ({ page }) => {
    await page.route(`**/api/garage/${encodeURIComponent(id)}/service`, (route) =>
      route.request().method() === "POST" ? route.fulfill({ status: 500, contentType: "application/json", body: JSON.stringify({ error: "boom" }) }) : route.fallback(),
    );
    await fillForm(page, "2026-01-15", "42000", "Mobil 1 5W-30");
    await page.getByRole("button", { name: "Add entry" }).click();

    await expect(page.getByTestId("sh-error")).toContainText(/couldn.t save|could not save/i);
    // Nothing the customer typed is lost.
    await expect(page.locator("#sh-date")).toHaveValue("2026-01-15");
    await expect(page.locator("#sh-mileage")).toHaveValue("42000");
    await expect(page.locator("#sh-notes")).toHaveValue("Mobil 1 5W-30");
    await expect(page.getByRole("checkbox", { name: "Tire Rotation" })).toBeChecked();
    await expect(page.getByText("42,000 mi")).toHaveCount(0);
  });

  test("SH-1b: a dropped connection keeps the entry in the form and says so", async ({ page }) => {
    await page.route(`**/api/garage/${encodeURIComponent(id)}/service`, (route) =>
      route.request().method() === "POST" ? route.abort("failed") : route.fallback(),
    );
    await fillForm(page);
    await page.getByRole("button", { name: "Add entry" }).click();
    await expect(page.getByTestId("sh-error")).toBeVisible();
    await expect(page.locator("#sh-mileage")).toHaveValue("42000");
  });

  test("SH-1c: retrying after a failure saves once, then clears and closes only on confirmed success", async ({ page }) => {
    let fail = true;
    let posts = 0;
    await page.route(`**/api/garage/${encodeURIComponent(id)}/service`, (route) => {
      if (route.request().method() !== "POST") return route.fallback();
      posts += 1;
      return fail ? route.fulfill({ status: 503, contentType: "application/json", body: "{}" }) : route.fallback();
    });
    await fillForm(page);
    await page.getByRole("button", { name: "Add entry" }).click();
    await expect(page.getByTestId("sh-error")).toBeVisible();

    fail = false;
    await page.getByRole("button", { name: "Add entry" }).click();
    const row = rowsWith(page, "42,000 mi");
    await expect(row).toHaveCount(1);
    await expect(page.getByTestId("sh-error")).toHaveCount(0);
    await expect(page.locator("#sh-mileage")).toHaveValue("");
    expect(posts).toBe(2);

    await page.reload();
    await openHistory(page);
    await expect(rowsWith(page, "42,000 mi")).toHaveCount(1);
  });

  test("SH-1d (guard): the button cannot double-submit while a save is in flight", async ({ page }) => {
    let posts = 0;
    await page.route(`**/api/garage/${encodeURIComponent(id)}/service`, async (route) => {
      if (route.request().method() !== "POST") return route.fallback();
      posts += 1;
      await new Promise((r) => setTimeout(r, 600));
      return route.fallback();
    });
    await fillForm(page);
    const add = page.getByRole("button", { name: /Add entry|Saving/ });
    await add.dblclick();
    await expect(rowsWith(page, "42,000 mi")).toHaveCount(1);
    expect(posts).toBe(1);
  });

  test("SH-1e: bad input is caught in the form with a message, before any request", async ({ page }) => {
    let posts = 0;
    await page.route(`**/api/garage/${encodeURIComponent(id)}/service`, (route) => {
      if (route.request().method() === "POST") posts += 1;
      return route.fallback();
    });
    await fillForm(page, "2026-01-15", "42000.5");
    await page.getByRole("button", { name: "Add entry" }).click();
    await expect(page.getByTestId("sh-error")).toContainText(/mileage/i);
    expect(posts).toBe(0);
  });
});

test.describe("service history — delete reliability (SH-2, SH-3)", () => {
  let id = "";
  test.beforeEach(async ({ page }) => {
    await signUpNewUser(page);
    id = await addTacoma(page);
    await openHistory(page);
    await fillForm(page, "2026-02-01", "50000");
    await page.getByRole("button", { name: "Add entry" }).click();
    await expect(rowsWith(page, "50,000 mi")).toHaveCount(1);
  });

  test("SH-3a: one tap on delete only asks; Cancel keeps the entry and sends no request", async ({ page }) => {
    let deletes = 0;
    await page.route(`**/api/garage/${encodeURIComponent(id)}/service/*`, (route) => {
      if (route.request().method() === "DELETE") deletes += 1;
      return route.fallback();
    });
    await page.getByRole("button", { name: /Delete .* entry/ }).click();
    await expect(page.getByText(/delete this entry\?/i)).toBeVisible();
    await page.getByRole("button", { name: "Cancel" }).click();
    await expect(rowsWith(page, "50,000 mi")).toHaveCount(1);
    expect(deletes).toBe(0);
  });

  test("SH-2a: a failed delete leaves the entry on screen and says so", async ({ page }) => {
    await page.route(`**/api/garage/${encodeURIComponent(id)}/service/*`, (route) =>
      route.request().method() === "DELETE" ? route.fulfill({ status: 500, contentType: "application/json", body: JSON.stringify({ error: "boom" }) }) : route.fallback(),
    );
    await page.getByRole("button", { name: /Delete .* entry/ }).click();
    await page.getByRole("button", { name: "Delete", exact: true }).click();
    await expect(page.getByTestId("sh-error")).toContainText(/couldn.t delete|could not delete/i);
    await expect(rowsWith(page, "50,000 mi")).toHaveCount(1);
    await page.reload();
    await openHistory(page);
    await expect(rowsWith(page, "50,000 mi")).toHaveCount(1);
  });

  test("SH-2b: a confirmed delete removes the entry and it stays gone after reload", async ({ page }) => {
    await page.getByRole("button", { name: /Delete .* entry/ }).click();
    await page.getByRole("button", { name: "Delete", exact: true }).click();
    await expect(rowsWith(page, "50,000 mi")).toHaveCount(0);
    await page.reload();
    await openHistory(page);
    await expect(rowsWith(page, "50,000 mi")).toHaveCount(0);
  });
});

test.describe("service history API — server-side validation (SH-4)", () => {
  let id = "";
  test.beforeEach(async ({ page }) => {
    await signUpNewUser(page);
    id = await addTacoma(page);
  });

  const url = () => `/api/garage/${encodeURIComponent(id)}/service`;
  const good = { date: "2026-03-01", mileage: 61000, title: "Tire Rotation" };

  const bad: Array<[string, Record<string, unknown>]> = [
    ["mileage null (used to become 0)", { ...good, mileage: null }],
    ["mileage missing", { date: good.date, title: good.title }],
    ["mileage empty string (used to become 0)", { ...good, mileage: "" }],
    ["mileage true (used to become 1)", { ...good, mileage: true }],
    ["mileage array", { ...good, mileage: [5] }],
    ["mileage negative", { ...good, mileage: -1 }],
    ["mileage fractional (used to 500)", { ...good, mileage: 100.5 }],
    ["mileage above 7 digits (used to 500)", { ...good, mileage: 99999999999 }],
    ["mileage Infinity-ish string", { ...good, mileage: "1e999" }],
    ["date not a date", { ...good, date: "yesterday" }],
    ["date wrong shape", { ...good, date: "01/15/2026" }],
    ["date impossible day", { ...good, date: "2026-02-30" }],
    ["title blank", { ...good, title: "   " }],
    ["title not a string", { ...good, title: 5 }],
    ["title too long", { ...good, title: "x".repeat(1501) }],
    ["notes too long", { ...good, notes: "n".repeat(2001) }],
    ["notes not a string", { ...good, notes: { a: 1 } }],
    ["guideId not a string", { ...good, guideId: 7 }],
  ];

  for (const [name, body] of bad) {
    test(`SH-4: rejects ${name} with 400 and a message`, async ({ page }) => {
      const res = await page.request.post(url(), { data: body });
      expect(res.status(), await res.text()).toBe(400);
      const json = await res.json();
      expect(typeof json.error).toBe("string");
      expect(json.error.length).toBeGreaterThan(3);
      const list = await (await page.request.get(url())).json();
      expect(list.entries, "a rejected request must write nothing").toHaveLength(0);
    });
  }

  test("SH-4: malformed JSON body is a 400, not a 500", async ({ page }) => {
    const res = await page.request.post(url(), { headers: { "Content-Type": "application/json" }, data: "{not json" });
    expect(res.status()).toBe(400);
  });

  test("SH-4: a valid entry (and the Wrench-sheet shape, numeric string mileage) still saves and trims", async ({ page }) => {
    const a = await page.request.post(url(), { data: { ...good, title: "  Tire Rotation  ", notes: "  rotated  " } });
    expect(a.status()).toBe(200);
    const created = (await a.json()).entry;
    expect(created).toMatchObject({ date: "2026-03-01", mileage: 61000, title: "Tire Rotation", notes: "rotated" });

    const b = await page.request.post(url(), { data: { date: "2026-03-02", mileage: "62000", title: "Oil", guideId: "some-guide" } });
    expect(b.status()).toBe(200);
    expect((await b.json()).entry).toMatchObject({ mileage: 62000, guideId: "some-guide" });

    const edge = await page.request.post(url(), { data: { date: "2024-02-29", mileage: 0, title: "Leap day, zero miles" } });
    expect(edge.status(), "0 miles and a real leap day are legal").toBe(200);
  });
});
