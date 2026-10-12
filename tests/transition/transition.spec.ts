import { test, expect, type Page, type APIResponse } from "@playwright/test";
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { signUpNewUser, validVin, randomIp } from "../e2e/helpers";

// OLD/NEW COMPATIBILITY REHEARSAL over real HTTP against a scratch Postgres. Not part of the normal e2e run.
//   PHASE=A  old app, original schema                   (baseline)
//   PHASE=B  old app, after the EXPAND sql              (old code must see no new errors; unlocks must survive its deletes)
//   PHASE=C  new app, expand schema + stragglers re-run (new code on in-window data; reconcile; contract SQL runs after)
//   PHASE=D  new app, final schema after CONTRACT        (constraints are real; history intact)
// Results are written to $TDIR/<phase>.json so the driver and the runbook quote real numbers. No payment exists anywhere.
const DB = process.env.TDB ?? "cc_win2";
const TDIR = process.env.TDIR ?? "/var/tmp/transition";
const PHASE = process.env.PHASE ?? "";
const sql = (q: string) => execFileSync("psql", ["-h", "127.0.0.1", "-p", "5544", "-U", "postgres", DB, "-At", "-F", "|", "-c", q], { encoding: "utf8" }).trim();
const sqlErr = (q: string): string => { try { sql(q); return ""; } catch (e) { return String((e as { stderr?: string }).stderr ?? e); } };
const CFG = { transmission: "unknown", drivetrain: "unknown" };
const enc = encodeURIComponent;
const STATE = `${TDIR}/state.json`;
mkdirSync(TDIR, { recursive: true });
type State = Record<string, string>;
type Entry = { id: string; vin?: string; model?: string; custom?: { vin?: string; model?: string } };
const vinOf = (e: Entry) => e.vin ?? e.custom?.vin;
const modelOf = (e: Entry) => e.model ?? e.custom?.model;
const load = (): State => (existsSync(STATE) ? JSON.parse(readFileSync(STATE, "utf8")) : {});
const save = (s: State) => writeFileSync(STATE, JSON.stringify(s, null, 1));
const out: Record<string, unknown> = {};
test.afterAll(() => { writeFileSync(`${TDIR}/${PHASE}.json`, JSON.stringify(out, null, 1)); });

const uid = (email: string) => sql(`select id from users where email='${email}'`);
async function login(page: Page, email: string) {
  await page.context().setExtraHTTPHeaders({ "x-forwarded-for": randomIp() });
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill("testpassword123");
  await page.getByRole("button", { name: /sign in|log in/i }).click();
  await expect(page).toHaveURL(/\/garage$/, { timeout: 30_000 });
}
async function makeAdmin(page: Page) {
  const email = await signUpNewUser(page);
  sql(`update users set is_admin = true where email='${email}'`);
  return email;
}
const addCustom = (page: Page, vin: string): Promise<APIResponse> =>
  page.request.post("/api/garage", { data: { kind: "custom", custom: { vin, year: "2015", make: "Ford", model: "F-150" }, config: CFG } });
const status = async (r: APIResponse) => r.status();
const rowFor = (userId: string, vinOrNull: string | null, extra = "") =>
  sql(`select id from garage_entries where user_id='${userId}' and ${vinOrNull === null ? "vin is null" : `upper(vin)=upper('${vinOrNull}')`} ${extra} order by created_at limit 1`);
const adminGift = (admin: Page, userId: string, rowId: string) =>
  admin.request.post("/api/admin/unlocks", { form: { userId, garageEntryId: rowId, action: "grant", reason: "rehearsal" }, maxRedirects: 0 });

test.describe(`phase ${PHASE}`, () => {
  test.skip(!/^[ABCD]$/.test(PHASE), "set PHASE=A|B|C|D");

  // ---------- A and B: the OLD app ----------
  test("A/B: old app, customer writes (valid, same VIN twice, lower-case VIN, no VIN, list)", async ({ browser }) => {
    test.skip(PHASE !== "A" && PHASE !== "B");
    const ctx = await browser.newContext(); const page = await ctx.newPage();
    const email = await signUpNewUser(page); const id = uid(email);
    const v1 = validVin("1FT"); const v2 = validVin("1FT");
    const r: Record<string, unknown> = {};
    r.valid = await status(await addCustom(page, v1));
    r.sameVinTwice = await status(await addCustom(page, v1));
    r.lowerCase = await status(await addCustom(page, v2.toLowerCase()));
    r.noVin = await status(await page.request.post("/api/garage", { data: { kind: "custom", custom: { year: "2015", make: "Ford", model: "Ranger" } } }));
    r.list = await status(await page.request.get("/api/garage"));
    r.rowsForV1 = sql(`select count(*) from garage_entries where user_id='${id}' and upper(vin)='${v1}'`);
    r.storedLowerVin = sql(`select vin from garage_entries where user_id='${id}' and upper(vin)='${v2}'`);
    out.customerWrites = r;
    const s = load(); s[`c1_${PHASE}`] = email; s[`c1_${PHASE}_vin`] = v1; save(s);
    expect([r.valid, r.sameVinTwice, r.lowerCase, r.noVin, r.list]).toEqual([200, 200, 200, 200, 200]);
    await ctx.close();
  });

  test("B: historical unlocks written by the OLD admin survive the OLD app deleting the cars", async ({ browser }) => {
    test.skip(PHASE !== "B");
    const ca = await browser.newContext(); const adminPage = await ca.newPage(); const adminEmail = await makeAdmin(adminPage);
    const ch = await browser.newContext(); const cust = await ch.newPage(); const hEmail = await signUpNewUser(cust); const hid = uid(hEmail);
    const gVin = validVin("1FT"), g2Vin = validVin("1FT");
    for (const v of [gVin, g2Vin]) expect((await addCustom(cust, v)).status()).toBe(200);
    expect((await cust.request.post("/api/garage", { data: { kind: "custom", custom: { year: "2012", make: "Ford", model: "Focus" } } })).status()).toBe(200);
    expect((await cust.request.post("/api/garage", { data: { kind: "custom", custom: { vin: "NOT-A-REAL-VIN", year: "2011", make: "Ford", model: "Fiesta" } } })).status()).toBe(200);
    const G = rowFor(hid, gVin), G2 = rowFor(hid, g2Vin), P = rowFor(hid, null), J = rowFor(hid, "NOT-A-REAL-VIN");
    // G and G2: gifted by the OLD admin screen (writes vehicle_unlocks); P (VIN-less) was bought; J has a junk VIN and was gifted.
    expect((await adminGift(adminPage, hid, G)).status()).toBe(303);
    expect((await adminGift(adminPage, hid, G2)).status()).toBe(303);
    sql(`insert into vehicle_unlocks(user_id,garage_entry_id,source) values ('${hid}','${P}','purchase'),('${hid}','${J}','gift')`);
    out.legacyUnlocksBefore = sql(`select count(*) from vehicle_unlocks where user_id='${hid}'`);
    // the OLD app deletes G, P and J (G2 stays)
    const list = (await (await cust.request.get("/api/garage")).json()).entries as Entry[];
    const idOf = (pred: (e: Entry) => boolean) => { const f = list.find(pred); if (!f) throw new Error("no match in " + JSON.stringify(list)); return f.id; };
    for (const gid of [idOf((e) => vinOf(e) === gVin), idOf((e) => !vinOf(e) && modelOf(e) === "Focus"), idOf((e) => vinOf(e) === "NOT-A-REAL-VIN")])
      expect((await cust.request.delete(`/api/garage/${enc(gid)}`)).status(), "old app delete").toBe(200);
    out.afterOldDeletes = {
      holds: sql(`select source||':'||status from legacy_unlock_holds where user_id='${hid}' order by 1`),
      remainingLegacyUnlocks: sql(`select count(*) from vehicle_unlocks where user_id='${hid}'`),
      entitlements: sql(`select count(*) from vin_entitlements where user_id='${hid}'`),
    };
    expect(out.afterOldDeletes).toMatchObject({ holds: "gift:pending_vin\ngift:pending_vin\npurchase:pending_vin", remainingLegacyUnlocks: "1" });
    const s = load(); Object.assign(s, { admin: adminEmail, h: hEmail, hId: hid, gVin, g2Vin, G, G2, P, J }); save(s);
    await ca.close(); await ch.close();
  });

  // ---------- C: the NEW app on in-window data ----------
  test("C: new app serves accounts that hold in-window duplicates and lower-case history; reconciliation of every kind of unlock", async ({ browser }) => {
    test.skip(PHASE !== "C");
    const s = load();
    const c1 = await browser.newContext(); const p1 = await c1.newPage(); await login(p1, s.c1_B);
    const r: Record<string, unknown> = {};
    r.listWithInWindowDuplicates = await status(await p1.request.get("/api/garage"));
    r.rowsForV1 = sql(`select count(*) from garage_entries where user_id='${uid(s.c1_B)}' and vin='${s.c1_B_vin}'`);
    r.addNewValid = await status(await addCustom(p1, validVin("1FT")));
    r.addSameVinAgain = await status(await addCustom(p1, s.c1_B_vin));
    r.addLowerCase = await status(await addCustom(p1, validVin("1FT").toLowerCase()));
    out.customerWrites = r;
    expect(r.listWithInWindowDuplicates).toBe(200);
    for (const k of ["addNewValid", "addSameVinAgain", "addLowerCase"]) expect(r[k] as number, k).toBeLessThan(500);
    await c1.close();

    // the straggler gift (G2 still in vehicle_unlocks) was carried by the post-deploy M3 re-run
    const ch = await browser.newContext(); const h = await ch.newPage(); await login(h, s.h);
    const g2 = (await (await h.request.get("/api/garage")).json()).entries.find((e: Entry) => vinOf(e) === s.g2Vin).id;
    const keys = await (await h.request.get(`/api/garage/${enc(g2)}/keys`)).json();
    const co = await (await h.request.get(`/api/garage/${enc(g2)}/keys/checkout`)).json();
    out.stragglerGift = { unlocked: keys.unlocked, checkout: co };
    expect(keys.unlocked).toBe(true);
    expect(co).toMatchObject({ eligible: false, reason: "already-unlocked" });

    // admin sees the three holds, restores the PAID one, waives the junk-VIN gift with a reason; nothing is deleted
    const ca = await browser.newContext(); const a = await ca.newPage(); await login(a, s.admin);
    await a.goto(`/admin/users/${s.hId}?tab=garage`);
    await expect(a.getByTestId("legacy-hold")).toHaveCount(3);
    const holds = sql(`select id||'|'||source||'|'||coalesce(vin_at_snapshot,'-') from legacy_unlock_holds where user_id='${s.hId}' order by source, coalesce(vin_at_snapshot,'')`).split("\n");
    const paid = holds.find((x) => x.includes("|purchase|"))!.split("|")[0];
    const junk = holds.find((x) => x.includes("NOT-A-REAL-VIN"))!.split("|")[0];
    const gHold = holds.find((x) => x.includes(`|gift|${s.gVin}`))!.split("|")[0];
    const restoredVin = validVin("1FT");
    const pr = await a.request.post("/api/admin/legacy-holds", { form: { holdId: paid, userId: s.hId, action: "convert", vin: restoredVin, reason: "verified receipt (rehearsal)" }, maxRedirects: 0 });
    const gr = await a.request.post("/api/admin/legacy-holds", { form: { holdId: gHold, userId: s.hId, action: "convert", reason: "restore gift (rehearsal)" }, maxRedirects: 0 });
    const jr = await a.request.post("/api/admin/legacy-holds", { form: { holdId: junk, userId: s.hId, action: "waive", reason: "junk VIN, customer asked to drop it (rehearsal)" }, maxRedirects: 0 });
    expect([pr.status(), gr.status(), jr.status()]).toEqual([303, 303, 303]);
    out.reconcile = {
      holdsStillPresent: sql(`select count(*) from legacy_unlock_holds where user_id='${s.hId}'`),
      holdStatus: sql(`select source||':'||status from legacy_unlock_holds where user_id='${s.hId}' order by 1`),
      paidEntitlement: sql(`select source||'|'||vin||'|'||(revoked_at is null) from vin_entitlements where user_id='${s.hId}' and vin='${restoredVin}'`),
      paidEventLog: sql(`select event_type||':'||source||':'||actor_type||':'||coalesce(reason,'-') from vin_entitlement_events where user_id='${s.hId}' and vin='${restoredVin}'`),
      auditRows: sql(`select string_agg(action, ',' order by action) from admin_audit_log where action like 'legacy_hold.%' and metadata->>'userId'='${s.hId}'`),
    };
    expect(out.reconcile).toMatchObject({ holdsStillPresent: "3", holdStatus: "gift:converted\ngift:waived\npurchase:converted" });
    expect((out.reconcile as { paidEntitlement: string }).paidEntitlement).toBe(`purchase|${restoredVin}|true`);
    // a resolved hold cannot be reopened
    const again = await a.request.post("/api/admin/legacy-holds", { form: { holdId: paid, userId: s.hId, action: "waive", reason: "second try" }, maxRedirects: 0 });
    expect(again.status()).toBe(400);
    s.restoredVin = restoredVin; save(s);
    await ch.close(); await ca.close();
  });

  // ---------- D: final schema ----------
  test("D: new app on the final schema: constraints are real, deletes keep entitlements, history intact", async ({ browser }) => {
    test.skip(PHASE !== "D");
    const s = load();
    const c = await browser.newContext(); const p = await c.newPage(); const email = await signUpNewUser(p); const id = uid(email);
    const v = validVin("1FT"); const r: Record<string, unknown> = {};
    r.valid = await status(await addCustom(p, v));
    r.sameVinAgain = await status(await addCustom(p, v));
    r.lowerCaseOfSameVin = await status(await addCustom(p, v.toLowerCase()));
    r.rowsForVin = sql(`select count(*) from garage_entries where user_id='${id}' and vin='${v}'`);
    r.rawLowerCaseInsert = sqlErr(`insert into garage_entries(id,user_id,kind,vin) values ('t-low','${id}','custom','abc')`).includes("garage_entries_vin_canonical_chk") ? "refused by CHECK" : "NOT REFUSED";
    r.rawDuplicateInsert = sqlErr(`insert into garage_entries(id,user_id,kind,vin) values ('t-dup','${id}','custom','${v}')`).includes("garage_entries_user_vin_uq") ? "refused by unique index" : "NOT REFUSED";
    out.constraintsLive = r;
    expect(r.rowsForVin).toBe("1");
    expect(r.rawLowerCaseInsert).toBe("refused by CHECK");
    expect(r.rawDuplicateInsert).toBe("refused by unique index");
    for (const k of ["valid", "sameVinAgain", "lowerCaseOfSameVin"]) expect(r[k] as number, k).toBeLessThan(500);

    // delete a car that holds an entitlement (G2, gifted before deploy and carried over): access survives, re-add restores it
    const ch = await browser.newContext(); const h = await ch.newPage(); await login(h, s.h);
    const g2 = (await (await h.request.get("/api/garage")).json()).entries.find((e: Entry) => vinOf(e) === s.g2Vin).id;
    expect((await h.request.delete(`/api/garage/${enc(g2)}`)).status()).toBe(200);
    out.afterNewAppDelete = {
      g2Entitlement: sql(`select source||'|'||(revoked_at is null) from vin_entitlements where user_id='${s.hId}' and vin='${s.g2Vin}'`),
      holds: sql(`select count(*) from legacy_unlock_holds where user_id='${s.hId}'`),
      paidEntitlement: sql(`select source||'|'||(revoked_at is null) from vin_entitlements where user_id='${s.hId}' and vin='${s.restoredVin}'`),
    };
    expect(out.afterNewAppDelete).toEqual({ g2Entitlement: "gift|true", holds: "3", paidEntitlement: "purchase|true" });
    const again = await h.request.post("/api/garage", { data: { kind: "custom", custom: { vin: s.g2Vin, year: "2015", make: "Ford", model: "F-150" }, config: CFG } });
    expect(again.status()).toBe(200);
    const id2 = (await again.json()).entry.id;
    expect((await (await h.request.get(`/api/garage/${enc(id2)}/keys`)).json()).unlocked).toBe(true);
    // the append-only history still shows every grant
    out.historyEvents = sql(`select count(*) from vin_entitlement_events where user_id='${s.hId}'`);
    await c.close(); await ch.close();
  });
});
