import { test, expect, type Page } from "@playwright/test";

// Signup form: what the customer typed is what gets submitted (Build 104-H, defect KD-1).
//
// The form kept email and password in React state only. Text typed BEFORE the page hydrated sits in the DOM but never reached that state,
// so after hydration the form still LOOKED filled in, yet submitting it posted empty values and the server answered
// 400 "Enter a valid email." (the browser's own `required` check passes because it reads the DOM). Autofill that skips React's onChange has
// the same effect. The fix reads what is on screen at submit time and adopts it into state at mount.
//
// How these tests create the condition: the app's scripts are HELD BACK by a fixed delay so that typing deterministically happens before
// hydration. They never wait longer to make a failure pass: the click always waits for the observable hydration signal (React attaches
// its props key to the form element), and the assertions are on what the SERVER RECEIVED, not on timing.
//   SR-1  both fields typed before hydration           SR-2  normal typing after hydration (control)
//   SR-3  email before hydration, password after       SR-4  server refuses once, fields keep their text, the retry sends it
//   SR-5  network failure then retry (needs #87's hang fix: CC_NEEDS_PR87=1)
//   SR-6  the corrected value is what server-side validation sees (a short password is refused by the SERVER, by its own message)
//   SR-7  throttling still reaches the customer in the server's own words
//   SR-8  autofill AFTER hydration (the value is set without firing React's onChange) is submitted as it appears on screen
//   SR-9  the same autofill, then a server refusal: the fields are not blanked by the submit re-render and the retry works

const PASSWORD = "testpassword123";
const rand = () => Math.random().toString(36).slice(2, 8);
const uniqueEmail = (tag: string) => `sr-${tag}-${Date.now()}-${rand()}@example.com`;
const randomIp = () => `10.79.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}`;

type Posted = { email?: string; password?: string };

async function openSignup(page: Page, { holdScriptsMs = 0 }: { holdScriptsMs?: number } = {}) {
  await page.context().setExtraHTTPHeaders({ "x-forwarded-for": randomIp() });
  if (holdScriptsMs > 0) {
    await page.route("**/_next/static/**/*.js", async (route) => { await new Promise((r) => setTimeout(r, holdScriptsMs)); await route.continue(); });
  }
  const posted: Posted[] = [];
  page.on("request", (r) => {
    if (r.method() === "POST" && new URL(r.url()).pathname === "/api/signup") posted.push(JSON.parse(r.postData() ?? "{}"));
  });
  await page.goto("/signup", { waitUntil: "domcontentloaded" });
  return posted;
}
// The form is hydrated once React has attached its props to the form element.
const hydrated = (page: Page) =>
  page.waitForFunction(() => { const f = document.querySelector("form"); return !!f && Object.keys(f).some((k) => k.startsWith("__reactProps")); }, undefined, { timeout: 30_000 });
const create = (page: Page) => page.getByRole("button", { name: /Create Account|Creating account/ });

test.describe("signup form: text typed before hydration is not lost", () => {
  test("SR-1 both fields typed before the page hydrates are submitted as typed and the account is created", async ({ page }) => {
    const posted = await openSignup(page, { holdScriptsMs: 3000 });
    const email = uniqueEmail("sr1");
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password").fill(PASSWORD);
    await hydrated(page);
    await create(page).click();
    await expect(page).toHaveURL(/\/garage$/, { timeout: 20_000 });
    expect(posted).toEqual([{ email, password: PASSWORD }]);
  });

  test("SR-2 control: normal typing after hydration still works and is submitted as typed", async ({ page }) => {
    const posted = await openSignup(page);
    await hydrated(page);
    const email = uniqueEmail("sr2");
    await page.getByLabel("Email").pressSequentially(email);
    await page.getByLabel("Password").pressSequentially(PASSWORD);
    await create(page).click();
    await expect(page).toHaveURL(/\/garage$/, { timeout: 20_000 });
    expect(posted).toEqual([{ email, password: PASSWORD }]);
  });

  test("SR-3 email typed before hydration and password typed after it: both arrive", async ({ page }) => {
    const posted = await openSignup(page, { holdScriptsMs: 3000 });
    const email = uniqueEmail("sr3");
    await page.getByLabel("Email").fill(email);
    await hydrated(page);
    await page.getByLabel("Password").pressSequentially(PASSWORD);
    await create(page).click();
    await expect(page).toHaveURL(/\/garage$/, { timeout: 20_000 });
    expect(posted).toEqual([{ email, password: PASSWORD }]);
  });

  test("SR-4 the server refuses once: the form keeps what was typed, shows the server's message, and the retry sends the same text", async ({ page }) => {
    const posted = await openSignup(page, { holdScriptsMs: 3000 });
    let refused = false;
    await page.route("**/api/signup", async (route) => {
      if (!refused) { refused = true; return route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ error: "This is temporarily unavailable. Try again in a minute." }) }); }
      return route.continue();
    });
    const email = uniqueEmail("sr4");
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password").fill(PASSWORD);
    await hydrated(page);
    await create(page).click();
    await expect(page.getByText("This is temporarily unavailable. Try again in a minute.")).toBeVisible();
    await expect(page.getByLabel("Email"), "the error re-render must not wipe the field").toHaveValue(email);
    await expect(page.getByLabel("Password")).toHaveValue(PASSWORD);
    await expect(create(page), "the button is usable again").toBeEnabled();
    await create(page).click();
    await expect(page).toHaveURL(/\/garage$/, { timeout: 20_000 });
    expect(posted).toEqual([{ email, password: PASSWORD }, { email, password: PASSWORD }]);
  });

  test("SR-5 network failure on the first attempt, then a retry (requires PR #87's hang fix)", async ({ page }) => {
    test.skip(!process.env.CC_NEEDS_PR87, "opt-in: set CC_NEEDS_PR87=1 on a tree that carries PR #87 (on main alone the form hangs on a dropped connection, which is that PR's defect)");
    const posted = await openSignup(page, { holdScriptsMs: 3000 });
    let dropped = false;
    await page.route("**/api/signup", async (route) => (!dropped ? ((dropped = true), route.abort("failed")) : route.continue()));
    const email = uniqueEmail("sr5");
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password").fill(PASSWORD);
    await hydrated(page);
    await create(page).click();
    await expect(page.getByRole("alert").filter({ hasText: /couldn.t reach/i })).toBeVisible();
    await expect(page.getByLabel("Email")).toHaveValue(email);
    await create(page).click();
    await expect(page).toHaveURL(/\/garage$/, { timeout: 20_000 });
    expect(posted).toEqual([{ email, password: PASSWORD }, { email, password: PASSWORD }]);
  });

  test("SR-6 the corrected value reaches SERVER validation: a 7-character password typed early is refused by the server with its own message", async ({ page }) => {
    const posted = await openSignup(page, { holdScriptsMs: 3000 });
    const email = uniqueEmail("sr6");
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password").fill("short77");
    await hydrated(page);
    await page.evaluate(() => { (document.querySelector("form") as HTMLFormElement).noValidate = true; }); // skip the browser's own minLength check
    await create(page).click();
    await expect(page.getByText("Password must be at least 8 characters.")).toBeVisible();
    expect(posted).toEqual([{ email, password: "short77" }]);
    await expect(page).toHaveURL(/\/signup$/);
  });

  test("SR-8 a value the browser fills in without firing onChange (autofill) after hydration is submitted as it appears on screen", async ({ page }) => {
    const posted = await openSignup(page);
    await hydrated(page);
    const email = uniqueEmail("sr8");
    await page.evaluate(([e, p]) => {
      // Setting .value directly is what a password manager / autofill does: no input event, so React state never hears about it.
      (document.getElementById("email") as HTMLInputElement).value = e;
      (document.getElementById("password") as HTMLInputElement).value = p;
    }, [email, PASSWORD]);
    await create(page).click();
    await expect(page).toHaveURL(/\/garage$/, { timeout: 20_000 });
    expect(posted).toEqual([{ email, password: PASSWORD }]);
  });

  test("SR-9 autofill after hydration, then the server refuses once: the fields keep what the browser filled in and the retry sends it", async ({ page }) => {
    // Review finding (Build 104-H): the submit read the screen correctly, but the re-render for "Creating account…" reset the fields to
    // the (still empty) React state, so after any server error the customer was looking at blank fields.
    const posted = await openSignup(page);
    let refused = false;
    await page.route("**/api/signup", async (route) => {
      if (!refused) { refused = true; return route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ error: "This is temporarily unavailable. Try again in a minute." }) }); }
      return route.continue();
    });
    await hydrated(page);
    const email = uniqueEmail("sr9");
    await page.evaluate(([e, p]) => {
      (document.getElementById("email") as HTMLInputElement).value = e;
      (document.getElementById("password") as HTMLInputElement).value = p;
    }, [email, PASSWORD]);
    await create(page).click();
    await expect(page.getByText("This is temporarily unavailable. Try again in a minute.")).toBeVisible();
    await expect(page.getByLabel("Email"), "the submit re-render must not blank an autofilled field").toHaveValue(email);
    await expect(page.getByLabel("Password")).toHaveValue(PASSWORD);
    await create(page).click();
    await expect(page).toHaveURL(/\/garage$/, { timeout: 20_000 });
    expect(posted).toEqual([{ email, password: PASSWORD }, { email, password: PASSWORD }]);
  });

  test("SR-7 throttling and duplicate answers still reach the customer in the server's own words", async ({ page }) => {
    const posted = await openSignup(page, { holdScriptsMs: 1500 });
    await page.route("**/api/signup", (route) => route.fulfill({ status: 429, contentType: "application/json", body: JSON.stringify({ error: "Too many attempts. Wait a bit and try again.", retryAfter: 30 }) }));
    const email = uniqueEmail("sr7");
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password").fill(PASSWORD);
    await hydrated(page);
    await create(page).click();
    await expect(page.getByText("Too many attempts. Wait a bit and try again.")).toBeVisible();
    expect(posted).toEqual([{ email, password: PASSWORD }]);
    await expect(page).toHaveURL(/\/signup$/);
  });
});
