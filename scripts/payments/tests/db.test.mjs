// Stripe TEST-MODE foundation: DATABASE-BACKED tests. Skips without DATABASE_URL; refuses any non-local database.
//   1. The idempotency migration (migrations/2026-10-13-stripe-idempotency.sql) on throwaway databases: the three constraints hold,
//      the guard aborts safely, re-running is a no-op, the ROLLBACK drops only what the script created.
//   2. The real Keys code (grant / settle / revoke) driven by processStripeEvent against the scratch schema (drizzle push), with the
//      real unique indexes doing the webhook dedupe: duplicate events, one pending purchase per account, full refund revokes with
//      service history and the entitlement audit trail preserved, a refunded duplicate leaves the original unlock alone.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const URL_ = process.env.DATABASE_URL;
const skip = !URL_ ? "DATABASE_URL not set" : !/@(127\.0\.0\.1|localhost)[:/]/.test(URL_) ? "refusing non-local database" : false;
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const req = createRequire(path.join(ROOT, "package.json"));
const mig = (f) => fs.readFileSync(path.join(ROOT, "migrations", f), "utf8");
const UP = () => mig("2026-10-13-stripe-idempotency.sql");
const DOWN = () => mig("2026-10-13-stripe-idempotency-ROLLBACK.sql");
const MARK = "created by 2026-10-13-stripe-idempotency.sql";
const NAMES = ["purchases_provider_ref_uq", "payment_events_provider_ref_uq", "purchases_one_pending_per_user_uq"];

const made = [];
let pool, ent, proc;

async function scratch() {
  const { Pool, Client } = req("pg");
  const admin = new Client({ connectionString: URL_.replace(/\/[^/?]*(\?|$)/, "/postgres$1") });
  await admin.connect();
  const name = `cc_pay_${process.pid}_${made.length}_${Date.now() % 100000}`;
  await admin.query(`CREATE DATABASE ${name}`);
  await admin.end();
  made.push(name);
  const p = new Pool({ connectionString: URL_.replace(/\/[^/?]*(\?|$)/, `/${name}$1`) });
  await p.query(`CREATE TABLE purchases (id text PRIMARY KEY, user_id text NOT NULL, status text NOT NULL, provider text, provider_ref text)`);
  await p.query(`CREATE TABLE payment_events (id text PRIMARY KEY, type text NOT NULL, provider text, provider_ref text)`);
  return p;
}
const bundle = async (entry) => {
  const out = await req("esbuild").build({ entryPoints: [path.join(ROOT, entry)], bundle: true, write: false, format: "cjs", platform: "node", logLevel: "silent", external: ["pg"], alias: { "@": path.join(ROOT, "src") } });
  const m = { exports: {} };
  new Function("module", "exports", "require", out.outputFiles[0].text)(m, m.exports, req);
  return m.exports;
};
before(async () => {
  if (skip) return;
  const { Pool } = req("pg");
  pool = new Pool({ connectionString: URL_ });
  ent = await bundle("src/lib/keysEntitlements.ts");
  proc = await bundle("src/lib/payments/processEvent.ts");
});
after(async () => {
  if (skip) return;
  if (pool) await pool.end();
  const { Client } = req("pg");
  const admin = new Client({ connectionString: URL_.replace(/\/[^/?]*(\?|$)/, "/postgres$1") });
  await admin.connect();
  for (const n of made) await admin.query(`DROP DATABASE IF EXISTS ${n} WITH (FORCE)`);
  await admin.end();
});
const code = async (p) => { try { await p; return null; } catch (e) { return e.code; } };
const idxState = async (p) => (await p.query(`select indexname, obj_description(indexname::regclass,'pg_class') c from pg_indexes where indexname = any($1) order by 1`, [NAMES])).rows;

// ---------------- 1. the migration ----------------
test("MIGRATION: duplicate provider refs, replayed events and a second pending purchase per account are rejected by the database", { skip }, async () => {
  const p = await scratch();
  await p.query(UP());
  await p.query(`insert into purchases values ('a','u1','pending','stripe','cs_1')`);
  assert.equal(await code(p.query(`insert into purchases values ('b','u2','pending','stripe','cs_1')`)), "23505", "same provider+ref twice");
  await p.query(`insert into purchases values ('c','u2','pending','stripe','cs_2')`);
  assert.equal(await code(p.query(`insert into purchases values ('d','u1','pending','stripe','cs_3')`)), "23505", "second pending purchase for u1");
  await p.query(`update purchases set status='succeeded' where id='a'`);
  await p.query(`insert into purchases values ('e','u1','pending','stripe','cs_4')`); // slot freed once the first is no longer pending
  await p.query(`insert into payment_events values ('x1','charge.refunded','stripe','evt_1')`);
  assert.equal(await code(p.query(`insert into payment_events values ('x2','charge.refunded','stripe','evt_1')`)), "23505", "replayed webhook event");
  await p.query(`insert into payment_events values ('x3','charge.refunded','stripe','evt_2')`);
  await p.query(`insert into payment_events values ('x4','other',null,null), ('x5','other',null,null)`); // rows without a provider ref are not constrained
  await p.query(`insert into purchases values ('f','u9','succeeded',null,null), ('g','u9','succeeded',null,null)`);
  await p.end();
});

test("MIGRATION: guard aborts and changes NOTHING when existing rows already violate a constraint; re-run is a no-op", { skip }, async () => {
  const p = await scratch();
  await p.query(`insert into purchases values ('a','u1','pending','stripe','cs_1'), ('b','u2','succeeded','stripe','cs_1')`);
  await assert.rejects(p.query(UP()), /duplicate \(provider, provider_ref\) in purchases/);
  assert.deepEqual(await idxState(p), [], "no index left behind");
  await p.query(`delete from purchases`);
  await p.query(`insert into purchases values ('a','u1','pending','stripe','cs_1'), ('b','u1','pending','stripe','cs_2')`);
  await assert.rejects(p.query(UP()), /more than one pending purchase/);
  assert.deepEqual(await idxState(p), []);
  await p.query(`delete from purchases`);
  await p.query(UP()); await p.query(UP());
  assert.deepEqual((await idxState(p)).map((r) => r.indexname), [...NAMES].sort());
  await p.end();
});

test("MIGRATION ROLLBACK drops only indexes carrying this script's marker", { skip }, async () => {
  const p = await scratch();
  await p.query(UP());
  assert.ok((await idxState(p)).every((r) => r.c === MARK));
  await p.query(DOWN());
  assert.deepEqual(await idxState(p), []);
  // an index of the same name that came from somewhere else must survive the rollback
  await p.query(`create unique index purchases_provider_ref_uq on purchases (id)`);
  await p.query(DOWN());
  assert.deepEqual((await idxState(p)).map((r) => r.indexname), ["purchases_provider_ref_uq"]);
  await p.query(DOWN()); // and rolling back twice is harmless
  await p.end();
});

test("MIGRATION VERIFY is read-only and reports the expected numbers", { skip }, async () => {
  const p = await scratch();
  const sql = mig("2026-10-13-stripe-idempotency-VERIFY.sql");
  assert.doesNotMatch(sql.replace(/--.*$/gm, ""), /\b(insert|update|delete|drop|alter|create|truncate)\b/i);
  const get = async () => Object.fromEntries((await p.query(sql)).rows.map((r) => [r.check, r.result]));
  assert.equal((await get())["idempotency indexes present (expect 3 after the migration, 0 before)"], "0");
  await p.query(UP());
  const after_ = await get();
  assert.equal(after_["idempotency indexes present (expect 3 after the migration, 0 before)"], "3");
  assert.equal(after_["purchases rows"], "0");
  await p.end();
});

test("PARITY: schema.ts declares exactly the migration's three indexes (a drizzle push database matches Production after the migration)", () => {
  const schema = fs.readFileSync(path.join(ROOT, "src/db/schema.ts"), "utf8");
  for (const n of NAMES) assert.ok(schema.includes(`"${n}"`), `${n} declared in schema.ts`);
  for (const n of NAMES) assert.ok(UP().includes(n), `${n} created by the migration`);
});

// ---------------- 2. real Keys code, real unique indexes ----------------
const ALPHA = "ABCDEFGHJKLMNPRSTUVWXYZ0123456789";
const TR = { A:1,B:2,C:3,D:4,E:5,F:6,G:7,H:8,J:1,K:2,L:3,M:4,N:5,P:7,R:9,S:2,T:3,U:4,V:5,W:6,X:7,Y:8,Z:9 };
const W = [8,7,6,5,4,3,2,10,0,9,8,7,6,5,4,3,2];
function vin() {
  let s = "1KT";
  for (let i = 3; i < 17; i++) s += ALPHA[Math.floor(Math.random() * ALPHA.length)];
  const sum = [...s.slice(0, 8) + "0" + s.slice(9)].reduce((a, c, i) => a + (/\d/.test(c) ? +c : TR[c]) * W[i], 0);
  const d = sum % 11 === 10 ? "X" : String(sum % 11);
  return s.slice(0, 8) + d + s.slice(9);
}
let seq = 0;
async function user() {
  const id = `pt-${Date.now()}-${++seq}-${Math.random().toString(36).slice(2, 6)}`;
  await pool.query("insert into users(id,email,password_hash) values ($1,$2,'x')", [id, `${id}@example.com`]);
  return id;
}
async function carWithHistory(userId, v) {
  const gid = `g-${userId}`;
  await pool.query("insert into garage_entries(id,user_id,kind,vehicle_id,vin) values ($1,$2,'custom',null,$3)", [gid, userId, v]);
  await pool.query("insert into service_entries(id,user_id,garage_entry_id,date,mileage,title,logged_at) values ($1,$2,$3,'2026-10-01',50000,'Oil change',now())", [`s-${userId}`, userId, gid]);
  return gid;
}
async function pending(userId, v, quoted = 2000) {
  const id = `pur-${randomUUID().slice(0, 8)}`;
  await pool.query("insert into purchases(id,user_id,amount_cents,status,provider,provider_ref) values ($1,$2,$3,'pending','stripe',$4)", [id, userId, quoted, `cs_${id}`]);
  return { id, userId, vin: v, quotedCents: quoted };
}
function realDeps(known, refunds) {
  return {
    claimEvent: async (eid, type) => {
      const ins = await pool.query(
        `insert into payment_events(id,type,status,provider,provider_ref) values ($1,$2,'processing','stripe',$3) on conflict (provider, provider_ref) where provider is not null and provider_ref is not null do nothing returning id`,
        [randomUUID(), type, eid]);
      if (ins.rowCount) return "new";
      const [r] = (await pool.query(`select status from payment_events where provider='stripe' and provider_ref=$1`, [eid])).rows;
      return r.status === "processing" ? "retry" : "done";
    },
    finishEvent: async (eid, status, message) => { await pool.query(`update payment_events set status=$2, message=$3 where provider='stripe' and provider_ref=$1`, [eid, status, message]); },
    findPurchase: async ({ purchaseId, paymentIntent }) => {
      const { rows } = await pool.query(`select id,user_id,status from purchases where ($1::text is not null and id=$1) or ($2::text is not null and provider='stripe' and provider_ref=$2) limit 1`, [purchaseId ?? null, paymentIntent ?? null]);
      if (!rows[0]) return null;
      const k = known.get(rows[0].id);
      return k ? { ...k, status: rows[0].status } : null;
    },
    updatePurchase: async (id, patch) => {
      if (patch.status) await pool.query(`update purchases set status=$2 where id=$1`, [id, patch.status]);
      if (patch.providerRef) await pool.query(`update purchases set provider_ref=$2 where id=$1`, [id, patch.providerRef]);
      if (patch.refundedCents !== undefined) await pool.query(`update purchases set refunded_cents=$2 where id=$1`, [id, patch.refundedCents]);
    },
    settle: (i) => ent.settleCapturedPayment({ userId: i.userId, vin: i.vin, purchaseId: i.purchaseId }),
    grantingPurchaseId: async (u, v) => (await ent.getEntitlement(u, v))?.purchaseId ?? null,
    revokeRefunded: (i) => ent.revokeEntitlement({ userId: i.userId, vin: i.vin, kind: "refunded", actor: { type: "system" }, reason: i.reason }),
    refund: async (i) => { refunds.push(i); },
  };
}
const completed = (eid, p, pi, subtotal) => ({ id: eid, type: "checkout.session.completed", data: { object: { client_reference_id: p.id, payment_status: "paid", payment_intent: pi, amount_subtotal: subtotal, metadata: { vin: p.vin } } } });
const refundedCharge = (eid, pi, full = true) => ({ id: eid, type: "charge.refunded", data: { object: { id: "ch_x", payment_intent: pi, amount: 2160, amount_refunded: full ? 2160 : 500, refunded: full } } });
const eventRows = async (eid) => (await pool.query(`select status from payment_events where provider='stripe' and provider_ref=$1`, [eid])).rows;

test("END TO END (real Keys code): paid event grants at the quoted rung; 10 replays change nothing; one payment_events row", { skip }, async () => {
  const u = await user(), v = vin(), refunds = [];
  const p = await pending(u, v);
  const known = new Map([[p.id, p]]);
  const deps = realDeps(known, refunds);
  const ev = completed("evt_" + randomUUID(), p, "pi_" + randomUUID().slice(0, 8), 2000);
  const results = [];
  for (let i = 0; i < 10; i++) results.push(await proc.processStripeEvent(ev, deps));
  assert.equal(results[0].action, "granted");
  assert.ok(results.slice(1).every((r) => r.action === "duplicate-event-ignored"));
  const e = await ent.getEntitlement(u, v);
  assert.equal(e.priceCents, 2000); assert.equal(e.rung, 1); assert.equal(e.purchaseId, p.id);
  assert.equal((await eventRows(ev.id)).length, 1);
  assert.equal((await pool.query(`select status from purchases where id=$1`, [p.id])).rows[0].status, "succeeded");
  assert.equal((await ent.listEntitlementEvents(u, v)).length, 1);
});

test("END TO END: two checkouts at once are impossible for one account (database), and an expired session frees the slot", { skip }, async () => {
  const u = await user(), refunds = [];
  const p1 = await pending(u, vin());
  assert.equal(await code(pending(u, vin())), "23505");
  const deps = realDeps(new Map([[p1.id, p1]]), refunds);
  await proc.processStripeEvent({ id: "evt_" + randomUUID(), type: "checkout.session.expired", data: { object: { client_reference_id: p1.id } } }, deps);
  await pending(u, vin()); // allowed now
});

test("END TO END: FULL REFUND revokes the unlock, keeps service history, the garage car and the whole entitlement audit trail; rung drops back", { skip }, async () => {
  const u = await user(), v = vin(), refunds = [];
  const gid = await carWithHistory(u, v);
  const p = await pending(u, v); const known = new Map([[p.id, p]]); const deps = realDeps(known, refunds);
  const pi = "pi_" + randomUUID().slice(0, 8);
  await proc.processStripeEvent(completed("evt_" + randomUUID(), p, pi, 2000), deps);
  assert.equal(await ent.hasEntitlement(u, v), true);
  const r = await proc.processStripeEvent(refundedCharge("evt_" + randomUUID(), pi), deps);
  assert.equal(r.action, "full-refund-revoked");
  assert.equal(await ent.hasEntitlement(u, v), false);
  assert.equal((await pool.query(`select count(*)::int n from service_entries where garage_entry_id=$1`, [gid])).rows[0].n, 1, "service history untouched");
  assert.equal((await pool.query(`select count(*)::int n from garage_entries where id=$1`, [gid])).rows[0].n, 1, "garage car untouched");
  assert.deepEqual((await ent.listEntitlementEvents(u, v)).map((x) => x.eventType), ["purchased", "refunded"], "append-only trail kept");
  assert.equal((await pool.query(`select count(*)::int n from vin_entitlements where user_id=$1`, [u])).rows[0].n, 1, "row kept, soft revoked");
  assert.deepEqual(await ent.nextUnlockPrice(u), { rung: 1, priceCents: 2000, purchasedCount: 0 });
  assert.equal((await pool.query(`select status, refunded_cents from purchases where id=$1`, [p.id])).rows[0].status, "refunded");
});

test("END TO END: confirmed duplicate charge is auto-refunded once; refunding it does NOT revoke the original unlock", { skip }, async () => {
  const u = await user(), v = vin(), refunds = [];
  const p1 = await pending(u, v); const known = new Map([[p1.id, p1]]); const deps = realDeps(known, refunds);
  await proc.processStripeEvent(completed("evt_" + randomUUID(), p1, "pi_" + randomUUID().slice(0, 8), 2000), deps);
  // account pays again for the same VIN (the first purchase is no longer pending, so the slot is free)
  const p2 = await pending(u, v); known.set(p2.id, p2);
  const pi2 = "pi_" + randomUUID().slice(0, 8);
  const evDup = completed("evt_" + randomUUID(), p2, pi2, 2000);
  assert.equal((await proc.processStripeEvent(evDup, deps)).action, "duplicate-auto-refunded");
  await proc.processStripeEvent(evDup, deps);
  assert.deepEqual(refunds.map((x) => x.idempotencyKey), [`duplicate:${p2.id}`], "one refund, however many deliveries");
  assert.equal((await ent.getEntitlement(u, v)).purchaseId, p1.id);
  const rr = await proc.processStripeEvent(refundedCharge("evt_" + randomUUID(), pi2), deps);
  assert.equal(rr.action, "refunded-purchase-did-not-grant");
  assert.equal(await ent.hasEntitlement(u, v), true, "original unlock intact");
  assert.equal((await ent.listEntitlementEvents(u, v)).length, 1);
});

test("END TO END: VIN already GIFTED (or legacy-held) is NOT auto-refunded: manual review, no refund, gift untouched", { skip }, async () => {
  const u = await user(), v = vin(), refunds = [];
  await ent.giftEntitlement({ userId: u, vin: v, actor: { type: "admin", id: "a1" }, reason: "test" });
  const p = await pending(u, v); const deps = realDeps(new Map([[p.id, p]]), refunds);
  const ev = completed("evt_" + randomUUID(), p, "pi_" + randomUUID().slice(0, 8), 2000);
  const r = await proc.processStripeEvent(ev, deps);
  assert.equal(r.action, "refund-required-manual");
  assert.equal(refunds.length, 0);
  assert.equal((await eventRows(ev.id))[0].status, "needs_review");
  assert.equal((await ent.getEntitlement(u, v)).source, "gift");
  assert.equal((await pool.query(`select status from purchases where id=$1`, [p.id])).rows[0].status, "needs_review");
});

test("END TO END: partial refund and dispute leave access exactly as it was and land in manual review", { skip }, async () => {
  const u = await user(), v = vin(), refunds = [];
  const p = await pending(u, v); const deps = realDeps(new Map([[p.id, p]]), refunds); const pi = "pi_" + randomUUID().slice(0, 8);
  await proc.processStripeEvent(completed("evt_" + randomUUID(), p, pi, 2000), deps);
  const e1 = "evt_" + randomUUID(), e2 = "evt_" + randomUUID();
  assert.equal((await proc.processStripeEvent(refundedCharge(e1, pi, false), deps)).action, "partial-refund-manual");
  assert.equal((await proc.processStripeEvent({ id: e2, type: "charge.dispute.created", data: { object: { id: "dp_1", payment_intent: pi } } }, deps)).action, "manual-review");
  assert.equal(await ent.hasEntitlement(u, v), true);
  assert.equal((await eventRows(e1))[0].status, "needs_review"); assert.equal((await eventRows(e2))[0].status, "needs_review");
  assert.equal(refunds.length, 0);
});

test("END TO END PRICE RUNG: a quote taken at rung 2 whose rung changed before capture is granted at the NEW price and flagged, never silently accepted", { skip }, async () => {
  const u = await user(), refunds = [];
  // account already holds one purchased VIN (rung 2 is next), customer quoted $18 ...
  const v0 = vin(); const p0 = await pending(u, v0); const known = new Map([[p0.id, p0]]); const deps = realDeps(known, refunds);
  await proc.processStripeEvent(completed("evt_" + randomUUID(), p0, "pi_" + randomUUID().slice(0, 8), 2000), deps);
  const v = vin(); const p = await pending(u, v, 1800); known.set(p.id, p);
  // ... then the first unlock is refunded before the second payment lands, so rung 1 ($20) is now the account's next rung
  await ent.revokeEntitlement({ userId: u, vin: v0, kind: "refunded", actor: { type: "system" } });
  const ev = completed("evt_" + randomUUID(), p, "pi_" + randomUUID().slice(0, 8), 1800);
  const r = await proc.processStripeEvent(ev, deps);
  assert.equal(r.action, "granted-price-differs");
  assert.equal((await eventRows(ev.id))[0].status, "needs_review");
  assert.equal(await ent.hasEntitlement(u, v), true);
  assert.equal(refunds.length, 0);
});
