import { test, expect, Page } from "@playwright/test";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { breakCheckDigit, randomIp, signUpNewUser, validVin } from "./helpers";

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
    expect(a.entry.id).toContain("~");               // every car has its own permanent id
    expect(b.entry.id).toContain("~");
    expect(a.entry.id).not.toBe(b.entry.id);
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
    await expect(page.locator(`a[href="/vehicles/${a.entry.id}"]`).first()).toBeVisible();
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
    expect(first.entry.id).toMatch(/^2018-honda-civic-1\.5t~/);
    expect(countFor(email)).toBe(1);
    expect((await (await page.request.get(`/api/garage/${CIVIC}/service`)).json()).entries).toHaveLength(1);       // old bare id: still this one car
    expect((await (await page.request.get(`/api/garage/${enc(first.entry.id)}/service`)).json()).entries).toHaveLength(1); // permanent id: same car
    const second = await (await post(page, catalog(validVin("1HG"), CIVIC))).json();
    expect(second.created).toBe(true);
    expect(countFor(email)).toBe(2);
    expect((await (await page.request.get(`/api/garage/${enc(second.entry.id)}/service`)).json()).entries).toHaveLength(0);
  });
});

// ----------------------------------------------------------------------- cross-account isolation (VIN identity != ownership)
// A VIN names a vehicle; it is not a lock. Any number of accounts may keep their own private record for the same VIN.
// Nothing an account does with a VIN can be seen, blocked or influenced by another account.
const stable = (b: { entry: Record<string, unknown>; created: boolean; configKept: boolean }) =>
  JSON.stringify({ created: b.created, configKept: b.configKept, entry: { ...b.entry, id: "<id>", addedAt: "<t>", vin: "<vin>", config: { ...(b.entry.config as object), confirmedAt: "<t>" } } });
const rowsForVin = (v: string) => Number(sql(`select count(*) from garage_entries where vin='${v}'`));

test.describe("Accounts are isolated: the same VIN in two garages shares nothing and blocks nothing", () => {
  test("a VIN another account already holds adds normally: own row, own history, nothing visible across accounts", async ({ browser }) => {
    const ctxA = await browser.newContext();
    const A = await ctxA.newPage();
    const emailA = await signUpNewUser(A);
    const v = validVin("WBA");
    const addedA = await (await post(A, catalog(v))).json();
    expect(addedA.created).toBe(true);
    expect((await A.request.post(`/api/garage/${BMW}/service`, { data: { date: "2026-01-02", mileage: 61000, title: "A private record" } })).ok()).toBeTruthy();
    expect((await A.request.put(`/api/garage/${BMW}/odometer`, { data: { value: 61000 } })).ok()).toBeTruthy();
    const idA = uidOf(emailA);

    const ctxB = await browser.newContext();
    const B = await ctxB.newPage();
    const emailB = await signUpNewUser(B);
    const idB = uidOf(emailB);
    for (const [name, data] of [
      ["catalog, same VIN", catalog(v)],
    ] as [string, unknown][]) {
      const r = await post(B, data);
      expect(r.status(), name).toBe(200);
      const text = await r.text();
      for (const secret of [emailA, idA, "A private record", "61000"]) expect(text, `${name}: leaks ${secret}`).not.toContain(secret);
    }
    expect(countFor(emailB)).toBe(1);
    expect(rowsForVin(v)).toBe(2);
    // two separate rows, one per account
    expect(sql(`select count(distinct id) from garage_entries where vin='${v}'`)).toBe("2");
    // B starts with an empty history and odometer; A's is untouched
    expect((await (await B.request.get(`/api/garage/${BMW}/service`)).json()).entries).toEqual([]);
    expect((await (await B.request.get(`/api/garage/${BMW}/odometer`)).json()).odometer).toBeNull();
    expect((await (await A.request.get(`/api/garage/${BMW}/service`)).json()).entries).toHaveLength(1);
    expect(sql(`select count(*) from service_entries where garage_entry_id in (select id from garage_entries where user_id='${idB}')`)).toBe("0");
    // B writing to its own record does not appear in A's
    expect((await B.request.post(`/api/garage/${BMW}/service`, { data: { date: "2026-02-02", mileage: 100, title: "B private record" } })).ok()).toBeTruthy();
    const aList = JSON.stringify((await (await A.request.get(`/api/garage/${BMW}/service`)).json()).entries);
    expect(aList).not.toContain("B private record");
    // B's config edit does not touch A's
    expect((await B.request.patch(`/api/garage/${BMW}`, { data: { drivetrain: "awd" } })).ok()).toBeTruthy();
    expect(sql(`select vin,transmission,drivetrain from garage_entries where user_id='${idA}'`)).toBe(`${v}|automatic|rwd`);
    // removing one account's record never removes the other's
    await A.request.delete(`/api/garage/${BMW}`);
    expect(countFor(emailB)).toBe(1);
    expect((await (await B.request.get(`/api/garage/${BMW}/service`)).json()).entries).toHaveLength(1);
    await ctxA.close();
    await ctxB.close();
  });

  test("no VIN squatting: someone adding a VIN first (any spelling, either endpoint) cannot block its real owner", async ({ browser }) => {
    const ctxS = await browser.newContext();
    const S = await ctxS.newPage();
    const emailS = await signUpNewUser(S);
    const v = validVin("WBA");
    // the squatter takes the VIN first, every way there is
    expect((await post(S, catalog(v.toLowerCase().replace(/^(.{3})/, "$1 ")))).ok()).toBeTruthy();
    const ctxO = await browser.newContext();
    const O = await ctxO.newPage();
    const emailO = await signUpNewUser(O);
    for (const [name, data] of [
      ["catalog, same spelling", catalog(v)],
    ] as [string, unknown][]) {
      const r = await post(O, data);
      expect(r.status(), name).toBe(200);
      expect((await r.json()).created, name).toBe(true);
      await O.request.delete(`/api/garage/${BMW}`);
    }
    // custom entry for the same VIN and an older VIN-less record completed with it work too
    const custom = await post(O, { kind: "custom", custom: { vin: v, make: "BMW", model: "328i" }, config: OK });
    expect(custom.status()).toBe(200);
    expect((await custom.json()).created).toBe(true);
    const uidO = uidOf(emailO);
    sql(`insert into garage_entries(id,user_id,kind,vehicle_id) values ('legacy-${uidO}','${uidO}','catalog','${JEEP}')`);
    const dupOwn = await O.request.post(`/api/garage/${JEEP}/vin`, { data: { vin: v } }); // already on O's own custom row
    expect(dupOwn.status()).toBe(409);
    expect((await dupOwn.json()).code).toBe("VIN_IN_GARAGE");
    expect(countFor(emailS)).toBe(1);
    expect(rowsForVin(v)).toBe(3 - 1); // S's row + O's custom row (the VIN-less legacy row stayed VIN-less)
    await ctxS.close();
    await ctxO.close();
  });

  test("the answer never depends on whether another account holds the VIN (no oracle), and completion works the same way", async ({ browser }) => {
    const ctxA = await browser.newContext();
    const A = await ctxA.newPage();
    await signUpNewUser(A);
    const ctxB = await browser.newContext();
    const B = await ctxB.newPage();
    const emailB = await signUpNewUser(B);
    const held = validVin("WBA");
    const free = validVin("WBA");
    await post(A, catalog(held));
    const rHeld = await post(B, catalog(held));
    const rFree = await post(B, catalog(free));
    expect(rHeld.status()).toBe(200);
    expect(rFree.status()).toBe(200);
    expect(stable(await rHeld.json())).toBe(stable(await rFree.json()));
    // completion of a legacy record with a held VIN answers exactly as with a free one
    const uid = uidOf(emailB);
    sql(`insert into garage_entries(id,user_id,kind,vehicle_id) values ('old-jeep-${uid}','${uid}','catalog','${JEEP}')`);
    sql(`insert into garage_entries(id,user_id,kind,vehicle_id) values ('old-civic-${uid}','${uid}','catalog','${CIVIC}')`);
    const heldElsewhere = validVin("1C4");
    await A.request.post("/api/garage", { data: { kind: "custom", custom: { vin: heldElsewhere, make: "Jeep", model: "Grand Cherokee" }, config: OK } });
    const c1 = await B.request.post(`/api/garage/${JEEP}/vin`, { data: { vin: heldElsewhere } });
    const c2 = await B.request.post(`/api/garage/${CIVIC}/vin`, { data: { vin: validVin("1HG") } });
    expect(c1.status()).toBe(200);
    expect(c2.status()).toBe(200);
    expect(sql(`select vin from garage_entries where id='old-jeep-${uid}'`)).toBe(heldElsewhere);
    // malformed input (only the check digit wrong, so this cannot accidentally be valid) gets the same format error whoever holds what
    const broken = await post(B, catalog(breakCheckDigit(held)));
    expect(broken.status()).toBe(400);
    expect((await broken.json()).problem).toBe("check-digit");
    await ctxA.close();
    await ctxB.close();
  });

  test("simultaneous adds of one VIN by two accounts both succeed, every time", async ({ browser }) => {
    test.setTimeout(180_000);
    const ctxA = await browser.newContext();
    const A = await ctxA.newPage();
    const emailA = await signUpNewUser(A);
    const ctxB = await browser.newContext();
    const B = await ctxB.newPage();
    const emailB = await signUpNewUser(B);
    for (let round = 0; round < 8; round++) {
      const v = validVin("WBA");
      const [ra, rb] = await Promise.all([post(A, catalog(v)), post(B, catalog(v))]);
      expect([ra.status(), rb.status()], `round ${round}`).toEqual([200, 200]);
      expect(rowsForVin(v), `round ${round}`).toBe(2);
      expect(sql(`select count(distinct user_id) from garage_entries where vin='${v}'`), `round ${round}`).toBe("2");
    }
    expect(countFor(emailA)).toBe(8);
    expect(countFor(emailB)).toBe(8);
    await ctxA.close();
    await ctxB.close();
  });

  test("a lookup by (account, VIN) is served by the unique index, not a table scan, on a populated table", async ({ page }) => {
    test.setTimeout(120_000);
    const email = await signUpNewUser(page);
    const uid = uidOf(email);
    // 40k synthetic rows under this account only, removed afterwards
    sql(`insert into garage_entries(id,user_id,kind,vehicle_id,vin) select 'plan-${uid}-'||g, '${uid}', 'catalog', 'plan-model-'||g, 'PLAN'||lpad(g::text,13,'0') from generate_series(1,40000) g`);
    try {
      sql("analyze garage_entries");
      const plan = sql(`explain select id from garage_entries where user_id='${uid}' and vin='PLAN0000000000042'`);
      expect(plan).toMatch(/garage_entries_user_vin_uq/);
      expect(plan).not.toMatch(/Seq Scan/);
    } finally {
      sql(`delete from garage_entries where id like 'plan-${uid}-%'`);
    }
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
    const held = validVin("1C4");
    await post(A, { kind: "custom", custom: { vin: held, make: "Jeep", model: "Grand Cherokee" }, config: OK }); // A holds the VIN as a custom car, so A has no catalog Jeep of its own
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
    // another account cannot complete or touch B's record
    expect((await A.request.post(`/api/garage/${JEEP}/vin`, { data: { vin: held } })).status()).toBe(404);
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
test.describe("VIN submissions have a plain volume limit that reveals nothing", () => {
  const retryAfter = (r: { headers(): Record<string, string> }) => Number(r.headers()["retry-after"]);

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
    const limited = await post(page, catalog(validVin("1HG"), CIVIC, { transmission: "cvt", drivetrain: "fwd" }));
    expect(limited.status()).toBe(429);
    expect(retryAfter(limited)).toBeGreaterThan(0);
    expect(Object.keys(await limited.json()).sort()).toEqual(["code", "error"]);
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
    expect(out[1]).toBe(409);              // a different VIN cannot replace it (VIN_ALREADY_SET)
    expect(out.slice(20)).toEqual([429, 429]);
  });
});
