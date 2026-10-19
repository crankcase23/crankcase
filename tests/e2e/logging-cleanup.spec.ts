import { test, expect, type Browser, type Page } from "@playwright/test";
import { Client } from "pg";
import { randomIp } from "./helpers";
import { makeResetToken } from "../../src/lib/passwordResetToken";

// Security logging cleanup and form hangs (Build 104-F).
//   SF-*  signup page: a failed request must end in a visible, honest error and a usable form (it used to hang on "Creating account…"
//         forever and throw an unhandled rejection), and the existing server messages must still reach the customer
//   RF-*  reset-password page: same hang when the network fails while saving the new password
//   RS-*  reset-password API (opt-in, CC_DB_FAULT=1, run alone): a REAL database failure while saving must answer 503 with a fixed message,
//         never SQL, parameters or the new password hash
// Local scratch database only (DATABASE_URL, default is the suite's scratch cluster).

const DB_URL = process.env.DATABASE_URL ?? "postgres://postgres@127.0.0.1:5544/cc_test";
const PASSWORD = "testpassword123";
const NEW_PASSWORD = "NewPass-8472x";
const LEAK = /Failed query|update "users"|insert into|select "|from "users"|params:|\$2[aby]\$|password_hash|users_email|duplicate key|violates|ECONNREFUSED|ECONNRESET|connection (terminated|refused)|node_modules|postgres(ql)?:\/\//i;

async function sql<T = Record<string, unknown>>(text: string, params: unknown[] = []): Promise<T[]> {
  const c = new Client({ connectionString: DB_URL });
  await c.connect();
  try { return (await c.query(text, params)).rows as T[]; } finally { await c.end(); }
}
const uniqueEmail = (tag: string) => `e2e-${tag}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}@example.com`;

async function pageAt(browser: Browser, path: string): Promise<{ page: Page; close: () => Promise<void>; errors: string[] }> {
  const ctx = await browser.newContext({ extraHTTPHeaders: { "x-forwarded-for": randomIp() } });
  const page = await ctx.newPage();
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(String(e.message)));
  await page.goto(path);
  return { page, close: () => ctx.close(), errors };
}

test.beforeAll(async ({ request }) => {
  // Warm every route the tests touch, including the Auth.js endpoints: a cold dev compile must not look like a product failure.
  for (const p of ["/signup", "/login", "/reset-password?token=x", "/api/auth/csrf", "/api/auth/session", "/api/auth/providers"]) await request.get(p, { timeout: 90_000, failOnStatusCode: false });
});

async function fillSignup(page: Page, email: string) {
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(PASSWORD);
}
const signupButton = (page: Page) => page.getByRole("button", { name: /^(Create Account|Creating account…)$/ });

test.describe("signup page", () => {
  test("SF-1 a dropped connection is a visible error and a usable form, not a stuck spinner", async ({ browser }) => {
    const { page, close, errors } = await pageAt(browser, "/signup");
    await page.route("**/api/signup", (r) => r.abort("failed"));
    const email = uniqueEmail("sf1");
    await fillSignup(page, email);
    await signupButton(page).click();
    await expect(page.getByText(/couldn.t reach|check your connection/i), "the customer is told what happened").toBeVisible({ timeout: 10_000 });
    await expect(signupButton(page)).toHaveText("Create Account");
    await expect(signupButton(page)).toBeEnabled();
    await expect(page.getByLabel("Email"), "the typed address is kept").toHaveValue(email);
    expect(page.url()).toContain("/signup");
    expect(errors, "no unhandled rejection from the failed request").toEqual([]);
    await close();
  });

  test("SF-2 recovery: after the network comes back the same form creates the account", async ({ browser }) => {
    const { page, close } = await pageAt(browser, "/signup");
    await page.route("**/api/signup", (r) => r.abort("failed"));
    const email = uniqueEmail("sf2");
    await fillSignup(page, email);
    await signupButton(page).click();
    await expect(page.getByText(/couldn.t reach|check your connection/i)).toBeVisible({ timeout: 10_000 });
    await page.unroute("**/api/signup");
    await signupButton(page).click();
    await expect(page).toHaveURL(/\/garage$/, { timeout: 30_000 });
    expect((await sql("select 1 from users where email=$1", [email])).length).toBe(1);
    await close();
  });

  test("SF-3 a proxy error page (non-JSON 502) is an honest error, not a hang and not an unhandled rejection", async ({ browser }) => {
    const { page, close, errors } = await pageAt(browser, "/signup");
    await page.route("**/api/signup", (r) => r.fulfill({ status: 502, contentType: "text/html", body: "<html><body>Bad gateway at /srv/app/node_modules/x</body></html>" }));
    await fillSignup(page, uniqueEmail("sf3"));
    await signupButton(page).click();
    await expect(page.getByText(/couldn.t create your account|try again/i)).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText(/Bad gateway|node_modules/), "nothing from the raw reply is shown").toHaveCount(0);
    await expect(signupButton(page)).toBeEnabled();
    expect(errors).toEqual([]);
    await close();
  });

  test("SF-4 a throttle answer (429 JSON, as the throttling PR returns) shows its own message and the form recovers", async ({ browser }) => {
    const { page, close } = await pageAt(browser, "/signup");
    await page.route("**/api/signup", (r) => r.fulfill({ status: 429, contentType: "application/json", headers: { "retry-after": "60" }, body: JSON.stringify({ error: "Too many sign-up attempts. Wait a bit and try again." }) }));
    await fillSignup(page, uniqueEmail("sf4"));
    await signupButton(page).click();
    await expect(page.getByText("Too many sign-up attempts. Wait a bit and try again.")).toBeVisible();
    await expect(signupButton(page)).toBeEnabled();
    await close();
  });

  test("SF-5 existing messages are preserved: a duplicate shows the server's own words", async ({ browser }) => {
    const { page, close } = await pageAt(browser, "/signup");
    await page.route("**/api/signup", (r) => r.fulfill({ status: 409, contentType: "application/json", body: JSON.stringify({ error: "An account with that email already exists." }) }));
    await fillSignup(page, uniqueEmail("sf5"));
    await signupButton(page).click();
    await expect(page.getByText("An account with that email already exists.")).toBeVisible();
    await expect(signupButton(page)).toBeEnabled();
    await close();
  });
});

test.describe("reset-password page", () => {
  async function resetPage(browser: Browser, token: string) {
    return pageAt(browser, "/reset-password?token=" + encodeURIComponent(token));
  }
  const fill = async (page: Page, pw: string) => {
    await page.getByLabel("New password", { exact: true }).fill(pw);
    await page.getByLabel(/confirm/i).fill(pw);
  };
  const submit = (page: Page) => page.getByRole("button", { name: /^(Set new password|Saving…)$/ });

  test("RF-1 a dropped connection while saving is a visible error and a usable form, not a stuck 'Saving…'", async ({ browser }) => {
    const { page, close, errors } = await resetPage(browser, "placeholder-token");
    await page.route("**/api/auth/reset-password", (r) => r.abort("failed"));
    await fill(page, NEW_PASSWORD);
    await submit(page).click();
    await expect(page.getByText(/couldn.t reach|check your connection/i)).toBeVisible({ timeout: 10_000 });
    await expect(submit(page)).toHaveText("Set new password");
    await expect(submit(page)).toBeEnabled();
    expect(errors).toEqual([]);
    await close();
  });

  test("RF-2 the server's own message still reaches the customer (503 JSON) and a non-JSON reply gets the generic one", async ({ browser }) => {
    const { page, close } = await resetPage(browser, "placeholder-token");
    await page.route("**/api/auth/reset-password", (r) => r.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ error: "We couldn't update your password right now. Please try again in a minute." }) }));
    await fill(page, NEW_PASSWORD);
    await submit(page).click();
    await expect(page.getByText("We couldn't update your password right now. Please try again in a minute.")).toBeVisible();
    await page.unroute("**/api/auth/reset-password");
    await page.route("**/api/auth/reset-password", (r) => r.fulfill({ status: 502, contentType: "text/html", body: "<html>Bad gateway</html>" }));
    await submit(page).click();
    await expect(page.getByText("Something went wrong. Try again.")).toBeVisible();
    await expect(submit(page)).toBeEnabled();
    await close();
  });

  test("RF-3 recovery: after the network failure the same link still works and saves the password", async ({ browser, playwright }) => {
    const email = uniqueEmail("rf3");
    const api = await playwright.request.newContext({ baseURL: `http://localhost:${new URL(test.info().project.use.baseURL ?? "http://localhost:3100").port}`, extraHTTPHeaders: { "x-forwarded-for": randomIp() } });
    expect((await api.post("/api/signup", { data: { email, password: PASSWORD } })).status()).toBe(200);
    const [{ id, password_hash }] = await sql<{ id: string; password_hash: string }>("select id, password_hash from users where email=$1", [email]);
    const token = makeResetToken(id, password_hash);
    const { page, close } = await resetPage(browser, token);
    await page.route("**/api/auth/reset-password", (r) => r.abort("failed"));
    await fill(page, NEW_PASSWORD);
    await submit(page).click();
    await expect(page.getByText(/couldn.t reach|check your connection/i)).toBeVisible({ timeout: 10_000 });
    await page.unroute("**/api/auth/reset-password");
    await submit(page).click();
    await expect(page.getByRole("heading", { name: "Password updated" })).toBeVisible({ timeout: 20_000 });
    expect((await sql<{ password_hash: string }>("select password_hash from users where email=$1", [email]))[0].password_hash).not.toBe(password_hash);
    await close(); await api.dispose();
  });
});

// Opt-in: injects a REAL failure into the scratch database (a trigger that makes one throwaway user's password UPDATE fail) so the
// reset route runs its real drizzle code path. Run alone: CC_DB_FAULT=1 npx playwright test tests/e2e/logging-cleanup.spec.ts -g RS-
test.describe("reset-password API under a real database failure", () => {
  test.skip(!process.env.CC_DB_FAULT, "opt-in: set CC_DB_FAULT=1 (injects a trigger into the scratch database, removed afterwards)");

  test("RS-1 a failing save answers 503 with a fixed message: no SQL, no parameters, no hash; the password is unchanged", async ({ playwright }) => {
    const email = uniqueEmail("rs1");
    const api = await playwright.request.newContext({ baseURL: `http://localhost:${new URL(test.info().project.use.baseURL ?? "http://localhost:3100").port}`, extraHTTPHeaders: { "x-forwarded-for": randomIp() } });
    expect((await api.post("/api/signup", { data: { email, password: PASSWORD } })).status()).toBe(200);
    const [{ id, password_hash }] = await sql<{ id: string; password_hash: string }>("select id, password_hash from users where email=$1", [email]);
    const token = makeResetToken(id, password_hash);
    const safe = email.replace(/[^a-z0-9@.-]/gi, "");
    await sql(`create or replace function cc_fault_104f() returns trigger language plpgsql as $$ begin raise exception 'cc fault injected for tests'; end $$`);
    await sql(`create trigger cc_fault_104f before update of password_hash on users for each row when (old.email = '${safe}') execute function cc_fault_104f()`);
    try {
      const res = await api.post("/api/auth/reset-password", { data: { token, password: NEW_PASSWORD } });
      const body = await res.text();
      expect(res.status()).toBe(503);
      expect(body).not.toMatch(LEAK);
      expect(JSON.parse(body).error).toMatch(/try again/i);
      expect((await sql<{ password_hash: string }>("select password_hash from users where email=$1", [email]))[0].password_hash, "a failed save leaves the password alone").toBe(password_hash);
    } finally {
      await sql("drop trigger if exists cc_fault_104f on users");
      await sql("drop function if exists cc_fault_104f()");
      await api.dispose();
    }
  });
});
