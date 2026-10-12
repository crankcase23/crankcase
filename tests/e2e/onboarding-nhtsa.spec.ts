import { test, expect, type Page, type Route } from "@playwright/test";
import { execFileSync } from "node:child_process";
import { signUpNewUser, validVin } from "./helpers";

// Customer onboarding certification: what a new customer sees when the NHTSA VIN decoder misbehaves.
// A VIN is now REQUIRED to put a vehicle in the garage (#43), and the decode runs in the browser against vPIC, so NHTSA
// trouble is the first thing a new customer can hit. These tests pin what the screen does in each failure mode.
// Fault injection is at the network layer (page.route); everything after the decode is the real app and database.

const psql = (q: string) => execFileSync("psql", ["-h", "127.0.0.1", "-p", "5544", "-U", "postgres", "cc_test", "-At", "-c", q], { encoding: "utf8" }).trim();
const garageRowsFor = (email: string) => psql(`select count(*) from garage_entries where user_id=(select id from users where email='${email}')`);

const JEEP_ROW = { ModelYear: "2014", Make: "JEEP", Model: "Grand Cherokee", Trim: "Laredo", EngineCylinders: "6", DisplacementL: "3.6", FuelTypePrimary: "Gasoline", ErrorCode: "0", ErrorText: "0 - VIN decoded clean. Check Digit (9th position) is correct" };
const ok = (row: Record<string, string>) => (r: Route) => r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ Count: 1, Message: "Results returned successfully", Results: [row] }) });

const OUTAGE = /couldn.t reach the nhtsa vin decoder/i;
const NO_READ = /couldn.t get a clean read on that vin/i;

async function decodeWith(page: Page, handler: (r: Route) => unknown, vin = validVin("1C4")) {
  await page.route("**/vpic.nhtsa.dot.gov/**", handler);
  await page.goto("/garage/add");
  await page.getByPlaceholder("Enter 17-character VIN").fill(vin);
  await page.getByRole("button", { name: "Decode" }).click();
}

test.describe("NHTSA decoder trouble during onboarding", () => {
  test.setTimeout(90_000);
  let email = "";
  test.beforeEach(async ({ page }) => {
    email = await signUpNewUser(page);
  });

  const outages: [string, (r: Route) => unknown][] = [
    ["the network request fails", (r) => r.abort("failed")],
    ["NHTSA answers HTTP 500", (r) => r.fulfill({ status: 500, body: "boom" })],
    ["NHTSA answers HTTP 503 with an HTML maintenance page", (r) => r.fulfill({ status: 503, contentType: "text/html", body: "<html>maintenance</html>" })],
    ["NHTSA answers 200 with a body that is not JSON", (r) => r.fulfill({ status: 200, contentType: "text/html", body: "<html>gateway</html>" })],
  ];
  for (const [name, handler] of outages) {
    test(`${name}: says so plainly, can retry, and creates nothing`, async ({ page }) => {
      await decodeWith(page, handler);
      await expect(page.getByText(OUTAGE)).toBeVisible();
      await expect(page.getByRole("button", { name: "Decode" })).toBeEnabled(); // not stuck on "Decoding…"
      expect(garageRowsFor(email)).toBe("0");
    });
  }

  test("NHTSA never answers: the screen gives up with the same plain message instead of spinning forever", async ({ page }) => {
    await decodeWith(page, () => new Promise(() => {})); // never fulfilled
    await expect(page.getByText(OUTAGE)).toBeVisible({ timeout: 30_000 });
    await expect(page.getByRole("button", { name: "Decode" })).toBeEnabled();
    expect(garageRowsFor(email)).toBe("0");
  });

  test("NHTSA does not know the VIN (empty result, error 7): says it could not read it, creates nothing", async ({ page }) => {
    await decodeWith(page, ok({ ErrorCode: "7", ErrorText: "7 - Manufacturer is not registered with NHTSA for sale or importation in the U.S." }));
    await expect(page.getByText(NO_READ)).toBeVisible();
    expect(garageRowsFor(email)).toBe("0");
  });

  test("NHTSA returns a partial decode (no model year): refuses to guess and creates nothing", async ({ page }) => {
    await decodeWith(page, ok({ ...JEEP_ROW, ModelYear: "", ErrorCode: "6", ErrorText: "6 - Incomplete VIN" }));
    await expect(page.getByText(NO_READ)).toBeVisible();
    expect(garageRowsFor(email)).toBe("0");
  });

  test("the failure messages never send the customer to a manual add that no longer exists", async ({ page }) => {
    // #43: the manual Year/Make/Model picker is browse-only ("This doesn't add anything to your garage").
    for (const [handler, message] of [[(r: Route) => r.abort("failed"), OUTAGE], [ok({ ErrorCode: "7" }), NO_READ]] as const) {
      await page.unroute("**/vpic.nhtsa.dot.gov/**");
      await decodeWith(page, handler);
      const box = page.getByText(message);
      await expect(box).toBeVisible();
      const text = (await box.innerText()).toLowerCase();
      expect(text, "the add page says a VIN is required, so the error must not offer a manual add").not.toMatch(/add your vehicle manually/);
    }
  });

  test("recovery: a failed decode, then NHTSA comes back, and the same VIN goes through to Confirm Your Ride", async ({ page }) => {
    let calls = 0;
    await decodeWith(page, (r) => (++calls === 1 ? r.abort("failed") : ok(JEEP_ROW)(r)));
    await expect(page.getByText(OUTAGE)).toBeVisible();
    await page.getByRole("button", { name: "Decode" }).click();
    await expect(page.getByText(OUTAGE)).toHaveCount(0);
    await page.getByRole("button", { name: /^\+ Add (this vehicle )?to (my )?garage$/i }).first().click();
    await expect(page.getByTestId("confirm-your-ride")).toBeVisible();
    expect(garageRowsFor(email)).toBe("0"); // nothing saved until both choices are confirmed
  });

  test("a slow NHTSA shows progress and a double click makes one request and one vehicle", async ({ page }) => {
    let calls = 0;
    await decodeWith(page, async (r) => {
      calls++;
      await new Promise((res) => setTimeout(res, 2500));
      await ok(JEEP_ROW)(r);
    });
    await expect(page.getByRole("button", { name: "Decoding…" })).toBeVisible();
    await page.getByRole("button", { name: "Decoding…" }).click({ force: true }).catch(() => {});
    await page.getByRole("button", { name: /^\+ Add (this vehicle )?to (my )?garage$/i }).first().click({ timeout: 15_000 });
    expect(calls).toBe(1);
    await page.getByRole("radiogroup", { name: "Transmission" }).getByText("Not sure", { exact: true }).click();
    await page.getByRole("radiogroup", { name: "Drivetrain" }).getByText("Not sure", { exact: true }).click();
    await page.getByRole("button", { name: /and add to garage$/ }).dblclick();
    await expect(page).toHaveURL(/\/vehicles\//);
    expect(garageRowsFor(email)).toBe("1");
  });
});
