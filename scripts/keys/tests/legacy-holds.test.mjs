// Legacy unlock holds + checkout eligibility: DB-backed permanent regression tests.
// "No historical purchase or gift may be silently dropped": a legacy admin unlock (old vehicle_unlocks table, deleted with its garage
// row) must end up as a VIN entitlement or as a preserved hold, whatever the car's VIN looks like and whenever the car is deleted.
// Runs against a THROWAWAY local Postgres (schema from `drizzle-kit push`, then the real migration files applied here, exactly as
// production will get them). Skips when DATABASE_URL is unset; refuses any non-local database.
// Run: npm run keys:test with DATABASE_URL pointed at 127.0.0.1:5544 (database cc_test).
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
let ent, vinLib, pool;
const sqlFile = (f) => fs.readFileSync(path.join(ROOT, "migrations", f), "utf8");
const MIGRATIONS = ["2026-10-11-vin-entitlements.sql", "2026-10-11-vin-entitlement-events.sql", "2026-10-12-legacy-unlock-holds.sql"];

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
  vinLib = await bundle("src/lib/vin.ts");
  const { Pool } = req("pg");
  pool = new Pool({ connectionString: URL_ });
  for (const f of MIGRATIONS) await pool.query(sqlFile(f)); // all idempotent
});
after(async () => { if (pool) await pool.end(); });

const ALPHA = "ABCDEFGHJKLMNPRSTUVWXYZ0123456789";
const TR = { A:1,B:2,C:3,D:4,E:5,F:6,G:7,H:8,J:1,K:2,L:3,M:4,N:5,P:7,R:9,S:2,T:3,U:4,V:5,W:6,X:7,Y:8,Z:9 };
const W = [8,7,6,5,4,3,2,10,0,9,8,7,6,5,4,3,2];
const fixCheck = (s) => {
  const sum = [...s.slice(0, 8) + "0" + s.slice(9)].reduce((a, c, i) => a + (/\d/.test(c) ? +c : TR[c]) * W[i], 0);
  return s.slice(0, 8) + (sum % 11 === 10 ? "X" : String(sum % 11)) + s.slice(9);
};
function vin() {
  let s = "1HG";
  for (let i = 3; i < 17; i++) s += ALPHA[Math.floor(Math.random() * ALPHA.length)];
  return fixCheck(s);
}
let seq = 0;
const uid = () => `lh-${Date.now()}-${++seq}-${Math.random().toString(36).slice(2, 6)}`;
async function user() {
  const id = uid();
  await pool.query("insert into users(id,email,password_hash) values ($1,$2,'x')", [id, `${id}@example.com`]);
  return id;
}
async function car(userId, v, label = ["2010", "BMW", "328i"]) {
  const id = `g-${uid()}`;
  await pool.query("insert into garage_entries(id,user_id,kind,vehicle_id,year,make,model,vin) values ($1,$2,'custom',null,$3,$4,$5,$6)", [id, userId, ...label, v]);
  return id;
}
const unlock = (userId, garageId, source = "gift", daysAgo = 30) =>
  pool.query("insert into vehicle_unlocks(user_id,garage_entry_id,source,granted_at) values ($1,$2,$3, now() - ($4 || ' days')::interval)", [userId, garageId, source, String(daysAgo)]);
const holds = async (u) => (await pool.query("select * from legacy_unlock_holds where user_id=$1 order by granted_at", [u])).rows;
const ents = async (u) => (await pool.query("select vin,source,rung,price_cents,granted_at,revoked_at from vin_entitlements where user_id=$1 order by granted_at", [u])).rows;
const events = async (u) => (await pool.query("select event_type,source,actor_type,reason from vin_entitlement_events where user_id=$1 order by created_at", [u])).rows;
const runSnapshot = async () => { await pool.query(sqlFile("2026-10-11-vin-entitlements.sql")); await pool.query(sqlFile("2026-10-12-legacy-unlock-holds.sql")); };
const unaccounted = async (u) =>
  (await pool.query(
    `select count(*)::int n from vehicle_unlocks x join garage_entries g on g.id = x.garage_entry_id
     where x.user_id=$1 and x.source in ('purchase','gift')
       and not exists (select 1 from legacy_unlock_holds h where h.user_id = x.user_id and h.garage_entry_id = x.garage_entry_id)
       and not (cc_vin_ok(g.vin) and g.vin = upper(regexp_replace(g.vin,'[\\s\\-_.]','','g'))
                and exists (select 1 from vin_entitlements e where e.user_id = x.user_id and e.vin = g.vin))`,
    [u],
  )).rows[0].n;
// A LegacyHoldError carries a short code; a Postgres error carries its message (its code is just P0001).
const code = async (p) => { try { await p; return null; } catch (e) { return e.name === "LegacyHoldError" ? e.code : e.message; } };

test("the SQL VIN check (cc_vin_ok) agrees with the app's validator on 3000 generated strings", { skip }, async () => {
  const out = [];
  for (let i = 0; i < 1000; i++) out.push(vin());
  for (let i = 0; i < 1000; i++) { const v = vin(); const bad = "0123456789X"[Math.floor(Math.random() * 11)]; out.push(v.slice(0, 8) + (bad === v[8] ? "Z" : bad) + v.slice(9)); }
  for (let i = 0; i < 1000; i++) {
    const v = vin(); const m = i % 6;
    out.push(m === 0 ? v.toLowerCase() : m === 1 ? v.slice(0, 5) + " " + v.slice(5, 11) + "-" + v.slice(11) : m === 2 ? v.slice(0, 16) : m === 3 ? "VIN" + String(i).padStart(14, "0") : m === 4 ? v.slice(0, 3) + "I" + v.slice(4) : "");
  }
  const { rows } = await pool.query("select s, cc_vin_ok(s) ok from unnest($1::text[]) s", [out]);
  const disagree = rows.filter((r) => r.ok !== vinLib.isValidVin(vinLib.canonicalVin(r.s)));
  assert.equal(disagree.length, 0, `disagreements: ${JSON.stringify(disagree.slice(0, 3))}`);
  assert.ok(rows.filter((r) => r.ok).length > 1200, "the sample really contains valid VINs, including lower-case and spaced spellings");
});

test("every kind of legacy unlock ends up as an entitlement or a preserved hold, with its source and original grant time (nothing unaccounted)", { skip }, async () => {
  const u = await user();
  const good = vin();
  const cases = {
    validGift: [good, "gift", 40],
    validPaid: [vin(), "purchase", 39],
    noVinGift: [null, "gift", 38],
    noVinPaid: [null, "purchase", 37],
    emptyVin: ["", "gift", 36],
    junk17: ["VIN00000000000010", "gift", 35],
    dashedValid: [(() => { const v = vin(); return v.slice(0, 5) + "-" + v.slice(5); })(), "gift", 34],
    badCheckDigit: [(() => { const v = vin(); return v.slice(0, 8) + (v[8] === "5" ? "6" : "5") + v.slice(9); })(), "purchase", 33],
  };
  const ids = {};
  for (const [k, [v, src, days]] of Object.entries(cases)) { ids[k] = await car(u, v); await unlock(u, ids[k], src, days); }
  await runSnapshot();

  assert.equal(await unaccounted(u), 0, "every legacy unlock is carried by an entitlement or a hold");
  const e = await ents(u); const h = await holds(u);
  assert.deepEqual(e.map((x) => x.source).sort(), ["gift", "purchase"], "only the two valid, canonical VINs became entitlements");
  assert.equal(h.length, 6);
  const byCar = Object.fromEntries(h.map((x) => [x.garage_entry_id, x]));
  for (const k of ["noVinGift", "noVinPaid", "emptyVin", "junk17", "dashedValid", "badCheckDigit"]) {
    assert.ok(byCar[ids[k]], `${k} is preserved as a hold`);
    assert.equal(byCar[ids[k]].source, cases[k][1], `${k}: original source kept (paid stays paid)`);
    assert.equal(byCar[ids[k]].status, "pending_vin");
    assert.equal(byCar[ids[k]].vin_at_snapshot, cases[k][0], `${k}: stored VIN kept verbatim`);
    assert.ok(Math.abs(new Date(byCar[ids[k]].granted_at) - (Date.now() - cases[k][2] * 86400000)) < 120000, `${k}: original grant time kept`);
  }
  assert.equal((await pool.query("select count(*)::int n from vehicle_unlocks where user_id=$1", [u])).rows[0].n, 8, "the old table is left exactly as it was");
  // Re-running changes nothing.
  await runSnapshot();
  assert.equal((await holds(u)).length, 6); assert.equal((await ents(u)).length, 2);
});

test("PERMANENT: deleting the garage vehicle can never make a historical gift or payment disappear, whatever its VIN and whenever it is deleted", { skip }, async () => {
  const u = await user();
  const makeCar = {
    "valid VIN, already copied": async () => vin(),
    "valid VIN, NOT yet copied (written by the old admin screen during the migration window)": async () => vin(),
    "no VIN": async () => null,
    "empty VIN": async () => "",
    "junk VIN": async () => "VIN00000000000099",
    "dashed VIN": async () => { const v = vin(); return v.slice(0, 6) + "-" + v.slice(6); },
  };
  for (const source of ["purchase", "gift"]) {
    for (const [name, mk] of Object.entries(makeCar)) {
      const v = await mk();
      const g = await car(u, v);
      await unlock(u, g, source, 12);
      if (name === "valid VIN, already copied") await runSnapshot();           // the migration ran; this one is an entitlement
      if (name === "no VIN") await runSnapshot();                              // the migration ran; this one is a hold already
      // other cases: the car is deleted BEFORE any snapshot or copy touches it (worst case: old code deleting during the window)
      await pool.query("delete from garage_entries where id=$1", [g]);         // the customer deletes the car
      const remainsAsEntitlement = v && vinLib.isValidVin(v) && v === vinLib.canonicalVin(v) && (await ents(u)).some((x) => x.vin === v && x.source === source);
      const remainsAsHold = (await holds(u)).some((x) => x.garage_entry_id === g && x.source === source && x.vin_at_snapshot === (v ?? null));
      assert.ok(remainsAsEntitlement || remainsAsHold, `${source} unlock on a car with ${name} survived the car being deleted`);
      assert.equal((await pool.query("select count(*)::int n from vehicle_unlocks where garage_entry_id=$1", [g])).rows[0].n, 0, "the old row did cascade away (that is the old behaviour); the record lives on elsewhere");
    }
  }
  const h = await holds(u); const e = await ents(u);
  assert.equal(h.filter((x) => x.source === "purchase").length + e.filter((x) => x.source === "purchase").length, 6, "all 6 paid unlocks are still on record");
  assert.equal(h.filter((x) => x.source === "gift").length + e.filter((x) => x.source === "gift").length, 6, "all 6 gifts are still on record");
});

test("a paid legacy unlock stored on a car whose VIN was valid all along is restorable without the customer after the car is deleted", { skip }, async () => {
  const u = await user(); const v = vin();
  const g = await car(u, v); await unlock(u, g, "purchase", 20);
  await pool.query("delete from garage_entries where id=$1", [g]);             // preserved by the trigger; no entitlement yet
  const [h] = await holds(u);
  assert.equal(h.vin_at_snapshot, v);
  const r = await ent.resolveLegacyHold({ holdId: h.id, userId: u, actor: { type: "admin", id: "admin-1" }, note: "window straggler" });
  assert.equal(r.created, true); assert.equal(r.entitlement.source, "purchase"); assert.equal(r.entitlement.rung, null);
  assert.equal((await pool.query("select e.granted_at = h.granted_at as same from vin_entitlements e, legacy_unlock_holds h where e.user_id=$1 and h.id=$2 and e.vin=$3", [u, h.id, v])).rows[0].same, true, "the ORIGINAL grant time is kept to the microsecond");
  assert.deepEqual((await events(u)).map((x) => [x.event_type, x.actor_type]), [["purchased", "admin"]]);
  assert.equal((await holds(u))[0].status, "converted");
  assert.equal(await unaccounted(u), 0);
});

test("holds are protected: facts cannot change, rows cannot be deleted or truncated, a resolved hold cannot be reopened; deleting the ACCOUNT still works", { skip }, async () => {
  const u = await user(); const g = await car(u, null); await unlock(u, g, "purchase"); await runSnapshot();
  const [h] = await holds(u);
  assert.match(await code(pool.query("update legacy_unlock_holds set source='gift' where id=$1", [h.id])), /original unlock facts/);
  assert.match(await code(pool.query("update legacy_unlock_holds set granted_at=now() where id=$1", [h.id])), /original unlock facts/);
  assert.match(await code(pool.query("update legacy_unlock_holds set vin_at_snapshot='X' where id=$1", [h.id])), /original unlock facts/);
  assert.match(await code(pool.query("delete from legacy_unlock_holds where id=$1", [h.id])), /cannot be deleted/);
  assert.match(await code(pool.query("truncate legacy_unlock_holds")), /cannot be truncated/);
  await pool.query("update legacy_unlock_holds set status='waived', resolved_by='a', resolution_note='test' where id=$1", [h.id]);
  assert.match(await code(pool.query("update legacy_unlock_holds set status='pending_vin' where id=$1", [h.id])), /cannot be reopened/);
  assert.equal((await holds(u)).length, 1);
  await pool.query("delete from users where id=$1", [u]);                      // privacy deletion of the whole account
  assert.equal((await pool.query("select count(*)::int n from legacy_unlock_holds where user_id=$1", [u])).rows[0].n, 0);
});

test("deleting a whole account with legacy unlocks does not fail and preserves nothing for that account (privacy deletion)", { skip }, async () => {
  const u = await user(); const g = await car(u, null); await unlock(u, g, "gift");
  await pool.query("delete from users where id=$1", [u]);
  assert.equal((await pool.query("select count(*)::int n from legacy_unlock_holds where user_id=$1", [u])).rows[0].n, 0);
});

test("customer completes the VIN: a gift held for that car is restored (original source and time), event says the customer did it", { skip }, async () => {
  const u = await user(); const g = await car(u, null); await unlock(u, g, "gift", 50); await runSnapshot();
  const v = vin();
  await pool.query("update garage_entries set vin=$1 where id=$2", [v, g]);       // what completeGarageVin does
  const r = await ent.reconcileHoldsForVehicle(u, g, v);
  assert.deepEqual(r, { restored: 1, needsReview: 0 });
  const e = await ents(u);
  assert.equal(e.length, 1); assert.equal(e[0].source, "gift"); assert.equal(e[0].vin, v);
  assert.ok(Math.abs(new Date(e[0].granted_at) - (Date.now() - 50 * 86400000)) < 120000);
  assert.deepEqual((await events(u)).map((x) => [x.event_type, x.actor_type]), [["gifted", "customer"]]);
  assert.equal((await holds(u))[0].status, "converted");
  assert.equal((await ent.nextUnlockPrice(u)).rung, 1, "a restored gift never moves the ladder");
  assert.equal((await ent.keysStatusForOwnVehicle(u, g)).unlocked, true);
  assert.deepEqual(await ent.reconcileHoldsForVehicle(u, g, v), { restored: 0, needsReview: 0 }, "second call changes nothing");
});

test("a PAID hold tied only to the car is NOT restored by whatever VIN the customer types: it waits for an admin; the same stored VIN restores it", { skip }, async () => {
  const u = await user(); const g = await car(u, null); await unlock(u, g, "purchase", 9); await runSnapshot();
  const v = vin();
  await pool.query("update garage_entries set vin=$1 where id=$2", [v, g]);
  assert.deepEqual(await ent.reconcileHoldsForVehicle(u, g, v), { restored: 0, needsReview: 1 });
  assert.equal((await ents(u)).length, 0, "no paid access is handed out on the customer's say-so");
  assert.equal((await holds(u))[0].status, "pending_vin", "and the hold is still there");
  assert.equal((await ent.checkoutEligibilityForOwnVehicle(u, g)).reason, "legacy-unlock-pending", "meanwhile the customer is not asked to pay again");
  // admin confirms
  const r = await ent.resolveLegacyHold({ holdId: (await holds(u))[0].id, userId: u, vin: v, actor: { type: "admin", id: "a1" }, note: "confirmed with customer by email" });
  assert.equal(r.entitlement.source, "purchase");
  // a paid hold whose stored VIN was valid and is typed again IS restored automatically
  const u2 = await user(); const v2 = vin(); const g2 = await car(u2, v2); await unlock(u2, g2, "purchase", 5);
  await pool.query("delete from garage_entries where id=$1", [g2]);
  const g3 = await car(u2, null);
  await pool.query("update garage_entries set vin=$1 where id=$2", [v2, g3]);
  assert.deepEqual(await ent.reconcileHoldsForVehicle(u2, g3, v2), { restored: 1, needsReview: 0 });
  assert.equal((await ents(u2))[0].source, "purchase");
});

test("resolution rules: invalid VIN refused, other account's hold untouchable, existing access is not duplicated, a revoked VIN needs an admin, waive needs an admin and a reason", { skip }, async () => {
  const a = await user(); const b = await user();
  const ga = await car(a, null); await unlock(a, ga, "gift"); await runSnapshot();
  const [h] = await holds(a);
  assert.equal((await code(ent.resolveLegacyHold({ holdId: h.id, userId: a, vin: "NOTAVIN", actor: { type: "customer" } }))), "VIN_INVALID");
  assert.equal((await code(ent.resolveLegacyHold({ holdId: h.id, userId: a, actor: { type: "customer" } }))), "VIN_REQUIRED");
  assert.equal((await code(ent.resolveLegacyHold({ holdId: h.id, userId: b, vin: vin(), actor: { type: "customer" } }))), "NOT_FOUND", "another account cannot touch it");
  const v = vin();
  // account already holds that VIN (gifted separately): hold closes, no second entitlement
  await ent.giftEntitlement({ userId: a, vin: v, actor: { type: "admin", id: "x" } });
  const r = await ent.resolveLegacyHold({ holdId: h.id, userId: a, vin: v, actor: { type: "admin", id: "x" } });
  assert.equal(r.created, false); assert.equal((await ents(a)).length, 1);
  assert.match((await holds(a))[0].resolution_note, /already held/);
  // revoked existing -> admin decision
  const ga2 = await car(a, null); await unlock(a, ga2, "gift"); await runSnapshot();
  const h2 = (await holds(a)).find((x) => x.garage_entry_id === ga2);
  const v2 = vin(); await ent.giftEntitlement({ userId: a, vin: v2, actor: { type: "admin", id: "x" } }); await ent.revokeEntitlement({ userId: a, vin: v2, actor: { type: "admin", id: "x" } });
  assert.equal(await code(ent.resolveLegacyHold({ holdId: h2.id, userId: a, vin: v2, actor: { type: "admin", id: "x" } })), "REVOKED_EXISTS");
  assert.equal((await holds(a)).find((x) => x.id === h2.id).status, "pending_vin", "still preserved");
  // waive
  await assert.rejects(ent.waiveLegacyHold({ holdId: h2.id, userId: a, actor: { type: "customer" }, note: "no thanks please" }), /only an admin/);
  await assert.rejects(ent.waiveLegacyHold({ holdId: h2.id, userId: a, actor: { type: "admin", id: "x" }, note: "" }), /reason is required/);
  const w = await ent.waiveLegacyHold({ holdId: h2.id, userId: a, actor: { type: "admin", id: "x" }, note: "customer asked us to remove it" });
  assert.equal(w.status, "waived"); assert.equal(w.resolvedBy, "x");
  assert.equal((await holds(a)).length, 2, "waived rows stay forever");
});

test("another account holding the same VIN as a hold's stored VIN is never affected by it", { skip }, async () => {
  const a = await user(); const b = await user(); const v = vin();
  const ga = await car(a, v); await unlock(a, ga, "gift"); await pool.query("delete from garage_entries where id=$1", [ga]);   // A's hold, VIN v
  const gb = await car(b, v);
  assert.deepEqual(await ent.reconcileHoldsForVehicle(b, gb, v), { restored: 0, needsReview: 0 });
  assert.equal((await ents(b)).length, 0);
  assert.equal((await ent.keysStatusForOwnVehicle(b, gb)).unlocked, false);
  assert.equal((await ent.checkoutEligibilityForOwnVehicle(b, gb)).eligible, true, "B pays for their own; A's hold is no concern of B's");
  assert.equal((await holds(a)).length, 1);
});

test("CHECKOUT ELIGIBILITY: no VIN, invalid VIN, already unlocked (gift or payment) and a pending legacy unlock are all refused; a revoked VIN or a fresh one is allowed at the server price", { skip }, async () => {
  const u = await user();
  const noVin = await car(u, null);
  const badVin = await car(u, "VIN00000000000042");
  const gifted = await car(u, vin()); const paid = await car(u, vin()); const fresh = await car(u, vin()); const revoked = await car(u, vin());
  const row = async (id) => (await pool.query("select vin from garage_entries where id=$1", [id])).rows[0].vin;
  await ent.giftEntitlement({ userId: u, vin: await row(gifted), actor: { type: "admin", id: "a" } });
  await ent.grantPurchasedEntitlement({ userId: u, vin: await row(paid) });
  await ent.grantPurchasedEntitlement({ userId: u, vin: await row(revoked) }); await ent.revokeEntitlement({ userId: u, vin: await row(revoked), actor: { type: "system" }, kind: "refunded" });
  const reason = async (id) => { const r = await ent.checkoutEligibilityForOwnVehicle(u, id); return r.eligible ? "ELIGIBLE" : r.reason; };
  assert.equal(await reason(noVin), "no-vin");
  assert.equal(await reason(badVin), "invalid-vin");
  assert.equal(await reason(gifted), "already-unlocked");
  assert.equal(await reason(paid), "already-unlocked");
  assert.equal(await reason("g-does-not-exist"), "not-in-garage");
  assert.equal(await reason(fresh), "ELIGIBLE");
  assert.equal(await reason(revoked), "ELIGIBLE", "a refunded VIN may be bought again");
  const e = await ent.checkoutEligibilityForOwnVehicle(u, fresh);
  assert.equal(e.priceCents, 1800, "server price: the account already bought one (the refunded one no longer counts) -> rung 2 = $18"); assert.equal(e.rung, 2);
  // someone else's car answers exactly like a missing one
  const other = await user(); const og = await car(other, vin());
  assert.equal(await reason(og), "not-in-garage");
});

test("PAYMENT SETTLEMENT: money for an already-held VIN (gift, earlier payment, pending legacy unlock) grants nothing and says refund; a fresh VIN is granted", { skip }, async () => {
  const u = await user();
  const vg = vin(); await ent.giftEntitlement({ userId: u, vin: vg, actor: { type: "admin", id: "a" } });
  const s1 = await ent.settleCapturedPayment({ userId: u, vin: vg });
  assert.equal(s1.outcome, "refund-required"); assert.equal(s1.reason, "already-unlocked");
  const vp = vin(); assert.equal((await ent.settleCapturedPayment({ userId: u, vin: vp })).outcome, "granted");
  const s2 = await ent.settleCapturedPayment({ userId: u, vin: vp.toLowerCase() });
  assert.equal(s2.outcome, "refund-required");
  // pending legacy hold for the VIN
  const vh = vin(); const g = await car(u, vh); await unlock(u, g, "purchase", 70); await pool.query("delete from garage_entries where id=$1", [g]);
  const s3 = await ent.settleCapturedPayment({ userId: u, vin: vh });
  assert.deepEqual([s3.outcome, s3.reason], ["refund-required", "legacy-unlock-pending"]);
  assert.equal((await ents(u)).filter((x) => x.vin === vh).length, 0, "nothing was granted for it");
  assert.equal((await ents(u)).length, 2, "gift + the one real purchase; no double entries");
  const ev = (await events(u)).map((x) => x.event_type);
  assert.deepEqual(ev, ["gifted", "purchased"], "refused settlements log nothing as a sale");
  assert.equal((await ent.nextUnlockPrice(u)).rung, 2);
});
