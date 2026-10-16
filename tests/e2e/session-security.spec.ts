import { test, expect, type Browser, type BrowserContext } from "@playwright/test";
import { Client } from "pg";
import { encode } from "next-auth/jwt";
import { signUpNewUser, randomIp } from "./helpers";
import { makeResetToken } from "../../src/lib/passwordResetToken";

// Session security (PR B). Sessions are stateless JWTs, so each case below is a way a stale session used to keep working:
//   SS-1 disabled account            SS-2 deleted account            SS-3 password reset, two browsers
//   SS-4 token from before the password-version stamp existed (no grandfathering: one re-login)
//   SS-5 control: an ordinary session keeps working, and a fresh login after reset works.
// The database is used only to flip the state under test (disable, delete) and to read what a reset link is signed against.
// It is the same database the app server uses (DATABASE_URL), with the suite's usual local scratch default.

const PASSWORD = "testpassword123";
const DB_URL = process.env.DATABASE_URL ?? "postgres://postgres@127.0.0.1:5544/cc_test";
async function sql<T = Record<string, unknown>>(text: string, params: unknown[] = []): Promise<T[]> {
  const c = new Client({ connectionString: DB_URL });
  await c.connect();
  try { return (await c.query(text, params)).rows as T[]; } finally { await c.end(); }
}

/** Credentials sign-in through the real Auth.js endpoint; the session cookie lands in `ctx`. */
async function login(ctx: BrowserContext, email: string, password = PASSWORD) {
  const csrf = (await (await ctx.request.get("/api/auth/csrf")).json()).csrfToken as string;
  await ctx.request.post("/api/auth/callback/credentials", { form: { csrfToken: csrf, email, password, json: "true" }, maxRedirects: 0 });
  return ((await (await ctx.request.get("/api/auth/session")).json()) as { user?: { id: string } } | null)?.user?.id ?? null;
}
const freshContext = async (browser: Browser) => browser.newContext({ extraHTTPHeaders: { "x-forwarded-for": randomIp() } });
const garageStatus = (ctx: BrowserContext) => ctx.request.get("/api/garage").then((r) => r.status());

test.beforeAll(async ({ request }) => {
  for (const p of ["/signup", "/login", "/garage"]) await request.get(p, { timeout: 90_000, failOnStatusCode: false });
});

test("SS-5 control: a normal session works, and /garage loads", async ({ page, context }) => {
  await signUpNewUser(page);
  expect(await garageStatus(context)).toBe(200);
  await page.goto("/garage");
  await expect(page).toHaveURL(/\/garage$/);
});

test("SS-1 a disabled account's EXISTING session stops working immediately (API and page)", async ({ page, context }) => {
  const email = await signUpNewUser(page);
  expect(await garageStatus(context)).toBe(200);
  await sql("update users set status='disabled' where email=$1", [email]);
  expect(await garageStatus(context), "API must refuse the old session").toBe(401);
  await page.goto("/garage");
  await expect(page, "page must send the old session to /login").toHaveURL(/\/login/);
  const ctx2 = await freshContext(page.context().browser()!);
  expect(await login(ctx2, email), "a fresh sign-in is refused too").toBeNull();
  await ctx2.close();
});

test("SS-2 a deleted account's existing session stops working immediately", async ({ page, context }) => {
  const email = await signUpNewUser(page);
  expect(await garageStatus(context)).toBe(200);
  const [{ id }] = await sql<{ id: string }>("select id from users where email=$1", [email]);
  await sql("delete from login_events where user_id=$1", [id]);
  await sql("delete from users where id=$1", [id]);
  expect(await garageStatus(context)).toBe(401);
  await page.goto("/garage");
  await expect(page).toHaveURL(/\/login/);
});

test("SS-3 password reset signs out every other browser (two-browser check)", async ({ page, context, browser }) => {
  const email = await signUpNewUser(page); // browser 1
  const ctx2 = await freshContext(browser); // browser 2, same account
  expect(await login(ctx2, email)).not.toBeNull();
  expect(await garageStatus(context)).toBe(200);
  expect(await garageStatus(ctx2)).toBe(200);

  // The reset is done by a third party (whoever holds the emailed link), with no session of its own.
  const [{ id, password_hash }] = await sql<{ id: string; password_hash: string }>("select id, password_hash from users where email=$1", [email]);
  const token = makeResetToken(id, password_hash);
  const resetter = await freshContext(browser);
  const res = await resetter.request.post("/api/auth/reset-password", { data: { token, password: "NewPass-8472x" } });
  expect(res.status()).toBe(200);

  expect(await garageStatus(context), "browser 1 must be signed out").toBe(401);
  expect(await garageStatus(ctx2), "browser 2 must be signed out").toBe(401);
  await page.goto("/garage");
  await expect(page).toHaveURL(/\/login/);

  // the old password no longer works, the new one does, and the new session is healthy
  const old = await freshContext(browser);
  expect(await login(old, email, PASSWORD)).toBeNull();
  const neu = await freshContext(browser);
  expect(await login(neu, email, "NewPass-8472x")).not.toBeNull();
  expect(await garageStatus(neu)).toBe(200);
  // the reset link itself is single-use
  const again = await resetter.request.post("/api/auth/reset-password", { data: { token, password: "OtherPass-77x" } });
  expect(again.status()).toBe(400);
  await Promise.all([ctx2.close(), resetter.close(), old.close(), neu.close()]);
});

test("SS-4 a session issued before the password-version stamp existed is refused: one re-login, no grandfathering", async ({ page, browser }) => {
  const email = await signUpNewUser(page);
  const [{ id }] = await sql<{ id: string }>("select id from users where email=$1", [email]);
  const secret = process.env.AUTH_SECRET!;
  expect(secret, "AUTH_SECRET must be set for the test process (same value as the server)").toBeTruthy();
  const salt = "authjs.session-token";
  const legacy = await encode({ token: { userId: id, email }, secret, salt, maxAge: 3600 }); // exactly what the old callback minted: no pwv
  const ctx = await freshContext(browser);
  await ctx.addCookies([{ name: salt, value: legacy, url: "http://localhost:3100" }]);
  expect(await garageStatus(ctx), "an unstamped token must not be accepted").toBe(401);
  expect(await login(ctx, email), "signing in again gives a stamped session").not.toBeNull();
  expect(await garageStatus(ctx)).toBe(200);
  await ctx.close();
});
