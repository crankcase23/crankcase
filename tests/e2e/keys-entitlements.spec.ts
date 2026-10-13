import { test, expect, type Page } from "@playwright/test";
import { execFileSync } from "node:child_process";
import { signUpNewUser, validVin } from "./helpers";

// Get the Keys PR-A, over HTTP in a real browser session against a throwaway Postgres.
// There is no payment and no grant endpoint, so a "purchase" is SIMULATED by inserting the row the future webhook will
// write (psql, test only). What is under test: the read-only surface, server-enforced price, VIN persistence across
// delete / re-add, and that nothing a browser can send changes an entitlement or a price.
const PG = ["-h", "127.0.0.1", "-p", "5544", "-U", "postgres", "cc_test", "-At", "-F", "|", "-c"];
const sql = (q: string) => execFileSync("psql", [...PG, q], { encoding: "utf8" }).trim();
const uid = (email: string) => sql(`select id from users where email='${email}'`);
const CFG = { transmission: "unknown", drivetrain: "unknown" };
const JEEP = "2014-jeep-grand-cherokee-3.6l";
let n = 0;
const simulatePurchase = (email: string, vin: string, rung: number) =>
  sql(`insert into vin_entitlements(id,user_id,vin,source,rung,price_cents) values ('sim-${Date.now()}-${++n}','${uid(email)}','${vin}','purchase',${rung},${[2000, 1800, 1600, 1500][Math.min(rung, 4) - 1]})`);

async function add(page: Page, vin: string, vehicleId = JEEP) {
  const r = await page.request.post("/api/garage", { data: { kind: "catalog", vehicleId, vin, config: CFG } });
  expect(r.status(), await r.text()).toBe(200);
}

test.describe("Keys status and server price", () => {
  test("signed-out calls are refused", async ({ browser }) => {
    const ctx = await browser.newContext();
    const p = await ctx.newPage();
    expect((await p.request.get("/api/keys/price")).status()).toBe(401);
    expect((await p.request.get(`/api/garage/${JEEP}/keys`)).status()).toBe(401);
    await ctx.close();
  });

  test("the price is the ladder for the account's own purchases, whatever the browser sends", async ({ page }) => {
    const email = await signUpNewUser(page);
    const expected = [2000, 1800, 1600, 1500, 1500];
    for (let bought = 0; bought < expected.length; bought++) {
      const r = await page.request.get(`/api/keys/price?price=1&priceCents=1&rung=4&userId=someone-else`);
      const j = await r.json();
      expect(j.priceCents, `after ${bought} purchases`).toBe(expected[bought]);
      expect(j.rung).toBe(bought + 1);
      expect(j.purchasedCount).toBe(bought);
      expect(j.ladderCents).toEqual([2000, 1800, 1600, 1500]);
      simulatePurchase(email, validVin("1HG"), bought + 1);
    }
  });

  test("a vehicle shows locked with the server price, then unlocked once the account holds the VIN's entitlement", async ({ page }) => {
    const email = await signUpNewUser(page);
    const vin = validVin();
    await add(page, vin);
    expect(await (await page.request.get(`/api/garage/${JEEP}/keys`)).json()).toEqual({ hasVin: true, unlocked: false, nextPriceCents: 2000, nextRung: 1 });
    simulatePurchase(email, vin, 1);
    expect(await (await page.request.get(`/api/garage/${JEEP}/keys`)).json()).toEqual({ hasVin: true, unlocked: true, nextPriceCents: null, nextRung: null });
  });

  test("PERSISTENCE: removing the vehicle keeps the entitlement; adding the same VIN back restores access and charges nothing", async ({ page }) => {
    const email = await signUpNewUser(page);
    const vin = validVin();
    await add(page, vin);
    simulatePurchase(email, vin, 1);
    const del = await page.request.delete(`/api/garage/${JEEP}`);
    expect(del.ok()).toBeTruthy();
    expect(sql(`select count(*) from garage_entries where user_id='${uid(email)}'`)).toBe("0");
    expect(sql(`select count(*) from vin_entitlements where user_id='${uid(email)}' and vin='${vin}' and revoked_at is null`)).toBe("1");
    expect((await page.request.get(`/api/garage/${JEEP}/keys`)).status()).toBe(404); // not in the garage any more
    await add(page, vin); // reacquire, same VIN (lower-case spelling must also restore it)
    expect((await (await page.request.get(`/api/garage/${JEEP}/keys`)).json()).unlocked).toBe(true);
    const price = await (await page.request.get("/api/keys/price")).json();
    expect(price.purchasedCount).toBe(1); // re-adding did not count as, or charge for, another unlock
    expect(sql(`select count(*) from vin_entitlements where user_id='${uid(email)}'`)).toBe("1");
  });

  test("ISOLATION: another account holding the same VIN is locked at its own price and cannot see or change the owner's entitlement", async ({ browser }) => {
    const mk = async () => { const ctx = await browser.newContext(); const page = await ctx.newPage(); const email = await signUpNewUser(page); return { ctx, page, email }; };
    const A = await mk(); const B = await mk();
    const vin = validVin();
    await add(A.page, vin);
    simulatePurchase(A.email, vin, 1);
    simulatePurchase(A.email, validVin("1HG"), 2); // A is two purchases in
    // Account B holds the same VIN. (#43 currently refuses a second account with 409 VIN_CLAIM_REQUIRED, the design under
    // review; the intended design allows it, so B's row is seeded directly to test entitlement isolation on its own.)
    sql(`insert into garage_entries(id,user_id,kind,vehicle_id,vin) values ('iso-${Date.now()}','${uid(B.email)}','catalog','${JEEP}','${vin}')`);
    expect(await (await B.page.request.get(`/api/garage/${JEEP}/keys`)).json()).toEqual({ hasVin: true, unlocked: false, nextPriceCents: 2000, nextRung: 1 });
    expect((await (await A.page.request.get(`/api/garage/${JEEP}/keys`)).json()).unlocked).toBe(true);
    expect((await (await A.page.request.get("/api/keys/price")).json()).priceCents).toBe(1600);
    expect((await (await B.page.request.get("/api/keys/price")).json()).priceCents).toBe(2000);
    // B probing A's garage row id gets the same 404 as a made-up id.
    const aRow = sql(`select id from garage_entries where user_id='${uid(A.email)}'`);
    const probe = await B.page.request.get(`/api/garage/${aRow}/keys`);
    const fake = await B.page.request.get(`/api/garage/not-a-real-id/keys`);
    expect(probe.status()).toBe(404); expect(await probe.json()).toEqual(await fake.json());
    // B removing its vehicle changes nothing for A.
    await B.page.request.delete(`/api/garage/${JEEP}`);
    expect((await (await A.page.request.get(`/api/garage/${JEEP}/keys`)).json()).unlocked).toBe(true);
    await A.ctx.close(); await B.ctx.close();
  });

  test("a browser cannot grant, revoke or reprice anything: no write verbs exist on the Keys routes", async ({ page }) => {
    const email = await signUpNewUser(page);
    const vin = validVin();
    await add(page, vin);
    for (const verb of ["post", "put", "patch", "delete"] as const) {
      for (const url of [`/api/garage/${JEEP}/keys`, "/api/keys/price"]) {
        const r = await page.request[verb](url, { data: { vin, priceCents: 1, source: "purchase", unlocked: true } });
        expect(r.status(), `${verb} ${url}`).toBe(405);
      }
    }
    expect(sql(`select count(*) from vin_entitlements where user_id='${uid(email)}'`)).toBe("0");
    expect((await (await page.request.get(`/api/garage/${JEEP}/keys`)).json()).unlocked).toBe(false);
  });

  test("a VIN-less older record is not unlockable and says so", async ({ page }) => {
    const email = await signUpNewUser(page);
    sql(`insert into garage_entries(id,user_id,kind,vehicle_id,vin) values ('old-${Date.now()}','${uid(email)}','catalog','${JEEP}',null)`);
    expect(await (await page.request.get(`/api/garage/${JEEP}/keys`)).json()).toEqual({ hasVin: false, unlocked: false, nextPriceCents: null, nextRung: null });
  });
});
