import { test, expect } from "@playwright/test";
import { Client } from "pg";
import { randomIp } from "./helpers";

// Customer authentication error handling (Build 104-E). Every case is a way a customer, or an attacker, used to be told
// something false or something private:
//   SU-*  signup: duplicate and failing requests must produce controlled answers, never SQL, schema, hashes or stack traces
//   FP-*  forgot password: the page must not claim success when the request failed, must not stay stuck, and must allow a retry
//   DR-*  disabled-account recovery: the post-reset screen must not promise a login, and must look identical for every account
// Local scratch database only (DATABASE_URL, default is the suite's scratch cluster).

const DB_URL = process.env.DATABASE_URL ?? "postgres://postgres@127.0.0.1:5544/cc_test";
const DUPLICATE_MESSAGE = "An account with that email already exists.";
// Anything that would tell a stranger how the database is laid out, or hand back a credential.
const LEAK = /Failed query|insert into|select "|from "users"|params:|\$2[aby]\$|password_hash|users_email|duplicate key|violates|ECONNREFUSED|ECONNRESET|connection (terminated|refused)|\bat [A-Za-z_.]+ \(|node_modules|postgres(ql)?:\/\//i;

async function sql<T = Record<string, unknown>>(text: string, params: unknown[] = []): Promise<T[]> {
  const c = new Client({ connectionString: DB_URL });
  await c.connect();
  try { return (await c.query(text, params)).rows as T[]; } finally { await c.end(); }
}
const uniqueEmail = (tag: string) => `e2e-${tag}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}@example.com`;

test.beforeAll(async ({ request }) => {
  for (const p of ["/signup", "/forgot-password", "/reset-password", "/login"]) await request.get(p, { timeout: 90_000, failOnStatusCode: false });
});

test.describe("signup", () => {
  test("SU-1 a sequential duplicate gets the plain, useful message and nothing else", async ({ playwright }) => {
    const email = uniqueEmail("su1");
    const api = await playwright.request.newContext({ baseURL: "http://localhost:3100", extraHTTPHeaders: { "x-forwarded-for": randomIp() } });
    const first = await api.post("/api/signup", { data: { email, password: "testpassword123" } });
    expect(first.status()).toBe(200);
    const again = await api.post("/api/signup", { data: { email, password: "testpassword123" } });
    expect(again.status()).toBe(409);
    expect(await again.json()).toEqual({ error: DUPLICATE_MESSAGE });
    // case and whitespace variants of the same address are the same account
    const variant = await api.post("/api/signup", { data: { email: `  ${email.toUpperCase()} `, password: "testpassword123" } });
    expect(variant.status()).toBe(409);
    expect(await variant.json()).toEqual({ error: DUPLICATE_MESSAGE });
    await api.dispose();
  });

  test("SU-2 simultaneous duplicate signups: exactly one account, every loser gets the plain message, no SQL, no hash", async ({ playwright }) => {
    const email = uniqueEmail("su2");
    const N = 8;
    const results = await Promise.all(
      Array.from({ length: N }, async () => {
        const api = await playwright.request.newContext({ baseURL: "http://localhost:3100", extraHTTPHeaders: { "x-forwarded-for": randomIp() } });
        const r = await api.post("/api/signup", { data: { email, password: "testpassword123" } });
        const out = { status: r.status(), body: await r.text() };
        await api.dispose();
        return out;
      }),
    );
    const ok = results.filter((r) => r.status === 200);
    const dup = results.filter((r) => r.status === 409);
    expect(ok.length, "exactly one request creates the account").toBe(1);
    expect(dup.length, "every other request is a plain duplicate").toBe(N - 1);
    for (const r of results) expect(r.body, `response body leaked internals: ${r.body.slice(0, 120)}`).not.toMatch(LEAK);
    for (const r of dup) expect(JSON.parse(r.body)).toEqual({ error: DUPLICATE_MESSAGE });
    expect((await sql<{ n: string }>("select count(*) n from users where email=$1", [email]))[0].n).toBe("1");
  });

  test("SU-3 a database outage is a controlled 503 with a customer-safe message (opt-in: briefly refuses scratch DB connections)", async ({ playwright }) => {
    test.skip(!process.env.CC_DB_OUTAGE, "set CC_DB_OUTAGE=1 and run this test alone");
    const name = new URL(DB_URL).pathname.slice(1);
    const adminUrl = new URL(DB_URL); adminUrl.pathname = "/postgres";
    const c = new Client({ connectionString: adminUrl.toString() });
    await c.connect();
    const api = await playwright.request.newContext({ baseURL: "http://localhost:3100", extraHTTPHeaders: { "x-forwarded-for": randomIp() } });
    let status = 0, body = "";
    try {
      await c.query(`alter database ${name} with allow_connections false`);
      await c.query("select pg_terminate_backend(pid) from pg_stat_activity where datname=$1 and pid<>pg_backend_pid()", [name]);
      const r = await api.post("/api/signup", { data: { email: uniqueEmail("su3"), password: "testpassword123" } });
      status = r.status(); body = await r.text();
    } finally {
      await c.query(`alter database ${name} with allow_connections true`);
      await c.end();
      await api.dispose();
    }
    expect(status, "an outage is not a 409 'your account has a problem'").toBe(503);
    expect(body).not.toMatch(LEAK);
    expect(JSON.parse(body).error).toMatch(/try again/i);
  });
});
