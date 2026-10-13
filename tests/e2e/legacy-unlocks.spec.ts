import { test, expect, type Page } from "@playwright/test";
import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { signUpNewUser, validVin } from "./helpers";

// Legacy (pre-entitlement) unlocks are never dropped: deleting a car keeps them as holds; the customer completing the VIN or an
// admin restores them; checkout refuses VINs that are already unlocked. Real sessions, production build, throwaway Postgres.
// No payment exists; nothing here charges anyone.
const PG = ["-h", "127.0.0.1", "-p", "5544", "-U", "postgres", "cc_test", "-At", "-F", "|", "-c"];
const sql = (q: string) => execFileSync("psql", [...PG, q], { encoding: "utf8" }).trim();
const uid = (email: string) => sql(`select id from users where email='${email}'`);
const CFG = { transmission: "unknown", drivetrain: "unknown" };
const JEEP = "2014-jeep-grand-cherokee-3.6l";
const enc = encodeURIComponent;
const rowIdOf = (garageId: string) => garageId.split("~")[1];

async function add(page: Page, vin: string): Promise<string> {
  const r = await page.request.post("/api/garage", { data: { kind: "catalog", vehicleId: JEEP, vin, config: CFG } });
  expect(r.status(), await r.text()).toBe(200);
  return (await r.json()).entry.id as string;
}
const checkout = async (page: Page, id: string) => (await page.request.get(`/api/garage/${enc(id)}/keys/checkout`)).json();

test.describe("Legacy unlocks survive, reconcile, and block double payment", () => {
  test("a legacy gift survives deleting the car, the customer completing the VIN restores it, checkout then refuses", async ({ browser }) => {
    const ctx = await browser.newContext(); const cust = await ctx.newPage();
    const email = await signUpNewUser(cust); const cid = uid(email);
    const vin = validVin("1C4");
    const gid = await add(cust, vin);
    expect((await checkout(cust, gid))).toMatchObject({ eligible: true, priceCents: 2000 });

    // an old-style unlock row (as the pre-entitlement admin screen wrote it), then the customer removes the car
    sql(`insert into vehicle_unlocks(user_id,garage_entry_id,source) values ('${cid}','${rowIdOf(gid)}','gift')`);
    expect((await cust.request.delete(`/api/garage/${enc(gid)}`)).ok()).toBeTruthy();
    expect(sql(`select count(*) from legacy_unlock_holds where user_id='${cid}' and status='pending_vin' and source='gift'`)).toBe("1");

    // the same cannot be dropped by hand either
    expect(() => sql(`delete from legacy_unlock_holds where user_id='${cid}'`)).toThrow();
    expect(sql(`select count(*) from legacy_unlock_holds where user_id='${cid}'`)).toBe("1");

    // a VIN-less older car (as the old garage allowed) carrying a hold; the customer completes its VIN
    const oldRow = randomUUID();
    sql(`insert into garage_entries(id,user_id,kind,vehicle_id) values ('${oldRow}','${cid}','catalog','${JEEP}')`);
    sql(`insert into legacy_unlock_holds(id,user_id,garage_entry_id,source,granted_at,vehicle_id) values ('${randomUUID()}','${cid}','${oldRow}','gift',now(),'${JEEP}')`);
    const list = await (await cust.request.get("/api/garage")).json();
    const old = (list.entries as { id: string }[]).find((e) => e.id.endsWith(`~${oldRow}`))!;
    expect(old, "VIN-less car appears in the garage").toBeTruthy();
    expect((await checkout(cust, old.id))).toMatchObject({ eligible: false, reason: "no-vin" });
    const vin2 = validVin("1C4");
    const r = await cust.request.post(`/api/garage/${enc(old.id)}/vin`, { data: { vin: vin2 } });
    expect(r.status(), await r.text()).toBe(200);
    expect((await r.json()).legacyUnlock).toEqual({ restored: 1, needsReview: 0 });
    expect((await (await cust.request.get(`/api/garage/${enc(old.id)}/keys`)).json()).unlocked).toBe(true);
    expect((await checkout(cust, old.id))).toMatchObject({ eligible: false, reason: "already-unlocked" });
    expect(sql(`select source||'|'||status from legacy_unlock_holds where garage_entry_id='${oldRow}'`)).toBe("gift|converted");
    await ctx.close();
  });

  test("a PAID legacy hold is not restored by a typed VIN; the admin restores it, audited; another account cannot see or touch it", async ({ browser }) => {
    const ctxA = await browser.newContext(); const admin = await ctxA.newPage();
    const adminEmail = await signUpNewUser(admin); sql(`update users set is_admin = true where email='${adminEmail}'`);
    const ctxC = await browser.newContext(); const cust = await ctxC.newPage();
    const cid = uid(await signUpNewUser(cust));
    const ctxO = await browser.newContext(); const other = await ctxO.newPage();
    const oid = uid(await signUpNewUser(other));

    const oldRow = randomUUID();
    sql(`insert into garage_entries(id,user_id,kind,vehicle_id) values ('${oldRow}','${cid}','catalog','${JEEP}')`);
    const hold = randomUUID();
    sql(`insert into legacy_unlock_holds(id,user_id,garage_entry_id,source,granted_at,vehicle_id) values ('${hold}','${cid}','${oldRow}','purchase',now(),'${JEEP}')`);
    const id = ((await (await cust.request.get("/api/garage")).json()).entries as { id: string }[]).find((e) => e.id.endsWith(`~${oldRow}`))!.id;
    const vin = validVin("1C4");
    const r = await cust.request.post(`/api/garage/${enc(id)}/vin`, { data: { vin } });
    expect((await r.json()).legacyUnlock).toEqual({ restored: 0, needsReview: 1 });
    expect((await (await cust.request.get(`/api/garage/${enc(id)}/keys`)).json()).unlocked).toBe(false);
    expect((await checkout(cust, id))).toMatchObject({ eligible: false, reason: "legacy-unlock-pending" });

    // only an admin of unlocks.manage can resolve it; a customer's POST is refused
    const denied = await cust.request.post("/api/admin/legacy-holds", { form: { holdId: hold, userId: cid, action: "convert", reason: "x" }, maxRedirects: 0 });
    expect([401, 403, 404, 307, 303]).toContain(denied.status());
    expect(sql(`select status from legacy_unlock_holds where id='${hold}'`)).toBe("pending_vin");
    // wrong account id with a real hold id: refused, nothing changes
    const wrong = await admin.request.post("/api/admin/legacy-holds", { form: { holdId: hold, userId: oid, action: "convert", reason: "wrong user" }, maxRedirects: 0 });
    expect(wrong.status()).toBe(404); // same answer as a hold that does not exist
    expect(sql(`select status from legacy_unlock_holds where id='${hold}'`)).toBe("pending_vin");
    // a reason is required
    expect((await admin.request.post("/api/admin/legacy-holds", { form: { holdId: hold, userId: cid, action: "convert" }, maxRedirects: 0 })).status()).toBe(400);

    // the admin screen shows it, then restores it
    await admin.goto(`/admin/users/${cid}?tab=garage`);
    await expect(admin.getByTestId("legacy-hold")).toHaveCount(1);
    const ok = await admin.request.post("/api/admin/legacy-holds", { form: { holdId: hold, userId: cid, action: "convert", vin, reason: "verified purchase receipt" }, maxRedirects: 0 });
    expect(ok.status(), await ok.text()).toBe(303);
    expect((await (await cust.request.get(`/api/garage/${enc(id)}/keys`)).json()).unlocked).toBe(true);
    expect(sql(`select source||'|'||coalesce(price_cents::text,'-') from vin_entitlements where user_id='${cid}' and vin='${vin}' and revoked_at is null`)).toBe("purchase|-");
    expect(sql(`select count(*) from admin_audit_log where action='legacy_hold.convert' and metadata->>'userId'='${cid}'`)).toBe("1");
    // the other account sees nothing of it
    expect(sql(`select count(*) from vin_entitlements where user_id='${oid}'`)).toBe("0");
    // resolved holds cannot be reopened or converted twice
    const again = await admin.request.post("/api/admin/legacy-holds", { form: { holdId: hold, userId: cid, action: "waive", reason: "second attempt" }, maxRedirects: 0 });
    expect(again.status()).toBe(400);
    await ctxA.close(); await ctxC.close(); await ctxO.close();
  });
});
