import { NextRequest, NextResponse } from "next/server";
import { findUserByEmail } from "@/lib/users";
import { makeResetToken } from "@/lib/passwordResetToken";
import { sendEmail } from "@/lib/email";
import { safeErrorSummary } from "@/lib/safeError";

// Always returns a generic success response, whether or not the email is
// registered -- this is what stops the endpoint from being used to check
// which emails have accounts (enumeration).
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const email = typeof body?.email === "string" ? body.email.trim() : "";
  if (!email) {
    return NextResponse.json({ error: "Email is required." }, { status: 400 });
  }

  let user: Awaited<ReturnType<typeof findUserByEmail>>;
  try {
    user = await findUserByEmail(email);
  } catch (err) {
    // Same answer whatever the address, so a failure reveals nothing about accounts, and nothing about the database either:
    // drizzle's error text carries the SQL and the bound parameters. Log the class and the short code only.
    console.error("[forgot-password] account lookup failed", safeErrorSummary(err));
    return NextResponse.json(
      { error: "We couldn't process that right now. Please try again in a minute." },
      { status: 503 },
    );
  }
  if (user) {
    const token = makeResetToken(user.id, user.passwordHash);
    const origin = new URL(req.url).origin;
    const resetUrl = origin + "/reset-password?token=" + encodeURIComponent(token);
    const html =
      "<p>Someone requested a password reset for your Crankcase Garage account.</p>" +
      "<p><a href=\"" + resetUrl + "\">Click here to set a new password</a>. This link expires in 1 hour.</p>" +
      "<p>If you didn't request this, you can safely ignore this email.</p>";
    const sent = await sendEmail(user.email, "Reset your Crankcase Garage password", html).catch((err) => {
      console.error("[forgot-password] mail send threw", safeErrorSummary(err));
      return null;
    });
    // The customer always gets the same generic answer (a different one for a failed send would reveal that the account
    // exists), so the operator has to be able to see an undelivered reset mail in the logs. Never the address or the link.
    if (!sent || !sent.ok) console.warn("[forgot-password] reset mail not sent:", sent?.error ?? "exception");
  }

  return NextResponse.json({ ok: true });
}
