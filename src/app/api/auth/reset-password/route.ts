import { NextRequest, NextResponse } from "next/server";
import { parseResetToken, verifyResetToken } from "@/lib/passwordResetToken";
import { findUserById, updatePassword } from "@/lib/users";
import { clientIp, resetRules, reserve, tooManyRequests, temporarilyUnavailable, logLimiterFailure } from "@/lib/authGuard";

// Abuse controls (docs/auth/ABUSE-CONTROLS.md): per network address 10/h on every attempt, then per user 10/h once the token has
// verified. FAILS CLOSED: if the limiter store is down the password is left unchanged (503).

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const token = typeof body?.token === "string" ? body.token : "";
  const password = typeof body?.password === "string" ? body.password : "";

if (!token) {
  return NextResponse.json({ error: "Missing reset token." }, { status: 400 });
}
  if (password.length < 8) {
    return NextResponse.json({ error: "Password must be at least 8 characters." }, { status: 400 });
  }

const parsed = parseResetToken(token);
// Step 1, BEFORE any verdict: the per-address budget. A flood of garbage or forged tokens is throttled by address, and every
// verdict below costs a slot. Nothing here is keyed on anything the caller could simply claim.
const ip = clientIp(req);
if (!ip) {
  logLimiterFailure("reset-password", "FAIL-CLOSED", new Error("no trustworthy client address")); // no trustworthy address: the per-address budget cannot apply
  return temporarilyUnavailable();
}
try {
  const slot = await reserve(resetRules(null, ip));
  if (!slot.ok) return tooManyRequests(slot.retryAfter);
} catch (err) {
  logLimiterFailure("reset-password", "FAIL-CLOSED", err);
  return temporarilyUnavailable();
}
  if (!parsed) {
    return NextResponse.json({ error: "This reset link is invalid." }, { status: 400 });
  }

const user = await findUserById(parsed.userId);
  if (!user) {
    return NextResponse.json({ error: "This reset link is invalid." }, { status: 400 });
  }

const userId = verifyResetToken(token, user.passwordHash);
  if (!userId) {
    return NextResponse.json({ error: "This reset link has expired or was already used. Request a new one." }, { status: 400 });
  }

// Step 2, ONLY for a token whose signature and password-version verified: the per-user budget (10/h). It used to be spent by the
// unverified id inside the token, which let anyone who knew a user id burn that user's budget with forged tokens (review M2).
try {
  const slot = await reserve(resetRules(userId, null));
  if (!slot.ok) return tooManyRequests(slot.retryAfter);
} catch (err) {
  logLimiterFailure("reset-password", "FAIL-CLOSED", err);
  return temporarilyUnavailable();
}

await updatePassword(userId, password);

return NextResponse.json({ ok: true });
}
