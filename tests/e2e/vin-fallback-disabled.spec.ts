import { test, expect } from "@playwright/test";
import { execFileSync } from "node:child_process";
import { signUpNewUser, validVin } from "./helpers";

// The NHTSA-outage fallback ships OFF. With VIN_FALLBACK_ENABLED unset the feature must be invisible and inert: no form after
// an outage, and every fallback endpoint answers "not available". (Skipped when the e2e server was started with the flag on;
// tests/e2e/vin-fallback.spec.ts covers that state.)
test.skip(process.env.VIN_FALLBACK_E2E === "on", "flag is ON for this run");

const psql = (q: string) => execFileSync("psql", ["-h", "127.0.0.1", "-p", "5544", "-U", "postgres", "cc_test", "-At", "-c", q], { encoding: "utf8" }).trim();

test.describe("NHTSA outage fallback (disabled by default)", () => {
  test.setTimeout(60_000);

  test("after an NHTSA outage the add page offers no manual form", async ({ page }) => {
    await signUpNewUser(page);
    await page.route("**/vpic.nhtsa.dot.gov/**", (r) => r.abort("failed"));
    await page.goto("/garage/add");
    await page.getByPlaceholder("Enter 17-character VIN").fill(validVin("1G1"));
    await page.getByRole("button", { name: "Decode" }).click();
    await expect(page.getByText(/couldn.t reach the nhtsa vin decoder/i)).toBeVisible();
    await expect(page.getByTestId("vin-fallback-form")).toHaveCount(0);
  });

  test("the fallback endpoints are off: add, verify and details all answer 404 and create nothing", async ({ page }) => {
    const email = await signUpNewUser(page);
    const vin = validVin("1G1");
    const add = await page.request.post("/api/garage", { data: { kind: "custom-unverified", custom: { vin, year: "2018", make: "Honda", model: "Civic" }, config: { transmission: "unknown", drivetrain: "unknown" } } });
    expect(add.status()).toBe(404);
    expect((await add.json()).code).toBe("FALLBACK_DISABLED");
    expect((await page.request.post("/api/garage/anything/verify")).status()).toBe(404);
    expect((await page.request.post("/api/garage/anything/details", { data: { year: "2018", make: "Honda", model: "Civic" } })).status()).toBe(404);
    expect(psql(`select count(*) from garage_entries where user_id=(select id from users where email='${email}')`)).toBe("0");
  });

  test("the normal VIN add is unchanged and leaves vin_status NULL", async ({ page }) => {
    await signUpNewUser(page);
    const vin = validVin("1G1");
    const r = await page.request.post("/api/garage", { data: { kind: "custom", custom: { vin, year: "2018", make: "Honda", model: "Civic" }, config: { transmission: "unknown", drivetrain: "unknown" } } });
    expect(r.status()).toBe(200);
    expect(psql(`select coalesce(vin_status,'NULL') from garage_entries where vin='${vin}'`)).toBe("NULL");
  });
});
