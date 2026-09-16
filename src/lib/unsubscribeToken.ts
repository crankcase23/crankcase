import { createHmac } from "node:crypto";

// Signs/verifies a per-user unsubscribe token without a DB column or a
// migration -- just an HMAC of the user id, keyed on the same secret
// NextAuth already uses to sign session JWTs. Anyone with the link can only
// unsubscribe that one userId; they can't forge a token for someone else's
// account without knowing AUTH_SECRET.
function secret(): string {
  return process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET || "dev-fallback-do-not-use-in-prod";
}

export function makeUnsubscribeToken(userId: string): string {
  return createHmac("sha256", secret()).update(userId).digest("hex").slice(0, 32);
}

export function verifyUnsubscribeToken(userId: string, token: string): boolean {
  return makeUnsubscribeToken(userId) === token;
}
