import { NextRequest, NextResponse } from "next/server";
import { findUserByEmail } from "@/lib/users";
import { makeResetToken } from "@/lib/passwordResetToken";
import { sendEmail } from "@/lib/email";

// Always returns a generic success response, whether or not the email is
// registered -- this is what stops the endpoint from being used to check
// which emails have accounts (enumeration).
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const email = typeof body?.email === "string" ? body.email.trim() : "";
  if (!email) {
    return NextResponse.json({ error: "Email is required." }, { status: 400 });
  }

const user = await findUserByEmail(email);
  if (user) {
    const token = makeResetToken(user.id, user.passwordHash);
    const origin = new URL(req.url).origin;
    const resetUrl = origin + "/reset-password?token=" + encodeURIComponent(token);
    const html =
      "<p>Someone requested a password reset for your Crankcase Garage account.</p>" +
      "<p><a href=\"" + resetUrl + "\">Click here to set a new password</a>. This link expires in 1 hour.</p>" +
      "<p>If you didn't request this, you can safely ignore this email.</p>";
    await sendEmail(user.email, "Reset your Crankcase Garage password", html).catch((err) => {
      console.error("[forgot-password] failed to send email", err);
    });
  }

return NextResponse.json({ ok: true });
}
