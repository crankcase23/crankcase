import { NextResponse } from "next/server";
import { createUser, EmailTakenError } from "@/lib/users";
import { safeErrorSummary } from "@/lib/safeError";
import { recordEvent, EVENT_TYPES } from "@/lib/events";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const email = typeof body?.email === "string" ? body.email.trim() : "";
  const password = typeof body?.password === "string" ? body.password : "";

  if (!email || !email.includes("@")) {
    return NextResponse.json({ error: "Enter a valid email." }, { status: 400 });
  }
  if (password.length < 8) {
    return NextResponse.json(
      { error: "Password must be at least 8 characters." },
      { status: 400 },
    );
  }

  try {
    const user = await createUser(email, password);
    // Feeds the admin activity feed and the signup funnel. Never throws.
    await recordEvent({ type: EVENT_TYPES.USER_SIGNED_UP, userId: user.id, objectType: "user", objectId: user.id });
    return NextResponse.json({ id: user.id, email: user.email });
  } catch (err) {
    // The duplicate message is customer-facing and useful; it is a fixed string, never taken from the error.
    if (err instanceof EmailTakenError) {
      return NextResponse.json({ error: "An account with that email already exists." }, { status: 409 });
    }
    // Anything else (database down, unexpected bug) is not the customer's problem to decode and must not leak how the database is
    // laid out: drizzle's error text contains the SQL and the bound parameters, including the password hash. Log the class and the
    // short error code only, answer with a fixed message.
    console.error("[signup] account creation failed", safeErrorSummary(err));
    return NextResponse.json(
      { error: "We couldn't create your account right now. Please try again in a minute." },
      { status: 503 },
    );
  }
}
