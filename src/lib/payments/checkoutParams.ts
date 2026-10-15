// Builds the Stripe Checkout Session parameters for a Get the Keys unlock. PURE: no network, no SDK, no DB. Nothing calls it yet.
// Owner rules (2026-10-13): price shown BEFORE tax; tax calculated by Stripe at checkout (automatic_tax + tax_behavior exclusive);
// card only (no async payment events); one pending purchase per account, so the quote cannot drift between rungs.
import { KEYS_LADDER } from "../keysPricing";

const LADDER_CENTS = new Set(KEYS_LADDER.map((d) => d * 100));
/** Stripe requires Checkout expiry between 30 minutes and 24 hours; 35 minutes keeps clock skew from tripping the minimum. */
export const CHECKOUT_TTL_SECONDS = 35 * 60;

/** What the customer is shown BEFORE checkout. Never includes tax: tax is computed by Stripe once it knows the address. */
export function displayUnlockPrice(priceCents: number): string {
  return `$${(priceCents / 100).toFixed(2)} before tax`;
}

export interface CheckoutInput {
  purchaseId: string; // our pending purchases.id, written BEFORE the session is created
  vin: string; // canonical VIN, server-side only
  vehicleLabel: string; // e.g. "2015 Ford F-150": no VIN, no name
  priceCents: number; // the server quote stored on the pending purchase row; never from the browser
  rung: number;
  successUrl: string;
  cancelUrl: string;
  nowSeconds: number;
  /** Stripe product tax code for digital goods. OWNER DECISION before live; never txcd_10000000 (general tangible) for US digital sales. */
  taxCode?: string;
}

export function buildCheckoutSessionParams(i: CheckoutInput) {
  if (!LADDER_CENTS.has(i.priceCents)) throw new Error(`checkout price ${i.priceCents} is not a Garage Rewards ladder price`);
  if (i.taxCode === "txcd_10000000") throw new Error("txcd_10000000 is the general tangible-goods tax code and must not be used for digital unlocks");
  return {
    mode: "payment" as const,
    payment_method_types: ["card"] as string[],
    client_reference_id: i.purchaseId,
    expires_at: i.nowSeconds + CHECKOUT_TTL_SECONDS,
    success_url: i.successUrl,
    cancel_url: i.cancelUrl,
    automatic_tax: { enabled: true },
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: "usd",
          unit_amount: i.priceCents,
          tax_behavior: "exclusive" as const,
          product_data: { name: `Get the Keys: ${i.vehicleLabel}`, ...(i.taxCode ? { tax_code: i.taxCode } : {}) },
        },
      },
    ],
    metadata: { purchase_id: i.purchaseId, vin: i.vin, rung: String(i.rung) },
  };
}
