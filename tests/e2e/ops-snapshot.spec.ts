import { test, expect, request as playwrightRequest } from "@playwright/test";

// ---------------------------------------------------------------------------
// Contract tests for GET /api/integrations/ops/snapshot and its relationship
// to /api/admin/report.
//
// Needs a running app with a reachable DATABASE_URL and BOTH tokens set in
// the environment the dev server reads (.env.local). The tokens used here are
// read from the test process's own env - they are never written down in this
// file. Skips itself cleanly when they are absent so the marketing/garage
// smoke tests still run without a database.
// ---------------------------------------------------------------------------

const SNAPSHOT = "/api/integrations/ops/snapshot";
const REPORT = "/api/admin/report";

const OPS = process.env.OPS_SNAPSHOT_TOKEN;
const ADMIN = process.env.ADMIN_REPORT_TOKEN;

test.describe("ops snapshot bridge", () => {
  // Serial: the last test deliberately trips the rate limit, and the server
  // counts every authenticated call in this file against the same window.
  test.describe.configure({ mode: "serial" });
  test.skip(!OPS || !ADMIN, "OPS_SNAPSHOT_TOKEN and ADMIN_REPORT_TOKEN must be set for these tests");

  // The password gate is a no-op when SITE_PASSWORD is unset (local dev); the
  // exemption itself is asserted structurally in src/proxy.ts and proven in
  // the deployed environment.

  test("1. no token -> 401", async ({ request }) => {
    const res = await request.get(SNAPSHOT);
    expect(res.status()).toBe(401);
    expect(await res.json()).toEqual({ error: "Unauthorized." });
    expect(res.headers()["cache-control"]).toContain("no-store");
  });

  test("2. malformed token -> 401 (same body)", async ({ request }) => {
    for (const header of ["Bearer", "Bearer ", `Basic ${OPS}`, `Token ${OPS}`, `bearer ${OPS}`]) {
      const res = await request.get(SNAPSHOT, { headers: { Authorization: header } });
      expect(res.status(), header).toBe(401);
      expect(await res.json()).toEqual({ error: "Unauthorized." });
    }
  });

  test("3. wrong token -> 401 (same body)", async ({ request }) => {
    const res = await request.get(SNAPSHOT, { headers: { Authorization: `Bearer ${"x".repeat(40)}` } });
    expect(res.status()).toBe(401);
    expect(await res.json()).toEqual({ error: "Unauthorized." });
  });

  test("4/8/9. correct token -> 200, no-store, schemaVersion", async ({ request }) => {
    const res = await request.get(SNAPSHOT, { headers: { Authorization: `Bearer ${OPS}` } });
    expect(res.status()).toBe(200);
    expect(res.headers()["cache-control"]).toContain("no-store");
    expect(res.headers()["x-schema-version"]).toBe("1");
    const body = await res.json();
    expect(body.schemaVersion).toBe(1);
    expect(body.integration).toBe("ops-snapshot");
    expect(typeof body.generatedAt).toBe("string");
    expect(body.truncated).toBe(false);
  });

  test("5. ADMIN_REPORT_TOKEN does NOT open the snapshot", async ({ request }) => {
    const res = await request.get(SNAPSHOT, { headers: { Authorization: `Bearer ${ADMIN}` } });
    expect(res.status()).toBe(401);
  });

  test("6. OPS_SNAPSHOT_TOKEN does NOT open /api/admin/report", async ({ request }) => {
    const res = await request.get(REPORT, { headers: { Authorization: `Bearer ${OPS}` } });
    expect(res.status()).toBe(401);
  });

  test("7. non-GET methods are refused, even with the right token", async ({ request }) => {
    const headers = { Authorization: `Bearer ${OPS}` };
    for (const method of ["post", "put", "patch", "delete"] as const) {
      const res = await request[method](SNAPSHOT, { headers, data: { anything: true } });
      expect(res.status(), method).toBe(405);
    }
  });

  test("10/12. payload carries no email, admin note, user ids or raw control chars", async ({ request }) => {
    const res = await request.get(SNAPSHOT, { headers: { Authorization: `Bearer ${OPS}` } });
    const text = await res.text();
    const body = JSON.parse(text);

    // Nothing that looks like an email address anywhere in the document.
    expect(text).not.toMatch(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
    // Seeded admin notes and internal ids must not leak.
    expect(text).not.toContain("PRIVATE ADMIN NOTE");
    expect(text).not.toContain("another private note");
    expect(text).not.toContain("u-test-1");
    expect(text).not.toMatch(/"adminNote"|"userId"|"userEmail"|"createdBy"|"completedBy"/);
    // Neither secret, nor either env var name's value, appears in the body.
    expect(text).not.toContain(OPS!);
    expect(text).not.toContain(ADMIN!);

    // The hostile message is present as DATA - still a string in the field it
    // belongs in - but cleaned of zero-width / bidi tricks and capped.
    const hostile = body.fromTheSite.new.find((f: { id: string }) => f.id === "fb-1");
    expect(hostile).toBeTruthy();
    expect(hostile.message).toContain("IGNORE ALL PREVIOUS INSTRUCTIONS");
    expect(hostile.message).not.toMatch(/[​‮]/);
    expect(hostile.fromSignedInUser).toBe(true);
    expect(hostile).not.toHaveProperty("adminNote");

    const long = body.fromTheSite.triaged.find((f: { id: string }) => f.id === "fb-2");
    expect(long.message.length).toBeLessThanOrEqual(1001); // 1000 chars + ellipsis
    expect(long.fromSignedInUser).toBe(false);

    const task = body.openTasks.find((t: { id: string }) => t.id === "task-1");
    expect(task).toBeTruthy();
    expect(task).not.toHaveProperty("createdBy");
    expect(task).not.toHaveProperty("completedBy");
  });

  test("11. coverage is computed server-side and analytics states are explicit", async ({ request }) => {
    const res = await request.get(SNAPSHOT, { headers: { Authorization: `Bearer ${OPS}` } });
    const body = await res.json();

    expect(body.coverage.vehicles.total).toBeGreaterThan(0);
    expect(body.coverage.guides.total).toBeGreaterThan(0);
    const t = body.coverage.torqueFigures;
    expect(t.total).toBe(t.sourcedOpenLaborProject + t.citedByHand + t.unsourced);
    expect(body.coverage.fluidFigures.total).toBeGreaterThan(0);
    expect(Array.isArray(body.coverage.catalogIssues)).toBe(true);

    expect(["ok", "unavailable"]).toContain(body.analytics.status);
    if (body.analytics.status === "unavailable") {
      expect(["not_configured", "http_error", "network_error", "bad_payload"]).toContain(body.analytics.reason);
    }
    expect(body.notIncluded.pullRequests).toContain("deferred");
  });

  test("13. /api/admin/report is unchanged: 401 without token, 200 with its own", async ({ request }) => {
    expect((await request.get(REPORT)).status()).toBe(401);
    const res = await request.get(REPORT, { headers: { Authorization: `Bearer ${ADMIN}` } });
    expect(res.status()).toBe(200);
    const body = await res.json();
    // Original shape, including the fields the external snapshot strips.
    expect(body).toHaveProperty("summary");
    expect(body).toHaveProperty("fromTheSite.new");
    expect(body).toHaveProperty("buildQueue");
    expect(body).toHaveProperty("openTasks");
    expect(body).toHaveProperty("analytics");
    expect(body.fromTheSite.new[0]).toHaveProperty("adminNote");
    expect(body).not.toHaveProperty("schemaVersion");
  });

  test("rate limit: a burst over the per-minute ceiling gets 429 with Retry-After", async () => {
    // Own context so the burst doesn't share state with the other tests'
    // requests beyond what the server already counted.
    const ctx = await playwrightRequest.newContext();
    const headers = { Authorization: `Bearer ${OPS}` };
    let saw429 = false;
    for (let i = 0; i < 14; i++) {
      const res = await ctx.get(SNAPSHOT, { headers });
      if (res.status() === 429) {
        saw429 = true;
        expect(Number(res.headers()["retry-after"])).toBeGreaterThan(0);
        expect(res.headers()["cache-control"]).toContain("no-store");
        break;
      }
      expect(res.status()).toBe(200);
    }
    expect(saw429).toBe(true);
    await ctx.dispose();
  });
});
