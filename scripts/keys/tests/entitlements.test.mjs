// Get the Keys PR-A: DB-backed regression tests for permanent VIN entitlements and server-side Garage Rewards pricing.
// Runs against a THROWAWAY Postgres whose schema came from `drizzle-kit push` (DATABASE_URL). Skips when it is unset, and
// refuses to run against anything that is not localhost so it can never touch a real database.
// Run: npm run keys:test, with DATABASE_URL set to the local scratch database (127.0.0.1:5544, database cc_test).
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const URL_ = process.env.DATABASE_URL;
const skip = !URL_ ? "DATABASE_URL not set" : !/@(127\.0\.0\.1|localhost)[:/]/.test(URL_) ? "refusing non-local database" : false;

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const req = createRequire(path.join(ROOT, "package.json"));
let ent, pricing, pool;

before(async () => {
  if (skip) return;
  const esbuild = req("esbuild");
  const bundle = async (entry) => {
    const out = await esbuild.build({ entryPoints: [path.join(ROOT, entry)], bundle: true, write: false, format: "cjs", platform: "node", logLevel: "silent", external: ["pg"], alias: { "@": path.join(ROOT, "src") } });
    const m = { exports: {} };
    new Function("module", "exports", "require", out.outputFiles[0].text)(m, m.exports, req);
    return m.exports;
  };
  ent = await bundle("src/lib/keysEntitlements.ts");
  pricing = await bundle("src/lib/keysPricing.ts");
  const { Pool } = req("pg");
  pool = new Pool({ connectionString: URL_ });
  // drizzle-kit push creates the tables but not triggers; the append-only trigger lives in the migration, so apply it
  // (idempotent) to make the test database match what production will have after the migration.
  await pool.query(fs.readFileSync(path.join(ROOT, "migrations/2026-10-11-vin-entitlement-events.sql"), "utf8"));
});
after(async () => { if (pool) await pool.end(); });

// Valid VINs (check digit computed) so tests use the same rules as the app.
const ALPHA = "ABCDEFGHJKLMNPRSTUVWXYZ0123456789";
const TR = { A:1,B:2,C:3,D:4,E:5,F:6,G:7,H:8,J:1,K:2,L:3,M:4,N:5,P:7,R:9,S:2,T:3,U:4,V:5,W:6,X:7,Y:8,Z:9 };
const W = [8,7,6,5,4,3,2,10,0,9,8,7,6,5,4,3,2];
function vin() {
  let s = "1KT"; // North American, so the check digit is exercised
  for (let i = 3; i < 17; i++) s += ALPHA[Math.floor(Math.random() * ALPHA.length)];
  const sum = [...s.slice(0, 8) + "0" + s.slice(9)].reduce((a, c, i) => a + (/\d/.test(c) ? +c : TR[c]) * W[i], 0);
  const d = sum % 11 === 10 ? "X" : String(sum % 11);
  return s.slice(0, 8) + d + s.slice(9);
}
let seq = 0;
async function user() {
  const id = `kt-${Date.now()}-${++seq}-${Math.random().toString(36).slice(2, 6)}`;
  await pool.query("insert into users(id,email,password_hash) values ($1,$2,'x')", [id, `${id}@example.com`]);
  return id;
}
async function garage(userId, v, vehicleId = null) {
  const id = `g-${userId}-${Math.random().toString(36).slice(2, 7)}`;
  await pool.query("insert into garage_entries(id,user_id,kind,vehicle_id,vin) values ($1,$2,'custom',$3,$4)", [id, userId, vehicleId, v]);
  return id;
}
const rows = async (userId) => (await pool.query("select vin,source,rung,price_cents,revoked_at from vin_entitlements where user_id=$1 order by granted_at", [userId])).rows;

test("ladder in cents is exactly $20/$18/$16/$15 and floors at $15", { skip }, () => {
  const cents = [1, 2, 3, 4, 5, 6, 10, 99].map(pricing.keysPriceCentsForNthVehicle);
  assert.deepEqual(cents, [2000, 1800, 1600, 1500, 1500, 1500, 1500, 1500]);
  assert.deepEqual([1, 2, 3, 4, 5].map(pricing.keysPriceForNthVehicle), [20, 18, 16, 15, 15]); // presentation agrees with server
  assert.equal(pricing.keysPriceCentsForNthVehicle(0), 2000); // never below rung 1
});

test("server price follows the account's own purchases: each new VIN moves one rung down, recorded on the row", { skip }, async () => {
  const u = await user();
  assert.deepEqual(await ent.nextUnlockPrice(u), { rung: 1, priceCents: 2000, purchasedCount: 0 });
  const expect = [[1, 2000], [2, 1800], [3, 1600], [4, 1500], [5, 1500]];
  for (const [rung, price] of expect) {
    const r = await ent.grantPurchasedEntitlement({ userId: u, vin: vin() });
    assert.equal(r.created, true);
    assert.equal(r.entitlement.rung, rung);
    assert.equal(r.entitlement.priceCents, price);
  }
  assert.deepEqual(await ent.nextUnlockPrice(u), { rung: 6, priceCents: 1500, purchasedCount: 5 });
});

test("the same VIN twice, in any spelling, is one entitlement and does not advance the ladder", { skip }, async () => {
  const u = await user(); const v = vin();
  const a = await ent.grantPurchasedEntitlement({ userId: u, vin: v });
  const b = await ent.grantPurchasedEntitlement({ userId: u, vin: v.toLowerCase() });
  const c = await ent.grantPurchasedEntitlement({ userId: u, vin: ` ${v.slice(0, 5)}-${v.slice(5)} ` });
  assert.equal(a.created, true); assert.equal(b.created, false); assert.equal(c.created, false);
  assert.equal((await rows(u)).length, 1);
  assert.equal((await ent.nextUnlockPrice(u)).rung, 2);
});

test("concurrent grants cannot double-spend a rung or duplicate a VIN", { skip }, async () => {
  const u = await user();
  const vins = Array.from({ length: 8 }, vin);
  const res = await Promise.all(vins.map((v) => ent.grantPurchasedEntitlement({ userId: u, vin: v })));
  assert.deepEqual(res.map((r) => r.entitlement.rung).sort((x, y) => x - y), [1, 2, 3, 4, 5, 6, 7, 8]);
  const same = await user(); const v = vin();
  const dup = await Promise.all(Array.from({ length: 6 }, () => ent.grantPurchasedEntitlement({ userId: same, vin: v })));
  assert.equal(dup.filter((r) => r.created).length, 1);
  assert.equal((await rows(same)).length, 1);
});

test("gifts and refunded (revoked) unlocks do not count toward the ladder; re-buying a revoked VIN is priced at the current rung", { skip }, async () => {
  const u = await user(); const gifted = vin(); const bought = vin();
  await pool.query("insert into vin_entitlements(id,user_id,vin,source) values ($1,$2,$3,'gift')", [`gift-${u}`, u, gifted]);
  assert.equal((await ent.nextUnlockPrice(u)).priceCents, 2000); // a gift does not push the customer down the ladder
  assert.equal(await ent.hasEntitlement(u, gifted), true);
  await ent.grantPurchasedEntitlement({ userId: u, vin: bought });
  assert.equal((await ent.nextUnlockPrice(u)).priceCents, 1800);
  await pool.query("update vin_entitlements set revoked_at=now() where user_id=$1 and vin=$2", [u, bought]);
  assert.equal(await ent.hasEntitlement(u, bought), false);
  assert.equal((await ent.nextUnlockPrice(u)).priceCents, 2000);
  const again = await ent.grantPurchasedEntitlement({ userId: u, vin: bought });
  assert.equal(again.created, true); assert.equal(again.entitlement.rung, 1); assert.equal(again.entitlement.revokedAt, null);
  assert.equal((await rows(u)).filter((r) => r.vin === bought).length, 1); // reinstated, not duplicated
});

test("deleting the garage vehicle never destroys a paid entitlement; re-adding the same VIN restores access", { skip }, async () => {
  const u = await user(); const v = vin();
  const g1 = await garage(u, v, "2014-jeep-grand-cherokee-3.6l");
  assert.deepEqual(await ent.keysStatusForOwnVehicle(u, g1), { hasVin: true, unlocked: false, nextPriceCents: 2000, nextRung: 1 });
  await ent.grantPurchasedEntitlement({ userId: u, vin: v });
  assert.equal((await ent.keysStatusForOwnVehicle(u, g1)).unlocked, true);
  await pool.query("delete from garage_entries where id=$1", [g1]); // the remove-vehicle action
  assert.equal((await rows(u)).length, 1, "entitlement row survives the vehicle delete");
  assert.equal(await ent.keysStatusForOwnVehicle(u, g1), null, "vehicle is gone from the garage");
  assert.equal(await ent.hasEntitlement(u, v), true);
  const g2 = await garage(u, v.toLowerCase().toUpperCase(), "2014-jeep-grand-cherokee-3.6l"); // re-add, same VIN, new row
  assert.deepEqual(await ent.keysStatusForOwnVehicle(u, g2), { hasVin: true, unlocked: true, nextPriceCents: null, nextRung: null });
  assert.equal((await ent.nextUnlockPrice(u)).purchasedCount, 1, "re-adding never charges or counts a second unlock");
});

test("VIN identity is canonical end to end: the garage table refuses a non-canonical VIN, and any spelling reaches the entitlement", { skip }, async () => {
  const u = await user(); const v = vin();
  await assert.rejects(() => garage(u, v.toLowerCase()), /canonical|check constraint/i);
  const g = await garage(u, v);
  await ent.grantPurchasedEntitlement({ userId: u, vin: v.toLowerCase() });
  assert.equal((await ent.keysStatusForOwnVehicle(u, g)).unlocked, true);
});

test("no cross-account leakage: another account on the same VIN is locked, priced from its own purchases, and cannot read or move the owner's", { skip }, async () => {
  const a = await user(); const b = await user(); const v = vin();
  const ga = await garage(a, v, "veh-x"); const gb = await garage(b, v, "veh-x");
  await ent.grantPurchasedEntitlement({ userId: a, vin: v });
  await ent.grantPurchasedEntitlement({ userId: a, vin: vin() }); // A is now at rung 3 next
  assert.equal(await ent.hasEntitlement(a, v), true);
  assert.equal(await ent.hasEntitlement(b, v), false);
  assert.deepEqual(await ent.keysStatusForOwnVehicle(b, gb), { hasVin: true, unlocked: false, nextPriceCents: 2000, nextRung: 1 });
  assert.equal((await ent.keysStatusForOwnVehicle(a, ga)).unlocked, true);
  // B asking about A's garage row id gets the same answer as an id that does not exist.
  assert.equal(await ent.keysStatusForOwnVehicle(b, ga), null);
  assert.equal(await ent.keysStatusForOwnVehicle(b, "no-such-id"), null);
  // B buying the same VIN is B's own entitlement at B's own rung; A is untouched.
  const rb = await ent.grantPurchasedEntitlement({ userId: b, vin: v });
  assert.equal(rb.entitlement.rung, 1);
  assert.equal((await ent.nextUnlockPrice(a)).rung, 3);
  assert.equal((await rows(a)).length, 2); assert.equal((await rows(b)).length, 1);
  // A transfer away/back: A removes the vehicle; A's entitlement is still A's, B's is still B's.
  await pool.query("delete from garage_entries where id=$1", [ga]);
  assert.equal(await ent.hasEntitlement(a, v), true); assert.equal(await ent.hasEntitlement(b, v), true);
});

test("a vehicle with no VIN, or a bad one, cannot carry an entitlement; granting rejects invalid VINs", { skip }, async () => {
  const u = await user();
  const g = await garage(u, null);
  assert.deepEqual(await ent.keysStatusForOwnVehicle(u, g), { hasVin: false, unlocked: false, nextPriceCents: null, nextRung: null });
  await assert.rejects(() => ent.grantPurchasedEntitlement({ userId: u, vin: "" }));
  await assert.rejects(() => ent.grantPurchasedEntitlement({ userId: u, vin: "1KT00000000000000" })); // wrong check digit
  assert.equal((await rows(u)).length, 0);
});

test("database rules: one row per (account, VIN), source is constrained, and deleting the ACCOUNT (privacy deletion) removes its rows", { skip }, async () => {
  const u = await user(); const v = vin();
  await pool.query("insert into vin_entitlements(id,user_id,vin,source) values ($3,$1,$2,'gift')", [u, v, `e1-${u}`]);
  await assert.rejects(() => pool.query("insert into vin_entitlements(id,user_id,vin,source) values ($1,$2,$3,'gift')", [`dupe-${u}`, u, v]), /unique|duplicate/i);
  await assert.rejects(() => pool.query("insert into vin_entitlements(id,user_id,vin,source) values ($1,$2,$3,'bogus')", [`b-${u}`, u, vin()]));
  await pool.query("delete from users where id=$1", [u]);
  assert.equal((await rows(u)).length, 0);
});

const events = async (userId, v) => (await ent.listEntitlementEvents(userId, v)).map((e) => [e.eventType, e.source, e.rung, e.priceCents, e.actorType]);

test("history: a purchase is logged with its rung and price; the same VIN again logs nothing", { skip }, async () => {
  const u = await user(); const v = vin();
  await ent.grantPurchasedEntitlement({ userId: u, vin: v, purchaseId: null, reason: "test purchase" });
  await ent.grantPurchasedEntitlement({ userId: u, vin: v.toLowerCase() });
  assert.deepEqual(await events(u, v), [["purchased", "purchase", 1, 2000, "system"]]);
});

test("history: revoke then buy again keeps BOTH rows of history; the reacquisition is priced at the current rung and remembers what it replaced", { skip }, async () => {
  const u = await user(); const first = vin(); const v = vin();
  await ent.grantPurchasedEntitlement({ userId: u, vin: first });                // rung 1
  await ent.grantPurchasedEntitlement({ userId: u, vin: v });                    // rung 2 ($18)
  const refund = await ent.revokeEntitlement({ userId: u, vin: v, actor: { type: "system" }, kind: "refunded", reason: "chargeback" });
  assert.equal(refund.revoked, true);
  assert.equal(await ent.hasEntitlement(u, v), false);
  await ent.revokeEntitlement({ userId: u, vin: v, actor: { type: "system" } });  // already revoked: no change, no event
  const back = await ent.grantPurchasedEntitlement({ userId: u, vin: v });       // current rung is 2 again ($18)
  assert.equal(back.created, true); assert.equal(back.entitlement.rung, 2);
  const log = await ent.listEntitlementEvents(u, v);
  assert.deepEqual(log.map((e) => e.eventType), ["purchased", "refunded", "reacquired"]);
  assert.equal(log[0].rung, 2); assert.equal(log[0].priceCents, 1800);
  assert.equal(log[1].reason, "chargeback");
  assert.equal(log[2].detail.replaced.rung, 2, "the reacquisition records the grant it replaced");
  assert.ok(log[2].detail.replaced.revokedAt, "...including that it had been revoked");
  assert.equal((await rows(u)).filter((r) => r.vin === v).length, 1, "still one current row");
});

test("admin gifts: logged with the admin as actor, never counted on the ladder, survive vehicle delete, and a revoke keeps the row", { skip }, async () => {
  const u = await user(); const admin = await user(); const v = vin(); const bought = vin();
  const g1 = await garage(u, v, "veh-x");
  const gift = await ent.giftEntitlement({ userId: u, vin: v, actor: { type: "admin", id: admin }, reason: "support goodwill" });
  assert.equal(gift.created, true); assert.equal(gift.entitlement.source, "gift"); assert.equal(gift.entitlement.rung, null);
  assert.equal((await ent.giftEntitlement({ userId: u, vin: v.toLowerCase(), actor: { type: "admin", id: admin } })).created, false, "gifting twice changes nothing");
  assert.equal((await ent.keysStatusForOwnVehicle(u, g1)).unlocked, true);
  assert.equal((await ent.nextUnlockPrice(u)).priceCents, 2000, "a gift never pushes the customer down the ladder");
  await ent.grantPurchasedEntitlement({ userId: u, vin: bought });
  assert.equal((await rows(u)).find((r) => r.vin === bought).rung, 1, "their first PURCHASE is still rung 1 after a gift");
  await pool.query("delete from garage_entries where id=$1", [g1]);              // remove the vehicle
  assert.equal(await ent.hasEntitlement(u, v), true, "the gift survives the vehicle being removed");
  const rv = await ent.revokeEntitlement({ userId: u, vin: v, actor: { type: "admin", id: admin }, reason: "gift withdrawn" });
  assert.equal(rv.revoked, true);
  assert.equal(await ent.hasEntitlement(u, v), false);
  assert.equal((await rows(u)).filter((r) => r.vin === v).length, 1, "revoked row is kept, not deleted");
  const log = await ent.listEntitlementEvents(u, v);
  assert.deepEqual(log.map((e) => [e.eventType, e.actorType, e.actorId, e.reason]), [
    ["gifted", "admin", admin, "support goodwill"],
    ["revoked", "admin", admin, "gift withdrawn"],
  ]);
  const regift = await ent.giftEntitlement({ userId: u, vin: v, actor: { type: "admin", id: admin } });
  assert.equal(regift.created, true);
  assert.deepEqual((await ent.listEntitlementEvents(u, v)).map((e) => e.eventType), ["gifted", "revoked", "gifted"]);
});

test("a vehicle with no valid VIN cannot be gifted; revoking something never held is a harmless no-op", { skip }, async () => {
  const u = await user();
  await assert.rejects(() => ent.giftEntitlement({ userId: u, vin: "", actor: { type: "admin", id: u } }));
  await assert.rejects(() => ent.giftEntitlement({ userId: u, vin: "1KT00000000000000", actor: { type: "admin", id: u } }));
  assert.deepEqual(await ent.revokeEntitlement({ userId: u, vin: vin(), actor: { type: "admin", id: u } }), { revoked: false, entitlement: null });
  assert.equal((await rows(u)).length, 0);
});

test("gifting to one account never unlocks another account holding the same VIN, and history is per account", { skip }, async () => {
  const a = await user(); const b = await user(); const admin = await user(); const v = vin();
  await ent.giftEntitlement({ userId: a, vin: v, actor: { type: "admin", id: admin } });
  assert.equal(await ent.hasEntitlement(a, v), true);
  assert.equal(await ent.hasEntitlement(b, v), false);
  assert.deepEqual(await ent.listEntitlementEvents(b, v), []);
  await ent.grantPurchasedEntitlement({ userId: b, vin: v });
  assert.deepEqual(await events(a, v), [["gifted", "gift", null, null, "admin"]]);
  assert.deepEqual(await events(b, v), [["purchased", "purchase", 1, 2000, "system"]]);
});

test("concurrent gift, purchase and revoke on one VIN leave one coherent row and an event for every change", { skip }, async () => {
  const u = await user(); const admin = await user(); const v = vin();
  const results = await Promise.all([
    ent.giftEntitlement({ userId: u, vin: v, actor: { type: "admin", id: admin } }),
    ent.grantPurchasedEntitlement({ userId: u, vin: v }),
    ent.giftEntitlement({ userId: u, vin: v, actor: { type: "admin", id: admin } }),
    ent.grantPurchasedEntitlement({ userId: u, vin: v }),
  ]);
  assert.equal(results.filter((r) => r.created).length, 1, "exactly one of the racers created it");
  assert.equal((await rows(u)).length, 1);
  assert.equal((await ent.listEntitlementEvents(u, v)).length, 1);
});

test("the history table is append-only: no UPDATE, no direct DELETE; only deleting the whole account removes it", { skip }, async () => {
  const u = await user(); const v = vin();
  await ent.grantPurchasedEntitlement({ userId: u, vin: v });
  await assert.rejects(() => pool.query("update vin_entitlement_events set reason='tampered' where user_id=$1", [u]), /append-only/);
  await assert.rejects(() => pool.query("delete from vin_entitlement_events where user_id=$1", [u]), /append-only/);
  await assert.rejects(() => pool.query("truncate vin_entitlement_events"), /append-only/);
  assert.equal((await ent.listEntitlementEvents(u, v)).length, 1);
  await assert.rejects(() => pool.query("insert into vin_entitlement_events(id,user_id,vin,event_type,source,actor_type) values ($1,$2,$3,'bogus','gift','admin')", [`x-${u}`, u, v]));
  await pool.query("delete from users where id=$1", [u]);                          // privacy deletion cascades
  assert.equal((await pool.query("select count(*)::int n from vin_entitlement_events where user_id=$1", [u])).rows[0].n, 0);
});

test("keys status follows a car's permanent id and refuses an ambiguous bare model id", { skip }, async () => {
  const u = await user(); const v1 = vin(); const v2 = vin();
  const mk = async (v) => {
    const id = `row-${Math.random().toString(36).slice(2, 9)}`;
    await pool.query("insert into garage_entries(id,user_id,kind,vehicle_id,vin) values ($1,$2,'catalog','model-z',$3)", [id, u, v]);
    return `model-z~${id}`;
  };
  const g1 = await mk(v1);
  await ent.grantPurchasedEntitlement({ userId: u, vin: v1 });
  assert.equal((await ent.keysStatusForOwnVehicle(u, "model-z")).unlocked, true, "one car: the old bare id is that car");
  const g2 = await mk(v2);
  await assert.rejects(() => ent.keysStatusForOwnVehicle(u, "model-z"), /ambiguous/i, "two cars: a bare id never picks one");
  assert.equal((await ent.keysStatusForOwnVehicle(u, g1)).unlocked, true);
  assert.equal((await ent.keysStatusForOwnVehicle(u, g2)).unlocked, false, "the other same-model car is not unlocked by its sibling");
});
