import { test, expect, type Page, type Browser } from "@playwright/test";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { signUpNewUser, testVin } from "./helpers";

// VIN-required garage: a VIN is mandatory for a permanent garage entry; browsing by year/make/model stays open; a photo can
// suggest a VIN (read in the browser) but the customer confirms it; another account's VIN never leaks anything.
// Needs the same throwaway Postgres as vehicle-config.spec.ts (psql is used only to assert / seed rows).
const PG = ["-h", "127.0.0.1", "-p", "5544", "-U", "postgres", "cc_test", "-At", "-F", "|", "-c"];
const sql = (q: string) => execFileSync("psql", [...PG, q], { encoding: "utf8" }).trim();
const SHOTS = process.env.SHOTS_DIR ?? "test-results/vin-shots";
fs.mkdirSync(SHOTS, { recursive: true });
const shot = (page: Page, name: string) => page.screenshot({ path: path.join(SHOTS, `${name}.png`), fullPage: true });
const FIX = (f: string) => path.join(__dirname, "fixtures", f);
const uid = (email: string) => sql(`select id from users where email='${email}'`);
const count = (email: string) => Number(sql(`select count(*) from garage_entries where user_id='${uid(email)}'`));

const GOOD_NA_VIN = "1HGCM82633A004352"; // published example VIN (valid check digit); not a real person's car
const CFG = { transmission: "unknown", drivetrain: "unknown" };
const JEEP = "2014-jeep-grand-cherokee-3.6l";

async function fillManual(page: Page, vinText: string) {
  await page.goto("/garage/add");
  await page.getByLabel("Year").fill("2014");
  await page.getByLabel("Make").fill("Jeep");
  await page.getByLabel("Model").fill("Grand Cherokee");
  if (vinText) await page.locator("#manualVin").fill(vinText);
}

test.describe("VIN is required to add; browsing stays open", () => {
  test("manual year/make/model path: no VIN, malformed VIN and a typo'd VIN are refused and save nothing; a good VIN goes to Confirm Your Ride", async ({ page }) => {
    const email = await signUpNewUser(page);
    await fillManual(page, "");
    await shot(page, "01-manual-form-vin-required");
    const go = page.getByRole("button", { name: "Continue: confirm your ride" });
    await go.click();
    await expect(page.getByTestId("manual-vin-error")).toContainText(/VIN is required/i);
    await expect(page.getByTestId("confirm-your-ride")).toHaveCount(0);

    await page.locator("#manualVin").fill("123");
    await go.click();
    await expect(page.getByTestId("manual-vin-error")).toContainText(/17 characters/);

    await page.locator("#manualVin").fill("1HGCM82633A00435O");
    await go.click();
    await expect(page.getByTestId("manual-vin-error")).toContainText(/I, O or Q/);

    await page.locator("#manualVin").fill("1HGCM82633A004353"); // one digit off: fails the check digit
    await go.click();
    await expect(page.getByTestId("manual-vin-error")).toContainText(/check digit/i);
    await shot(page, "02-typo-vin-refused");
    expect(count(email)).toBe(0);

    await page.locator("#manualVin").fill("1hgcm826-33a 004352"); // lower case, dash and space are tolerated
    await go.click();
    await expect(page.getByTestId("confirm-your-ride")).toBeVisible();
    await shot(page, "03-confirm-your-ride-after-vin");
    await page.getByRole("radiogroup", { name: "Transmission" }).getByText("Not sure", { exact: true }).click();
    await page.getByRole("radiogroup", { name: "Drivetrain" }).getByText("Not sure", { exact: true }).click();
    await page.getByRole("button", { name: /and add to garage$/ }).click();
    await expect(page).toHaveURL(/\/vehicles\//);
    expect(sql(`select vin from garage_entries where user_id='${uid(email)}'`)).toBe(GOOD_NA_VIN);
  });

  test("browsing a vehicle by year/make/model does not touch the garage", async ({ page }) => {
    const email = await signUpNewUser(page);
    await fillManual(page, "");
    const link = page.getByRole("link", { name: /Just browsing/ });
    await expect(link).toBeVisible();
    await link.click();
    await expect(page).toHaveURL(new RegExp(`/vehicles/${JEEP}$`));
    expect(count(email)).toBe(0);
  });

  test("API: catalog and custom adds without a valid VIN get VIN_REQUIRED and create nothing", async ({ page }) => {
    const email = await signUpNewUser(page);
    const post = (data: unknown) => page.request.post("/api/garage", { data });
    for (const body of [
      { kind: "catalog", vehicleId: JEEP, config: CFG },
      { kind: "catalog", vehicleId: JEEP, vin: "", config: CFG },
      { kind: "catalog", vehicleId: JEEP, vin: "TOOSHORT", config: CFG },
      { kind: "catalog", vehicleId: JEEP, vin: "1HGCM82633A004353", config: CFG },
      { kind: "custom", custom: { year: "2013", make: "Nissan", model: "Pathfinder" }, config: CFG },
      { kind: "custom", custom: { vin: 12345678901234567, make: "Nissan" }, config: CFG },
    ]) {
      const r = await post(body);
      expect(r.status(), JSON.stringify(body)).toBe(400);
      expect((await r.json()).code).toBe("VIN_REQUIRED");
    }
    expect(count(email)).toBe(0);
    const ok = await post({ kind: "catalog", vehicleId: JEEP, vin: GOOD_NA_VIN.toLowerCase(), config: CFG });
    expect(ok.status()).toBe(200);
    expect(sql(`select vin from garage_entries where user_id='${uid(email)}'`)).toBe(GOOD_NA_VIN); // stored normalized
  });

  test("service history and odometer cannot silently create a VIN-less garage entry", async ({ page }) => {
    const email = await signUpNewUser(page);
    const s = await page.request.post(`/api/garage/${JEEP}/service`, { data: { date: "2026-01-10", mileage: 1000, title: "Oil" } });
    expect(s.status()).toBe(409);
    expect((await s.json()).code).toBe("VIN_REQUIRED");
    const o = await page.request.put(`/api/garage/${JEEP}/odometer`, { data: { value: 5000 } });
    expect(o.status()).toBe(409);
    expect(count(email)).toBe(0);
  });

  test("garage entries that predate the rule (no VIN) are kept, listed and still work", async ({ page }) => {
    const email = await signUpNewUser(page);
    const id = uid(email);
    sql(`insert into garage_entries(id,user_id,kind,vehicle_id,vin) values ('legacy-${id}','${id}','catalog','${JEEP}',null)`);
    await page.goto("/garage");
    await expect(page.getByText(/Grand Cherokee/).first()).toBeVisible();
    const s = await page.request.post(`/api/garage/${JEEP}/service`, { data: { date: "2026-01-10", mileage: 1000, title: "Oil" } });
    expect(s.status()).toBe(200);
    expect(count(email)).toBe(1);
    // adding the same vehicle now with its VIN fills the VIN in on the existing row: no duplicate, history intact
    const add = await page.request.post("/api/garage", { data: { kind: "catalog", vehicleId: JEEP, vin: GOOD_NA_VIN, config: CFG } });
    expect(add.status()).toBe(200);
    expect(count(email)).toBe(1);
    expect(sql(`select vin from garage_entries where user_id='${id}'`)).toBe(GOOD_NA_VIN);
    expect(sql(`select count(*) from service_entries where garage_entry_id='legacy-${id}'`)).toBe("1");
  });
});

test.describe("Photo scan: suggests a VIN, the customer confirms", () => {
  test("Take Photo / Upload Photo read a barcode in the browser and fill the VIN box; nothing is saved until Confirm Your Ride", async ({ page }) => {
    const email = await signUpNewUser(page);
    // The photo must never leave the device: fail the test on any upload request.
    const uploads: string[] = [];
    page.on("request", (r) => { if (r.method() !== "GET" && !r.url().includes("/_next/") && /image|multipart/.test(r.headers()["content-type"] ?? "")) uploads.push(r.url()); });

    await fillManual(page, "");
    await expect(page.getByRole("button", { name: "Take Photo" }).first()).toBeVisible();
    await expect(page.getByRole("button", { name: "Upload Photo" }).first()).toBeVisible();
    await expect(page.getByTestId("vin-photo-camera").first()).toHaveAttribute("capture", "environment");
    await shot(page, "04-take-or-upload-photo");

    await page.getByTestId("vin-photo-upload").last().setInputFiles(FIX("vin-code39.png"));
    await expect(page.locator("#manualVin")).toHaveValue(GOOD_NA_VIN, { timeout: 20_000 });
    await expect(page.getByRole("status").last()).toContainText(GOOD_NA_VIN);
    await shot(page, "05-scanned-vin-to-review");
    expect(count(email)).toBe(0); // reading a photo never adds anything

    await page.getByTestId("vin-photo-camera").last().setInputFiles(FIX("vin-code128.png"));
    await expect(page.locator("#manualVin")).toHaveValue("WVWZZZ1KZAW000123", { timeout: 20_000 });

    // The customer can still correct it before continuing.
    await page.locator("#manualVin").fill(GOOD_NA_VIN);
    await page.getByRole("button", { name: "Continue: confirm your ride" }).click();
    await expect(page.getByTestId("confirm-your-ride")).toBeVisible();
    expect(count(email)).toBe(0);
    expect(uploads).toEqual([]);
  });

  test("the top VIN box takes a photo too, and Decode is the review step", async ({ page }) => {
    await signUpNewUser(page);
    await page.goto("/garage/add");
    await page.getByTestId("vin-photo-upload").first().setInputFiles(FIX("vin-code39.png"));
    await expect(page.getByPlaceholder("Enter 17-character VIN")).toHaveValue(GOOD_NA_VIN, { timeout: 20_000 });
  });

  test("a photo with no VIN barcode says so and fills nothing", async ({ page }) => {
    await signUpNewUser(page);
    await fillManual(page, "");
    await page.getByTestId("vin-photo-upload").last().setInputFiles(FIX("not-a-vin-barcode.png"));
    await expect(page.getByRole("status").last()).toContainText(/Couldn't read a VIN/, { timeout: 20_000 });
    await expect(page.locator("#manualVin")).toHaveValue("");
    await shot(page, "06-scan-failed-message");
  });
});

async function newAccount(browser: Browser) {
  const ctx = await browser.newContext();
  const p = await ctx.newPage();
  const email = await signUpNewUser(p);
  return { ctx, p, email };
}

test.describe("Cross-account VIN privacy", () => {
  test("two accounts can hold the same VIN; neither sees the other's history, and a refusal never mentions other accounts", async ({ browser }) => {
    const v = testVin();
    const A = await newAccount(browser);
    const B = await newAccount(browser);
    const addA = await A.p.request.post("/api/garage", { data: { kind: "catalog", vehicleId: JEEP, vin: v, config: { transmission: "automatic", drivetrain: "4wd" } } });
    expect(addA.status()).toBe(200);
    await A.p.request.post(`/api/garage/${JEEP}/service`, { data: { date: "2026-01-10", mileage: 61000, title: "Private A job", notes: "A-secret-note" } });
    await A.p.request.put(`/api/garage/${JEEP}/odometer`, { data: { value: 61000 } });

    // B adds the very same VIN: succeeds exactly like a fresh VIN, with B's own choices and none of A's data.
    const addB = await B.p.request.post("/api/garage", { data: { kind: "catalog", vehicleId: JEEP, vin: v, config: { transmission: "automatic", drivetrain: "2wd" } } });
    expect(addB.status()).toBe(200);
    const bodyB = await addB.json();
    expect(bodyB.created).toBe(true);
    expect(JSON.stringify(bodyB)).not.toMatch(/A-secret|Private A|61000/);
    expect(bodyB.entry.config.drivetrain).toBe("2wd");

    const svcB = await (await B.p.request.get(`/api/garage/${JEEP}/service`)).text();
    expect(svcB).not.toMatch(/A-secret|Private A/);
    const odoB = await (await B.p.request.get(`/api/garage/${JEEP}/odometer`)).json();
    expect(odoB.odometer).toBeNull();

    // A still has everything; B's add changed nothing for A.
    const svcA = await (await A.p.request.get(`/api/garage/${JEEP}/service`)).text();
    expect(svcA).toMatch(/A-secret/);
    expect(sql(`select count(*) from garage_entries where vin='${v}'`)).toBe("2");

    // Removing it from B's garage leaves A's vehicle and history untouched.
    const del = await B.p.request.delete(`/api/garage/${JEEP}`);
    expect(del.ok()).toBeTruthy();
    expect(sql(`select count(*) from garage_entries where vin='${v}'`)).toBe("1");
    expect(await (await A.p.request.get(`/api/garage/${JEEP}/service`)).text()).toMatch(/A-secret/);

    // A refused VIN gives the same generic message whether or not anyone else holds it.
    const refusedOwned = await B.p.request.post("/api/garage", { data: { kind: "catalog", vehicleId: JEEP, vin: v.slice(0, 16), config: CFG } });
    const refusedFresh = await B.p.request.post("/api/garage", { data: { kind: "catalog", vehicleId: JEEP, vin: testVin().slice(0, 16), config: CFG } });
    expect(await refusedOwned.json()).toEqual(await refusedFresh.json());
    await A.ctx.close(); await B.ctx.close();
  });
});
