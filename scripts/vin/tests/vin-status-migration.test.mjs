import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

// Migration apply / rollback test for 2026-10-12-vin-status. It creates its OWN throwaway database on a scratch Postgres
// and drops it afterwards. It never runs unless MIGRATION_TEST_ADMIN_URL points at a LOCAL scratch server
// (localhost / 127.0.0.1 only); in CI and on a normal checkout it is skipped.
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const ADMIN = process.env.MIGRATION_TEST_ADMIN_URL;
const local = (() => {
  try {
    return ADMIN ? ["localhost", "127.0.0.1", "[::1]"].includes(new URL(ADMIN).hostname) : false;
  } catch {
    return false;
  }
})();
const skip = !ADMIN ? "set MIGRATION_TEST_ADMIN_URL to a local scratch Postgres to run" : !local ? "MIGRATION_TEST_ADMIN_URL must be a local host" : false;

const migrate = fs.readFileSync(path.join(ROOT, "migrations/2026-10-12-vin-status.sql"), "utf8");
const rollback = fs.readFileSync(path.join(ROOT, "migrations/2026-10-12-vin-status-ROLLBACK.sql"), "utf8");

function urlFor(db) {
  const u = new URL(ADMIN);
  u.pathname = `/${db}`;
  return u.toString();
}
const psql = (url, q) => execFileSync("psql", [url, "-v", "ON_ERROR_STOP=1", "-At", "-F", "|", "-c", q], { encoding: "utf8" }).trim();
const run = (url, sqlText) => execFileSync("psql", [url, "-v", "ON_ERROR_STOP=1", "-q", "-f", "-"], { input: sqlText, encoding: "utf8" });

test("vin-status migration: applies twice, leaves legacy rows untouched, rolls back cleanly twice, re-applies", { skip }, () => {
  const name = `mig_vinstatus_${process.pid}_${Date.now()}`;
  const admin = urlFor("postgres");
  psql(admin, `create database ${name}`);
  const url = urlFor(name);
  try {
    run(
      url,
      `create table garage_entries (id text primary key, user_id text not null, kind text not null, vehicle_id text, vin text, year text, make text, model text, created_at timestamp default now());
       create unique index garage_entries_user_vin_uq on garage_entries (user_id, vin) where vin is not null;
       insert into garage_entries(id,user_id,kind,vin,make) values ('a','u1','custom','1HGCM82633A004352','Honda'),('b','u2','custom','1HGCM82633A004352','Honda'),('c','u1','catalog',null,null);`,
    );
    const fingerprint = () => psql(url, `select md5(string_agg(id||coalesce(user_id,'')||coalesce(vin,'')||coalesce(make,''), ',' order by id)) || '|' || count(*) from garage_entries`);
    const cols = () => psql(url, `select count(*) from information_schema.columns where table_name='garage_entries' and column_name in ('vin_status','vin_status_at')`);
    const chk = () => psql(url, `select count(*) from pg_constraint where conname='garage_entries_vin_status_chk'`);
    const before = fingerprint();
    assert.equal(cols(), "0");

    run(url, migrate);
    run(url, migrate); // idempotent
    assert.equal(cols(), "2");
    assert.equal(chk(), "1");
    assert.equal(fingerprint(), before, "legacy rows unchanged");
    assert.equal(psql(url, `select count(*) from garage_entries where vin_status is not null or vin_status_at is not null`), "0", "no backfill");
    // the same VIN in two accounts is allowed (per-account unique only); the same VIN twice in one account is not
    run(url, `insert into garage_entries(id,user_id,kind,vin) values ('d','u3','custom','WBAPH5C55BA000001'),('e','u4','custom','WBAPH5C55BA000001')`);
    assert.throws(() => run(url, `insert into garage_entries(id,user_id,kind,vin) values ('f','u3','custom','WBAPH5C55BA000001')`), /garage_entries_user_vin_uq|duplicate key/);
    // the check constraint accepts the two statuses and rejects anything else
    run(url, `update garage_entries set vin_status='unverified', vin_status_at=now() where id='d'`);
    run(url, `update garage_entries set vin_status='verified', vin_status_at=now() where id='e'`);
    assert.throws(() => run(url, `update garage_entries set vin_status='maybe' where id='a'`), /garage_entries_vin_status_chk/);

    // roll back: only the two flags go; vehicles, VINs and histories stay
    const keep = fingerprint();
    run(url, rollback);
    run(url, rollback); // idempotent
    assert.equal(cols(), "0");
    assert.equal(chk(), "0");
    assert.equal(fingerprint(), keep, "rollback keeps every row and VIN");
    assert.equal(psql(url, `select count(*) from pg_indexes where tablename='garage_entries' and indexname='garage_entries_user_vin_uq'`), "1", "VIN index intact");

    run(url, migrate); // and it can be applied again
    assert.equal(cols(), "2");
    assert.equal(psql(url, `select count(*) from garage_entries where vin_status is not null`), "0", "statuses do not survive a rollback");
  } finally {
    psql(admin, `drop database if exists ${name}`);
  }
});

test("migration files carry no global VIN constraint and never touch Production-style cross-account rules", () => {
  assert.ok(!/unique[^;]*\(\s*vin\s*\)|unique\s+index[^;]*\(\s*(upper\()?vin\b/i.test(migrate), "no global unique on vin");
  for (const f of fs.readdirSync(path.join(ROOT, "migrations"))) {
    const t = fs.readFileSync(path.join(ROOT, "migrations", f), "utf8").replace(/--.*$/gm, "");
    assert.ok(!/create\s+unique\s+index[^;]*garage_entries\s*\(\s*(upper\()?\s*vin\b/i.test(t), `${f}: no global VIN unique index`);
  }
});
