import { test, expect, type Browser, type BrowserContext } from "@playwright/test";
import { Client } from "pg";
import { signUpNewUser, randomIp } from "./helpers";

// Authentication throttling (PR A), end to end against the real Auth.js handler, the real routes and the real database.
// The exhaustive rules and the concurrency checks live in scripts/auth/tests/auth-guard.test.mjs (npm run throttle:test); this file proves
// the pieces work together in a real browser session:
//   AB-1 login: 8 wrong guesses, then 429 with Retry-After, generic; the real owner on another address still gets in
//   AB-2 login form shows a plain wait message, not "wrong password", when throttled
//   AB-3 successful logins do not spend the budget
//   AB-4 signup burst is cut off before an account is created
//   AB-5 forgot-password: same answer for a real and an unknown email; per-address 429
//   AB-6 reset-password: guessing tokens from one address is cut off
//   AB-7 the counter rows hold only hashes
// Every context gets its own x-forwarded-for, so the suite never throttles itself.

const PASSWORD = "testpassword123";
const DB_URL = process.env.DATABASE_URL ?? "postgres://postgres@127.0.0.1:5544/cc_test";
async function sql<T = Record<string, unknown>>(text: string, params: unknown[] = []): Promise<T[]> {
  const c = new Client({ connectionString: DB_URL });
  await c.connect();
  try { return (await c.query(text, params)).rows as T[]; } finally { await c.end(); }
}
const ctxAt = (browser: Browser, ip: string) => browser.newContext({ extraHTTPHeaders: { "x-forwarded-for": ip } });

/** One credentials sign-in attempt through the real Auth.js endpoint. */
async function attempt(ctx: BrowserContext, email: string, password: string) {
  const csrf = (await (await ctx.request.get("/api/auth/csrf")).json()).csrfToken as string;
  const res = await ctx.request.post("/api/auth/callback/credentials", { form: { csrfToken: csrf, email, password, json: "true" }, maxRedirects: 0 });
  const session = (await (await ctx.request.get("/api/auth/session")).json()) as { user?: { id: string } } | null;
  return { status: res.status(), retryAfter: res.headers()["retry-after"], body: await res.text(), signedIn: !!session?.user?.id };
}
async function makeAccount(browser: Browser): Promise<{ email: string }> {
  const ctx = await ctxAt(browser, randomIp());
  const page = await ctx.newPage();
  const email = await signUpNewUser(page);
  await ctx.close();
  return { email };
}

test.beforeAll(async ({ request }) => {
  for (const p of ["/signup", "/login", "/forgot-password"]) await request.get(p, { timeout: 90_000, failOnStatusCode: false });
});

test("AB-1 login: 8 wrong guesses, then 429 + Retry-After; the owner on another address still signs in", async ({ browser }) => {
  const { email } = await makeAccount(browser);
  const attacker = await ctxAt(browser, randomIp());
  for (let i = 0; i < 8; i++) {
    const r = await attempt(attacker, email, "wrong-guess-" + i);
    expect(r.status, `guess ${i} is an ordinary failure`).not.toBe(429);
    expect(r.signedIn).toBe(false);
  }
  const blocked = await attempt(attacker, email, "wrong-guess-9");
  expect(blocked.status).toBe(429);
  expect(Number(blocked.retryAfter)).toBeGreaterThan(0);
  expect(blocked.body).toContain("error=RateLimited");
  // not even the right password gets through from the throttled address (the check never runs)
  expect((await attempt(attacker, email, PASSWORD)).signedIn).toBe(false);
  // an unknown email gets the very same kind of answer, so the throttle reveals nothing about accounts
  const ghost = `ghost-${Date.now()}@example.com`;
  for (let i = 0; i < 8; i++) await attempt(attacker, ghost, "x");
  const ghostBlocked = await attempt(attacker, ghost, "x");
  expect(ghostBlocked.status).toBe(429);
  expect(ghostBlocked.body.replace(/\d+/g, "N")).toBe(blocked.body.replace(/\d+/g, "N"));
  // the real owner, elsewhere, is not locked out by the attacker
  const home = await ctxAt(browser, randomIp());
  expect((await attempt(home, email, PASSWORD)).signedIn).toBe(true);
  await attacker.close(); await home.close();
});

test("AB-2 the login form says to wait, it does not claim the password is wrong", async ({ browser }) => {
  const { email } = await makeAccount(browser);
  const ctx = await ctxAt(browser, randomIp());
  const page = await ctx.newPage();
  for (let i = 0; i < 8; i++) await attempt(ctx, email, "nope-" + i);
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Log In" }).click();
  await expect(page.getByText(/Too many attempts\. Try again in about \d+ minutes?\./)).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText("Wrong email or password.")).toHaveCount(0);
  await ctx.close();
});

test("AB-3 successful logins do not spend the budget (20 in a row from one address)", async ({ browser }) => {
  const { email } = await makeAccount(browser);
  const ctx = await ctxAt(browser, randomIp());
  for (let i = 0; i < 20; i++) expect((await attempt(ctx, email, PASSWORD)).signedIn, `login ${i}`).toBe(true);
  await ctx.close();
});

test("AB-4 signup: the burst is cut off before more accounts are created", async ({ browser }) => {
  const ctx = await ctxAt(browser, randomIp());
  const statuses: number[] = [];
  for (let i = 0; i < 12; i++) {
    const r = await ctx.request.post("/api/signup", { data: { email: `burst-${Date.now()}-${i}@example.com`, password: PASSWORD } });
    statuses.push(r.status());
    if (r.status() === 429) expect(Number(r.headers()["retry-after"])).toBeGreaterThan(0);
  }
  expect(statuses.filter((s) => s === 200).length).toBe(10);
  expect(statuses.slice(10)).toEqual([429, 429]);
  const same = await ctxAt(browser, randomIp());
  const dupe = `dupe-${Date.now()}@example.com`;
  const s2 = [];
  for (let i = 0; i < 4; i++) s2.push((await same.request.post("/api/signup", { data: { email: dupe, password: PASSWORD } })).status());
  expect(s2).toEqual([200, 409, 409, 429]); // explicit duplicate answer kept (documented residual risk), then the per-email cap
  await ctx.close(); await same.close();
});

test("AB-5 forgot-password: identical answer for a real and an unknown email; per-address 429", async ({ browser }) => {
  const { email } = await makeAccount(browser);
  const ctx = await ctxAt(browser, randomIp());
  const real = await ctx.request.post("/api/auth/forgot-password", { data: { email } });
  const ghost = await ctx.request.post("/api/auth/forgot-password", { data: { email: `ghost-${Date.now()}@example.com` } });
  expect(real.status()).toBe(200);
  expect(ghost.status()).toBe(200);
  expect(await real.text()).toBe(await ghost.text());
  const rest = [];
  for (let i = 0; i < 4; i++) rest.push(await ctx.request.post("/api/auth/forgot-password", { data: { email: `ghost-${Date.now()}-${i}@example.com` } }));
  expect(rest.map((r) => r.status())).toEqual([200, 200, 200, 429]);
  expect(Number(rest[3].headers()["retry-after"])).toBeGreaterThan(0);
  await ctx.close();
});

test("AB-6 reset-password: guessing tokens from one address is cut off", async ({ browser }) => {
  const ctx = await ctxAt(browser, randomIp());
  const s: number[] = [];
  for (let i = 0; i < 12; i++) s.push((await ctx.request.post("/api/auth/reset-password", { data: { token: "garbage-" + i, password: "Passw0rd-new1" } })).status());
  expect(s.slice(0, 10).every((x) => x === 400)).toBe(true);
  expect(s.slice(10)).toEqual([429, 429]);
  await ctx.close();
});

test("AB-7 the counter rows hold only hashes: no email, no address", async ({ browser }) => {
  const ip = randomIp();
  const email = `hashcheck-${Date.now()}@example.com`;
  const ctx = await ctxAt(browser, ip);
  await attempt(ctx, email, "wrong");
  await ctx.request.post("/api/auth/forgot-password", { data: { email } });
  const rows = await sql<{ object_id: string; object_type: string; user_id: string | null; metadata: unknown; path: string | null }>(
    "select object_id, object_type, user_id, metadata, path from app_events where type = 'auth.throttle' order by created_at desc limit 40",
  );
  expect(rows.length).toBeGreaterThan(0);
  const blob = JSON.stringify(rows).toLowerCase();
  expect(blob).not.toContain(email.toLowerCase());
  expect(blob).not.toContain(ip);
  for (const r of rows) {
    expect(r.object_id).toMatch(/^[0-9a-f]{32}$/);
    expect(r.user_id).toBeNull();
    expect(r.metadata).toBeNull();
  }
  await ctx.close();
});
