import { NextRequest, NextResponse } from "next/server";
import { parseResetToken, verifyResetToken } from "@/lib/passwordResetToken";
import { findUserById, updatePassword } from "@/lib/users";
import { safeErrorSummary } from "@/lib/safeError";
import { clientIp, resetRules, reserve, tooManyRequests, temporarilyUnavailable, logLimiterFailure } from "@/lib/authGuard";

// Abuse controls (docs/auth/ABUSE-CONTROLS.md): per network address 10/h on every attempt, then per user 10/h once the token has
// verified. FAILS CLOSED: if the limiter store is down the password is left unchanged (503).

// A database failure here must not escape as an unhandled error: drizzle's error text is the SQL plus the bound parameters, and for
// the UPDATE those include the NEW bcrypt hash, which the framework then writes to the server log (build 104-F). Answer with a fixed
// message and log the error class and short code only.
const UNAVAILABLE = { error: "We couldn't update your password right now. Please try again in a minute." };

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

let user: Awaited<ReturnType<typeof findUserById>>;
  try {
    user = await findUserById(parsed.userId);
  } catch (err) {
    console.error("[reset-password] account lookup failed", safeErrorSummary(err));
    return NextResponse.json(UNAVAILABLE, { status: 503 });
  }
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

try {
  await updatePassword(userId, password);
} catch (err) {
  console.error("[reset-password] password update failed", safeErrorSummary(err));
  return NextResponse.json(UNAVAILABLE, { status: 503 });
}

return NextResponse.json({ ok: true });
}
