import { test, expect } from "@playwright/test";
import { Client } from "pg";
import { signUpNewUser } from "./helpers";

// Database error logging against a REAL failing database (Build 104-G). Opt-in: CC_DB_FAULT=1, run alone. Injects BEFORE INSERT triggers, scoped
// to one throwaway user, into the scratch database and removes them afterwards.
//   DE-1  a failing feedback insert: the customer still gets the same generic 500, and the error_events row that records it holds class + code +
//         stack frames, never the SQL, the user id or the feedback text (the failed INSERT's own message used to be stored verbatim)
//   DE-2  a failing analytics (app_events) insert stays fail-open: 204, no row, nothing thrown at the page
//   DE-3  a failing error_events insert (the recorder itself failing) leaves the customer's answer unchanged
// The SERVER LOG is swept by the caller (it is a separate process): every line mentioning these sentinels or SQL is a leak. The sentinels are
// FEEDBACK-104G-SENTINEL and PATH-104G-SENTINEL; "[events] failed to record" and "[errors] failed to record error from" must be present, with a
// class and code and nothing else.
const DB_URL = process.env.DATABASE_URL ?? "postgres://postgres@127.0.0.1:5544/cc_test";
const FEEDBACK = "FEEDBACK-104G-SENTINEL please ignore this test message";
const PATH_SENTINEL = "/vehicles/PATH-104G-SENTINEL";
const LEAK = /Failed query|insert into|select "|from "|params:|\$2[aby]\$|password_hash|FEEDBACK-104G-SENTINEL|PATH-104G-SENTINEL|postgres(ql)?:\/\//i;

async function sql<T = Record<string, unknown>>(text: string, params: unknown[] = []): Promise<T[]> {
  const c = new Client({ connectionString: DB_URL });
  await c.connect();
  try { return (await c.query(text, params)).rows as T[]; } finally { await c.end(); }
}

test.describe("database error logging under real failures", () => {
  test.skip(!process.env.CC_DB_FAULT, "opt-in: set CC_DB_FAULT=1 (injects triggers into the scratch database, removed afterwards)");

  test("DE-1..3 feedback, analytics and recorder failures: generic answers unchanged, nothing sensitive stored", async ({ page }) => {
    test.setTimeout(120_000);
    const email = await signUpNewUser(page);
    const [{ id }] = await sql<{ id: string }>("select id from users where email=$1", [email]);
    expect(id).toMatch(/^[0-9a-f-]{36}$/);
    const t0 = new Date(Date.now() - 2000);
    // error_events rows from this route carry no user id, so that trigger is scoped by source instead (the run is alone, on a scratch database)
    const fault = async (table: string, name: string) => {
      const scope = table === "error_events" ? "new.source = 'api/feedback'" : `new.user_id = '${id}'`;
      await sql(`create or replace function ${name}() returns trigger language plpgsql as $$ begin raise exception 'cc fault injected for tests'; end $$`);
      await sql(`create trigger ${name} before insert on ${table} for each row when (${scope}) execute function ${name}()`);
    };
    const unfault = async (table: string, name: string) => {
      await sql(`drop trigger if exists ${name} on ${table}`);
      await sql(`drop function if exists ${name}()`);
    };
    try {
      // DE-1: feedback insert fails; error_events can still be written
      await fault("feedback", "cc_fault_104g_fb");
      const res = await page.request.post("/api/feedback", { data: { kind: "bug", message: FEEDBACK, path: "/garage" } });
      expect(res.status()).toBe(500);
      expect((await res.json()).error, "the customer-facing answer is unchanged").toBe("Could not send that right now.");
      const rows = await sql<{ message: string; stack: string | null; source: string; fingerprint: string }>(
        "select message, stack, source, fingerprint from error_events where source='api/feedback' and created_at >= $1 order by created_at desc limit 1", [t0]);
      expect(rows.length, "the failure is still recorded").toBe(1);
      const stored = `${rows[0].message}\n${rows[0].stack ?? ""}`;
      expect.soft(stored, "stored message + stack carry no SQL, user id, or feedback text").not.toMatch(LEAK);
      expect.soft(stored).not.toContain(id);
      expect.soft(rows[0].message, "class and code are kept").toMatch(/class=\w+ code=P0001/);
      expect.soft(rows[0].stack ?? "", "stack frames are kept").toMatch(/\n\s+at /);

      // DE-2: analytics insert fails; the page must not notice
      await fault("app_events", "cc_fault_104g_ev");
      const ev = await page.request.post("/api/events/view", { data: { type: "vehicle.viewed", objectId: "veh-104g", objectType: "vehicle", path: PATH_SENTINEL } });
      expect(ev.status(), "fail-open: analytics failure never reaches the page").toBe(204);
      expect((await sql("select 1 from app_events where user_id=$1 and object_id='veh-104g'", [id])).length, "and no event row was written").toBe(0);

      // DE-3: the recorder's own insert fails
      await fault("error_events", "cc_fault_104g_er");
      const before = (await sql("select 1 from error_events where source='api/feedback' and created_at >= $1", [t0])).length;
      const res2 = await page.request.post("/api/feedback", { data: { kind: "bug", message: FEEDBACK, path: "/garage" } });
      expect(res2.status()).toBe(500);
      expect((await res2.json()).error).toBe("Could not send that right now.");
      expect((await sql("select 1 from error_events where source='api/feedback' and created_at >= $1", [t0])).length, "no row was falsely reported as recorded").toBe(before);
    } finally {
      await unfault("feedback", "cc_fault_104g_fb");
      await unfault("app_events", "cc_fault_104g_ev");
      await unfault("error_events", "cc_fault_104g_er");
    }
  });
});
