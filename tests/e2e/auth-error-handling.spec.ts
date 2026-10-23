import { test, expect } from "@playwright/test";
import { Client } from "pg";
import { randomIp } from "./helpers";
import { makeResetToken } from "../../src/lib/passwordResetToken";

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

// ---------------------------------------------------------------------------------------------------------------------
// Forgot password. The page and the API are tested separately: the page against mocked answers (so every failure shape is
// deterministic), the API against the real server.
// ---------------------------------------------------------------------------------------------------------------------
const FORGOT = "**/api/auth/forgot-password";
// Next.js ships its own hidden role="alert" route announcer, so the page's error box is looked up inside the form only.
const errorBox = (page: import("@playwright/test").Page) => page.locator("form").getByRole("alert");
const DELIVERY_CLAIM = /on its way|has been sent|have been sent|was sent|we sent|we've sent|is sent|check your inbox/i;

test.describe("forgot password page", () => {
  async function submit(page: import("@playwright/test").Page, email = "someone@example.com") {
    await page.goto("/forgot-password");
    await page.getByLabel("Email").fill(email);
    await page.getByRole("button", { name: /send reset link|sending/i }).click();
  }

  test("FP-1 a server error is reported as an error, never as success, and the form stays usable", async ({ page }) => {
    await page.route(FORGOT, (r) => r.fulfill({ status: 500, body: "" }));
    await submit(page);
    await expect(errorBox(page)).toContainText(/couldn.t|try again/i);
    await expect(page.getByText(DELIVERY_CLAIM), "a failed request must not claim a link was sent").toHaveCount(0);
    await expect(page.getByText(/if an account exists/i)).toHaveCount(0);
    await expect(page.getByLabel("Email")).toHaveValue("someone@example.com");
    await expect(page.getByRole("button", { name: "Send reset link" })).toBeEnabled();
  });

  test("FP-2 a network failure is not a stuck spinner: the button recovers, an error is shown, nothing claims success", async ({ page }) => {
    await page.route(FORGOT, (r) => r.abort("connectionfailed"));
    await submit(page);
    await expect(errorBox(page)).toContainText(/connection|couldn.t|try again/i);
    await expect(page.getByRole("button", { name: "Send reset link" }), "button must not stay on 'Sending…'").toBeEnabled();
    await expect(page.getByText(DELIVERY_CLAIM)).toHaveCount(0);
    await expect(page.getByText(/if an account exists/i)).toHaveCount(0);
  });

  test("FP-3 recovery after a temporary network failure: the same form can simply be submitted again", async ({ page }) => {
    let calls = 0;
    await page.route(FORGOT, (r) => (++calls === 1 ? r.abort("connectionfailed") : r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true }) })));
    await submit(page, "retry@example.com");
    await expect(errorBox(page)).toBeVisible();
    await expect(page.getByLabel("Email")).toHaveValue("retry@example.com");
    await page.getByRole("button", { name: "Send reset link" }).click();
    await expect(page.getByText(/if an account exists/i)).toBeVisible();
    await expect(errorBox(page)).toHaveCount(0);
    expect(calls).toBe(2);
  });

  test("FP-4 the success message is generic and does not claim the email was sent or delivered", async ({ page }) => {
    await page.route(FORGOT, (r) => r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true }) }));
    await submit(page);
    const msg = page.getByText(/if an account exists/i);
    await expect(msg).toBeVisible();
    await expect(page.getByText(DELIVERY_CLAIM), "success wording must not promise delivery").toHaveCount(0);
    // a way out when nothing arrives: use another address without reloading
    await page.getByRole("button", { name: /different email|try again/i }).click();
    await expect(page.getByLabel("Email")).toBeVisible();
  });

  test("FP-5 while the request is in flight the button is disabled and says so, then returns to normal", async ({ page }) => {
    await page.route(FORGOT, async (r) => { await new Promise((x) => setTimeout(x, 800)); await r.fulfill({ status: 500, body: "" }); });
    await page.goto("/forgot-password");
    await page.getByLabel("Email").fill("slow@example.com");
    await page.getByRole("button", { name: "Send reset link" }).click();
    await expect(page.getByRole("button", { name: "Sending…" })).toBeDisabled();
    await expect(errorBox(page)).toBeVisible();
    await expect(page.getByRole("button", { name: "Send reset link" })).toBeEnabled();
  });

  test("FP-6 a rate-limit answer (429, as the throttling PR returns) is shown as 'wait and retry', not as success", async ({ page }) => {
    await page.route(FORGOT, (r) => r.fulfill({ status: 429, contentType: "application/json", headers: { "retry-after": "60" }, body: JSON.stringify({ error: "Too many requests." }) }));
    await submit(page);
    await expect(errorBox(page)).toContainText(/too many|wait/i);
    await expect(page.getByText(/if an account exists/i)).toHaveCount(0);
  });
});

test.describe("forgot password API", () => {
  test("FP-7 known and unknown addresses get byte-identical answers (no account oracle)", async ({ playwright }) => {
    const email = uniqueEmail("fp7");
    const api = await playwright.request.newContext({ baseURL: "http://localhost:3100", extraHTTPHeaders: { "x-forwarded-for": randomIp() } });
    expect((await api.post("/api/signup", { data: { email, password: "testpassword123" } })).status()).toBe(200);
    const known = await api.post("/api/auth/forgot-password", { data: { email } });
    const unknown = await api.post("/api/auth/forgot-password", { data: { email: uniqueEmail("fp7-none") } });
    expect(known.status()).toBe(200);
    expect(unknown.status()).toBe(200);
    expect(await known.text()).toBe(await unknown.text());
    expect((await api.post("/api/auth/forgot-password", { data: { email: "" } })).status(), "empty email is still a plain 400").toBe(400);
    await api.dispose();
  });

  test("FP-8 a database outage is a controlled 503 with a safe message, same for known and unknown (opt-in)", async ({ playwright }) => {
    test.skip(!process.env.CC_DB_OUTAGE, "set CC_DB_OUTAGE=1 and run this test alone");
    const name = new URL(DB_URL).pathname.slice(1);
    const adminUrl = new URL(DB_URL); adminUrl.pathname = "/postgres";
    const c = new Client({ connectionString: adminUrl.toString() });
    await c.connect();
    const api = await playwright.request.newContext({ baseURL: "http://localhost:3100", extraHTTPHeaders: { "x-forwarded-for": randomIp() } });
    const out: { status: number; body: string }[] = [];
    try {
      await c.query(`alter database ${name} with allow_connections false`);
      await c.query("select pg_terminate_backend(pid) from pg_stat_activity where datname=$1 and pid<>pg_backend_pid()", [name]);
      for (const e of [uniqueEmail("fp8a"), uniqueEmail("fp8b")]) {
        const r = await api.post("/api/auth/forgot-password", { data: { email: e } });
        out.push({ status: r.status(), body: await r.text() });
      }
    } finally {
      await c.query(`alter database ${name} with allow_connections true`);
      await c.end();
      await api.dispose();
    }
    for (const r of out) { expect(r.status).toBe(503); expect(r.body).not.toMatch(LEAK); expect(JSON.parse(r.body).error).toMatch(/try again/i); }
    expect(out[0].body).toBe(out[1].body);
  });
});

// ---------------------------------------------------------------------------------------------------------------------
// Disabled-account recovery messaging. A disabled customer can still complete a reset (the documented recovery procedure), but
// the screen after it must not promise a login that will fail, and must be IDENTICAL for disabled and active accounts so it tells
// an attacker holding a reset link nothing about the account's state. Reactivation stays an administrator action.
// ---------------------------------------------------------------------------------------------------------------------
const PASSWORD = "testpassword123";
const NEW_PASSWORD = "NewPass-8472x";
const PROMISE = /you can (now )?log in|you can (now )?sign in|log in with your new password|sign in with your new password|you're all set/i;
const STATE_WORDS = /disabled|suspended|deactivated|blocked|locked|banned|inactive/i;

async function accountWithResetLink(playwright: import("@playwright/test").PlaywrightWorkerArgs["playwright"], tag: string, disabled: boolean) {
  const email = uniqueEmail(tag);
  const api = await playwright.request.newContext({ baseURL: "http://localhost:3100", extraHTTPHeaders: { "x-forwarded-for": randomIp() } });
  expect((await api.post("/api/signup", { data: { email, password: PASSWORD } })).status()).toBe(200);
  await api.dispose();
  if (disabled) await sql("update users set status='disabled', disabled_at=now() where email=$1", [email]);
  const [{ id, password_hash }] = await sql<{ id: string; password_hash: string }>("select id, password_hash from users where email=$1", [email]);
  return { email, id, token: makeResetToken(id, password_hash) };
}
async function resetThroughThePage(page: import("@playwright/test").Page, token: string) {
  await page.goto(`/reset-password?token=${encodeURIComponent(token)}`);
  await page.getByLabel("New password", { exact: true }).fill(NEW_PASSWORD);
  await page.getByLabel(/confirm/i).fill(NEW_PASSWORD);
  await page.getByRole("button", { name: "Set new password" }).click();
  await expect(page.getByRole("heading", { name: "Password updated" })).toBeVisible();
  return (await page.locator("main, body").first().innerText()).replace(/\s+/g, " ").trim();
}
async function signInStatus(playwright: import("@playwright/test").PlaywrightWorkerArgs["playwright"], email: string, password: string) {
  const ctx = await playwright.request.newContext({ baseURL: "http://localhost:3100", extraHTTPHeaders: { "x-forwarded-for": randomIp() } });
  const csrf = (await (await ctx.get("/api/auth/csrf")).json()).csrfToken as string;
  await ctx.post("/api/auth/callback/credentials", { form: { csrfToken: csrf, email, password, json: "true" }, maxRedirects: 0 });
  const id = ((await (await ctx.get("/api/auth/session")).json()) as { user?: { id: string } } | null)?.user?.id ?? null;
  await ctx.dispose();
  return id;
}

test.describe("disabled-account recovery messaging", () => {
  test("DR-1 the screen after a reset does not promise a login and is identical for a disabled and an active account", async ({ browser, playwright }) => {
    const active = await accountWithResetLink(playwright, "dr1a", false);
    const disabled = await accountWithResetLink(playwright, "dr1d", true);
    const pageA = await (await browser.newContext()).newPage();
    const pageD = await (await browser.newContext()).newPage();
    const textA = await resetThroughThePage(pageA, active.token);
    const textD = await resetThroughThePage(pageD, disabled.token);
    expect(textD, "a disabled account must see exactly what an active one sees (no account-state oracle)").toBe(textA);
    expect(textD, "must not promise an immediate login").not.toMatch(PROMISE);
    expect(textD, "must not reveal the account state").not.toMatch(STATE_WORDS);
    expect(textD, "must tell a customer who still cannot sign in what to do next").toMatch(/can.t sign in|cannot sign in|still can.t|if you can.t/i);
    await expect(pageD.getByRole("link", { name: /log in/i }).first()).toBeVisible();
  });

  test("DR-2 the reset answer is byte-identical for disabled and active accounts, and a reset never reactivates", async ({ playwright }) => {
    const active = await accountWithResetLink(playwright, "dr2a", false);
    const disabled = await accountWithResetLink(playwright, "dr2d", true);
    const api = await playwright.request.newContext({ baseURL: "http://localhost:3100", extraHTTPHeaders: { "x-forwarded-for": randomIp() } });
    const ra = await api.post("/api/auth/reset-password", { data: { token: active.token, password: NEW_PASSWORD } });
    const rd = await api.post("/api/auth/reset-password", { data: { token: disabled.token, password: NEW_PASSWORD } });
    expect(rd.status()).toBe(ra.status());
    expect(await rd.text()).toBe(await ra.text());
    await api.dispose();
    expect((await sql<{ status: string }>("select status from users where id=$1", [disabled.id]))[0].status, "reset must not reactivate").toBe("disabled");
  });

  test("DR-3 administrative reactivation is still required: refused while disabled, works with the new password once re-enabled", async ({ playwright }) => {
    const d = await accountWithResetLink(playwright, "dr3", true);
    const api = await playwright.request.newContext({ baseURL: "http://localhost:3100", extraHTTPHeaders: { "x-forwarded-for": randomIp() } });
    expect((await api.post("/api/auth/reset-password", { data: { token: d.token, password: NEW_PASSWORD } })).status()).toBe(200);
    await api.dispose();
    expect(await signInStatus(playwright, d.email, NEW_PASSWORD), "still refused while disabled").toBeNull();
    await sql("update users set status='active', disabled_at=null where id=$1", [d.id]); // what the admin Re-enable button does
    expect(await signInStatus(playwright, d.email, NEW_PASSWORD), "works after re-enable").toBe(d.id);
    expect(await signInStatus(playwright, d.email, PASSWORD), "the old password stays dead").toBeNull();
  });
});
