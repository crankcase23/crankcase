import { test, expect, Page } from "@playwright/test";
import { execFileSync } from "node:child_process";
import { signUpNewUser, validVin } from "./helpers";

// Same-model garage identity, in a real browser on a production build and a THROWAWAY Postgres.
// Two or more cars of one year/make/model are separate physical vehicles. Each has a permanent garage id
// ("<model>~<rowId>"); service, odometer, configuration, VIN completion and delete must act on exactly that car, and a bare
// model id (an old link) must never be guessed once the customer owns more than one.
const PG = ["-h", "127.0.0.1", "-p", "5544", "-U", "postgres", "cc_test", "-At", "-F", "|", "-c"];
const sql = (q: string) => execFileSync("psql", [...PG, q], { encoding: "utf8" }).trim();
const CIVIC = "2018-honda-civic-1.5t";
const JEEP = "2014-jeep-grand-cherokee-3.6l";
const A_CFG = { transmission: "cvt", drivetrain: "fwd" };
const B_CFG = { transmission: "unknown", drivetrain: "fwd" };
const enc = encodeURIComponent;
const uidOf = (email: string) => sql(`select id from users where email='${email}'`);

type Car = { id: string; vin: string };
async function addCar(page: Page, vin: string, config: unknown = A_CFG, vehicleId = CIVIC): Promise<Car> {
  const r = await page.request.post("/api/garage", { data: { kind: "catalog", vehicleId, vin, config } });
  expect(r.ok(), await r.text()).toBeTruthy();
  const body = await r.json();
  return { id: body.entry.id, vin };
}
const svc = (page: Page, id: string, title: string, mileage = 1000) =>
  page.request.post(`/api/garage/${enc(id)}/service`, { data: { date: "2026-01-02", mileage, title } });
const titles = async (page: Page, id: string) =>
  ((await (await page.request.get(`/api/garage/${enc(id)}/service`)).json()).entries as { title: string }[]).map((e) => e.title).sort();
const odo = async (page: Page, id: string) => (await (await page.request.get(`/api/garage/${enc(id)}/odometer`)).json()).odometer;
const rowOf = (id: string) => id.split("~")[1];

test.describe("Every car has its own permanent garage id", () => {
  test("two cars of one model get different ids that carry their row id and never change", async ({ page }) => {
    await signUpNewUser(page);
    const a = await addCar(page, validVin("1HG"));
    const b = await addCar(page, validVin("1HG"), B_CFG);
    expect(a.id).toMatch(/^2018-honda-civic-1\.5t~.+/);
    expect(b.id).toMatch(/^2018-honda-civic-1\.5t~.+/);
    expect(a.id).not.toBe(b.id);
    // listing returns the same ids, in order added, and re-adding a VIN returns the same car with the same id
    const list = (await (await page.request.get("/api/garage")).json()).entries as { id: string }[];
    expect(list.map((e) => e.id)).toEqual([a.id, b.id]);
    const again = await (await page.request.post("/api/garage", { data: { kind: "catalog", vehicleId: CIVIC, vin: b.vin.toLowerCase(), config: B_CFG } })).json();
    expect(again.created).toBe(false);
    expect(again.entry.id).toBe(b.id);
  });

  test("deleting the oldest car does not re-point anything: the other car keeps its id, history and odometer; the deleted id reaches nobody", async ({ page }) => {
    const email = await signUpNewUser(page);
    const a = await addCar(page, validVin("1HG"));
    const b = await addCar(page, validVin("1HG"), B_CFG);
    expect((await svc(page, a.id, "Car A job")).ok()).toBeTruthy();
    expect((await svc(page, b.id, "Car B job")).ok()).toBeTruthy();
    expect((await page.request.put(`/api/garage/${enc(a.id)}/odometer`, { data: { value: 111 } })).ok()).toBeTruthy();
    expect((await page.request.put(`/api/garage/${enc(b.id)}/odometer`, { data: { value: 222 } })).ok()).toBeTruthy();

    expect((await page.request.delete(`/api/garage/${enc(a.id)}`)).ok()).toBeTruthy();

    // B is exactly as it was, under the same id
    expect(await titles(page, b.id)).toEqual(["Car B job"]);
    expect(await odo(page, b.id)).toBe(222);
    const list = (await (await page.request.get("/api/garage")).json()).entries as { id: string }[];
    expect(list.map((e) => e.id)).toEqual([b.id]);
    // A's id now reaches nothing: not B, not anyone
    expect(await titles(page, a.id)).toEqual([]);
    expect(await odo(page, a.id)).toBeNull();
    const w = await svc(page, a.id, "Should not land on B");
    expect(w.status()).toBe(404);
    expect((await w.json()).code).toBe("NOT_IN_GARAGE");
    expect((await page.request.put(`/api/garage/${enc(a.id)}/odometer`, { data: { value: 999 } })).status()).toBe(404);
    expect((await page.request.patch(`/api/garage/${enc(a.id)}`, { data: { drivetrain: "awd" } })).status()).toBe(404);
    expect((await page.request.delete(`/api/garage/${enc(a.id)}`)).ok()).toBeTruthy(); // idempotent, and must not remove B
    expect(await titles(page, b.id)).toEqual(["Car B job"]);
    expect(await odo(page, b.id)).toBe(222);
    expect(sql(`select count(*) from garage_entries where user_id='${uidOf(email)}'`)).toBe("1");
    expect(sql(`select count(*) from service_entries where title='Should not land on B'`)).toBe("0");
  });
});

test.describe("Each operation lands on exactly the car it names", () => {
  test("service, odometer, configuration, VIN completion and delete are per car", async ({ page }) => {
    const email = await signUpNewUser(page);
    const uid = uidOf(email);
    const a = await addCar(page, validVin("1HG"), A_CFG);
    const b = await addCar(page, validVin("1HG"), B_CFG);

    // service history
    const s = await svc(page, b.id, "B only", 5000);
    expect(s.ok()).toBeTruthy();
    const entryId = (await s.json()).entry.id as string;
    expect(await titles(page, a.id)).toEqual([]);
    expect(await titles(page, b.id)).toEqual(["B only"]);
    // deleting a service entry through the OTHER car's id cannot reach it
    expect((await page.request.delete(`/api/garage/${enc(a.id)}/service/${enc(entryId)}`)).status()).toBeLessThan(500);
    expect(await titles(page, b.id)).toEqual(["B only"]);
    expect((await page.request.delete(`/api/garage/${enc(b.id)}/service/${enc(entryId)}`)).ok()).toBeTruthy();
    expect(await titles(page, b.id)).toEqual([]);

    // odometer
    expect((await page.request.put(`/api/garage/${enc(b.id)}/odometer`, { data: { value: 42000 } })).ok()).toBeTruthy();
    expect(await odo(page, a.id)).toBeNull();
    expect(await odo(page, b.id)).toBe(42000);

    // configuration (Edit Configuration)
    const cfg = await page.request.patch(`/api/garage/${enc(b.id)}`, { data: { transmission: "cvt" } });
    expect(cfg.ok()).toBeTruthy();
    expect(sql(`select transmission,drivetrain from garage_entries where id='${rowOf(a.id)}'`)).toBe("cvt|fwd");
    expect(sql(`select transmission,drivetrain from garage_entries where id='${rowOf(b.id)}'`)).toBe("cvt|fwd");
    expect((await page.request.patch(`/api/garage/${enc(a.id)}`, { data: { drivetrain: "unknown" } })).ok()).toBeTruthy();
    expect(sql(`select drivetrain from garage_entries where id='${rowOf(a.id)}'`)).toBe("unknown");
    expect(sql(`select drivetrain from garage_entries where id='${rowOf(b.id)}'`)).toBe("fwd");

    // VIN completion of a VIN-less older record of ANOTHER model, with a same-model pair alongside
    sql(`insert into garage_entries(id,user_id,kind,vehicle_id) values ('old-jeep-${uid}','${uid}','catalog','${JEEP}')`);
    const jid = `${JEEP}~old-jeep-${uid}`;
    const vin = validVin("1C4");
    expect((await page.request.post(`/api/garage/${enc(jid)}/vin`, { data: { vin } })).ok()).toBeTruthy();
    expect(sql(`select vin from garage_entries where id='old-jeep-${uid}'`)).toBe(vin);
    expect(sql(`select count(*) from garage_entries where user_id='${uid}' and vehicle_id='${CIVIC}' and vin is not null`)).toBe("2");

    // delete removes exactly one
    expect((await page.request.delete(`/api/garage/${enc(a.id)}`)).ok()).toBeTruthy();
    expect(sql(`select id from garage_entries where user_id='${uid}' and vehicle_id='${CIVIC}'`)).toBe(rowOf(b.id));
  });

  test("another customer's car id reaches nothing, even with the right model and row id", async ({ browser }) => {
    const ctxA = await browser.newContext();
    const A = await ctxA.newPage();
    await signUpNewUser(A);
    const a = await addCar(A, validVin("1HG"));
    await svc(A, a.id, "A private");
    const ctxB = await browser.newContext();
    const B = await ctxB.newPage();
    const emailB = await signUpNewUser(B);
    const b = await addCar(B, validVin("1HG"), B_CFG);
    expect(await titles(B, a.id)).toEqual([]);
    expect((await svc(B, a.id, "intrusion")).status()).toBe(404);
    expect((await B.request.put(`/api/garage/${enc(a.id)}/odometer`, { data: { value: 1 } })).status()).toBe(404);
    expect((await B.request.patch(`/api/garage/${enc(a.id)}`, { data: { drivetrain: "awd" } })).status()).toBe(404);
    await B.request.delete(`/api/garage/${enc(a.id)}`);
    expect(await titles(A, a.id)).toEqual(["A private"]);
    expect(sql(`select count(*) from garage_entries where user_id='${uidOf(emailB)}'`)).toBe("1");
    expect(await titles(B, b.id)).toEqual([]);
    await ctxA.close();
    await ctxB.close();
  });
});

test.describe("A bare model id (an old link) is an alias for one car and refused for several", () => {
  test("with one car it still works exactly as before; with two, every operation refuses and changes nothing", async ({ page }) => {
    const email = await signUpNewUser(page);
    const uid = uidOf(email);
    const a = await addCar(page, validVin("1HG"));
    // one car: the bare id is that car
    expect((await svc(page, CIVIC, "via old id")).ok()).toBeTruthy();
    expect(await titles(page, a.id)).toEqual(["via old id"]);
    expect((await page.request.put(`/api/garage/${CIVIC}/odometer`, { data: { value: 10 } })).ok()).toBeTruthy();
    expect(await odo(page, a.id)).toBe(10);

    const b = await addCar(page, validVin("1HG"), B_CFG);
    const before = sql(`select id,vin,transmission,drivetrain from garage_entries where user_id='${uid}' order by id`);
    const svcBefore = sql("select count(*) from service_entries");

    for (const [name, res] of [
      ["GET service", await page.request.get(`/api/garage/${CIVIC}/service`)],
      ["POST service", await svc(page, CIVIC, "must not land")],
      ["GET odometer", await page.request.get(`/api/garage/${CIVIC}/odometer`)],
      ["PUT odometer", await page.request.put(`/api/garage/${CIVIC}/odometer`, { data: { value: 777 } })],
      ["PATCH config", await page.request.patch(`/api/garage/${CIVIC}`, { data: { drivetrain: "awd" } })],
      ["POST vin", await page.request.post(`/api/garage/${CIVIC}/vin`, { data: { vin: validVin("1HG") } })],
      ["DELETE car", await page.request.delete(`/api/garage/${CIVIC}`)],
      ["DELETE service entry", await page.request.delete(`/api/garage/${CIVIC}/service/anything`)],
    ] as const) {
      expect(res.status(), name).toBe(409);
      expect((await res.json()).code, name).toBe("VEHICLE_AMBIGUOUS");
    }
    expect(sql(`select id,vin,transmission,drivetrain from garage_entries where user_id='${uid}' order by id`)).toBe(before);
    expect(sql("select count(*) from service_entries")).toBe(svcBefore);
    expect(await odo(page, a.id)).toBe(10);
    expect(await odo(page, b.id)).toBeNull();

    // back to one car: the alias resolves again, to the car that is left
    expect((await page.request.delete(`/api/garage/${enc(a.id)}`)).ok()).toBeTruthy();
    expect((await page.request.get(`/api/garage/${CIVIC}/service`)).ok()).toBeTruthy();
    expect(await odo(page, CIVIC)).toBeNull();
  });

  test("the vehicle page redirects a one-car alias to the permanent id and asks which car when there are several", async ({ page }) => {
    await signUpNewUser(page);
    const a = await addCar(page, validVin("1HG"), A_CFG);
    await page.goto(`/vehicles/${CIVIC}`);
    await expect(page).toHaveURL(new RegExp(`/vehicles/${a.id.replace(/[.~]/g, "\\$&")}$`));

    const b = await addCar(page, validVin("1HG"), B_CFG);
    await page.goto(`/vehicles/${CIVIC}`);
    await expect(page.getByTestId("choose-your-car")).toBeVisible();
    const links = page.getByTestId("choose-car-link");
    await expect(links).toHaveCount(2);
    await expect(links.nth(0)).toContainText(a.vin.slice(-6));
    await expect(links.nth(1)).toContainText(b.vin.slice(-6));
    // nothing build-specific is shown until a car is chosen
    await expect(page.getByTestId("config-line")).toHaveCount(0);
    for (const sub of ["/spec-sheet/print", "/service-history/print"]) {
      await page.goto(`/vehicles/${CIVIC}${sub}`);
      await expect(page.getByTestId("choose-your-car")).toBeVisible();
    }

    await page.goto(`/vehicles/${CIVIC}`);
    await links.nth(1).click();
    await expect(page).toHaveURL(new RegExp(`${enc(b.id).replace(/[.~]/g, "\\$&")}$|${b.id.replace(/[.~]/g, "\\$&")}$`));
    await expect(page.getByText(b.vin).first()).toBeVisible();
    await expect(page.getByText(a.vin)).toHaveCount(0);
  });
});
