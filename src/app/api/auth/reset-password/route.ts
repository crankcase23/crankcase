import { NextRequest, NextResponse } from "next/server";
import { parseResetToken, verifyResetToken } from "@/lib/passwordResetToken";
import { findUserById, updatePassword } from "@/lib/users";

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
