// Stripe TEST-MODE foundation: pure rule tests (no DB, no network, no Stripe SDK). Owner rules of 2026-10-13:
//   auto-refund confirmed duplicates only; disputes and partial refunds are manual; price shown before tax with Stripe-calculated tax;
//   full refund revokes only the unlock that purchase granted; webhook idempotent; nothing sells uncertified guides.
import { test } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { createHmac } from "node:crypto";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const req = createRequire(path.join(ROOT, "package.json"));
const esbuild = req("esbuild");
async function load(entry) {
  const out = await esbuild.build({ entryPoints: [path.join(ROOT, entry)], bundle: true, write: false, format: "cjs", platform: "node", logLevel: "silent", alias: { "@": path.join(ROOT, "src") } });
  const m = { exports: {} };
  new Function("module", "exports", "require", out.outputFiles[0].text)(m, m.exports, req);
  return m.exports;
}
const { processStripeEvent } = await load("src/lib/payments/processEvent.ts");
const { verifyStripeSignature } = await load("src/lib/payments/stripeSignature.ts");
const { buildCheckoutSessionParams, displayUnlockPrice, CHECKOUT_TTL_SECONDS } = await load("src/lib/payments/checkoutParams.ts");
const flags = await load("src/lib/payments/flags.ts");

// ---------- flags ----------
test("payment flags are OFF unless exactly '1'; live keys are refused", () => {
  for (const v of [undefined, "", "0", "true", "yes", "2"]) {
    assert.equal(flags.checkoutEnabled({ KEYS_CHECKOUT_ENABLED: v }), false);
    assert.equal(flags.paidEnforcementEnabled({ PAID_ENFORCEMENT_ENABLED: v }), false);
  }
  assert.equal(flags.checkoutEnabled({ KEYS_CHECKOUT_ENABLED: "1" }), true);
  assert.equal(flags.checkoutEnabled({}), false);
  assert.doesNotThrow(() => flags.assertTestModeKey("sk_test_abc123"));
  for (const k of [undefined, "", "sk_live_abc123", "rk_live_abc", "pk_test_abc", "sk_test_", "sk_test_ab c"]) assert.throws(() => flags.assertTestModeKey(k), /test mode only/i);
});

test("uncertified guides are never purchasable, whatever their tier", () => {
  assert.equal(flags.isPurchasable({ tier: "premium" }), false);
  assert.equal(flags.isPurchasable({ tier: "premium", preview: false }), false);
  assert.equal(flags.isPurchasable({ tier: "premium", certified: false }), false);
  assert.equal(flags.isPurchasable({ tier: "premium", preview: true, certified: true }), false);
  assert.equal(flags.isPurchasable({ tier: "free", certified: true }), false);
  assert.equal(flags.isPurchasable({ tier: "premium", certified: true }), true);
});

// ---------- signature ----------
const SECRET = "whsec_test_secret";
const sign = (body, t, secret = SECRET) => `t=${t},v1=${createHmac("sha256", secret).update(`${t}.${body}`).digest("hex")}`;
test("webhook signature: valid on the raw body, rejected when body, secret, header or time is wrong", () => {
  const body = '{"id":"evt_1","type":"x"}', now = 1_800_000_000;
  assert.deepEqual(verifyStripeSignature(body, sign(body, now), SECRET, now), { ok: true });
  assert.deepEqual(verifyStripeSignature(Buffer.from(body), sign(body, now), SECRET, now), { ok: true });
  assert.equal(verifyStripeSignature(body + " ", sign(body, now), SECRET, now).ok, false, "re-serialized/altered body");
  assert.equal(verifyStripeSignature(body, sign(body, now, "whsec_other"), SECRET, now).ok, false);
  assert.equal(verifyStripeSignature(body, null, SECRET, now).reason, "missing-header");
  assert.equal(verifyStripeSignature(body, "garbage", SECRET, now).reason, "malformed-header");
  assert.equal(verifyStripeSignature(body, `t=${now},v1=zz`, SECRET, now).ok, false);
  assert.equal(verifyStripeSignature(body, sign(body, now - 301), SECRET, now).reason, "stale-timestamp");
  assert.equal(verifyStripeSignature(body, sign(body, now - 300), SECRET, now).ok, true, "5 minutes is inside tolerance");
  assert.equal(verifyStripeSignature(body, sign(body, now + 301), SECRET, now).reason, "stale-timestamp", "future timestamps too");
  const two = `t=${now},v1=${"0".repeat(64)},v1=${createHmac("sha256", SECRET).update(`${now}.${body}`).digest("hex")}`;
  assert.equal(verifyStripeSignature(body, two, SECRET, now).ok, true, "any one matching v1 is enough (secret rotation)");
});

// ---------- checkout params ----------
const base = { purchaseId: "p1", vin: "1HGCM82633A004352", vehicleLabel: "2015 Ford F-150", priceCents: 2000, rung: 1, successUrl: "https://x/ok", cancelUrl: "https://x/no", nowSeconds: 1_800_000_000 };
test("checkout params: price BEFORE tax, Stripe calculates tax, card only, short expiry, server-side ids only", () => {
  const p = buildCheckoutSessionParams(base);
  assert.equal(p.mode, "payment");
  assert.deepEqual(p.payment_method_types, ["card"]);
  assert.equal(p.automatic_tax.enabled, true);
  assert.equal(p.line_items[0].price_data.unit_amount, 2000);
  assert.equal(p.line_items[0].price_data.tax_behavior, "exclusive");
  assert.equal(p.client_reference_id, "p1");
  assert.equal(p.expires_at - base.nowSeconds, CHECKOUT_TTL_SECONDS);
  assert.ok(CHECKOUT_TTL_SECONDS >= 30 * 60 && CHECKOUT_TTL_SECONDS <= 24 * 3600);
  assert.doesNotMatch(p.line_items[0].price_data.product_data.name, /1HGCM82633A004352/, "no VIN in the customer-visible name");
  assert.equal(displayUnlockPrice(2000), "$20.00 before tax");
  assert.equal(displayUnlockPrice(1500), "$15.00 before tax");
});
test("checkout params refuse off-ladder prices and the general tangible tax code", () => {
  for (const c of [1, 1999, 2500, 0, -2000]) assert.throws(() => buildCheckoutSessionParams({ ...base, priceCents: c }), /ladder/);
  for (const c of [2000, 1800, 1600, 1500]) assert.doesNotThrow(() => buildCheckoutSessionParams({ ...base, priceCents: c }));
  assert.throws(() => buildCheckoutSessionParams({ ...base, taxCode: "txcd_10000000" }), /tangible/);
  assert.equal(buildCheckoutSessionParams({ ...base, taxCode: "txcd_10201000" }).line_items[0].price_data.product_data.tax_code, "txcd_10201000");
});

// ---------- event processing over fakes ----------
function world(over = {}) {
  const w = {
    events: new Map(), purchases: new Map(), calls: [], granting: new Map(),
    settle: async () => ({ outcome: "granted", entitlement: { purchaseId: "p1", priceCents: 2000, source: "purchase" } }),
    ...over,
  };
  w.purchases.set("p1", { id: "p1", userId: "u1", vin: "1HGCM82633A004352", quotedCents: 2000, status: "pending", providerRef: "cs_1" });
  w.deps = {
    claimEvent: async (id, type) => { const e = w.events.get(id); if (!e) { w.events.set(id, { type, status: "processing" }); return "new"; } return e.status === "processing" ? "retry" : "done"; },
    finishEvent: async (id, status, message) => { w.events.get(id).status = status; w.events.get(id).message = message; },
    findPurchase: async ({ purchaseId, paymentIntent }) => [...w.purchases.values()].find((p) => (purchaseId && p.id === purchaseId) || (paymentIntent && p.providerRef === paymentIntent)) ?? null,
    updatePurchase: async (id, patch) => { w.calls.push(["updatePurchase", id, patch]); Object.assign(w.purchases.get(id), patch); },
    settle: async (i) => { w.calls.push(["settle", i]); return w.settle(i); },
    grantingPurchaseId: async (u, v) => w.granting.get(`${u}|${v}`) ?? null,
    revokeRefunded: async (i) => { w.calls.push(["revoke", i]); return { revoked: true }; },
    legacyHoldsFor: async () => w.holds ?? [],
    refund: async (i) => { w.calls.push(["refund", i]); },
  };
  return w;
}
const called = (w, name) => w.calls.filter((c) => c[0] === name);
const completed = (id = "evt_c1", extra = {}) => ({ id, type: "checkout.session.completed", data: { object: { id: "cs_1", client_reference_id: "p1", payment_status: "paid", payment_intent: "pi_1", amount_subtotal: 2000, amount_total: 2160, metadata: { vin: "1HGCM82633A004352" }, ...extra } } });
const charge = (id, o = {}) => ({ id, type: "charge.refunded", data: { object: { id: "ch_1", payment_intent: "pi_1", amount: 2160, amount_refunded: 2160, refunded: true, ...o } } });

test("paid session grants once, marks the purchase succeeded and re-points provider_ref to the payment intent", async () => {
  const w = world();
  const r = await processStripeEvent(completed(), w.deps);
  assert.equal(r.http, 200); assert.equal(r.action, "granted");
  assert.equal(called(w, "settle").length, 1);
  assert.equal(w.purchases.get("p1").status, "succeeded");
  assert.equal(w.purchases.get("p1").providerRef, "pi_1");
  assert.equal(called(w, "refund").length, 0);
});

test("IDEMPOTENT: the same event id delivered twice (or ten times) applies its effect once", async () => {
  const w = world();
  for (let i = 0; i < 10; i++) await processStripeEvent(completed(), w.deps);
  assert.equal(called(w, "settle").length, 1);
  assert.equal((await processStripeEvent(completed(), w.deps)).action, "duplicate-event-ignored");
});

test("an event that crashed mid-way is retried (claim 'retry'), not lost", async () => {
  const w = world();
  w.events.set("evt_c1", { type: "checkout.session.completed", status: "processing" });
  const r = await processStripeEvent(completed(), w.deps);
  assert.equal(r.action, "granted");
});

test("webhook beats our own purchase write: non-2xx so Stripe retries, event left unfinished", async () => {
  const w = world(); w.purchases.clear();
  const r = await processStripeEvent(completed(), w.deps);
  assert.equal(r.http, 503);
  assert.equal(w.events.get("evt_c1").status, "processing");
  w.purchases.set("p1", { id: "p1", userId: "u1", vin: "1HGCM82633A004352", quotedCents: 2000, status: "pending", providerRef: "cs_1" });
  assert.equal((await processStripeEvent(completed(), w.deps)).action, "granted", "the retry succeeds");
});

test("unpaid session grants nothing", async () => {
  const w = world();
  const r = await processStripeEvent(completed("evt_u", { payment_status: "unpaid" }), w.deps);
  assert.equal(r.action, "session-not-paid");
  assert.equal(called(w, "settle").length, 0);
});

test("session metadata VIN that differs from our purchase row grants nothing and goes to review", async () => {
  const w = world();
  const r = await processStripeEvent(completed("evt_v", { metadata: { vin: "5YJSA1E26HF000337" } }), w.deps);
  assert.equal(r.action, "vin-mismatch");
  assert.equal(w.events.get("evt_v").status, "needs_review");
  assert.equal(called(w, "settle").length, 0);
});

test("PRICE RUNG: a grant at a different price than quoted/captured keeps access but is flagged for review", async () => {
  const w = world({ settle: async () => ({ outcome: "granted", entitlement: { purchaseId: "p1", priceCents: 1800, source: "purchase" } }) });
  const r = await processStripeEvent(completed(), w.deps);
  assert.equal(r.action, "granted-price-differs");
  assert.equal(w.events.get("evt_c1").status, "needs_review");
  assert.equal(w.purchases.get("p1").status, "succeeded", "customer paid and keeps access");
  assert.equal(called(w, "refund").length, 0, "never auto-refunded: a person decides the difference");
});

test("CONFIRMED DUPLICATE (VIN already held through a DIFFERENT paid purchase): refunded automatically, once, with an idempotency key", async () => {
  const w = world({ settle: async () => ({ outcome: "refund-required", reason: "already-unlocked", entitlement: { purchaseId: "p0", priceCents: 2000, source: "purchase" } }) });
  const r = await processStripeEvent(completed(), w.deps);
  assert.equal(r.action, "duplicate-auto-refunded");
  const refunds = called(w, "refund");
  assert.equal(refunds.length, 1);
  assert.deepEqual({ ...refunds[0][1], note: undefined }, { paymentIntent: "pi_1", idempotencyKey: "duplicate:p1", reason: "duplicate", note: undefined });
  assert.match(refunds[0][1].note, /p0/);
  await processStripeEvent(completed(), w.deps);
  assert.equal(called(w, "refund").length, 1, "replay does not refund twice");
});

// ---- non-fulfillable payments: gift-held and legacy-held VINs (owner rules 2026-10-13 evening) ----
const refundRequired = (reason, entitlement) => ({ outcome: "refund-required", reason, entitlement });
const GIFT = { purchaseId: null, priceCents: null, source: "gift" };
const LEGACY_BOUGHT = { purchaseId: null, priceCents: 2000, source: "purchase" };

test("GIFT-HELD VIN: the account already has permanent access, so the payment is CONFIRMED non-fulfillable and refunded automatically, once", async () => {
  const w = world({ settle: async () => refundRequired("already-unlocked", GIFT) });
  const r = await processStripeEvent(completed(), w.deps);
  assert.equal(r.action, "held-entitlement-auto-refunded");
  assert.deepEqual(called(w, "refund").map((c) => [c[1].idempotencyKey, c[1].reason]), [["held-entitlement:p1", "already-entitled"]]);
  assert.match(called(w, "refund")[0][1].note, /gift/);
  await processStripeEvent(completed(), w.deps);
  assert.equal(called(w, "refund").length, 1);
  assert.equal(w.purchases.get("p1").status, "refund_requested", "the purchase row is kept, only marked");
  assert.equal(w.events.get("evt_c1").status, "processed");
});

test("VIN held by an earlier RECORDED (legacy, purchase-id-less) paid unlock is also confirmed non-fulfillable", async () => {
  const w = world({ settle: async () => refundRequired("already-unlocked", LEGACY_BOUGHT) });
  assert.equal((await processStripeEvent(completed(), w.deps)).action, "held-entitlement-auto-refunded");
  assert.equal(called(w, "refund").length, 1);
});

test("LEGACY HOLD whose stored VIN is exactly this VIN (paid OR gift): confirmed, refunded automatically", async () => {
  for (const source of ["purchase", "gift"]) {
    const w = world({ settle: async () => refundRequired("legacy-unlock-pending", null) });
    w.holds = [{ id: "h1", source, matchedBy: "snapshot-vin" }];
    const r = await processStripeEvent(completed(`evt_${source}`), w.deps);
    assert.equal(r.action, "legacy-hold-auto-refunded", source);
    assert.deepEqual(called(w, "refund").map((c) => c[1].idempotencyKey), ["legacy-hold:p1"], source);
    assert.match(called(w, "refund")[0][1].note, /h1/);
  }
});

test("LEGACY GIFT tied to the car that carries this VIN: confirmed (same line the restore code uses), refunded automatically", async () => {
  const w = world({ settle: async () => refundRequired("legacy-unlock-pending", null) });
  w.holds = [{ id: "h2", source: "gift", matchedBy: "garage-entry" }];
  assert.equal((await processStripeEvent(completed(), w.deps)).action, "legacy-hold-auto-refunded");
});

test("AMBIGUOUS: a PAID legacy hold tied only to the car (not this exact VIN) goes to MANUAL REVIEW: no refund, hold untouched", async () => {
  const w = world({ settle: async () => refundRequired("legacy-unlock-pending", null) });
  w.holds = [{ id: "h3", source: "purchase", matchedBy: "garage-entry" }];
  const r = await processStripeEvent(completed(), w.deps);
  assert.equal(r.action, "refund-required-manual");
  assert.equal(called(w, "refund").length, 0);
  assert.equal(w.events.get("evt_c1").status, "needs_review");
  assert.equal(w.purchases.get("p1").status, "needs_review");
  assert.match(w.events.get("evt_c1").message, /admin must decide/);
});

test("AMBIGUOUS: a snapshot-VIN hold alongside a car-tied paid hold is still confirmed (one restorable claim is enough)", async () => {
  const w = world({ settle: async () => refundRequired("legacy-unlock-pending", null) });
  w.holds = [{ id: "h4", source: "purchase", matchedBy: "garage-entry" }, { id: "h5", source: "purchase", matchedBy: "snapshot-vin" }];
  assert.equal((await processStripeEvent(completed(), w.deps)).action, "legacy-hold-auto-refunded");
});

test("AMBIGUOUS: not enough information (held VIN with no entitlement detail, or a legacy block with no hold found) => manual review, never a refund", async () => {
  for (const [i, s] of [refundRequired("already-unlocked", null), refundRequired("legacy-unlock-pending", null)].entries()) {
    const w = world({ settle: async () => s });
    w.holds = [];
    const r = await processStripeEvent(completed(`evt_i${i}`), w.deps);
    assert.equal(r.action, "refund-required-manual", `case ${i}`);
    assert.equal(called(w, "refund").length, 0, `case ${i}`);
    assert.equal(w.events.get(`evt_i${i}`).status, "needs_review");
  }
});

test("a refund that FAILS (Stripe error) leaves the event unfinished so Stripe retries, and the retry refunds once under the same idempotency key", async () => {
  const w = world({ settle: async () => refundRequired("already-unlocked", GIFT) });
  let boom = true;
  const real = w.deps.refund;
  w.deps.refund = async (i) => { if (boom) throw new Error("stripe 500"); return real(i); };
  await assert.rejects(processStripeEvent(completed(), w.deps), /stripe 500/);
  assert.equal(w.events.get("evt_c1").status, "processing", "not finished: the next delivery is processed");
  boom = false;
  assert.equal((await processStripeEvent(completed(), w.deps)).action, "held-entitlement-auto-refunded");
  assert.deepEqual(called(w, "refund").map((c) => c[1].idempotencyKey), ["held-entitlement:p1"]);
});

test("the refund of a gift-held payment never revokes the gift: the charge.refunded that follows changes no access", async () => {
  const w = world({ settle: async () => refundRequired("already-unlocked", GIFT) });
  await processStripeEvent(completed(), w.deps);
  w.granting.set("u1|1HGCM82633A004352", null); // the gift has no purchase id
  const r = await processStripeEvent(charge("evt_rg"), w.deps);
  assert.equal(r.action, "refunded-purchase-did-not-grant");
  assert.equal(called(w, "revoke").length, 0);
});

test("crash after the grant, before the status write: the retry sees this purchase's OWN entitlement and finishes cleanly, no refund", async () => {
  const w = world({ settle: async () => ({ outcome: "refund-required", reason: "already-unlocked", entitlement: { purchaseId: "p1", priceCents: 2000, source: "purchase" } }) });
  const r = await processStripeEvent(completed(), w.deps);
  assert.equal(r.action, "already-granted-by-this-purchase");
  assert.equal(called(w, "refund").length, 0);
  assert.equal(w.purchases.get("p1").status, "succeeded");
});

test("FULL REFUND of the purchase that granted the unlock revokes it, once", async () => {
  const w = world(); await processStripeEvent(completed(), w.deps);
  w.granting.set("u1|1HGCM82633A004352", "p1");
  const r = await processStripeEvent(charge("evt_r1"), w.deps);
  assert.equal(r.action, "full-refund-revoked");
  assert.deepEqual(called(w, "revoke").map((c) => c[1].vin), ["1HGCM82633A004352"]);
  assert.equal(w.purchases.get("p1").status, "refunded");
  await processStripeEvent(charge("evt_r1"), w.deps);
  assert.equal(called(w, "revoke").length, 1);
});

test("a refunded DUPLICATE purchase never takes away the access the ORIGINAL purchase granted", async () => {
  const w = world({ settle: async () => ({ outcome: "refund-required", reason: "already-unlocked", entitlement: { purchaseId: "p0", priceCents: 2000, source: "purchase" } }) });
  await processStripeEvent(completed(), w.deps);
  w.granting.set("u1|1HGCM82633A004352", "p0"); // the original purchase holds the entitlement
  const r = await processStripeEvent(charge("evt_r2"), w.deps);
  assert.equal(r.action, "refunded-purchase-did-not-grant");
  assert.equal(called(w, "revoke").length, 0);
});

test("PARTIAL refund: no revoke, flagged for manual review; a stale partial after the full refund does not downgrade it", async () => {
  const w = world(); await processStripeEvent(completed(), w.deps);
  w.granting.set("u1|1HGCM82633A004352", "p1");
  const r = await processStripeEvent(charge("evt_p", { amount_refunded: 500, refunded: false }), w.deps);
  assert.equal(r.action, "partial-refund-manual");
  assert.equal(w.events.get("evt_p").status, "needs_review");
  assert.equal(called(w, "revoke").length, 0);
  assert.equal(w.purchases.get("p1").status, "partially_refunded");
  await processStripeEvent(charge("evt_f"), w.deps);
  assert.equal(w.purchases.get("p1").status, "refunded");
  assert.equal((await processStripeEvent(charge("evt_p2", { amount_refunded: 500, refunded: false }), w.deps)).action, "stale-partial-after-full");
  assert.equal(w.purchases.get("p1").status, "refunded");
});

test("refund amount equal to charge but refunded flag false is NOT treated as a confirmed full refund", async () => {
  const w = world(); await processStripeEvent(completed(), w.deps);
  w.granting.set("u1|1HGCM82633A004352", "p1");
  const r = await processStripeEvent(charge("evt_x", { refunded: false }), w.deps);
  assert.equal(r.action, "partial-refund-manual");
  assert.equal(called(w, "revoke").length, 0);
});

test("DISPUTES and failed refunds: recorded for manual review, never any automatic action", async () => {
  for (const type of ["charge.dispute.created", "charge.dispute.updated", "charge.dispute.closed", "charge.dispute.funds_withdrawn", "refund.failed"]) {
    const w = world(); await processStripeEvent(completed(), w.deps);
    w.granting.set("u1|1HGCM82633A004352", "p1");
    const before = w.calls.length;
    const r = await processStripeEvent({ id: `evt_${type}`, type, data: { object: { id: "dp_1", payment_intent: "pi_1", status: "lost" } } }, w.deps);
    assert.equal(r.action, "manual-review", type);
    assert.equal(w.events.get(`evt_${type}`).status, "needs_review", type);
    assert.equal(w.calls.length, before, `${type} must change nothing`);
  }
});

test("expired session frees the pending slot; unrelated events are ignored", async () => {
  const w = world();
  const r = await processStripeEvent({ id: "evt_e", type: "checkout.session.expired", data: { object: { client_reference_id: "p1" } } }, w.deps);
  assert.equal(r.action, "pending-purchase-expired");
  assert.equal(w.purchases.get("p1").status, "failed");
  assert.equal((await processStripeEvent({ id: "evt_z", type: "customer.created", data: { object: {} } }, w.deps)).action, "unhandled-type");
  assert.equal((await processStripeEvent({ id: "evt_ru", type: "refund.updated", data: { object: {} } }, w.deps)).action, "unhandled-type", "refund.updated is routine and not acted on");
});

test("charge.refunded with unusable amounts goes to review instead of revoking", async () => {
  const w = world(); await processStripeEvent(completed(), w.deps);
  w.granting.set("u1|1HGCM82633A004352", "p1");
  const r = await processStripeEvent(charge("evt_b", { amount: 0 }), w.deps);
  assert.equal(r.action, "bad-charge-amounts");
  assert.equal(called(w, "revoke").length, 0);
});
