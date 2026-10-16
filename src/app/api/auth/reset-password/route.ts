import { NextRequest, NextResponse } from "next/server";
import { parseResetToken, verifyResetToken } from "@/lib/passwordResetToken";
import { findUserById, updatePassword } from "@/lib/users";
import { clientIp, resetRules, reserve, tooManyRequests, temporarilyUnavailable, logLimiterFailure } from "@/lib/authGuard";

// Abuse controls (docs/auth/ABUSE-CONTROLS.md): per network address 10/h and per user named in the token 10/h, so the
// token signature cannot be ground at speed. FAILS CLOSED: if the limiter store is down the password is left unchanged (503).

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
// Reserved before ANY verdict, so a flood of garbage tokens is throttled by address too, and every verdict below costs a slot.
try {
  const slot = await reserve(resetRules(parsed?.userId ?? null, clientIp(req)));
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

await updatePassword(userId, password);

return NextResponse.json({ ok: true });
}
