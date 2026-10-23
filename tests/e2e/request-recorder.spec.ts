import { test, expect } from "@playwright/test";
import { randomIp } from "./helpers";
import { isPrefetchRequest, recordRequestsTo } from "./request-recorder";

// Permanent regression for the SF-7 production-mode failure (Build 104-AO): the recorder SF-7 uses must ignore Next.js link prefetching and
// must still catch a real navigation, otherwise "a failed sign-in must not navigate to the garage" would either fail on every production
// build or, worse, pass for the wrong reason. These tests run in dev and in production mode: they do not depend on the server prefetching,
// they send the exact headers a production build sends (captured from the real SF-7 requests).

const PREFETCH_HEADERS = { "next-router-prefetch": "1", rsc: "1", "next-router-segment-prefetch": "/_tree", "next-url": "/signup" };

test.describe("request recorder (SF-7 harness)", () => {
  test("RR-1 a request carrying Next.js prefetch headers is recorded as a prefetch, never as a navigation", async ({ browser }) => {
    const ctx = await browser.newContext({ extraHTTPHeaders: { "x-forwarded-for": randomIp() } });
    const page = await ctx.newPage();
    await page.goto("/login");
    const rec = recordRequestsTo(page, "/garage");
    await page.evaluate((h) => fetch("/garage?_rsc=abc123", { headers: h }).then(() => undefined), PREFETCH_HEADERS);
    // a production build ALSO prefetches the header's own /garage link by itself, so assert on the injected one, not on the count
    const injected = new URL("/garage?_rsc=abc123", page.url()).toString();
    expect(rec.prefetches, "the injected prefetch is visible to the recorder").toContain(injected);
    // The app may make requests of its own to /garage while the page is open (a dev server issued one without a prefetch header, 104-AO full run),
    // which the recorder rightly counts. This test is about classifying THE INJECTED request, so assert on that one only.
    expect(rec.navigations, "the injected prefetch is not a navigation").not.toContain(injected);
    await ctx.close();
  });

  test("RR-2 a document navigation to the path IS recorded as a navigation (the security half of SF-7 still bites)", async ({ browser }) => {
    const ctx = await browser.newContext({ extraHTTPHeaders: { "x-forwarded-for": randomIp() } });
    const page = await ctx.newPage();
    await page.goto("/login");
    const rec = recordRequestsTo(page, "/garage");
    await page.goto("/garage"); // signed out: bounces to /login, which is exactly why the URL alone cannot prove "never went there"
    expect(rec.navigations.length, "the navigation request to /garage was seen").toBeGreaterThanOrEqual(1);
    await ctx.close();
  });

  test("RR-3 a client-side router push to the path IS recorded as a navigation", async ({ browser }) => {
    const ctx = await browser.newContext({ extraHTTPHeaders: { "x-forwarded-for": randomIp() } });
    const page = await ctx.newPage();
    await page.goto("/login");
    // hydrated: the router exists (same call the other suites use to navigate without a document load)
    await page.waitForFunction(() => Boolean((window as unknown as { next?: { router?: unknown } }).next?.router));
    const rec = recordRequestsTo(page, "/garage");
    await page.evaluate(() => (window as unknown as { next: { router: { push(u: string): void } } }).next.router.push("/garage"));
    await expect.poll(() => rec.navigations.length, { timeout: 15_000, message: "the router push reached the server as a non-prefetch request" }).toBeGreaterThanOrEqual(1);
    await ctx.close();
  });

  test("RR-5 a same-document URL change to the path (what a router push to a cached route is) IS recorded even though no request is made", async ({ browser }) => {
    const ctx = await browser.newContext({ extraHTTPHeaders: { "x-forwarded-for": randomIp() } });
    const page = await ctx.newPage();
    await page.goto("/login");
    const rec = recordRequestsTo(page, "/garage");
    await page.evaluate(() => history.pushState({}, "", "/garage")); // no network request
    await expect.poll(() => rec.navigations.length, { timeout: 5_000, message: "the URL change was recorded without any request" }).toBeGreaterThanOrEqual(1);
    expect(new URL(rec.navigations[0]).pathname).toBe("/garage");
    await ctx.close();
  });

  test("RR-4 header classification: only a positive prefetch marker is ignored; anything unknown counts", async () => {
    expect(isPrefetchRequest({ "next-router-prefetch": "1", rsc: "1" })).toBe(true);
    expect(isPrefetchRequest({ "Next-Router-Prefetch": "1" })).toBe(true); // header names are case-insensitive
    expect(isPrefetchRequest({ purpose: "prefetch" })).toBe(true);
    expect(isPrefetchRequest({ "sec-purpose": "prefetch;anonymous-client-ip" })).toBe(true);
    expect(isPrefetchRequest({ rsc: "1", "next-router-state-tree": "%5B%5D" }), "a router push is an RSC fetch WITHOUT the prefetch marker").toBe(false);
    expect(isPrefetchRequest({ "next-router-prefetch": "0" })).toBe(false);
    expect(isPrefetchRequest({})).toBe(false);
    expect(isPrefetchRequest({ accept: "text/html" })).toBe(false);
  });
});
