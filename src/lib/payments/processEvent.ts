// Stripe event handling rules for Get the Keys. PURE LOGIC over injected dependencies: no Stripe SDK, no network, no direct DB access.
// Nothing calls this yet (no webhook route exists; adding one needs owner approval). Production has no Stripe keys.
//
// Owner rules (2026-10-13):
//   - Automatically refund CONFIRMED DUPLICATE charges only: the account already holds the VIN through a DIFFERENT paid purchase.
//   - Disputes and partial refunds are NEVER automatic: they are recorded for manual review and change no access.
//   - A confirmed FULL refund revokes the unlock that THAT purchase granted (soft revoke, history kept), and nothing else.
//   - A grant whose captured price differs from the server quote is kept and flagged for review, never silently accepted.
//   - Every event is applied at most once: the event id is claimed in the database (unique index) before any effect.

export type SettleOutcome =
  | { outcome: "granted"; entitlement: { purchaseId: string | null; priceCents: number | null; source: string } }
  | { outcome: "refund-required"; reason: "already-unlocked" | "legacy-unlock-pending"; entitlement: { purchaseId: string | null; priceCents: number | null; source: string } | null };

export interface PurchaseRef {
  id: string;
  userId: string;
  vin: string;
  /** The pre-tax price quoted when the pending row was written. */
  quotedCents: number;
  status: string;
}

export type EventStatus = "processed" | "needs_review" | "ignored";

export interface Deps {
  /** Inserts the event row if new. "new" = first sight, "retry" = seen before but never finished, "done" = already finished (do nothing). */
  claimEvent(eventId: string, type: string): Promise<"new" | "retry" | "done">;
  finishEvent(eventId: string, status: EventStatus, message: string | null): Promise<void>;
  findPurchase(ref: { purchaseId?: string | null; paymentIntent?: string | null }): Promise<PurchaseRef | null>;
  updatePurchase(id: string, patch: { status?: string; providerRef?: string; refundedCents?: number }): Promise<void>;
  settle(input: { userId: string; vin: string; purchaseId: string }): Promise<SettleOutcome>;
  /** The id of the purchase whose payment created the account's current active entitlement for this VIN, or null. */
  grantingPurchaseId(userId: string, vin: string): Promise<string | null>;
  revokeRefunded(input: { userId: string; vin: string; reason: string }): Promise<{ revoked: boolean }>;
  /** Full refund of the charge behind this payment intent. Must be idempotent on idempotencyKey. */
  refund(input: { paymentIntent: string; idempotencyKey: string; reason: "duplicate" }): Promise<void>;
}

export interface StripeEvent {
  id: string;
  type: string;
  data: { object: { [key: string]: unknown; metadata?: Record<string, unknown> } };
}

export type Result = { http: 200 | 503; action: string; detail?: string };

const str = (v: unknown): string | null => (typeof v === "string" && v ? v : null);

export async function processStripeEvent(ev: StripeEvent, deps: Deps): Promise<Result> {
  const claim = await deps.claimEvent(ev.id, ev.type);
  if (claim === "done") return { http: 200, action: "duplicate-event-ignored" };
  const obj = ev.data?.object ?? {};

  const finish = async (status: EventStatus, action: string, message: string | null = null): Promise<Result> => {
    await deps.finishEvent(ev.id, status, message);
    return { http: 200, action, detail: message ?? undefined };
  };
  // The purchase is not in the database yet (the webhook can beat our own write): answer non-2xx so Stripe retries, and leave the
  // event unfinished so the retry is processed.
  const notYet = (what: string): Result => ({ http: 503, action: "purchase-not-found-retry", detail: what });

  switch (ev.type) {
    case "checkout.session.completed": {
      if (obj.payment_status !== "paid") return finish("ignored", "session-not-paid"); // card only: unpaid means nothing to grant yet
      const purchase = await deps.findPurchase({ purchaseId: str(obj.client_reference_id) });
      if (!purchase) return notYet("checkout.session.completed");
      const pi = str(obj.payment_intent);
      if (!pi) return finish("needs_review", "no-payment-intent", "paid session without a payment intent");
      const metaVin = str(obj.metadata?.vin);
      if (metaVin && metaVin !== purchase.vin) return finish("needs_review", "vin-mismatch", "session metadata VIN differs from the purchase row; nothing granted");
      if (purchase.status === "succeeded") return finish("processed", "already-settled");
      // From here on the payment_intent id is the purchase's provider reference (the session id was it until now).
      await deps.updatePurchase(purchase.id, { providerRef: pi });
      const settled = await deps.settle({ userId: purchase.userId, vin: purchase.vin, purchaseId: purchase.id });
      if (settled.outcome === "granted") {
        await deps.updatePurchase(purchase.id, { status: "succeeded" });
        const captured = typeof obj.amount_subtotal === "number" ? obj.amount_subtotal : null;
        const granted = settled.entitlement.priceCents;
        if (captured !== null && (captured !== purchase.quotedCents || captured !== granted)) {
          return finish("needs_review", "granted-price-differs", `captured subtotal ${captured}, quoted ${purchase.quotedCents}, granted rung price ${granted}; access granted, difference needs review`);
        }
        return finish("processed", "granted");
      }
      // Money was captured for access that already exists, or that a legacy unlock still owns.
      const held = settled.entitlement;
      // A crash after the grant but before the status write: the retry finds THIS purchase's own entitlement. That is success, not a duplicate.
      if (settled.reason === "already-unlocked" && held?.purchaseId === purchase.id) {
        await deps.updatePurchase(purchase.id, { status: "succeeded" });
        return finish("processed", "already-granted-by-this-purchase");
      }
      const confirmedDuplicate = settled.reason === "already-unlocked" && held?.source === "purchase" && !!held.purchaseId && held.purchaseId !== purchase.id;
      if (confirmedDuplicate) {
        await deps.refund({ paymentIntent: pi, idempotencyKey: `duplicate:${purchase.id}`, reason: "duplicate" });
        await deps.updatePurchase(purchase.id, { status: "refund_requested" });
        return finish("processed", "duplicate-auto-refunded");
      }
      await deps.updatePurchase(purchase.id, { status: "needs_review" });
      return finish("needs_review", "refund-required-manual", `captured payment but ${settled.reason === "legacy-unlock-pending" ? "a legacy unlock is pending for this VIN" : "the VIN is already held without a prior paid purchase (gift or admin)"}; not auto-refunded`);
    }

    case "checkout.session.expired": {
      const purchase = await deps.findPurchase({ purchaseId: str(obj.client_reference_id) });
      if (!purchase) return finish("ignored", "expired-session-unknown-purchase");
      if (purchase.status === "pending") await deps.updatePurchase(purchase.id, { status: "failed" }); // frees the one-pending-per-account slot
      return finish("processed", "pending-purchase-expired");
    }

    case "charge.refunded": {
      const amount = Number(obj.amount), refunded = Number(obj.amount_refunded);
      if (!Number.isFinite(amount) || !Number.isFinite(refunded) || amount <= 0) return finish("needs_review", "bad-charge-amounts", "unusable charge amounts");
      const pi = str(obj.payment_intent);
      const purchase = pi ? await deps.findPurchase({ paymentIntent: pi }) : null;
      if (!purchase) return notYet("charge.refunded");
      if (refunded <= 0) return finish("ignored", "no-refund-amount");
      const full = obj.refunded === true && refunded >= amount;
      if (!full) {
        // Events are unordered: a stale partial-refund event can arrive after the full refund. Never downgrade a refunded purchase.
        if (purchase.status === "refunded") return finish("processed", "stale-partial-after-full");
        await deps.updatePurchase(purchase.id, { status: "partially_refunded", refundedCents: refunded });
        return finish("needs_review", "partial-refund-manual", `partial refund ${refunded} of ${amount}: access unchanged, manual review`);
      }
      await deps.updatePurchase(purchase.id, { status: "refunded", refundedCents: refunded });
      // Revoke only if THIS purchase is what granted the current unlock. A refunded duplicate must never take away the original's access.
      const granting = await deps.grantingPurchaseId(purchase.userId, purchase.vin);
      if (granting !== purchase.id) return finish("processed", "refunded-purchase-did-not-grant", "full refund recorded; access untouched because this purchase did not grant it");
      await deps.revokeRefunded({ userId: purchase.userId, vin: purchase.vin, reason: `full refund of charge ${str(obj.id) ?? ""}`.trim() });
      return finish("processed", "full-refund-revoked");
    }

    default: {
      // refund.created / refund.updated fire for every ordinary refund and are not acted on: charge.refunded carries the amounts.
      if (ev.type.startsWith("charge.dispute.") || ev.type === "refund.failed") {
        // Disputes and failed refunds are human decisions. Record and flag; change nothing.
        return finish("needs_review", "manual-review", `${ev.type}: no automatic action`);
      }
      return finish("ignored", "unhandled-type");
    }
  }
}
