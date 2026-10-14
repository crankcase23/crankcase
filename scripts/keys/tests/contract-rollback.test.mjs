// Option B contract / contract-rollback scripts: DB-backed permanent regression tests.
// CONFIRMED DEFECT (Neon rehearsal, 2026-10-12): post-deploy-contract-ROLLBACK.sql dropped garage_entries_user_vin_uq and
// garage_entries_user_catalog_novin_uq unconditionally. Production already has both from the full vehicle-configuration migration (M1),
// so a rollback after the contract step silently removed indexes that existed BEFORE the contract step. The contract now marks only the
// indexes it creates (COMMENT) and the rollback drops only those.
// CONFIRMED DEFECT #2 (2026-10-13, found reading the script, then reproduced here): post-deploy-contract-ROLLBACK.sql also dropped
// garage_entries_vin_canonical_chk unconditionally and always re-installed the temporary trigger. Production's CHECK was created by M2
// (vin-canonical.sql), not by the contract, and Production never had the temporary trigger, so a rollback would have removed an M2 protection
// and added a trigger that was never there. The contract now marks what it created/removed (COMMENT on the CHECK and indexes it creates; a
// table COMMENT when it drops the temporary trigger) and the rollback undoes only those. See the EXACT-STATE tests at the bottom.
// Each test builds its own throwaway database (never the shared cc_test), applies the real scripts from docs/release/old-code-window.
// Skips when DATABASE_URL is unset; refuses any non-local database.
import { test, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const URL_ = process.env.DATABASE_URL;
const skip = !URL_ ? "DATABASE_URL not set" : !/@(127\.0\.0\.1|localhost)[:/]/.test(URL_) ? "refusing non-local database" : false;
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const req = createRequire(path.join(ROOT, "package.json"));
const win = (f) => fs.readFileSync(path.join(ROOT, "docs", "release", "old-code-window", f), "utf8");
const PRE2 = () => win("pre-2-vin-canonical.sql");
const CONTRACT = () => win("post-deploy-contract.sql");
const ROLLBACK = () => win("post-deploy-contract-ROLLBACK.sql");
const MARK = "created by post-deploy-contract.sql";

const made = [];
async function scratch() {
  const { Pool, Client } = req("pg");
  const admin = new Client({ connectionString: URL_.replace(/\/[^/?]*(\?|$)/, "/postgres$1") });
  await admin.connect();
  const name = `cc_contract_${process.pid}_${made.length}_${Date.now() % 100000}`;
  await admin.query(`CREATE DATABASE ${name}`);
  await admin.end();
  made.push(name);
  const pool = new Pool({ connectionString: URL_.replace(/\/[^/?]*(\?|$)/, `/${name}$1`) });
  await pool.query(`CREATE TABLE garage_entries (id text PRIMARY KEY, user_id text NOT NULL, kind text NOT NULL, vehicle_id text, vin text)`);
  return pool;
}
after(async () => {
  if (skip || !made.length) return;
  const { Client } = req("pg");
  const admin = new Client({ connectionString: URL_.replace(/\/[^/?]*(\?|$)/, "/postgres$1") });
  await admin.connect();
  for (const n of made) await admin.query(`DROP DATABASE IF EXISTS ${n} WITH (FORCE)`);
  await admin.end();
});

async function state(pool) {
  const q = async (s) => (await pool.query(s)).rows;
  const idx = await q(`select indexname, obj_description(indexname::regclass,'pg_class') as comment from pg_indexes where tablename='garage_entries' and indexname like '%_uq' order by 1`);
  return {
    check: (await q(`select 1 from pg_constraint where conname='garage_entries_vin_canonical_chk'`)).length === 1,
    trigger: (await q(`select 1 from pg_trigger where tgname='garage_entries_canonical_vin' and not tgisinternal`)).length === 1,
    idx,
  };
}
const M1_INDEXES = `CREATE UNIQUE INDEX garage_entries_user_vin_uq ON garage_entries (user_id, vin) WHERE vin IS NOT NULL;
CREATE UNIQUE INDEX garage_entries_user_catalog_novin_uq ON garage_entries (user_id, vehicle_id) WHERE kind = 'catalog' AND vin IS NULL;`;

test("PRODUCTION SHAPE: indexes that came from M1 survive contract and contract-rollback", { skip }, async () => {
  const pool = await scratch();
  try {
    await pool.query(M1_INDEXES);
    await pool.query(PRE2());
    await pool.query(CONTRACT());
    let s = await state(pool);
    assert.equal(s.check, true, "contract adds the CHECK");
    assert.equal(s.trigger, false, "contract drops the temporary trigger");
    assert.deepEqual(s.idx.map((i) => i.indexname), ["garage_entries_user_catalog_novin_uq", "garage_entries_user_vin_uq"]);
    assert.ok(s.idx.every((i) => i.comment === null), "indexes that pre-existed are not marked as created by the contract");
    await pool.query(ROLLBACK());
    s = await state(pool);
    assert.equal(s.check, false, "rollback drops the CHECK");
    assert.equal(s.trigger, true, "rollback re-installs the upper-casing trigger");
    assert.deepEqual(s.idx.map((i) => i.indexname), ["garage_entries_user_catalog_novin_uq", "garage_entries_user_vin_uq"], "M1's indexes must still exist (they are M1's, not the contract's)");
    await pool.query(ROLLBACK()); // idempotent
  } finally { await pool.end(); }
});

test("PRE-1 SHAPE: indexes the contract itself created are marked and removed by contract-rollback; re-running is idempotent", { skip }, async () => {
  const pool = await scratch();
  try {
    await pool.query(PRE2());
    await pool.query(CONTRACT());
    let s = await state(pool);
    assert.deepEqual(s.idx.map((i) => [i.indexname, i.comment]), [["garage_entries_user_catalog_novin_uq", MARK], ["garage_entries_user_vin_uq", MARK]]);
    await pool.query(CONTRACT());
    await pool.query(ROLLBACK());
    s = await state(pool);
    assert.deepEqual(s.idx, [], "indexes created by the contract are removed so the old code can write duplicates again");
    assert.equal(s.check, false);
    assert.equal(s.trigger, true);
    await pool.query(CONTRACT()); // forward again after a rollback
    assert.equal((await state(pool)).check, true);
  } finally { await pool.end(); }
});

test("contract does not drop or change rows, and skips (not fails) the unique index when same-account duplicates exist", { skip }, async () => {
  const pool = await scratch();
  try {
    await pool.query(PRE2());
    await pool.query(`INSERT INTO garage_entries(id,user_id,kind,vin) VALUES ('a','u1','custom','1HGCM82633A004352'),('b','u1','custom','1HGCM82633A004352'),('c','u2','custom','1HGCM82633A004352')`);
    await pool.query(CONTRACT());
    const rows = (await pool.query(`select count(*)::int n from garage_entries`)).rows[0].n;
    assert.equal(rows, 3, "nothing deleted or merged");
    const s = await state(pool);
    assert.equal(s.check, true);
    assert.ok(!s.idx.some((i) => i.indexname === "garage_entries_user_vin_uq"), "unique index skipped while duplicates exist");
    await pool.query(ROLLBACK());
  } finally { await pool.end(); }
});

// ---- EXACT-STATE tests (defect #2): contract then rollback must restore byte-for-byte what existed before the contract. ----
async function snapshot(pool) {
  const q = async (s) => (await pool.query(s)).rows;
  return {
    checks: await q(`select conname, convalidated, pg_get_constraintdef(oid) def, obj_description(oid,'pg_constraint') comment from pg_constraint where conrelid='garage_entries'::regclass and contype='c' order by 1`),
    idx: await q(`select indexname, indexdef, obj_description(indexname::regclass,'pg_class') comment from pg_indexes where tablename='garage_entries' order by 1`),
    triggers: await q(`select tgname, pg_get_triggerdef(oid) def from pg_trigger where tgrelid='garage_entries'::regclass and not tgisinternal order by 1`),
    fn: await q(`select proname from pg_proc where proname='garage_entries_canonical_vin'`),
    tableComment: (await q(`select obj_description('garage_entries'::regclass,'pg_class') c`))[0].c,
    rows: await q(`select * from garage_entries order by id`),
  };
}
const M2_CHECK = `ALTER TABLE garage_entries ADD CONSTRAINT garage_entries_vin_canonical_chk CHECK (vin IS NULL OR vin = upper(vin));`;
const TRIGGER = `CREATE OR REPLACE FUNCTION garage_entries_canonical_vin() RETURNS trigger AS $f$ BEGIN IF NEW.vin IS NOT NULL THEN NEW.vin := upper(NEW.vin); END IF; RETURN NEW; END $f$ LANGUAGE plpgsql;
CREATE TRIGGER garage_entries_canonical_vin BEFORE INSERT OR UPDATE OF vin ON garage_entries FOR EACH ROW EXECUTE FUNCTION garage_entries_canonical_vin();`;
const SEED = `INSERT INTO garage_entries(id,user_id,kind,vehicle_id,vin) VALUES ('a','u1','catalog','v1',NULL),('b','u1','custom',NULL,'1HGCM82633A004352'),('c','u2','custom',NULL,'1HGCM82633A004352')`;

test("EXACT STATE, PRODUCTION SHAPE (M2 CHECK + M1 indexes, no temp trigger): contract is a no-op and rollback leaves the M2 CHECK and both indexes", { skip }, async () => {
  const pool = await scratch();
  try {
    await pool.query(M2_CHECK); await pool.query(M1_INDEXES); await pool.query(SEED);
    const before = await snapshot(pool);
    assert.equal(before.checks.length, 1); assert.equal(before.triggers.length, 0);
    await pool.query(CONTRACT());
    assert.deepEqual(await snapshot(pool), before, "contract changes nothing in the Production shape");
    await pool.query(ROLLBACK());
    assert.deepEqual(await snapshot(pool), before, "rollback must NOT drop the M2 CHECK, drop M1's indexes, or add the temporary trigger");
    await pool.query(ROLLBACK()); await pool.query(CONTRACT()); await pool.query(ROLLBACK());
    assert.deepEqual(await snapshot(pool), before, "idempotent and repeatable");
  } finally { await pool.end(); }
});

test("EXACT STATE, PRE-2 SHAPE (temp trigger only): contract then rollback restores trigger, no CHECK, no indexes, no leftover marker", { skip }, async () => {
  const pool = await scratch();
  try {
    await pool.query(PRE2()); await pool.query(SEED);
    const before = await snapshot(pool);
    assert.equal(before.triggers.length, 1); assert.equal(before.checks.length, 0);
    await pool.query(CONTRACT());
    const mid = await snapshot(pool);
    assert.equal(mid.checks.length, 1); assert.equal(mid.triggers.length, 0);
    await pool.query(ROLLBACK());
    assert.deepEqual(await snapshot(pool), before, "exact original state, including NULL table comment");
    await pool.query(CONTRACT()); await pool.query(ROLLBACK());
    assert.deepEqual(await snapshot(pool), before, "forward and back again");
  } finally { await pool.end(); }
});

test("EXACT STATE, MIXED SHAPE (M2 CHECK already present AND temp trigger): rollback removes only what the contract did", { skip }, async () => {
  const pool = await scratch();
  try {
    await pool.query(M2_CHECK); await pool.query(TRIGGER); await pool.query(SEED);
    const before = await snapshot(pool);
    await pool.query(CONTRACT());
    const mid = await snapshot(pool);
    assert.equal(mid.checks.length, 1); assert.equal(mid.triggers.length, 0); assert.equal(mid.idx.length, 3, "pkey + 2 contract indexes");
    await pool.query(ROLLBACK());
    assert.deepEqual(await snapshot(pool), before, "CHECK stays (it pre-existed), contract indexes go, trigger returns");
  } finally { await pool.end(); }
});

test("a rollback run when the contract never ran changes nothing", { skip }, async () => {
  const pool = await scratch();
  try {
    await pool.query(M2_CHECK); await pool.query(M1_INDEXES); await pool.query(SEED);
    const before = await snapshot(pool);
    await pool.query(ROLLBACK());
    assert.deepEqual(await snapshot(pool), before);
  } finally { await pool.end(); }
});
