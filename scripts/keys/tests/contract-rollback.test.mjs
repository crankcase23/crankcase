// Option B contract / contract-rollback scripts: DB-backed permanent regression tests.
// CONFIRMED DEFECT (Neon rehearsal, 2026-10-12): post-deploy-contract-ROLLBACK.sql dropped garage_entries_user_vin_uq and
// garage_entries_user_catalog_novin_uq unconditionally. Production already has both from the full vehicle-configuration migration (M1),
// so a rollback after the contract step silently removed indexes that existed BEFORE the contract step. The contract now marks only the
// indexes it creates (COMMENT) and the rollback drops only those.
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
