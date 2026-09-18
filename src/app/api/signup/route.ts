import { NextResponse } from "next/server";
import { createUser } from "@/lib/users";
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
    const message = err instanceof Error ? err.message : "Could not create account.";
    return NextResponse.json({ error: message }, { status: 409 });
  }
}
