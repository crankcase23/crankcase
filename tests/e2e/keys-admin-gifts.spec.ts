import { test, expect, type Page } from "@playwright/test";
import { execFileSync } from "node:child_process";
import { signUpNewUser, validVin } from "./helpers";

// Admin gift / revoke now go through the entitlement functions: one permanent (account, VIN) record, an append-only event
// log with the admin as actor, and admin screens that read the same table. Real browser sessions, production build,
// throwaway Postgres. No payment exists; nothing here charges anyone.
const PG = ["-h", "127.0.0.1", "-p", "5544", "-U", "postgres", "cc_test", "-At", "-F", "|", "-c"];
const sql = (q: string) => execFileSync("psql", [...PG, q], { encoding: "utf8" }).trim();
const uid = (email: string) => sql(`select id from users where email='${email}'`);
const CFG = { transmission: "unknown", drivetrain: "unknown" };
const JEEP = "2014-jeep-grand-cherokee-3.6l";
const CIVIC = "2018-honda-civic-1.5t";
const enc = encodeURIComponent;

async function add(page: Page, vin: string, vehicleId = JEEP): Promise<string> {
  const r = await page.request.post("/api/garage", { data: { kind: "catalog", vehicleId, vin, config: CFG } });
  expect(r.status(), await r.text()).toBe(200);
  return (await r.json()).entry.id as string;
}
const status = async (page: Page, id: string) => (await page.request.get(`/api/garage/${enc(id)}/keys`)).json();
const rowIdOf = (garageId: string) => garageId.split("~")[1];
const adminForm = (admin: Page, data: Record<string, string>) =>
  admin.request.post("/api/admin/unlocks", { form: data, maxRedirects: 0 });
const events = (userId: string, vin: string) =>
  sql(`select event_type||':'||source||':'||actor_type||':'||coalesce(actor_id,'-')||':'||coalesce(reason,'-') from vin_entitlement_events where user_id='${userId}' and vin='${vin}' order by created_at, id`).split("\n").filter(Boolean);

async function makeAdmin(page: Page) {
  const email = await signUpNewUser(page);
  sql(`update users set is_admin = true where email='${email}'`);
  return email;
}

test.describe("Admin gifts are permanent, VIN-linked, logged, and isolated", () => {
  test("gift -> customer unlocked, ladder untouched; remove + re-add vehicle keeps it; revoke keeps the row and the history", async ({ browser }) => {
    const ctxA = await browser.newContext(); const adminPage = await ctxA.newPage();
    const adminEmail = await makeAdmin(adminPage);
    const ctxC = await browser.newContext(); const cust = await ctxC.newPage();
    const custEmail = await signUpNewUser(cust);
    const cid = uid(custEmail);
    const vin = validVin("1C4");
    const gid = await add(cust, vin);
    expect((await status(cust, gid)).unlocked).toBe(false);

    const g = await adminForm(adminPage, { userId: cid, garageEntryId: rowIdOf(gid), action: "grant", reason: "launch goodwill" });
    expect(g.status(), await g.text()).toBe(303);
    expect((await status(cust, gid)).unlocked).toBe(true);
    expect(sql(`select source||'|'||coalesce(rung::text,'-')||'|'||coalesce(price_cents::text,'-')||'|'||coalesce(revoked_at::text,'live') from vin_entitlements where user_id='${cid}' and vin='${vin}'`)).toBe("gift|-|-|live");
    expect(events(cid, vin)).toEqual([`gifted:gift:admin:${uid(adminEmail)}:launch goodwill`]);
    expect(sql(`select count(*) from admin_audit_log where action='unlock.grant' and metadata->>'userId'='${cid}'`)).toBe("1");
    // the old unlock table is no longer written
    expect(sql(`select count(*) from vehicle_unlocks where user_id='${cid}'`)).toBe("0");
    // a gift does not move the customer down the price ladder
    expect((await (await cust.request.get("/api/keys/price")).json()).priceCents).toBe(2000);

    // asking again changes nothing and logs nothing new
    expect((await adminForm(adminPage, { userId: cid, garageEntryId: rowIdOf(gid), action: "grant" })).status()).toBe(303);
    expect(events(cid, vin)).toHaveLength(1);

    // the customer removes the vehicle and adds it back: access is still there (it was never tied to the garage row)
    expect((await cust.request.delete(`/api/garage/${enc(gid)}`)).ok()).toBeTruthy();
    expect(sql(`select count(*) from vin_entitlements where user_id='${cid}' and vin='${vin}' and revoked_at is null`)).toBe("1");
    const gid2 = await add(cust, vin);
    expect(gid2).not.toBe(gid);
    expect((await status(cust, gid2)).unlocked).toBe(true);

    // revoke: access ends, the row is kept, history grows
    expect((await adminForm(adminPage, { userId: cid, garageEntryId: rowIdOf(gid2), action: "revoke", reason: "gift withdrawn" })).status()).toBe(303);
    expect((await status(cust, gid2)).unlocked).toBe(false);
    expect(sql(`select count(*) from vin_entitlements where user_id='${cid}' and vin='${vin}' and revoked_at is not null`)).toBe("1");
    expect(events(cid, vin)).toEqual([
      `gifted:gift:admin:${uid(adminEmail)}:launch goodwill`,
      `revoked:gift:admin:${uid(adminEmail)}:gift withdrawn`,
    ]);
    // gifting again after a revoke reinstates it and the earlier history stays
    expect((await adminForm(adminPage, { userId: cid, garageEntryId: rowIdOf(gid2), action: "grant" })).status()).toBe(303);
    expect((await status(cust, gid2)).unlocked).toBe(true);
    expect(events(cid, vin)).toHaveLength(3);
    await ctxA.close(); await ctxC.close();
  });

  test("a vehicle with no VIN cannot be unlocked; non-admins and wrong-account vehicles are refused", async ({ browser }) => {
    const ctxA = await browser.newContext(); const adminPage = await ctxA.newPage(); await makeAdmin(adminPage);
    const ctxC = await browser.newContext(); const cust = await ctxC.newPage();
    const custEmail = await signUpNewUser(cust); const cid = uid(custEmail);
    const ctxO = await browser.newContext(); const other = await ctxO.newPage();
    const otherEmail = await signUpNewUser(other); const oid = uid(otherEmail);
    sql(`insert into garage_entries(id,user_id,kind,vehicle_id) values ('legacy-${cid}','${cid}','catalog','${JEEP}')`);
    const none = await adminForm(adminPage, { userId: cid, garageEntryId: `legacy-${cid}`, action: "grant" });
    expect(none.status()).toBe(400);
    expect((await none.json()).error).toMatch(/no valid VIN/i);
    expect(sql(`select count(*) from vin_entitlements where user_id='${cid}'`)).toBe("0");

    const gid = await add(cust, validVin("1C4"));
    // a customer cannot call the admin route
    expect((await adminForm(cust, { userId: cid, garageEntryId: rowIdOf(gid), action: "grant" })).status()).toBe(403);
    // an admin naming a vehicle that belongs to someone else is refused
    expect((await adminForm(adminPage, { userId: oid, garageEntryId: rowIdOf(gid), action: "grant" })).status()).toBe(404);
    expect((await adminForm(adminPage, { userId: cid, garageEntryId: rowIdOf(gid), action: "bogus" })).status()).toBe(400);
    expect(sql(`select count(*) from vin_entitlements where user_id in ('${cid}','${oid}')`)).toBe("0");
    await ctxA.close(); await ctxC.close(); await ctxO.close();
  });

  test("same VIN in two accounts: a gift unlocks only the account it was given to, and the admin screens say so", async ({ browser }) => {
    const ctxA = await browser.newContext(); const adminPage = await ctxA.newPage(); await makeAdmin(adminPage);
    const ctxX = await browser.newContext(); const x = await ctxX.newPage();
    const emailX = await signUpNewUser(x); const xid = uid(emailX);
    const ctxY = await browser.newContext(); const y = await ctxY.newPage();
    const emailY = await signUpNewUser(y); const yid = uid(emailY);
    const vin = validVin("1C4");
    const gx = await add(x, vin); const gy = await add(y, vin);
    expect((await adminForm(adminPage, { userId: xid, garageEntryId: rowIdOf(gx), action: "grant" })).status()).toBe(303);
    expect((await status(x, gx)).unlocked).toBe(true);
    expect((await status(y, gy)).unlocked).toBe(false);
    expect(events(yid, vin)).toEqual([]);

    // admin vehicle export reads the same table, per owner: X's car "yes", Y's car "no"
    const csv = await (await adminPage.request.get("/api/admin/export/vehicles")).text();
    const line = (email: string) => csv.split("\r\n").find((l) => l.startsWith(email) && l.includes(vin))!;
    expect(line(emailX)).toContain(",yes,");
    expect(line(emailY)).toContain(",no,");
    const users = await (await adminPage.request.get("/api/admin/export/users")).text();
    const urow = (email: string) => users.split("\r\n").find((l) => l.startsWith(email))!.split(",");
    expect(urow(emailX)[4]).toBe("1");   // Unlocks column
    expect(urow(emailY)[4]).toBe("0");

    // the admin user page (Garage tab) shows the unlock on X's car and offers Gift on Y's
    await adminPage.goto(`/admin/users/${xid}?tab=garage`);
    await expect(adminPage.getByText(/unlocked · gift/)).toBeVisible();
    await expect(adminPage.getByRole("button", { name: "Revoke unlock" })).toBeVisible();
    await adminPage.goto(`/admin/users/${yid}?tab=garage`);
    await expect(adminPage.getByText(/unlocked · /)).toHaveCount(0);
    await expect(adminPage.getByRole("button", { name: "Gift unlock" })).toBeVisible();

    // the per-account Unlocks count on the overview reads the same table (it once compared a column with itself)
    await adminPage.goto(`/admin/users/${xid}`);
    expect(await adminPage.locator("main").innerText()).toMatch(/Unlocks\s*\n?\s*1\b/i);
    await adminPage.goto(`/admin/users/${yid}`);
    expect(await adminPage.locator("main").innerText()).toMatch(/Unlocks\s*\n?\s*0\b/i);

    // a revoked gift stops showing as unlocked everywhere
    expect((await adminForm(adminPage, { userId: xid, garageEntryId: rowIdOf(gx), action: "revoke" })).status()).toBe(303);
    const csv2 = await (await adminPage.request.get("/api/admin/export/vehicles")).text();
    expect(csv2.split("\r\n").find((l) => l.startsWith(emailX) && l.includes(vin))).toContain(",no,");
    await ctxA.close(); await ctxX.close(); await ctxY.close();
  });

  test("two cars of one model: gifting one leaves its sibling locked, and each is addressed by its own permanent id", async ({ browser }) => {
    const ctxA = await browser.newContext(); const adminPage = await ctxA.newPage(); await makeAdmin(adminPage);
    const ctxC = await browser.newContext(); const cust = await ctxC.newPage();
    const email = await signUpNewUser(cust); const cid = uid(email);
    const v1 = validVin("1HG"); const v2 = validVin("1HG");
    const g1 = await add(cust, v1, CIVIC); const g2 = await add(cust, v2, CIVIC);
    expect((await adminForm(adminPage, { userId: cid, garageEntryId: rowIdOf(g2), action: "grant" })).status()).toBe(303);
    expect((await status(cust, g1)).unlocked).toBe(false);
    expect((await status(cust, g2)).unlocked).toBe(true);
    // the bare model id is ambiguous with two cars: the keys route refuses instead of reporting some car's state
    const amb = await cust.request.get(`/api/garage/${CIVIC}/keys`);
    expect(amb.status()).toBe(409);
    expect((await amb.json()).code).toBe("VEHICLE_AMBIGUOUS");
    // removing the unlocked car and re-adding it restores its access; the sibling never had any
    await cust.request.delete(`/api/garage/${enc(g2)}`);
    expect((await status(cust, g1)).unlocked).toBe(false);
    const g2b = await add(cust, v2, CIVIC);
    expect((await status(cust, g2b)).unlocked).toBe(true);
    await ctxA.close(); await ctxC.close();
  });
});
