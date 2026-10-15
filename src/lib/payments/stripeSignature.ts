// Stripe webhook signature check (no SDK, no network). Verifies against the RAW request body: a parsed-then-reserialized body
// will not match. Scheme (docs.stripe.com/webhooks): header "t=<unix>,v1=<hex hmac-sha256 of `${t}.${rawBody}`>[,v1=...]";
// default tolerance 5 minutes.
import { createHmac, timingSafeEqual } from "node:crypto";

export type SignatureResult = { ok: true } | { ok: false; reason: "missing-header" | "malformed-header" | "stale-timestamp" | "no-matching-signature" };

export function verifyStripeSignature(rawBody: string | Buffer, header: string | null | undefined, secret: string, nowSeconds: number, toleranceSeconds = 300): SignatureResult {
  if (!header) return { ok: false, reason: "missing-header" };
  let t: string | undefined;
  const sigs: string[] = [];
  for (const part of header.split(",")) {
    const i = part.indexOf("=");
    if (i < 0) continue;
    const k = part.slice(0, i).trim();
    const v = part.slice(i + 1).trim();
    if (k === "t") t = v;
    else if (k === "v1") sigs.push(v);
  }
  if (!t || !/^\d+$/.test(t) || sigs.length === 0) return { ok: false, reason: "malformed-header" };
  if (Math.abs(nowSeconds - Number(t)) > toleranceSeconds) return { ok: false, reason: "stale-timestamp" };
  const body = typeof rawBody === "string" ? Buffer.from(rawBody, "utf8") : rawBody;
  const expected = createHmac("sha256", secret).update(Buffer.concat([Buffer.from(`${t}.`, "utf8"), body])).digest();
  for (const s of sigs) {
    if (!/^[0-9a-f]{64}$/i.test(s)) continue;
    const got = Buffer.from(s, "hex");
    if (got.length === expected.length && timingSafeEqual(got, expected)) return { ok: true };
  }
  return { ok: false, reason: "no-matching-signature" };
}
