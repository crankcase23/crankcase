import { test, expect, Page } from "@playwright/test";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { randomIp, signUpNewUser, validVin } from "./helpers";

// VIN-required garage + photo VIN scanning, in a real browser on a production build and a THROWAWAY Postgres.
// NHTSA is unreachable from the sandbox, so its vPIC response is mocked at the network layer. The photo scan itself is real:
// the open-source OCR engine runs in the page against the fixture photos in tests/e2e/fixtures. Those photos are clean
// synthetic renderings, so they prove the pipeline and the safety rules, NOT accuracy on real dash plates in real light.
// A real phone camera is not driven here: the camera button is a file input with capture="environment" and the test
// supplies the photo through the same file chooser a phone would use.
const PG = ["-h", "127.0.0.1", "-p", "5544", "-U", "postgres", "cc_test", "-At", "-F", "|", "-c"];
const sql = (q: string) => execFileSync("psql", [...PG, q], { encoding: "utf8" }).trim();
const SHOTS = process.env.SHOTS_DIR ?? "test-results/config-shots";
fs.mkdirSync(SHOTS, { recursive: true });
const shot = (page: Page, name: string) => page.screenshot({ path: path.join(SHOTS, `${name}.png`), fullPage: true });
const FIX = (n: string) => path.join(__dirname, "fixtures", n);

const BMW = "2010-bmw-328i-3.0l";
const JEEP = "2014-jeep-grand-cherokee-3.6l";
const CIVIC = "2018-honda-civic-1.5t";
const CLEAN_VIN = "1HGCM82633A004352"; // the VIN rendered in fixtures/vin-clean.png
const OK = { transmission: "automatic", drivetrain: "rwd" };
const uidOf = (email: string) => sql(`select id from users where email='${email}'`);
const countFor = (email: string) => Number(sql(`select count(*) from garage_entries where user_id='${uidOf(email)}'`));
const post = (page: Page, data: unknown) => page.request.post("/api/garage", { data });
const catalog = (vin: unknown, vehicleId = BMW, config: unknown = OK) => ({ kind: "catalog", vin, vehicleId, config });

async function mockVpic(page: Page, row: Record<string, string>) {
  let calls = 0;
  await page.route("**/vpic.nhtsa.dot.gov/**", (route) => {
    calls++;
    return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ Count: 1, Results: [{ ErrorCode: "0", ...row }] }) });
  });
  return () => calls;
}
const HONDA_ROW = { ModelYear: "2003", Make: "HONDA", Model: "Accord", BodyClass: "Sedan", EngineCylinders: "4", DisplacementL: "2.4", FuelTypePrimary: "Gasoline" };

// ------------------------------------------------------------------------------------------------ server enforcement
test.describe("A VIN is required by the server, not just the screen", () => {
  test("adding without a VIN, or with a bad one, is refused and creates nothing", async ({ page }) => {
    const email = await signUpNewUser(page);
    const good = validVin("WBA");
    const cases: [string, unknown][] = [
      ["missing", catalog(undefined)],
      ["empty", catalog("")],
      ["spaces only", catalog("   ")],
      ["16 chars", catalog(good.slice(1))],
      ["18 chars", catalog(good + "1")],
      ["letter O", catalog(good.slice(0, 4) + "O" + good.slice(5))],
      ["letter I", catalog(good.slice(0, 4) + "I" + good.slice(5))],
      ["symbol", catalog(good.slice(0, 4) + "#" + good.slice(5))],
      ["wrong check digit", catalog(good.slice(0, 8) + (good[8] === "4" ? "5" : "4") + good.slice(9))],
      ["a number, not a string", catalog(12345678901234567)],
      ["custom, missing", { kind: "custom", custom: { make: "Nissan", model: "Pathfinder" }, config: OK }],
      ["custom, bad check digit", { kind: "custom", custom: { vin: "1HGCM82633A004353", make: "Honda" }, config: OK }],
    ];
    for (const [name, data] of cases) {
      const r = await post(page, data);
      expect(r.status(), name).toBe(400);
      expect((await r.json()).code, name).toBe("VIN_INVALID");
    }
    expect(countFor(email)).toBe(0);
  });

  test("the VIN is stored in canonical form (upper case, no spaces) and the same VIN in any spelling is one vehicle", async ({ page }) => {
    const email = await signUpNewUser(page);
    const v = validVin("WBA");
    const a = await (await post(page, catalog(v.toLowerCase().replace(/^(.{5})/, "$1 ")))).json();
    expect(a.created).toBe(true);
    expect(sql(`select vin from garage_entries where user_id='${uidOf(email)}'`)).toBe(v);
    const b = await (await post(page, catalog(` ${v} `))).json();
    expect(b.created).toBe(false);
    const c = await (await post(page, { kind: "custom", custom: { vin: v.toLowerCase(), make: "BMW", model: "328i" }, config: OK })).json();
    expect(c.created).toBe(false);
    expect(countFor(email)).toBe(1);
  });

  test("service history and odometer cannot be used to create a VIN-less garage vehicle", async ({ page }) => {
    const email = await signUpNewUser(page);
    const s = await page.request.post(`/api/garage/${JEEP}/service`, { data: { date: "2026-01-01", mileage: 1000, title: "Oil" } });
    expect(s.status()).toBe(404);
    const o = await page.request.put(`/api/garage/${JEEP}/odometer`, { data: { value: 1000 } });
    expect(o.status()).toBe(404);
    expect(countFor(email)).toBe(0);
  });

  test("two cars of the same year/make/model with different VINs coexist, each with its own history, VIN and removal", async ({ page }) => {
    const email = await signUpNewUser(page);
    const v1 = validVin("1HG");
    const v2 = validVin("1HG");
    const a = await (await post(page, catalog(v1, CIVIC, { transmission: "cvt", drivetrain: "fwd" }))).json();
    const b = await (await post(page, catalog(v2, CIVIC, { transmission: "manual", drivetrain: "fwd" }))).json();
    expect(a.created).toBe(true); expect(b.created).toBe(true);
    expect(a.entry.id).toBe(CIVIC);                 // oldest keeps the plain legacy id
    expect(b.entry.id).toContain("~");               // the second car has its own id
    expect(countFor(email)).toBe(2);
    expect(sql(`select count(distinct vin) from garage_entries where user_id='${uidOf(email)}'`)).toBe("2");

    // separate Service History and odometer
    const enc = encodeURIComponent;
    await page.request.post(`/api/garage/${enc(a.entry.id)}/service`, { data: { date: "2026-01-01", mileage: 10, title: "Car A job" } });
    await page.request.post(`/api/garage/${enc(b.entry.id)}/service`, { data: { date: "2026-01-02", mileage: 20, title: "Car B job" } });
    await page.request.put(`/api/garage/${enc(b.entry.id)}/odometer`, { data: { value: 777 } });
    const titles = async (id: string) => (await (await page.request.get(`/api/garage/${enc(id)}/service`)).json()).entries.map((e: { title: string }) => e.title);
    expect(await titles(a.entry.id)).toEqual(["Car A job"]);
    expect(await titles(b.entry.id)).toEqual(["Car B job"]);
    const odoA = await (await page.request.get(`/api/garage/${enc(a.entry.id)}/odometer`)).json();
    expect(JSON.stringify(odoA)).not.toContain("777");

    // the garage lists both, and each car's page opens
    await page.goto("/garage");
    await expect(page.getByRole("button", { name: /^Remove .*Civic.* from garage$/ })).toHaveCount(2);
    await expect(page.locator(`a[href="/vehicles/${CIVIC}"]`).first()).toBeVisible();
    await expect(page.locator(`a[href="/vehicles/${b.entry.id}"]`).first()).toBeVisible();
    await page.goto(`/vehicles/${enc(b.entry.id)}`);
    await expect(page.getByRole("heading", { level: 1 })).toContainText(/Civic/);

    // the same VIN again is the same car; a lowercase spelling too
    const again = await (await post(page, catalog(v2.toLowerCase(), CIVIC, { transmission: "cvt", drivetrain: "fwd" }))).json();
    expect(again.created).toBe(false); expect(again.entry.id).toBe(b.entry.id);
    expect(countFor(email)).toBe(2);

    // removing one car leaves the other (and its history) alone
    expect((await page.request.delete(`/api/garage/${enc(b.entry.id)}`)).ok()).toBeTruthy();
    expect(countFor(email)).toBe(1);
    expect(await titles(a.entry.id)).toEqual(["Car A job"]);
  });

  test("an older VIN-less record is completed by the first VIN (history kept); the next different VIN is a second car", async ({ page }) => {
    const email = await signUpNewUser(page);
    sql(`insert into garage_entries (id,user_id,kind,vehicle_id) values (gen_random_uuid()::text,'${uidOf(email)}','catalog','${CIVIC}')`);
    const enc = encodeURIComponent;
    // the older record already has history under the plain id
    sql(`insert into service_entries (id,user_id,garage_entry_id,date,mileage,title) select gen_random_uuid()::text,user_id,id,'2026-01-01',5,'Old job' from garage_entries where user_id='${uidOf(email)}'`);
    const v1 = validVin("1HG");
    const first = await (await post(page, catalog(v1, CIVIC))).json();
    expect(first.created).toBe(false);
    expect(first.entry.id).toBe(CIVIC);
    expect(countFor(email)).toBe(1);
    expect((await (await page.request.get(`/api/garage/${CIVIC}/service`)).json()).entries).toHaveLength(1);
    const second = await (await post(page, catalog(validVin("1HG"), CIVIC))).json();
    expect(second.created).toBe(true);
    expect(countFor(email)).toBe(2);
    expect((await (await page.request.get(`/api/garage/${enc(second.entry.id)}/service`)).json()).entries).toHaveLength(0);
  });
});

// ----------------------------------------------------------------------- one VIN per account, no squatting, privacy
test.describe("One VIN per account: another account holding it changes nothing (no VIN squatting), histories stay private", () => {
  test("two accounts can each hold the same VIN; service history, list and delete never cross accounts", async ({ browser }) => {
    const ctxA = await browser.newContext();
    const A = await ctxA.newPage();
    const emailA = await signUpNewUser(A);
    const v = validVin("WBA");
    const added = await (await post(A, catalog(v))).json();
    expect(added.created).toBe(true);
    const svc = await A.request.post(`/api/garage/${BMW}/service`, { data: { date: "2026-01-02", mileage: 61000, title: "A private record" } });
    expect(svc.ok()).toBeTruthy();
    const idA = uidOf(emailA);

    const ctxB = await browser.newContext();
    const B = await ctxB.newPage();
    const emailB = await signUpNewUser(B);

    // B adds the very same VIN (also in lower case with a space): it is a normal, fully separate add.
    const rb = await post(B, catalog(v.toLowerCase().replace(/^(.{3})/, "$1 ")));
    expect(rb.status()).toBe(200);
    const textB = await rb.text();
    expect(JSON.parse(textB).created).toBe(true);
    for (const secret of [emailA, idA, "A private record", "61000"]) expect(textB, `leaks ${secret}`).not.toContain(secret);
    expect(countFor(emailB)).toBe(1);
    // B's copy of a VIN A already holds is a second, separate row (same VIN, different owners)
    expect(sql(`select count(*) from garage_entries where vin='${v}'`)).toBe("2");
    // a malformed VIN still gets the same format error
    expect((await post(B, catalog(v.slice(0, 16) + "Z"))).status()).toBe(400);

    // B starts with an empty history, adds its own, and neither sees the other's
    expect((await (await B.request.get(`/api/garage/${BMW}/service`)).json()).entries).toEqual([]);
    const own = await B.request.post(`/api/garage/${BMW}/service`, { data: { date: "2026-02-03", mileage: 12345, title: "B own record" } });
    expect(own.ok()).toBeTruthy();
    const listA = JSON.stringify(await (await A.request.get(`/api/garage/${BMW}/service`)).json());
    const listB = JSON.stringify(await (await B.request.get(`/api/garage/${BMW}/service`)).json());
    expect(listA).toContain("A private record");
    expect(listA).not.toContain("B own record");
    expect(listB).toContain("B own record");
    expect(listB).not.toContain("A private record");
    expect(listB).not.toContain("61000");
    // A only ever lists its own vehicles
    expect((await (await A.request.get("/api/garage")).json()).entries).toHaveLength(1);

    // B removing its vehicle leaves A's vehicle, VIN and history untouched
    await B.request.delete(`/api/garage/${BMW}`);
    expect(sql(`select vin,transmission,drivetrain from garage_entries where user_id='${idA}'`)).toBe(`${v}|automatic|rwd`);
    expect(sql(`select count(*) from service_entries where garage_entry_id in (select id from garage_entries where user_id='${idA}')`)).toBe("1");
    await ctxA.close();
    await ctxB.close();
  });

  test("squatting does not work: an attacker who adds a victim's VIN first cannot lock the victim out or see anything of theirs", async ({ browser }) => {
    const v = validVin("WBA");
    const ctxX = await browser.newContext();
    const X = await ctxX.newPage();
    await signUpNewUser(X);
    expect((await (await post(X, catalog(v))).json()).created).toBe(true); // the squatter holds it first

    const ctxV = await browser.newContext();
    const V = await ctxV.newPage();
    const emailV = await signUpNewUser(V);
    for (const data of [catalog(v), { kind: "custom", custom: { vin: v, make: "BMW", model: "328i" }, config: OK }] as unknown[]) {
      const r = await post(V, data);
      expect(r.status()).toBe(200);
      // (the same VIN twice for the same account is the same car: the second answer is the idempotent one)
    }
    expect(countFor(emailV)).toBe(1);
    // the victim's own service history works and is theirs alone
    expect((await V.request.post(`/api/garage/${BMW}/service`, { data: { date: "2026-03-04", mileage: 40000, title: "Victim record" } })).ok()).toBeTruthy();
    expect(JSON.stringify(await (await X.request.get(`/api/garage/${BMW}/service`)).json())).not.toContain("Victim record");
    await ctxX.close();
    await ctxV.close();
  });

  test("the answer for a VIN never depends on whether another account holds it (no ownership oracle)", async ({ browser }) => {
    const held = validVin("WBA");
    const free = validVin("WBA");
    const ctxA = await browser.newContext();
    const A = await ctxA.newPage();
    await signUpNewUser(A);
    await post(A, catalog(held));
    const ctxB = await browser.newContext();
    const B = await ctxB.newPage();
    await signUpNewUser(B);
    const strip = (b: Record<string, unknown>) => ({ status: Object.keys(b).sort(), created: b.created });
    const rHeld = await post(B, { kind: "custom", custom: { vin: held, make: "BMW", model: "328i" }, config: OK });
    const rFree = await post(B, { kind: "custom", custom: { vin: free, make: "BMW", model: "328i" }, config: OK });
    expect(rHeld.status()).toBe(rFree.status());
    expect(strip(await rHeld.json())).toEqual(strip(await rFree.json()));
    await ctxA.close();
    await ctxB.close();
  });
});

// ------------------------------------------------------------------------------------------- older records, VIN completion
test.describe("Older records are kept and can be completed with a VIN", () => {
  test("a record with no VIN stays, asks for one, and takes a valid VIN without touching anything else", async ({ page }) => {
    const email = await signUpNewUser(page);
    const uid = uidOf(email);
    sql(`insert into garage_entries(id,user_id,kind,vehicle_id,vin,transmission,drivetrain,config_confirmed_at) values ('old-bmw-${uid}','${uid}','catalog','${BMW}',null,'automatic','rwd',now())`);
    sql(`insert into service_entries(id,garage_entry_id,date,mileage,title) values ('svc-${uid}','old-bmw-${uid}','2025-11-02',58000,'Engine Oil & Filter Change')`);

    await page.goto("/garage");
    await expect(page.getByTestId("card-vin-needed")).toHaveCount(1);
    await shot(page, "20-garage-vin-needed");
    await page.goto(`/vehicles/${BMW}`);
    await expect(page.getByTestId("vin-completion")).toBeVisible();
    await expect(page.getByTestId("config-line")).toHaveText(/Automatic.*Standard RWD/);
    await shot(page, "21-vin-completion-panel");

    const input = page.getByTestId("vin-input");
    await input.fill("WBAPH7C58AA175761"); // check digit right, but another character is off by one: fails the check
    await page.getByTestId("vin-lookup").click();
    await expect(page.getByTestId("vin-error")).toContainText(/check-digit/i);
    expect(sql(`select vin is null from garage_entries where id='old-bmw-${uid}'`)).toBe("t");

    const v = validVin("WBA");
    await input.fill(v);
    await page.getByTestId("vin-lookup").click();
    await expect(page.getByTestId("vin-saved")).toBeVisible();
    expect(sql(`select vin,transmission,drivetrain from garage_entries where id='old-bmw-${uid}'`)).toBe(`${v}|automatic|rwd`);
    expect(sql(`select count(*) from service_entries where garage_entry_id='old-bmw-${uid}'`)).toBe("1");
    expect(countFor(email)).toBe(1);
    await page.goto("/garage");
    await expect(page.getByTestId("card-vin-needed")).toHaveCount(0);
  });

  test("VIN completion works even when another account holds that VIN; a saved VIN cannot be swapped; one VIN is one vehicle per account", async ({ browser }) => {
    const ctxA = await browser.newContext();
    const A = await ctxA.newPage();
    await signUpNewUser(A);
    const held = validVin("WBA");
    await post(A, catalog(held));

    const ctxB = await browser.newContext();
    const B = await ctxB.newPage();
    const emailB = await signUpNewUser(B);
    const uid = uidOf(emailB);
    sql(`insert into garage_entries(id,user_id,kind,vehicle_id,vin) values ('old-jeep-${uid}','${uid}','catalog','${JEEP}',null)`);
    const r = await B.request.post(`/api/garage/${JEEP}/vin`, { data: { vin: held } });
    expect(r.status()).toBe(200);
    expect(sql(`select vin from garage_entries where id='old-jeep-${uid}'`)).toBe(held);
    // the same VIN on a second vehicle of the same account is refused: a VIN names one vehicle
    sql(`insert into garage_entries(id,user_id,kind,vehicle_id,vin) values ('old-civic-${uid}','${uid}','catalog','${CIVIC}',null)`);
    const dup = await B.request.post(`/api/garage/${CIVIC}/vin`, { data: { vin: held } });
    expect(dup.status()).toBe(409);
    expect((await dup.json()).code).toBe("VIN_IN_GARAGE");
    expect(sql(`select vin is null from garage_entries where id='old-civic-${uid}'`)).toBe("t");

    const swap = await B.request.post(`/api/garage/${JEEP}/vin`, { data: { vin: validVin("1C4") } });
    expect(swap.status()).toBe(409);
    expect((await swap.json()).code).toBe("VIN_ALREADY_SET");
    expect(sql(`select vin from garage_entries where id='old-jeep-${uid}'`)).toBe(held);
    expect((await B.request.post(`/api/garage/${JEEP}/vin`, { data: { vin: "nope" } })).status()).toBe(400);
    await ctxA.close();
    await ctxB.close();
  });
});

// ------------------------------------------------------------------------------------------------------ browsing
test.describe("Browsing by year/make/model never creates a garage vehicle", () => {
  test("the manual picker shows what we have, says a VIN is needed, and saves nothing", async ({ page }) => {
    const email = await signUpNewUser(page);
    await page.goto("/garage/add");
    await page.getByLabel("Year").fill("2018");
    await page.getByLabel("Make").fill("Honda");
    await page.getByLabel("Model").fill("Civic");
    await page.getByRole("button", { name: "Look up this vehicle" }).click();
    await expect(page.getByTestId("manual-browse-result")).toBeVisible();
    await expect(page.getByTestId("manual-needs-vin")).toContainText(/enter its VIN/i);
    await shot(page, "22-manual-browse-needs-vin");
    expect(countFor(email)).toBe(0);
    await page.goto("/garage");
    await expect(page.getByText("Your garage is empty")).toBeVisible();
  });
});

// ------------------------------------------------------------------------------ typed VIN validation on the real screen
test.describe("The VIN box validates before any lookup", () => {
  test("a VIN with a bad check digit is stopped, the misread is highlighted and a correction is offered but never applied", async ({ page }) => {
    await signUpNewUser(page);
    const calls = await mockVpic(page, HONDA_ROW);
    await page.goto("/garage/add");
    const input = page.getByTestId("vin-input");
    await input.fill("1HGCM82633A004352".replace("8", "B")); // a camera/eye reads 8 as B
    await page.getByTestId("vin-lookup").click();
    await expect(page.getByTestId("vin-error")).toBeVisible();
    await expect(page.getByTestId("vin-scan-chars").locator('[data-uncertain="true"]').first()).toBeVisible();
    expect(calls()).toBe(0);
    await expect(input).toHaveValue("1HGCMB2633A004352"); // never rewritten for the customer
    await expect(page.getByTestId("vin-suggestion")).toContainText("B → 8");
    await shot(page, "23-vin-check-digit-suggestion");
    await page.getByTestId("vin-suggestion").first().click();
    await expect(input).toHaveValue(CLEAN_VIN);
    await page.getByTestId("vin-lookup").click();
    await expect(page.getByRole("button", { name: /^\+ Add (this vehicle )?to (my )?garage$/i }).first()).toBeVisible();
    expect(calls()).toBe(1);
  });

  test("a VIN with I, O or Q in it is refused with those characters highlighted", async ({ page }) => {
    await signUpNewUser(page);
    const calls = await mockVpic(page, HONDA_ROW);
    await page.goto("/decode");
    await page.getByTestId("vin-input").fill("1HGCM826O3A004352");
    await page.getByTestId("vin-lookup").click();
    await expect(page.getByTestId("vin-error")).toContainText(/I, O or Q/);
    await expect(page.getByTestId("vin-scan-chars").locator('[data-uncertain="true"]')).toHaveCount(1);
    expect(calls()).toBe(0);
  });
});

// -------------------------------------------------------------------------------------------- photo scan (mobile)
test.describe("Photo VIN scan on a phone-sized screen", () => {
  test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  test.setTimeout(120_000);

  test("Take photo and Upload photo exist, the camera input asks for the rear camera, and neither uploads or stores anything", async ({ page }) => {
    await signUpNewUser(page);
    const requests: string[] = [];
    page.on("request", (r) => { if (r.method() !== "GET") requests.push(`${r.method()} ${new URL(r.url()).pathname}`); });
    await page.goto("/garage/add");
    await expect(page.getByTestId("vin-take-photo")).toBeVisible();
    await expect(page.getByTestId("vin-upload-photo")).toBeVisible();
    await expect(page.getByTestId("vin-photo-input-camera")).toHaveAttribute("capture", "environment");
    await expect(page.getByTestId("vin-photo-input-camera")).toHaveAttribute("accept", "image/jpeg,image/png,image/webp");
    await expect(page.getByTestId("vin-photo-input-upload")).not.toHaveAttribute("capture", /.*/);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);

    const chooser = page.waitForEvent("filechooser");
    await page.getByTestId("vin-take-photo").click();
    await (await chooser).setFiles(FIX("vin-clean.png"));
    await expect(page.getByTestId("vin-input")).toHaveValue(CLEAN_VIN, { timeout: 90_000 });
    await shot(page, "24-scan-clean-mobile");
    expect(requests, "reading a photo must not POST/PUT anything").toEqual([]);
    expect(await page.evaluate(() => Object.keys(localStorage).length + Object.keys(sessionStorage).length)).toBe(0);
  });

  test("a clean photo prefills the VIN, still needs explicit confirmation, and only then can be looked up", async ({ page }) => {
    await signUpNewUser(page);
    const calls = await mockVpic(page, HONDA_ROW);
    await page.goto("/decode");
    const chooser = page.waitForEvent("filechooser");
    await page.getByTestId("vin-upload-photo").click();
    await (await chooser).setFiles(FIX("vin-clean.png"));
    await expect(page.getByTestId("vin-input")).toHaveValue(CLEAN_VIN, { timeout: 90_000 });
    await expect(page.getByTestId("vin-confirm-scan")).toBeVisible();
    await expect(page.getByTestId("vin-lookup")).toBeDisabled();
    await page.getByTestId("vin-lookup").click({ force: true }).catch(() => {});
    expect(calls(), "no lookup before the customer confirms").toBe(0);
    await page.getByTestId("vin-confirm-scan").check();
    await expect(page.getByTestId("vin-lookup")).toBeEnabled();
    await page.getByTestId("vin-lookup").click();
    await expect(page.getByText("Accord").first()).toBeVisible();
    expect(calls()).toBe(1);
  });

  test("a photo whose VIN reads wrong is shown exactly as read, highlighted, blocked from lookup, and never auto-corrected", async ({ page }) => {
    await signUpNewUser(page);
    const calls = await mockVpic(page, HONDA_ROW);
    await page.goto("/decode");
    const chooser = page.waitForEvent("filechooser");
    await page.getByTestId("vin-upload-photo").click();
    await (await chooser).setFiles(FIX("vin-letter-o.png")); // the photo shows ...826O3A...; the engine decides what it reads
    const input = page.getByTestId("vin-input");
    await expect(input).not.toHaveValue("", { timeout: 90_000 });
    const read = await input.inputValue();
    expect(read, "the app must not 'repair' the read into the VIN that validates").not.toBe(CLEAN_VIN);
    await expect(page.getByTestId("vin-error")).toBeVisible();
    await expect(page.getByTestId("vin-scan-chars").locator('[data-uncertain="true"]').first()).toBeVisible();
    await expect(page.getByTestId("vin-lookup")).toBeDisabled();
    await shot(page, "25-scan-misread-highlighted");
    expect(calls()).toBe(0);
    // the customer fixes it by hand; a scanned VIN still needs the confirmation
    await input.fill(CLEAN_VIN);
    await expect(page.getByTestId("vin-lookup")).toBeEnabled(); // typed by the customer: no scan confirmation applies
  });

  test("poor photos, wrong files and dangerous files fail gracefully with a way forward and nothing is read", async ({ page }) => {
    await signUpNewUser(page);
    await page.goto("/garage/add");
    const status = page.getByTestId("vin-scan-status");
    const feed = async (file: string | { name: string; mimeType: string; buffer: Buffer }) => {
      const chooser = page.waitForEvent("filechooser");
      await page.getByTestId("vin-upload-photo").click();
      await (await chooser).setFiles(file);
    };
    await feed(FIX("vin-unreadable.png"));
    await expect(status).toContainText(/couldn't find a 17-character VIN/i, { timeout: 90_000 });
    await expect(page.getByTestId("vin-input")).toHaveValue("");
    const tips = page.getByTestId("vin-retake-tips");
    await expect(tips).toBeVisible();
    await expect(tips).toContainText(/closer/i);
    await expect(tips).toContainText(/flash off/i);
    await expect(tips).toContainText(/straight-on/i);
    await shot(page, "26-scan-unreadable");

    await feed(FIX("no-vin.png"));
    await expect(status).toContainText(/couldn't find a 17-character VIN/i, { timeout: 90_000 });

    await feed(FIX("not-an-image.jpg"));
    await expect(status).toContainText(/isn't a JPEG, PNG or WebP/i);
    await feed(FIX("script.svg.png"));
    await expect(status).toContainText(/isn't a JPEG, PNG or WebP/i);
    await feed({ name: "huge.jpg", mimeType: "image/jpeg", buffer: Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(16 * 1024 * 1024)]) });
    await expect(status).toContainText(/too large/i);
    // a decompression-bomb header: a PNG that claims 30000 x 30000
    const bomb = Buffer.alloc(40); Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(bomb); bomb.writeUInt32BE(30000, 16); bomb.writeUInt32BE(30000, 20);
    await feed({ name: "bomb.png", mimeType: "image/png", buffer: bomb });
    await expect(status).toContainText(/too large to read safely/i);
    // typing still works after every failure
    await page.getByTestId("vin-input").fill(CLEAN_VIN);
    await expect(page.getByTestId("vin-lookup")).toBeEnabled();
  });

  test("the whole mobile journey: photo -> confirm VIN -> Confirm Your Ride -> Add to Garage, with the VIN saved in canonical form", async ({ page }) => {
    sql(`delete from garage_entries where vin='${CLEAN_VIN}'`); // the photo's VIN is fixed; clear earlier runs' rows in the throwaway DB
    const email = await signUpNewUser(page);
    await mockVpic(page, HONDA_ROW);
    await page.goto("/garage/add");
    const chooser = page.waitForEvent("filechooser");
    await page.getByTestId("vin-take-photo").click();
    await (await chooser).setFiles(FIX("vin-clean.png"));
    await expect(page.getByTestId("vin-input")).toHaveValue(CLEAN_VIN, { timeout: 90_000 });
    await page.getByTestId("vin-confirm-scan").check();
    await page.getByTestId("vin-lookup").click();
    await page.getByRole("button", { name: /add (this vehicle )?to (my )?garage/i }).first().click();
    await expect(page.getByTestId("confirm-your-ride")).toBeVisible();
    await page.getByRole("radiogroup", { name: "Transmission" }).getByText("Automatic", { exact: true }).click();
    await page.getByRole("radiogroup", { name: "Drivetrain" }).getByText("Not sure", { exact: true }).click();
    await page.getByRole("button", { name: /and add to garage$/ }).click();
    await expect(page).toHaveURL(/\/garage\/custom\//);
    expect(sql(`select vin,transmission,drivetrain from garage_entries where user_id='${uidOf(email)}'`)).toBe(`${CLEAN_VIN}|automatic|unknown`);
    await shot(page, "27-mobile-journey-saved");
  });
});

// ----------------------------------------------------------------------- probe protection (enumeration / ownership probing)
test.describe("VIN attempts are rate limited and the limit reveals nothing", () => {

  // Replaces the deleted "collisions run out of budget" test. Collisions no longer exist, so the property that matters is:
  // probing VINs another account holds is neither blocked early nor distinguishable from probing free VINs.
  test("probing VINs another account holds gets the same answers, the same budget and the same 429 as probing free VINs", async ({ page, browser }) => {
    const holderEmail = await signUpNewUser(page);
    const held: string[] = [];
    for (let i = 0; i < 7; i++) {
      const v = validVin("1HG");
      held.push(v);
      expect((await post(page, catalog(v, CIVIC, { transmission: "cvt", drivetrain: "fwd" }))).ok()).toBeTruthy();
    }
    const cfg = { transmission: "cvt", drivetrain: "fwd" };
    const shape = async (r: Awaited<ReturnType<typeof post>>) => ({ status: r.status(), keys: Object.keys(await r.json()).sort() });

    const ctxP = await browser.newContext();
    const prober = await ctxP.newPage();
    const probeEmail = await signUpNewUser(prober);
    const ctxF = await browser.newContext();
    const control = await ctxF.newPage();
    await signUpNewUser(control);

    // 7 held VINs for the prober and 7 free VINs for the control: identical status and body shape every time
    for (let i = 0; i < 7; i++) {
      const a = await shape(await post(prober, catalog(held[i], CIVIC, cfg)));
      const b = await shape(await post(control, catalog(validVin("1HG"), CIVIC, cfg)));
      expect(a, `attempt ${i}`).toEqual(b);
      expect(a.status).toBe(200);
    }
    // no collision bookkeeping exists any more
    expect(sql(`select count(*) from app_events where type='vin.collision' and user_id='${uidOf(probeEmail)}'`)).toBe("0");
    expect(countFor(probeEmail)).toBe(7);

    // both run out of the same attempt budget at the same point, with the same plain 429
    let probeLast: Awaited<ReturnType<typeof post>> | null = null;
    let controlLast: Awaited<ReturnType<typeof post>> | null = null;
    const pStatuses: number[] = [];
    const cStatuses: number[] = [];
    for (let i = 0; i < 15; i++) {
      probeLast = await post(prober, catalog(i < 7 ? held[i] : validVin("1HG"), CIVIC, cfg)); // re-adds of its own held VINs, then new
      controlLast = await post(control, catalog(validVin("1HG"), CIVIC, cfg));
      pStatuses.push(probeLast.status());
      cStatuses.push(controlLast.status());
    }
    expect(pStatuses).toEqual(cStatuses);
    expect(pStatuses.slice(-2)).toEqual([429, 429]);
    const pBody = await probeLast!.text();
    expect(pBody).toBe(await controlLast!.text());
    expect(JSON.parse(pBody)).toEqual({ code: "VIN_RATE_LIMITED", error: expect.any(String) });
    for (const secret of [held[0], holderEmail, probeEmail, "Civic", uidOf(holderEmail)]) expect(pBody).not.toContain(secret);
    // the VIN is never written to the abuse bookkeeping
    expect(sql(`select count(*) from app_events where type like 'vin.%' and (metadata::text ilike '%${held[0]}%' or object_id ilike '%${held[0]}%')`)).toBe("0");
    await ctxP.close();
    await ctxF.close();
  });

  test("an account has a budget of VIN attempts per hour, whatever the outcome", async ({ page }) => {
    const email = await signUpNewUser(page);
    const out: number[] = [];
    for (let i = 0; i < 22; i++) out.push((await post(page, catalog(validVin("1HG"), CIVIC, { transmission: "cvt", drivetrain: "fwd" }))).status());
    expect(out.slice(0, 20).every((s) => s === 200)).toBeTruthy();
    expect(out.slice(20)).toEqual([429, 429]);
    expect(countFor(email)).toBe(20);
    // malformed VINs are refused before any lookup and cost no budget (they reveal nothing)
    const bad = await post(page, catalog("NOTAVIN", CIVIC));
    expect(bad.status()).toBe(400);
  });

  test("the same network address shares a budget across accounts", async ({ browser }) => {
    test.setTimeout(240_000);
    const ip = randomIp();
    const statuses: number[] = [];
    for (let u = 0; u < 8; u++) {
      const ctx = await browser.newContext();
      const pg = await ctx.newPage();
      await signUpNewUser(pg, ip);
      // 19 attempts each: under the 20-per-account budget, but 8 x 19 = 152 is over the 150-per-address budget
      for (let i = 0; i < 19; i++) statuses.push((await post(pg, catalog(validVin("1HG"), CIVIC, { transmission: "cvt", drivetrain: "fwd" }))).status());
      await ctx.close();
    }
    expect(statuses.filter((s) => s === 200)).toHaveLength(150);
    expect(statuses.filter((s) => s === 429)).toHaveLength(2);
    expect(statuses.slice(-2).every((s) => s === 429)).toBeTruthy();
  });

  test("VIN completion is limited the same way and answers generically", async ({ page }) => {
    const email = await signUpNewUser(page);
    sql(`insert into garage_entries (id,user_id,kind,vehicle_id) values (gen_random_uuid()::text,'${uidOf(email)}','catalog','${JEEP}')`);
    const out: number[] = [];
    for (let i = 0; i < 22; i++) {
      const r = await page.request.post(`/api/garage/${JEEP}/vin`, { data: { vin: validVin("1J4") } });
      out.push(r.status());
      if (r.status() === 429) expect(Object.keys(await r.json()).sort()).toEqual(["code", "error"]);
    }
    expect(out[0]).toBe(200);              // the first valid VIN completes the record
    expect(out[1]).toBe(409);              // a different VIN cannot replace it
    expect(out.slice(20)).toEqual([429, 429]);
  });
});
