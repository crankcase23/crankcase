import { NextRequest, NextResponse, after } from "next/server";
import { findUserByEmail } from "@/lib/users";
import { makeResetToken } from "@/lib/passwordResetToken";
import { sendEmail } from "@/lib/email";
import { safeErrorSummary } from "@/lib/safeError";
import { clientIp, forgotRules, reserve, tooManyRequests, limiterBusy, temporarilyUnavailable, logLimiterFailure } from "@/lib/authGuard";

// Always returns the same generic success response, whether or not the email is registered -- this is what stops the
// endpoint from being used to check which emails have accounts (enumeration). Three things keep it that way:
//   - the account lookup and the mail send both happen AFTER the response (after()), so response time does not reveal
//     whether an account exists or how slow the mail provider is;
//   - the per-email limit answers with the same generic 200 (and sends nothing) once reached, for known and unknown
//     emails alike, because it is keyed on the hash of what was typed, never on whether an account exists;
//   - only the per-address limit says 429, and it says nothing about any account.
// Limits (docs/auth/ABUSE-CONTROLS.md): per address 5/h (429 + Retry-After), per email 3/h (silent). If the limiter store
// is down this FAILS CLOSED: generic 503, no mail, because an unthrottled reset-mail endpoint is a mail-bombing tool.
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const email = typeof body?.email === "string" ? body.email.trim() : "";
  if (!email) {
    return NextResponse.json({ error: "Email is required." }, { status: 400 });
  }

  // No trustworthy address: the per-address mail limit cannot be applied, so refuse (generic 503, no mail).
  const ip = clientIp(req);
  if (!ip) {
    logLimiterFailure("forgot-password", "FAIL-CLOSED", new Error("no trustworthy client address"));
    return temporarilyUnavailable();
  }
  try {
    const slot = await reserve(forgotRules(email, ip));
    if (!slot.ok) {
      // busy (could not decide in bounded time) is keyed on what was typed, never on whether the account exists: say so plainly.
      if (slot.busy) return limiterBusy(slot.retryAfter); // not a limit hit (Patch 12): 503, same body for every address typed
      if (slot.denied.some((d) => d.scope === "forgot.ip")) return tooManyRequests(slot.retryAfter);
      return NextResponse.json({ ok: true }); // per-email limit: indistinguishable from success, nothing is sent
    }
  } catch (err) {
    logLimiterFailure("forgot-password", "FAIL-CLOSED", err);
    return temporarilyUnavailable();
  }

  const origin = new URL(req.url).origin;
  after(async () => {
    // Runs after the answer has gone out, so a failure here is for the operator, not the customer. Build 104-E: log the error
    // class and short code only (drizzle's message carries the SQL and bound parameters), never the address or the link.
    try {
      const user = await findUserByEmail(email);
      if (!user) return;
      const token = makeResetToken(user.id, user.passwordHash);
      const resetUrl = origin + "/reset-password?token=" + encodeURIComponent(token);
      const html =
        "<p>Someone requested a password reset for your Crankcase Garage account.</p>" +
        "<p><a href=\"" + resetUrl + "\">Click here to set a new password</a>. This link expires in 1 hour.</p>" +
        "<p>If you didn't request this, you can safely ignore this email.</p>";
      const sent = await sendEmail(user.email, "Reset your Crankcase Garage password", html);
      if (!sent || !sent.ok) console.warn("[forgot-password] reset mail not sent:", sent?.error ?? "exception");
    } catch (err) {
      console.error("[forgot-password] reset processing failed", safeErrorSummary(err));
    }
  });

  return NextResponse.json({ ok: true });
}
