import { getRepairsForVehicle } from "../../src/data/repairs";
import { test, expect, Page, BrowserContext } from "@playwright/test";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { signUpNewUser, validVin } from "./helpers";

// Vehicle Configuration V1, exercised in a real browser against a production build and a THROWAWAY Postgres:
//   VIN Lookup -> Confirm Your Ride -> Add to Garage, persistence across logins/devices, Edit Configuration, guide applicability,
//   stale Wrench Mode sessions, duplicates, legacy garage rows, other vehicles, auth.
// The sandbox cannot reach NHTSA, so the vPIC response is mocked at the network layer (the app code path is the real one:
// decodeVin -> matchCatalogVehicles -> Confirm Your Ride). Test VINs are synthetic; none is a real person's VIN.
// Database access below (psql) is only for asserting what was persisted and for seeding rows that predate the feature.
const PG = ["-h", "127.0.0.1", "-p", "5544", "-U", "postgres", "cc_test", "-At", "-F", "|", "-c"];
const sql = (q: string) => execFileSync("psql", [...PG, q], { encoding: "utf8" }).trim();
const SHOTS = process.env.SHOTS_DIR ?? "test-results/config-shots";
fs.mkdirSync(SHOTS, { recursive: true });
const shot = (page: Page, name: string) => page.screenshot({ path: path.join(SHOTS, `${name}.png`), fullPage: true });

const BMW = "2010-bmw-328i-3.0l";
const JEEP = "2014-jeep-grand-cherokee-3.6l";
const OIL = `/vehicles/${BMW}/repairs/bmw-2010-328i-oil-change`;
const PASSWORD = "testpassword123";
const vin = (prefix = "WBA") => validVin(prefix);
const OUT_OF_BUILD = /x-?drive|\bawd\b|all[- ]wheel|transfer[- ]case|front (?:differential|axle)|manual[- ](?:trans\w*|gearbox|pan|holder)|\(manual\)|\bclutch\b/i;

async function mockVpic(page: Page, row: Record<string, string>) {
  await page.route("**/vpic.nhtsa.dot.gov/**", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ Count: 1, Results: [{ ErrorCode: "0", ...row }] }) }),
  );
}
const BMW_ROW: Record<string, string> = { ModelYear: "2010", Make: "BMW", Model: "328i", BodyClass: "Sedan/Saloon", EngineCylinders: "6", DisplacementL: "3.0", FuelTypePrimary: "Gasoline" };
const userIdFor = (email: string) => sql(`select id from users where email='${email}'`);
const rows = (email: string) => sql(`select vehicle_id,vin,transmission,drivetrain,(config_confirmed_at is not null) from garage_entries where user_id='${userIdFor(email)}' order by created_at`);

async function lookup(page: Page, theVin: string, row = BMW_ROW) {
  await mockVpic(page, row);
  await page.goto("/garage/add");
  await page.getByPlaceholder("Enter 17-character VIN").fill(theVin);
  await page.getByRole("button", { name: "Decode" }).click();
  await expect(page.getByRole("button", { name: "+ Add to garage" })).toBeVisible();
}
async function toConfirm(page: Page) {
  await page.getByRole("button", { name: "+ Add to garage" }).click();
  await expect(page.getByTestId("confirm-your-ride")).toBeVisible();
}
const pick = (page: Page, axis: "Transmission" | "Drivetrain", label: string) => page.getByRole("radiogroup", { name: axis }).getByText(label, { exact: true }).click();
const labelsIn = (page: Page, axis: "Transmission" | "Drivetrain") => page.getByRole("radiogroup", { name: axis }).locator("label").allInnerTexts();

/** The whole customer journey for a BMW: sign up, VIN lookup, confirm, add. Returns the account. */
async function addBmw(page: Page, trans: string, drive: string, theVin = vin()) {
  const email = await signUpNewUser(page);
  await lookup(page, theVin);
  await toConfirm(page);
  await pick(page, "Transmission", trans);
  await pick(page, "Drivetrain", drive);
  await page.getByRole("button", { name: /and add to garage$/ }).click();
  await expect(page).toHaveURL(new RegExp(`/vehicles/${BMW}~[^/]+$`));
  return { email, vin: theVin };
}
async function login(ctx: BrowserContext, email: string) {
  const p = await ctx.newPage();
  await p.goto("/login");
  await p.getByLabel("Email").fill(email);
  await p.getByLabel("Password").fill(PASSWORD);
  await p.getByRole("button", { name: "Log In" }).click();
  await expect(p).toHaveURL(/\/garage$/, { timeout: 20_000 });
  return p;
}

test.describe("1-3. VIN Lookup -> Confirm Your Ride -> Add to Garage", () => {
  test("confirmation happens on the site between VIN Lookup and the add: nothing is saved until both choices are confirmed", async ({ page }) => {
    const email = await signUpNewUser(page);
    await lookup(page, vin());
    await shot(page, "01-vin-lookup-result");
    await toConfirm(page);
    await shot(page, "02-confirm-your-ride-empty");

    // not saved yet, and the button cannot be pressed
    expect(rows(email)).toBe("");
    const confirm = page.getByRole("button", { name: /add to garage$/ });
    await expect(confirm).toBeDisabled();
    await pick(page, "Transmission", "Automatic");
    await expect(confirm).toBeDisabled();
    expect(rows(email)).toBe("");

    // a BMW 328i is only offered builds it came in
    expect(await labelsIn(page, "Transmission")).toEqual(["Automatic", "Manual", "Not sure"]);
    expect(await labelsIn(page, "Drivetrain")).toEqual(["Standard RWD", "xDrive AWD", "Not sure"]);
    await expect(page.getByTestId("config-generic-note")).toHaveCount(0); // the BMW list is ours, so no "general options" caveat

    await pick(page, "Drivetrain", "Standard RWD");
    await expect(page.getByRole("button", { name: "Confirm Automatic · Standard RWD and add to garage" })).toBeEnabled();
    await shot(page, "03-confirm-your-ride-automatic-rwd");
    await page.getByRole("button", { name: "Confirm Automatic · Standard RWD and add to garage" }).click();
    await expect(page).toHaveURL(new RegExp(`/vehicles/${BMW}~[^/]+$`));
    expect(rows(email)).toMatch(new RegExp(`^${BMW}\\|[A-Z0-9]{17}\\|automatic\\|rwd\\|t$`));
  });

  test("the saved configuration shows on the vehicle page, the garage card and the guide, with no xDrive or manual wording anywhere", async ({ page }) => {
    await addBmw(page, "Automatic", "Standard RWD");
    await expect(page.getByTestId("config-line")).toHaveText(/Automatic.*Standard RWD/);
    await shot(page, "04-vehicle-page-automatic-rwd");

    await page.goto("/garage");
    const card = page.getByText(/3\.0L inline-six · Automatic · RWD/);
    await expect(card).toBeVisible();
    await expect(page.getByText(/Confirm transmission/)).toHaveCount(0);
    await shot(page, "05-garage-card-after");

    await page.goto(OIL);
    await expect(page.getByTestId("config-applied")).toBeVisible();
    const text = await page.locator("body").innerText();
    expect(text).not.toMatch(OUT_OF_BUILD);
    expect(text).not.toMatch(/not confirmed from the VIN alone|might be RWD or xDrive|check whether your car is/i);
    await expect(page.getByText("Before you start: check your car").first()).toBeVisible();
    // Step 1 is practical: no part-number dump, no catalog comparison
    expect(text).not.toMatch(/RealOEM|11137553164|diagram 11_/);
    await shot(page, "06-oil-change-automatic-rwd");
  });

  test("the VIN may preselect a choice, but the customer still confirms it and nothing is saved by the lookup", async ({ page }) => {
    const email = await signUpNewUser(page);
    await lookup(page, vin(), { ...BMW_ROW, DriveType: "AWD/All-Wheel Drive" });
    await toConfirm(page);
    await expect(page.getByRole("radiogroup", { name: "Drivetrain" }).getByRole("radio", { name: "xDrive AWD" })).toBeChecked();
    await expect(page.getByText(/Suggested from your VIN lookup/)).toBeVisible();
    await expect(page.getByRole("radiogroup", { name: "Transmission" }).getByRole("radio", { checked: true })).toHaveCount(0);
    await expect(page.getByRole("button", { name: /add to garage$/ })).toBeDisabled();
    expect(rows(email)).toBe("");
  });

  test("Back from Confirm Your Ride saves nothing", async ({ page }) => {
    const email = await signUpNewUser(page);
    await lookup(page, vin());
    await toConfirm(page);
    await page.getByRole("button", { name: "Back" }).click();
    expect(rows(email)).toBe("");
    await expect(page.getByRole("button", { name: "+ Add to garage" })).toBeVisible();
  });
});

test.describe("2/3/4/5. Other builds, Not sure", () => {
  test("Automatic + xDrive: saved, shown as xDrive, and the oil-change guide refuses (not researched for xDrive)", async ({ page }) => {
    const { email } = await addBmw(page, "Automatic", "xDrive AWD");
    expect(rows(email)).toMatch(/\|automatic\|awd\|t$/);
    await expect(page.getByTestId("config-line")).toHaveText(/xDrive AWD/);
    await page.goto(OIL);
    await expect(page.getByTestId("config-unavailable")).toBeVisible();
    await expect(page.getByRole("button", { name: /Not available for your configuration/ })).toBeDisabled();
    await shot(page, "07-oil-change-xdrive-refusal");
    await page.goto("/garage");
    await expect(page.getByText(/Automatic · xDrive/)).toBeVisible();
  });

  test("Manual + RWD: saved; guides researched only for the automatic refuse, guides that do not depend on it still open", async ({ page }) => {
    const { email } = await addBmw(page, "Manual", "Standard RWD");
    expect(rows(email)).toMatch(/\|manual\|rwd\|t$/);
    await page.goto(OIL);
    await expect(page.getByTestId("config-unavailable")).toBeVisible();
    await page.goto(`/vehicles/${BMW}/repairs/bmw-2010-328i-battery`);
    await expect(page.getByTestId("config-unavailable")).toHaveCount(0);
    await expect(page.getByText("Before you start: check your car").first()).toBeVisible();
  });

  test("Not sure: stored as unknown, the add works, build-dependent steps are restricted, universal ones show, and nothing looks certified", async ({ page }) => {
    const { email } = await addBmw(page, "Not sure", "Not sure");
    expect(rows(email)).toMatch(/\|unknown\|unknown\|t$/);
    await expect(page.getByRole("button", { name: "Confirm configuration" })).toBeVisible();
    await page.goto(OIL);
    await expect(page.getByTestId("config-needs-confirmation")).toBeVisible();
    const text = await page.locator("body").innerText();
    expect(text).toMatch(/RESTRICTED — Drain the sump/);
    expect(text).toMatch(/Lift and support the car/);
    expect(text).not.toMatch(/OUT_OF_BUILD/);
    await shot(page, "08-oil-change-not-sure-restricted");
  });
});

test.describe("6. Edit Configuration after the add", () => {
  test("editing changes the guides, keeps the vehicle, its VIN and its service history, and needs no delete or re-add", async ({ page }) => {
    const { email, vin: theVin } = await addBmw(page, "Automatic", "Standard RWD");
    const logged = await page.request.post(`/api/garage/${BMW}/service`, { data: { date: "2026-01-10", mileage: 61000, title: "Engine Oil & Filter Change" } });
    expect(logged.ok()).toBeTruthy();
    const before = rows(email);
    const idBefore = sql(`select id from garage_entries where user_id='${userIdFor(email)}'`);

    await page.getByRole("button", { name: "Edit configuration" }).click();
    await shot(page, "09-edit-configuration");
    await pick(page, "Drivetrain", "xDrive AWD");
    await page.getByRole("button", { name: "Save configuration" }).click();
    await expect(page.getByTestId("config-line")).toHaveText(/xDrive AWD/);

    expect(rows(email)).toMatch(new RegExp(`\\|${theVin}\\|automatic\\|awd\\|t$`));
    expect(sql(`select id from garage_entries where user_id='${userIdFor(email)}'`)).toBe(idBefore);
    expect(sql(`select count(*) from service_entries where garage_entry_id='${idBefore}'`)).toBe("1");
    expect(before).not.toBe(rows(email));

    await page.goto(OIL);
    await expect(page.getByTestId("config-unavailable")).toBeVisible();
    // and back again
    await page.goto(`/vehicles/${BMW}`);
    await page.getByRole("button", { name: "Edit configuration" }).click();
    await pick(page, "Drivetrain", "Standard RWD");
    await page.getByRole("button", { name: "Save configuration" }).click();
    await expect(page.getByTestId("config-line")).toHaveText(/Standard RWD/);
    await page.goto(OIL);
    await expect(page.getByTestId("config-applied")).toBeVisible();
    expect(sql(`select count(*) from service_entries where garage_entry_id='${idBefore}'`)).toBe("1");
  });

  test("an edit the model does not offer is refused by the server (a 328i is never 4WD or FWD)", async ({ page }) => {
    await addBmw(page, "Automatic", "Standard RWD");
    for (const body of [{ drivetrain: "4wd" }, { drivetrain: "fwd" }, { transmission: "cvt" }, {}]) {
      const r = await page.request.patch(`/api/garage/${BMW}`, { data: body });
      expect(r.status(), JSON.stringify(body)).toBe(400);
    }
    const ok = await page.request.patch(`/api/garage/${BMW}`, { data: { transmission: "manual" } });
    expect(ok.ok()).toBeTruthy();
  });
});

test.describe("7/8. Existing garage preserved; persistence across logins and devices", () => {
  test("a vehicle that predates the feature (no configuration saved) is kept, asks to be confirmed, and gets its configuration without delete and re-add", async ({ page }) => {
    const email = await signUpNewUser(page);
    const uid = userIdFor(email);
    const legacyVin = vin("WBA");
    // rows exactly as they existed before the migration: no configuration columns set
    sql(`insert into garage_entries(id,user_id,kind,vehicle_id,vin) values ('legacy-bmw-${uid}','${uid}','catalog','${BMW}','${legacyVin}'),('legacy-jeep-${uid}','${uid}','catalog','${JEEP}',null)`);
    sql(`insert into service_entries(id,garage_entry_id,date,mileage,title) values ('svc-${uid}','legacy-bmw-${uid}','2025-11-02',58000,'Engine Oil & Filter Change')`);

    await page.goto("/garage");
    await expect(page.getByText(/328i/).first()).toBeVisible();
    await expect(page.getByText(/Grand Cherokee/).first()).toBeVisible();
    await expect(page.getByText("Confirm transmission & drivetrain")).toHaveCount(2); // both legacy rows (BMW and Jeep) have nothing saved yet, so both ask
    await shot(page, "10-garage-legacy-rows");

    await page.goto(`/vehicles/${BMW}`);
    await expect(page.getByRole("button", { name: "Confirm configuration" })).toBeVisible();
    await page.getByRole("button", { name: "Confirm configuration" }).click();
    await pick(page, "Transmission", "Automatic");
    await pick(page, "Drivetrain", "Standard RWD");
    await page.getByRole("button", { name: "Save configuration" }).click();
    await expect(page.getByTestId("config-line")).toHaveText(/Automatic.*Standard RWD/);

    expect(sql(`select id,vin,transmission,drivetrain from garage_entries where id='legacy-bmw-${uid}'`)).toBe(`legacy-bmw-${uid}|${legacyVin}|automatic|rwd`);
    expect(sql(`select count(*) from garage_entries where user_id='${uid}'`)).toBe("2");
    expect(sql(`select count(*) from service_entries where garage_entry_id='legacy-bmw-${uid}'`)).toBe("1");
    expect(sql(`select transmission is null and drivetrain is null from garage_entries where id='legacy-jeep-${uid}'`)).toBe("t");
  });

  test("the confirmed configuration persists across logout, login and a second device", async ({ page, browser }) => {
    const { email } = await addBmw(page, "Automatic", "Standard RWD");
    const second = await browser.newContext();
    const p2 = await login(second, email);
    await p2.goto(`/vehicles/${BMW}`);
    await expect(p2.getByTestId("config-line")).toHaveText(/Automatic.*Standard RWD/);
    await p2.goto("/garage");
    await expect(p2.getByText(/Automatic · RWD/)).toBeVisible();
    const api = await p2.request.get("/api/garage");
    const body = await api.json();
    const entry = (body.entries ?? body).find((e: { id: string }) => e.id.startsWith(`${BMW}~`));
    expect(entry.config).toMatchObject({ transmission: "automatic", drivetrain: "rwd" });
    // sign out and back in on the first device
    await page.context().clearCookies();
    const p3 = await login(page.context(), email);
    await p3.goto(`/vehicles/${BMW}`);
    await expect(p3.getByTestId("config-line")).toHaveText(/Automatic.*Standard RWD/);
    await second.close();
  });
});

test.describe("9/14. A later lookup never overwrites a confirmed choice, and never duplicates a vehicle", () => {
  test("looking the same VIN up again and answering differently keeps the saved configuration and the single vehicle", async ({ page }) => {
    const { email, vin: theVin } = await addBmw(page, "Automatic", "Standard RWD");
    await lookup(page, theVin);
    await toConfirm(page);
    await pick(page, "Transmission", "Manual");
    await pick(page, "Drivetrain", "xDrive AWD");
    await page.getByRole("button", { name: /and add to garage$/ }).click();
    await expect(page.getByTestId("already-in-garage")).toBeVisible();
    await expect(page.getByTestId("already-in-garage")).toContainText(/Your saved transmission and drivetrain were kept/);
    await shot(page, "11-already-in-garage");
    expect(rows(email)).toMatch(new RegExp(`^${BMW}\\|${theVin}\\|automatic\\|rwd\\|t$`));
  });

  test("the same catalog vehicle or the same VIN added twice over the API is one row", async ({ page }) => {
    const email = await signUpNewUser(page);
    const body = { kind: "catalog", vin: vin("1HG"), vehicleId: "2018-honda-civic-1.5t", config: { transmission: "cvt", drivetrain: "fwd" } };
    const a = await (await page.request.post("/api/garage", { data: body })).json();
    const b = await (await page.request.post("/api/garage", { data: { ...body, config: { transmission: "manual", drivetrain: "awd" } } })).json();
    expect(a.created).toBe(true); expect(b.created).toBe(false); expect(b.configKept).toBe(true);
    const custom = { kind: "custom", custom: { vin: vin("1N6"), year: "2013", make: "Nissan", model: "Pathfinder" }, config: { transmission: "automatic", drivetrain: "4wd" } };
    const c = await (await page.request.post("/api/garage", { data: custom })).json();
    const d = await (await page.request.post("/api/garage", { data: custom })).json();
    expect(c.created).toBe(true); expect(d.created).toBe(false);
    expect(sql(`select count(*) from garage_entries where user_id='${userIdFor(email)}'`)).toBe("2");
    expect(rows(email)).toMatch(/2018-honda-civic-1\.5t\|.*\|cvt\|fwd\|t/);
    // concurrent double submit
    const camryVin = vin("4T1");
    const par = await Promise.all([1, 2, 3].map(() => page.request.post("/api/garage", { data: { kind: "catalog", vin: camryVin, vehicleId: "2021-toyota-camry-2.5l", config: { transmission: "automatic", drivetrain: "fwd" } } })));
    expect(par.every((r) => r.ok())).toBeTruthy();
    expect(sql(`select count(*) from garage_entries where user_id='${userIdFor(email)}' and vehicle_id='2021-toyota-camry-2.5l'`)).toBe("1");
  });
});

test.describe("13. A Wrench Mode session never resumes on steps for an old configuration", () => {
  test("changing the saved configuration ends the open session", async ({ page }) => {
    await addBmw(page, "Automatic", "Standard RWD");
    await page.goto(OIL);
    await page.getByRole("button", { name: /Start Wrench Mode/ }).click();
    await expect(page.getByTestId("wrench-session-ended")).toHaveCount(0);
    // the configuration changes (another tab or device): the open session must not carry on
    const r = await page.request.patch(`/api/garage/${BMW}`, { data: { transmission: "unknown", drivetrain: "unknown" } });
    expect(r.ok()).toBeTruthy();
    await page.waitForTimeout(5_500); // SWR throttles focus revalidation to once per 5 s
    await page.evaluate(() => { window.dispatchEvent(new Event("focus")); document.dispatchEvent(new Event("visibilitychange")); });
    await expect(page.getByTestId("wrench-session-ended")).toBeVisible({ timeout: 15_000 });
    await shot(page, "12-wrench-session-ended");
    // and a fresh start uses the new, restricted guide
    await page.reload();
    await expect(page.getByTestId("config-needs-confirmation")).toBeVisible();
  });
});

test.describe("15. Other vehicles are unaffected", () => {
  test("Jeep: the add flow offers 2WD/4WD, saves the answer, and its guides read as before (no configuration notice)", async ({ page }) => {
    const email = await signUpNewUser(page);
    await mockVpic(page, { ModelYear: "2014", Make: "Jeep", Model: "Grand Cherokee", EngineCylinders: "6", DisplacementL: "3.6", FuelTypePrimary: "Gasoline" });
    await page.goto("/garage/add");
    await page.getByPlaceholder("Enter 17-character VIN").fill(vin("1C4TEST"));
    await page.getByRole("button", { name: "Decode" }).click();
    await page.getByRole("button", { name: "+ Add to garage" }).click();
    await expect(page.getByTestId("confirm-your-ride")).toBeVisible();
    const drive = await labelsIn(page, "Drivetrain");
    expect(drive).toEqual(["2WD", "4WD", "Not sure"]);
    await expect(page.getByTestId("config-generic-note")).toContainText("not a list verified for this model");
    await shot(page, "13-confirm-your-ride-jeep");
    await pick(page, "Transmission", "Automatic");
    await pick(page, "Drivetrain", "4WD");
    await page.getByRole("button", { name: /and add to garage$/ }).click();
    await expect(page).toHaveURL(new RegExp(`/vehicles/${JEEP}~[^/]+$`));
    expect(rows(email)).toMatch(/\|automatic\|4wd\|t$/);
    await expect(page).toHaveURL(new RegExp(`/vehicles/${JEEP}~[^/]+$`)); // the guides are listed on the vehicle page
    const guideLinks = page.locator(`a[href^="/vehicles/${JEEP}/repairs/"]`);
    const href = await guideLinks.first().getAttribute("href");
    await page.goto(href!);
    await expect(page.getByTestId("config-needs-confirmation")).toHaveCount(0);
    await expect(page.getByTestId("config-unavailable")).toHaveCount(0);
    await expect(page.getByRole("heading").first()).toBeVisible();
  });

  test("a Ford with no model list gets the generic family and a VIN preselect; a manual vehicle form also goes through confirmation", async ({ page }) => {
    await signUpNewUser(page);
    await mockVpic(page, { ModelYear: "2015", Make: "Ford", Model: "F-150", EngineCylinders: "8", DisplacementL: "5.0", FuelTypePrimary: "Gasoline", DriveType: "4WD/4-Wheel Drive/4x4", TransmissionStyle: "Automatic" });
    await page.goto("/garage/add");
    await page.getByPlaceholder("Enter 17-character VIN").fill(vin("1FTTEST"));
    await page.getByRole("button", { name: "Decode" }).click();
    await page.getByRole("button", { name: "+ Add to garage" }).click();
    await expect(page.getByTestId("confirm-your-ride")).toBeVisible();
    expect(await labelsIn(page, "Drivetrain")).toEqual(["FWD", "RWD", "AWD", "4WD", "Not sure"]);
    await expect(page.getByTestId("config-generic-note")).toBeVisible();
    await expect(page.getByRole("radiogroup", { name: "Drivetrain" }).getByRole("radio", { name: "4WD" })).toBeChecked();
    await expect(page.getByRole("radiogroup", { name: "Transmission" }).getByRole("radio", { name: "Automatic" })).toBeChecked();
    await expect(page.getByRole("button", { name: "Confirm Automatic · 4WD and add to garage" })).toBeEnabled(); // preselected, still needs the click
  });
});

test.describe("17/18. Security and refusals", () => {
  test("signed-out calls are rejected; nobody can read or change another customer's configuration", async ({ page, browser }) => {
    const anon = await browser.newContext();
    const p = await anon.newPage();
    expect((await p.request.get("/api/garage")).status()).toBe(401);
    expect((await p.request.post("/api/garage", { data: { kind: "catalog", vehicleId: BMW, config: { transmission: "automatic", drivetrain: "rwd" } } })).status()).toBe(401);
    expect((await p.request.patch(`/api/garage/${BMW}`, { data: { drivetrain: "awd" } })).status()).toBe(401);
    await anon.close();

    const { email } = await addBmw(page, "Automatic", "Standard RWD");
    const other = await browser.newContext();
    const po = await other.newPage();
    await po.goto("/signup");
    await po.getByLabel("Email").fill(`e2e-other-${Date.now()}@example.com`);
    await po.getByLabel("Password").fill(PASSWORD);
    await po.getByRole("button", { name: "Create Account" }).click();
    await expect(po).toHaveURL(/\/garage$/, { timeout: 20_000 });
    const r = await po.request.patch(`/api/garage/${BMW}`, { data: { drivetrain: "awd" } });
    expect(r.status()).toBe(404);
    expect(rows(email)).toMatch(/\|automatic\|rwd\|t$/);
    await other.close();
  });

  test("the server refuses an add without both axes, and impossible BMW combinations", async ({ page }) => {
    await signUpNewUser(page);
    const post = (data: unknown) => page.request.post("/api/garage", { data });
    const V = vin("WBA");
    for (const d of [
      { kind: "catalog", vin: V, vehicleId: BMW },
      { kind: "catalog", vin: V, vehicleId: BMW, config: { transmission: "automatic" } },
      { kind: "catalog", vin: V, vehicleId: BMW, config: { transmission: "automatic", drivetrain: "4wd" } },
      { kind: "catalog", vin: V, vehicleId: BMW, config: { transmission: "cvt", drivetrain: "rwd" } },
      { kind: "custom", custom: { vin: V, make: "Nissan" } },
      { kind: "catalog", vin: V, vehicleId: "no-such-vehicle", config: { transmission: "automatic", drivetrain: "rwd" } },
    ]) {
      const r = await post(d);
      expect(r.status(), JSON.stringify(d)).toBe(400);
    }
    expect(JSON.stringify(await (await post({ kind: "catalog", vin: V, vehicleId: BMW })).json())).toMatch(/Confirm your/);
  });

  test("a vehicle-specific guide with no evidence for the confirmed build gives no steps, parts or torque, and cannot start Wrench Mode", async ({ page }) => {
    await addBmw(page, "Automatic", "xDrive AWD");
    await page.goto(`/vehicles/${BMW}/repairs/bmw-2010-328i-differential-fluid`);
    await expect(page.getByTestId("config-unavailable")).toBeVisible();
    const text = await page.locator("body").innerText();
    expect(text).not.toMatch(/\d+\s*Nm/);
    expect(text).toMatch(/NOT AVAILABLE/);
  });
});

test.describe("16. All 16 BMW categories open for every configuration", () => {
  const JOBS = ["front-brake-pads", "fuse-bulb", "key-fob-battery", "o2-sensor", "rear-brake-pads", "serpentine-belt", "battery", "coolant", "fluid-checks", "cabin-air-filter", "pcv-valve", "engine-air-filter", "tire-rotation", "wiper-blades", "differential-fluid", "oil-change"];
  for (const [name, t, d] of [["Automatic + RWD", "Automatic", "Standard RWD"], ["Not sure", "Not sure", "Not sure"]] as const) {
    test(`${name}: the vehicle page lists 16 categories and every guide opens`, async ({ page }) => {
      test.setTimeout(150_000);
      await addBmw(page, t, d);
      await page.goto(`/vehicles/${BMW}`);
      const links = await page.locator(`a[href^="/vehicles/${BMW}~"][href*="/repairs/bmw-2010-328i-"]`).evaluateAll((els) => [...new Set(els.map((e) => (e as HTMLAnchorElement).getAttribute("href")))]);
      expect(links.length).toBe(16);
      for (const href of links as string[]) {
        const res = await page.goto(href);
        expect(res?.status(), href).toBe(200);
        await expect(page.getByRole("heading").first()).toBeVisible();
        await expect(page.getByTestId("config-unavailable"), href).toHaveCount(0);
        // safety-critical restrictions survive any configuration: a guide that has blocked steps still says so
        const slug = href.split("/").pop()!;
        const g = getRepairsForVehicle(BMW).find((x) => x.id === slug)!;
        if (g.steps.some((x) => x.title.startsWith("⛔ BLOCKED — "))) expect(await page.locator("body").innerText(), href).toContain("BLOCKED");
        if (name === "Automatic + RWD") await expect(page.getByTestId("config-needs-confirmation"), href).toHaveCount(0);
      }
      expect(JOBS.length).toBe(16);
    });
  }
});

test.describe("16. Two cars of the same year/make/model coexist", () => {
  const CIVIC = "2018-honda-civic-1.5t";
  const cfg = { transmission: "cvt", drivetrain: "fwd" };

  test("different VINs are separate cars with separate history, config, edit and delete; the old bare model link asks which car", async ({ page }) => {
    const email = await signUpNewUser(page);
    const a = await (await page.request.post("/api/garage", { data: { kind: "catalog", vehicleId: CIVIC, vin: vin("CIVICA"), config: cfg } })).json();
    const b = await (await page.request.post("/api/garage", { data: { kind: "catalog", vehicleId: CIVIC, vin: vin("CIVICB"), config: { transmission: "manual", drivetrain: "fwd" } } })).json();
    expect(a.created).toBe(true); expect(b.created).toBe(true);
    // each car has its own permanent id: <model>~<rowId>
    expect(a.entry.id).toMatch(new RegExp(`^${CIVIC.replace(/\./g, "\\.")}~[0-9a-f-]{36}$`));
    expect(b.entry.id).toMatch(new RegExp(`^${CIVIC.replace(/\./g, "\\.")}~[0-9a-f-]{36}$`));
    expect(a.entry.id).not.toBe(b.entry.id);
    expect(sql(`select count(*) from garage_entries where user_id='${userIdFor(email)}' and vehicle_id='${CIVIC}'`)).toBe("2");

    // each car has its own Service History
    const post = (id: string, title: string) => page.request.post(`/api/garage/${encodeURIComponent(id)}/service`, { data: { date: "2026-01-15", mileage: 1000, title } });
    expect((await post(a.entry.id, "Oil change A")).ok()).toBeTruthy();
    expect((await post(b.entry.id, "Brake pads B")).ok()).toBeTruthy();
    const histA = (await (await page.request.get(`/api/garage/${encodeURIComponent(a.entry.id)}/service`)).json()).entries.map((e: { title: string }) => e.title);
    const histB = (await (await page.request.get(`/api/garage/${encodeURIComponent(b.entry.id)}/service`)).json()).entries.map((e: { title: string }) => e.title);
    expect(histA).toEqual(["Oil change A"]);
    expect(histB).toEqual(["Brake pads B"]);

    // each car's page loads under its own id and shows its own history
    await page.goto(`/vehicles/${encodeURIComponent(b.entry.id)}`);
    await expect(page.getByRole("heading", { level: 1 })).toContainText(/Civic/);
    await page.goto(`/vehicles/${encodeURIComponent(a.entry.id)}`);
    await expect(page.getByRole("heading", { level: 1 })).toContainText(/Civic/);
    // the old bare model link no longer guesses between two cars: it asks which one
    await page.goto(`/vehicles/${CIVIC}`);
    await expect(page.getByTestId("choose-your-car")).toBeVisible();

    // editing one car's configuration leaves the other alone
    expect((await page.request.patch(`/api/garage/${encodeURIComponent(b.entry.id)}`, { data: { transmission: "automatic" } })).ok()).toBeTruthy();
    const list = (await (await page.request.get("/api/garage")).json()).entries as { id: string; config: { transmission: string } }[];
    expect(list.find((e) => e.id === a.entry.id)!.config.transmission).toBe("cvt");
    expect(list.find((e) => e.id === b.entry.id)!.config.transmission).toBe("automatic");

    // the same VIN again is the same car; it is not duplicated
    const again = await (await page.request.post("/api/garage", { data: { kind: "catalog", vehicleId: CIVIC, vin: sql(`select vin from garage_entries where id='${b.entry.id.split("~")[1]}'`), config: cfg } })).json();
    expect(again.created).toBe(false); expect(again.entry.id).toBe(b.entry.id);

    // removing the extra car removes only that car (and its history), the first car is untouched
    expect((await page.request.delete(`/api/garage/${encodeURIComponent(b.entry.id)}`)).ok()).toBeTruthy();
    expect(sql(`select count(*) from garage_entries where user_id='${userIdFor(email)}' and vehicle_id='${CIVIC}'`)).toBe("1");
    const left = (await (await page.request.get(`/api/garage/${encodeURIComponent(a.entry.id)}/service`)).json()).entries;
    expect(left).toHaveLength(1);
  });

  test("an older record without a VIN is completed by the first VIN; the next different VIN is a new car; another customer's id never resolves", async ({ page, browser }) => {
    const email = await signUpNewUser(page);
    // an older record that predates the VIN rule (seeded directly: the API no longer creates VIN-less rows)
    sql(`insert into garage_entries (id,user_id,kind,vehicle_id,transmission,drivetrain,config_confirmed_at) values (gen_random_uuid()::text,'${userIdFor(email)}','catalog','${CIVIC}','cvt','fwd',now())`);
    await page.request.post(`/api/garage/${CIVIC}/service`, { data: { date: "2026-02-01", mileage: 500, title: "Legacy history" } });
    const first = await (await page.request.post("/api/garage", { data: { kind: "catalog", vehicleId: CIVIC, vin: vin("CIVICC"), config: cfg } })).json();
    expect(first.created).toBe(false);          // completed the existing record, did not create a second one
    expect(first.entry.id).toMatch(/^2018-honda-civic-1\.5t~/);
    const hist = (await (await page.request.get(`/api/garage/${encodeURIComponent(first.entry.id)}/service`)).json()).entries;
    expect(hist).toHaveLength(1);                // history stayed with the record
    const second = await (await page.request.post("/api/garage", { data: { kind: "catalog", vehicleId: CIVIC, vin: vin("CIVICD"), config: cfg } })).json();
    expect(second.created).toBe(true);
    expect(second.entry.id).toContain("~");
    expect(sql(`select count(*) from garage_entries where user_id='${userIdFor(email)}' and vehicle_id='${CIVIC}'`)).toBe("2");

    // a different customer cannot read, edit or delete this customer's extra car by its id
    const ctx = await browser.newContext();
    const other = await ctx.newPage();
    await signUpNewUser(other);
    const sid = encodeURIComponent(second.entry.id);
    expect((await (await other.request.get(`/api/garage/${sid}/service`)).json()).entries).toEqual([]);
    expect((await other.request.patch(`/api/garage/${sid}`, { data: { transmission: "manual" } })).status()).toBe(404);
    await other.request.delete(`/api/garage/${sid}`);
    expect(sql(`select count(*) from garage_entries where user_id='${userIdFor(email)}' and vehicle_id='${CIVIC}'`)).toBe("2");
    await ctx.close();
  });
});
