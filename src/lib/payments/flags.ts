// Payment safety rails. Everything here defaults to OFF/refuse. Nothing in the app calls these yet: there is no checkout route and
// no webhook route (owner approval needed before either exists). Production has no Stripe keys and neither flag.

/** Checkout may start only when the flag is exactly "1". Default off. */
export const checkoutEnabled = (env: Record<string, string | undefined> = process.env): boolean => env.KEYS_CHECKOUT_ENABLED === "1";

/** Paid-access restrictions apply only when the flag is exactly "1". Default off: every guide stays readable (readable() is always true). */
export const paidEnforcementEnabled = (env: Record<string, string | undefined> = process.env): boolean => env.PAID_ENFORCEMENT_ENABLED === "1";

/** Refuses anything but a Stripe TEST secret key. Live keys (sk_live_, rk_live_) are never accepted by this code path. */
export function assertTestModeKey(key: string | undefined): asserts key is string {
  if (!key || !/^sk_test_[A-Za-z0-9]+$/.test(key)) throw new Error("Stripe test mode only: a key starting with sk_test_ is required. Live keys are refused.");
}

/**
 * May this guide be sold? Stricter than guideAccess.isSellable(): the guide must also be CERTIFIED. Uncertified guides are never
 * sold (owner rule 2026-10-13), whatever their tier. `certified` has no source yet (only an Atlas G1 pass may set it), so today
 * nothing is purchasable, which is the intended state.
 */
export const isPurchasable = (g: { tier?: string; preview?: boolean; certified?: boolean }): boolean =>
  g.tier === "premium" && g.preview !== true && g.certified === true;

/**
 * TEST-ONLY fixture gate (owner rule 2026-10-13: payments are tested with a disposable fixture, and uncertified content is never sold
 * in Production). A fixture is sellable only when ALL of these hold; any miss means "not sellable":
 *   - the deployment is a Vercel PREVIEW (VERCEL_ENV === "preview"; unset, "production" or "development" never qualify);
 *   - KEYS_TEST_FIXTURE_ENABLED is exactly "1" (set in the Preview scope only);
 *   - the Stripe key is a test key (assertTestModeKey);
 *   - the guide carries testFixture: true AND an id starting "test-fixture-" (a real guide cannot be sold by flipping one field).
 * Real guides are unaffected: they are sellable only through isPurchasable (certified), and this function never marks anything certified.
 */
export const FIXTURE_ID_PREFIX = "test-fixture-";
export function isSellableHere(
  g: { id?: string; tier?: string; preview?: boolean; certified?: boolean; testFixture?: boolean },
  env: Record<string, string | undefined> = process.env,
): boolean {
  if (isPurchasable(g)) return true; // a certified guide: the normal path (still subject to the checkout flag elsewhere)
  if (g.testFixture !== true || typeof g.id !== "string" || !g.id.startsWith(FIXTURE_ID_PREFIX)) return false;
  if (env.VERCEL_ENV !== "preview" || env.KEYS_TEST_FIXTURE_ENABLED !== "1") return false;
  try { assertTestModeKey(env.STRIPE_SECRET_KEY); } catch { return false; }
  return true;
}
