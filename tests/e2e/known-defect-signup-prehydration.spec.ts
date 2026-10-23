import { test, expect } from "@playwright/test";

// KNOWN DEFECT KD-1 (found during 104-G verification, NOT fixed here: it is signup behaviour, outside the logging scope).
// The signup form keeps email and password in React state (useState). Text typed before the page hydrates is in the DOM but never reached
// that state, so after hydration the form still LOOKS filled in, yet submitting it posts empty values and the server answers
// 400 "Enter a valid email." That is what a customer on a slow phone connection sees, and it is what made the shared test helper
// signUpNewUser intermittently time out (SH-1d setup) when two workers shared a CPU. Reproduced on pristine main and on the integrated tree.
//
// This spec states the CORRECT behaviour (the form submits what is on screen). It is marked as an expected failure, so:
//   * today it PASSES AS "expected to fail", documenting the defect permanently;
//   * run it with CC_KNOWN_DEFECTS=strict to see the red failure;
//   * the day the form is fixed it starts failing as "unexpectedly passed": delete the test.fail line then.
test("KD-1 a signup typed before the page finishes loading is submitted as typed", async ({ page }) => {
  test.fail(process.env.CC_KNOWN_DEFECTS !== "strict", "known defect KD-1: pre-hydration input never reaches React state (signup posts empty values)");
  await page.context().setExtraHTTPHeaders({ "x-forwarded-for": `10.78.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}` });
  // Hold the app's scripts back so hydration reliably happens AFTER the customer has typed.
  await page.route("**/_next/static/**/*.js", async (route) => { await new Promise((r) => setTimeout(r, 3000)); await route.continue(); });
  await page.goto("/signup", { waitUntil: "domcontentloaded" });
  await page.getByLabel("Email").fill(`kd1-${Date.now()}-${Math.random().toString(36).slice(2, 7)}@example.com`);
  await page.getByLabel("Password").fill("testpassword123");
  await page.waitForTimeout(7000); // hydration completes; the fields still show what was typed
  await page.getByRole("button", { name: "Create Account" }).click();
  await expect(page).toHaveURL(/\/garage$/, { timeout: 20_000 });
});
