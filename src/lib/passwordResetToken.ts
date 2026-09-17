import { createHmac } from "node:crypto";

// Signs/verifies a password-reset token without a DB column or migration --
// an HMAC over the user id + expiry, keyed on the app's auth secret AND the
// user's current password hash. Tying the signature to the current hash
// means the token stops working the instant the password changes (this
// reset or any other), so there's no separate "used" flag to track --
// resetting once burns every outstanding link for that account for free.

const ONE_HOUR_MS = 60 * 60 * 1000;

function secret(): string {
  return process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET || "dev-fallback-do-not-use-in-prod";
}

function sign(userId: string, expiresAt: number, passwordHash: string): string {
  return createHmac("sha256", secret() + "|" + passwordHash)
  .update(userId + "." + expiresAt)
  .digest("hex")
  .slice(0, 32);
}

export function makeResetToken(userId: string, passwordHash: string): string {
  const expiresAt = Date.now() + ONE_HOUR_MS;
  const sig = sign(userId, expiresAt, passwordHash);
  return Buffer.from(userId + "." + expiresAt + "." + sig).toString("base64url");
}

export function parseResetToken(token: string): { userId: string; expiresAt: number; sig: string } | null {
  try {
    const decoded = Buffer.from(token, "base64url").toString("utf8");
    const parts = decoded.split(".");
    if (parts.length !== 3) return null;
    const [userId, expiresAtRaw, sig] = parts;
    const expiresAt = Number(expiresAtRaw);
    if (!userId || !Number.isFinite(expiresAt) || !sig) return null;
    return { userId, expiresAt, sig };
  } catch {
    return null;
  }
}

// Returns the userId the token is valid for, or null if it's malformed,
// expired, or was signed against a password hash that's no longer current.
export function verifyResetToken(token: string, currentPasswordHash: string): string | null {
  const parsed = parseResetToken(token);
  if (!parsed) return null;
  if (Date.now() > parsed.expiresAt) return null;
  const expected = sign(parsed.userId, parsed.expiresAt, currentPasswordHash);
  return expected === parsed.sig ? parsed.userId : null;
}
