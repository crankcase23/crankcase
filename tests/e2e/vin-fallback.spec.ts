import { test, expect, type Page } from "@playwright/test";
import { execFileSync } from "node:child_process";
import { signUpNewUser, validVin } from "./helpers";

// NHTSA-outage fallback (flag ON). Needs the vPIC stub and a server started with VIN_FALLBACK_ENABLED=true and
// VPIC_BASE_URL=http://127.0.0.1:3199: run it with `bash scripts/vin/run-fallback-e2e.sh`. Skipped otherwise, so the default
// suite (flag off) stays green and tests/e2e/vin-fallback-disabled.spec.ts covers the off state.
//
// The BROWSER's NHTSA call is faked as down with page.route; the SERVER's NHTSA call goes to the stub, whose answer depends on
// the VIN's first three characters (see scripts/vin/vpic-stub.mjs): 1G1 down (503), 1C4 Jeep Grand Cherokee 2014,
// 5YJ never answers, ZZZ unknown (error 7).
test.skip(process.env.VIN_FALLBACK_E2E !== "on", "needs the vPIC stub and VIN_FALLBACK_ENABLED=true (scripts/vin/run-fallback-e2e.sh)");

const STUB = "http://127.0.0.1:3199";
const psql = (q: string) => execFileSync("psql", ["-h", "127.0.0.1", "-p", "5544", "-U", "postgres", "cc_test", "-At", "-F", "|", "-c", q], { encoding: "utf8" }).trim();
const rowOf = (vin: string) => psql(`select kind, coalesce(vehicle_id,'-'), coalesce(vin_status,'NULL'), coalesce(year,''), coalesce(make,''), coalesce(model,'') from garage_entries where vin='${vin}'`);
const countFor = (email: string) => psql(`select count(*) from garage_entries where user_id=(select id from users where email='${email}')`);
const setMode = (vin: string, mode: string) => fetch(`${STUB}/__mode`, { method: "POST", body: JSON.stringify({ vin, mode }) });
const hits = async (vin: string) => Number(await (await fetch(`${STUB}/__hits/${vin}`)).text());

const CFG = { transmission: "unknown", drivetrain: "unknown" };
const JEEP = { year: "2014", make: "Jeep", model: "Grand Cherokee" };
const HONDA = { year: "2018", make: "Honda", model: "Civic" };

async function addApi(page: Page, vin: string, d: Record<string, unknown> = HONDA, kind = "custom-unverified") {
  const res = await page.request.post("/api/garage", { data: { kind, custom: { vin, ...d }, config: CFG } });
  return { status: res.status(), body: await res.json().catch(() => ({})), headers: res.headers() };
}

async function offerFallback(page: Page, vin: string) {
  await page.route("**/vpic.nhtsa.dot.gov/**", (r) => r.abort("failed")); // the browser cannot reach NHTSA
  await page.goto("/garage/add");
  await page.getByPlaceholder("Enter 17-character VIN").fill(vin);
  await page.getByRole("button", { name: "Decode" }).click();
  await expect(page.getByTestId("vin-fallback-form")).toBeVisible();
}
async function fillAndContinue(page: Page, d: { year: string; make: string; model: string }) {
  const form = page.getByTestId("vin-fallback-form");
  await form.getByLabel("Year").fill(d.year);
  await form.getByLabel("Make").fill(d.make);
  await form.getByLabel("Model").fill(d.model);
  await form.getByRole("checkbox").check();
  await form.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("radiogroup", { name: "Transmission" }).getByText("Not sure", { exact: true }).click();
  await page.getByRole("radiogroup", { name: "Drivetrain" }).getByText("Not sure", { exact: true }).click();
  await page.getByRole("button", { name: /and add to garage$/ }).click();
}

test.describe("NHTSA outage fallback (enabled)", () => {
  test.setTimeout(90_000);
  let email = "";
  test.beforeEach(async ({ page }) => {
    email = await signUpNewUser(page);
  });

  test("outage end to end: typed vehicle is added UNVERIFIED, custom only, with the badge everywhere it shows", async ({ page }) => {
    const vin = validVin("1G1");
    await offerFallback(page, vin);
    await fillAndContinue(page, HONDA);
    await expect(page).toHaveURL(/\/garage\/custom\//);
    expect(rowOf(vin)).toBe("custom|-|unverified|2018|Honda|Civic");
    await expect(page.getByTestId("unverified-badge").first()).toBeVisible();
    await expect(page.getByTestId("unverified-panel")).toContainText("You typed these details yourself");
    // Service History and reminders only: no catalog link, no fluids lookup, no Keys upsell.
    await expect(page.getByText("View its specs, fluids, and guides")).toHaveCount(0);
    await expect(page.getByRole("region", { name: "Get the Keys" })).toHaveCount(0);
    await expect(page.getByRole("heading", { name: "Fluid Capacities" })).toHaveCount(0);
    await expect(page.locator("#history").first()).toBeVisible();
    await expect(page.locator("#maintenance").first()).toBeVisible();
    // The garage card and the printable history carry the label too.
    const id = page.url().split("/garage/custom/")[1].split(/[?#]/)[0];
    await page.goto("/garage");
    await expect(page.getByTestId("unverified-badge").first()).toBeVisible();
    await page.goto(`/garage/custom/${id}/service-history/print`);
    await expect(page.getByText(/UNVERIFIED: details typed by the owner/)).toBeVisible();
  });

  test("an unverified vehicle never calls the vehicle-data lookup (no specs or fluids keyed on typed text)", async ({ page }) => {
    const vin = validVin("1G1");
    expect((await addApi(page, vin, JEEP)).status).toBe(200); // typed as a real catalog vehicle on purpose
    expect(rowOf(vin)).toBe("custom|-|unverified|2014|Jeep|Grand Cherokee"); // still custom, never catalog
    const lookups: string[] = [];
    page.on("request", (r) => r.url().includes("/api/vehicle-data/lookup") && lookups.push(r.url()));
    const id = JSON.parse(await (await page.request.get("/api/garage")).text()).entries.find((e: { custom?: { vin?: string } }) => e.custom?.vin === vin).id;
    await page.goto(`/garage/custom/${id}`);
    await expect(page.getByTestId("unverified-panel")).toBeVisible();
    await page.waitForTimeout(1500);
    expect(lookups).toEqual([]);
    await expect(page.getByText("View its specs, fluids, and guides")).toHaveCount(0);
  });

  test("the server never takes the browser's word: NHTSA reachable and typed details match, so it is added VERIFIED with NHTSA's values", async ({ page }) => {
    const vin = validVin("1C4");
    await offerFallback(page, vin);
    await fillAndContinue(page, { year: "2014", make: "jeep", model: "grand cherokee" });
    await expect(page).toHaveURL(/\/garage\/custom\//);
    expect(rowOf(vin)).toBe("custom|-|verified|2014|JEEP|Grand Cherokee"); // NHTSA's spelling, not the typed one
    await expect(page.getByTestId("unverified-badge")).toHaveCount(0);
  });

  test("NHTSA reachable but the typed details do NOT match: refused, nothing created, says what NHTSA reads", async ({ page }) => {
    const vin = validVin("1C4");
    await offerFallback(page, vin);
    await fillAndContinue(page, { year: "2012", make: "Jeep", model: "Grand Cherokee" });
    await expect(page.getByText(/reads this VIN as 2014 JEEP Grand Cherokee/)).toBeVisible();
    expect(rowOf(vin)).toBe("");
    expect(countFor(email)).toBe("0");
  });

  test("NHTSA reachable but does not know the VIN (error 7): blocked in phase 1, nothing created", async ({ page }) => {
    const vin = validVin("ZZZ");
    const r = await addApi(page, vin);
    expect(r.status).toBe(422);
    expect(r.body.code).toBe("VIN_NOT_DECODABLE");
    expect(countFor(email)).toBe("0");
  });

  test("the form is NOT offered when NHTSA answered 'no clean read' (that is not an outage)", async ({ page }) => {
    await page.route("**/vpic.nhtsa.dot.gov/**", (r) => r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ Results: [{ ModelYear: "", Make: "", Model: "", ErrorCode: "7" }] }) }));
    await page.goto("/garage/add");
    await page.getByPlaceholder("Enter 17-character VIN").fill(validVin("1G1"));
    await page.getByRole("button", { name: "Decode" }).click();
    await expect(page.getByText(/couldn.t get a clean read on that vin/i)).toBeVisible();
    await expect(page.getByTestId("vin-fallback-form")).toHaveCount(0);
  });

  test("a server that cannot reach NHTSA within its timeout still adds UNVERIFIED (hang), not stuck", async ({ page }) => {
    const vin = validVin("5YJ");
    const t0 = Date.now();
    const r = await addApi(page, vin);
    expect(r.status).toBe(200);
    expect(Date.now() - t0).toBeGreaterThan(7_000);
    expect(Date.now() - t0).toBeLessThan(25_000);
    expect(rowOf(vin)).toBe("custom|-|unverified|2018|Honda|Civic");
  });

  test("VIN rules do not relax: bad check digit, bad characters, short VIN and missing details are all refused", async ({ page }) => {
    const good = validVin("1G1");
    const badCheck = good.slice(0, 8) + (good[8] === "7" ? "3" : "7") + good.slice(9);
    expect((await addApi(page, badCheck)).body.code).toBe("VIN_INVALID");
    expect((await addApi(page, good.slice(0, 16))).body.code).toBe("VIN_INVALID");
    expect((await addApi(page, good.replace(/.$/, "O"))).body.code).toBe("VIN_INVALID");
    expect((await addApi(page, "")).body.code).toBe("VIN_INVALID");
    for (const bad of [{ ...HONDA, year: "1975" }, { ...HONDA, year: "abcd" }, { ...HONDA, make: "" }, { ...HONDA, model: "" }, { ...HONDA, make: "<script>alert(1)</script>" }]) {
      const r = await addApi(page, good, bad);
      expect([r.status, r.body.code]).toEqual([400, "DETAILS_INVALID"]);
    }
    expect((await page.request.post("/api/garage", { data: { kind: "custom-unverified", custom: { vin: good, ...HONDA } } })).status()).toBe(400); // no config
    expect(countFor(email)).toBe("0");
    expect(await hits(good)).toBe(0); // refused before NHTSA was ever asked
  });

  test("5 fallback additions per account per day; removing a vehicle does not refund the allowance", async ({ page }) => {
    const ids: string[] = [];
    for (let i = 0; i < 5; i++) {
      const r = await addApi(page, validVin("1G1"));
      expect(r.status).toBe(200);
      ids.push(r.body.entry.id);
    }
    const sixth = await addApi(page, validVin("1G1"));
    expect(sixth.status).toBe(429);
    expect(sixth.body.code).toBe("FALLBACK_CAP");
    expect(Number(sixth.headers["retry-after"])).toBeGreaterThan(0);
    expect((await page.request.delete(`/api/garage/${ids[0]}`)).ok()).toBe(true);
    expect((await addApi(page, validVin("1G1"))).status).toBe(429);
    expect(countFor(email)).toBe("4");
  });

  test("the allowance is per account: a second account is not limited by the first", async ({ page, browser }) => {
    for (let i = 0; i < 5; i++) expect((await addApi(page, validVin("1G1"))).status).toBe(200);
    expect((await addApi(page, validVin("1G1"))).status).toBe(429);
    const ctx = await browser.newContext();
    const other = await ctx.newPage();
    await signUpNewUser(other);
    expect((await addApi(other, validVin("1G1"))).status).toBe(200);
    await ctx.close();
  });

  test("re-adding your own VIN changes nothing, costs no allowance, and never asks NHTSA again", async ({ page }) => {
    const vin = validVin("1G1");
    const first = await addApi(page, vin);
    expect(first.body.created).toBe(true);
    const before = await hits(vin);
    const again = await addApi(page, vin, JEEP); // different typed details: must not overwrite
    expect(again.status).toBe(200);
    expect(again.body.created).toBe(false);
    expect(await hits(vin)).toBe(before);
    expect(rowOf(vin)).toBe("custom|-|unverified|2018|Honda|Civic");
    expect(countFor(email)).toBe("1");
  });

  test("a VIN another account holds does not matter: each account gets its own separate row, and A's row is untouched", async ({ page, browser }) => {
    const vin = validVin("1G1");
    expect((await addApi(page, vin, HONDA, "custom")).status).toBe(200); // account A: a normal (legacy-style) custom add
    const rowBefore = rowOf(vin);
    const ctx = await browser.newContext();
    const b = await ctx.newPage();
    const emailB = await signUpNewUser(b);
    const viaFallback = await addApi(b, vin, JEEP);
    expect(viaFallback.status).toBe(200);
    expect(viaFallback.body.created).toBe(true);
    expect(JSON.stringify(viaFallback.body)).not.toMatch(/Honda|Civic/i); // nothing of A's details comes back
    expect(countFor(emailB)).toBe("1");
    expect(psql(`select count(*) from garage_entries where vin='${vin}'`)).toBe("2");
    expect(psql(`select kind, coalesce(vehicle_id,'-'), coalesce(vin_status,'NULL'), coalesce(year,''), coalesce(make,''), coalesce(model,'') from garage_entries where vin='${vin}' and user_id=(select id from users where email='${email}')`)).toBe(rowBefore);
    await ctx.close();
  });

  test("the 5/day cap holds under parallel requests: 12 at once let at most 5 through, and a refused request leaves no reservation behind", async ({ page }) => {
    const vins = Array.from({ length: 12 }, () => validVin("1G1"));
    const results = await Promise.all(vins.map((v) => addApi(page, v, HONDA)));
    const ok = results.filter((r) => r.status === 200 && r.body.created === true).length;
    const capped = results.filter((r) => r.status === 429).length;
    expect(ok, JSON.stringify(results.map((r) => r.status))).toBeLessThanOrEqual(5);
    expect(ok + capped, "every request is either added or told the cap").toBe(12);
    expect(countFor(email)).toBe(String(ok));
    // the stored allowance matches exactly what was added: refused requests released theirs
    expect(psql(`select count(*) from app_events where type='vin.fallback_add' and user_id=(select id from users where email='${email}')`)).toBe(String(ok));
    // once settled, the cap is real: sequentially, the allowance left is 5 - ok
    const more = await addApi(page, validVin("1G1"), HONDA);
    expect(more.status).toBe(ok >= 5 ? 429 : 200);
  });

  test("parallel adds of the SAME VIN (a double-click, a retry storm) create one row and cost one allowance", async ({ page }) => {
    const vin = validVin("1G1");
    const results = await Promise.all(Array.from({ length: 4 }, () => addApi(page, vin, HONDA)));
    expect(results.map((r) => r.status), "a handful of parallel duplicates must never be capped or fail").toEqual([200, 200, 200, 200]);
    expect(results.filter((r) => r.body.created === true)).toHaveLength(1);
    expect(countFor(email)).toBe("1");
    expect(psql(`select count(*) from app_events where type='vin.fallback_add' and user_id=(select id from users where email='${email}')`)).toBe("1");
  });

  test("parallel adds of the same VIN from two accounts both succeed, every time", async ({ page, browser }) => {
    const ctx = await browser.newContext();
    const b = await ctx.newPage();
    const emailB = await signUpNewUser(b);
    for (let i = 0; i < 4; i++) {
      const vin = validVin("1G1");
      const [ra, rb] = await Promise.all([addApi(page, vin, HONDA), addApi(b, vin, HONDA)]);
      expect([ra.status, rb.status], `round ${i}`).toEqual([200, 200]);
      expect([ra.body.created, rb.body.created]).toEqual([true, true]);
    }
    expect(countFor(email)).toBe("4");
    expect(countFor(emailB)).toBe("4");
    await ctx.close();
  });

  test("legacy rows are untouched: a normal add keeps vin_status NULL and no badge", async ({ page }) => {
    const vin = validVin("1G1");
    expect((await addApi(page, vin, HONDA, "custom")).status).toBe(200);
    expect(rowOf(vin)).toBe("custom|-|NULL|2018|Honda|Civic");
    const entries = (await (await page.request.get("/api/garage")).json()).entries;
    expect(entries.find((e: { custom?: { vin?: string } }) => e.custom?.vin === vin).vinStatus).toBeNull();
  });

  test("verify: the SERVER asks NHTSA; a match upgrades to verified with NHTSA's values, a mismatch or an outage changes nothing", async ({ page }) => {
    const vin = validVin("1G1");
    const added = await addApi(page, vin, JEEP);
    const id = added.body.entry.id;
    // Still down: nothing changes.
    let r = await page.request.post(`/api/garage/${id}/verify`);
    expect([r.status(), (await r.json()).code]).toEqual([503, "DECODER_UNAVAILABLE"]);
    expect(rowOf(vin)).toBe("custom|-|unverified|2014|Jeep|Grand Cherokee");
    // NHTSA recovers but reads a DIFFERENT vehicle: mismatch, nothing changes.
    await setMode(vin, "civic");
    r = await page.request.post(`/api/garage/${id}/verify`);
    expect([r.status(), (await r.json()).code]).toEqual([409, "DETAILS_MISMATCH"]);
    expect(rowOf(vin)).toBe("custom|-|unverified|2014|Jeep|Grand Cherokee");
    // NHTSA reads the same vehicle: verified, with NHTSA's spelling.
    await setMode(vin, "jeep");
    r = await page.request.post(`/api/garage/${id}/verify`);
    expect(r.status()).toBe(200);
    expect((await r.json()).entry.vinStatus).toBe("verified");
    expect(rowOf(vin)).toBe("custom|-|verified|2014|JEEP|Grand Cherokee");
    // Verified rows are not "unverified" any more: a second verify and a details edit are refused.
    r = await page.request.post(`/api/garage/${id}/verify`);
    expect([r.status(), (await r.json()).code]).toEqual([409, "NOT_UNVERIFIED"]);
    r = await page.request.post(`/api/garage/${id}/details`, { data: { year: "2000", make: "X", model: "Y" } });
    expect([r.status(), (await r.json()).code]).toEqual([409, "NOT_UNVERIFIED"]);
    expect(rowOf(vin)).toBe("custom|-|verified|2014|JEEP|Grand Cherokee");
  });

  test("verify from the vehicle page: 'Check with NHTSA now' flips the badge off when NHTSA agrees", async ({ page }) => {
    const vin = validVin("1G1");
    const id = (await addApi(page, vin, JEEP)).body.entry.id;
    await setMode(vin, "jeep");
    await page.goto(`/garage/custom/${id}`);
    await expect(page.getByTestId("unverified-badge").first()).toBeVisible();
    await page.getByRole("button", { name: "Check with NHTSA now" }).click();
    await expect(page.getByTestId("unverified-panel")).toHaveCount(0);
    await expect(page.getByTestId("unverified-badge")).toHaveCount(0);
    expect(rowOf(vin)).toBe("custom|-|verified|2014|JEEP|Grand Cherokee");
  });

  test("correct details: an unverified vehicle's typed details can be fixed, its VIN cannot, and other accounts' vehicles are off limits", async ({ page, browser }) => {
    const vin = validVin("1G1");
    const id = (await addApi(page, vin, HONDA)).body.entry.id;
    let r = await page.request.post(`/api/garage/${id}/details`, { data: { year: "2019", make: "Honda", model: "Civic Si", vin: "SHOULDBEIGNORED00000" } });
    expect(r.status()).toBe(200);
    expect(rowOf(vin)).toBe("custom|-|unverified|2019|Honda|Civic Si");
    expect(psql(`select vin from garage_entries where id='${id}'`)).toBe(vin);
    r = await page.request.post(`/api/garage/${id}/details`, { data: { year: "2019", make: "", model: "Civic" } });
    expect(r.status()).toBe(400);
    const ctx = await browser.newContext();
    const b = await ctx.newPage();
    await signUpNewUser(b);
    expect((await b.request.post(`/api/garage/${id}/verify`)).status()).toBe(404);
    expect((await b.request.post(`/api/garage/${id}/details`, { data: HONDA })).status()).toBe(404);
    expect(rowOf(vin)).toBe("custom|-|unverified|2019|Honda|Civic Si");
    await ctx.close();
  });

  test("signed out: the fallback, verify and details endpoints all refuse", async ({ browser }) => {
    const ctx = await browser.newContext();
    const anon = await ctx.newPage();
    const vin = validVin("1G1");
    expect((await addApi(anon, vin)).status).toBe(401);
    expect((await anon.request.post("/api/garage/anything/verify")).status()).toBe(401);
    expect((await anon.request.post("/api/garage/anything/details", { data: HONDA })).status()).toBe(401);
    await ctx.close();
  });
});
