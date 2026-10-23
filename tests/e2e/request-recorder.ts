import type { Page } from "@playwright/test";

// Counting requests to a path without mistaking Next.js LINK PREFETCHING for navigation (Build 104-AO, found as SF-7 red in production mode).
//
// A production build prefetches every visible <Link>: the marketing header's "My Garage" link makes the browser request
// `/garage?_rsc=...` with `Next-Router-Prefetch: 1` while the customer is still on /signup. `next dev` does not prefetch, so a test that
// counted EVERY request to /garage passed in dev and failed in production. A prefetch is not a navigation: nothing is shown, no page is
// entered, and an unauthenticated one is just redirected.
//
// What still counts (and must keep failing a test that expects "never went there"):
//   - a document navigation (page.goto, a link click, a form post): isNavigationRequest()
//   - a client-side router navigation (router.push / router.replace): an RSC fetch WITHOUT the prefetch header, or, when the route is already in the
//     prefetch cache and no request is made, the frame's URL change itself
// Unknown shapes are COUNTED. The only thing ignored is a request that positively identifies itself as a prefetch.

/** True only for a request that identifies itself as a prefetch (Next.js sets next-router-prefetch; browsers set Purpose / Sec-Purpose). */
export function isPrefetchRequest(headers: Record<string, string>): boolean {
  const h: Record<string, string> = {};
  for (const [k, v] of Object.entries(headers)) h[k.toLowerCase()] = v;
  if (h["next-router-prefetch"] !== undefined && h["next-router-prefetch"] !== "0") return true;
  return /prefetch/i.test(h["purpose"] ?? "") || /prefetch/i.test(h["sec-purpose"] ?? "");
}

export type RequestRecorder = {
  /** Requests that are real navigations to the path (document or client router), as full URLs. */
  navigations: string[];
  /** Requests that identified themselves as prefetches: kept for visibility, never counted as navigation. */
  prefetches: string[];
};

/** Start recording requests whose pathname equals `pathname`. Call before the action under test. */
export function recordRequestsTo(page: Page, pathname: string): RequestRecorder {
  const rec: RequestRecorder = { navigations: [], prefetches: [] };
  page.on("request", (r) => {
    if (new URL(r.url()).pathname !== pathname) return;
    if (!r.isNavigationRequest() && isPrefetchRequest(r.headers())) rec.prefetches.push(r.url());
    else rec.navigations.push(r.url());
  });
  // A client-side router navigation to a route whose data is already in Next's prefetch cache sends NO request at all, so the request listener above
  // cannot see it. The frame's own URL change can: Playwright reports history.pushState / router.push as a frame navigation too.
  page.on("framenavigated", (f) => {
    if (f !== page.mainFrame()) return;
    if (new URL(f.url()).pathname === pathname) rec.navigations.push(f.url());
  });
  return rec;
}
