import { NextResponse } from "next/server";
import { createUser } from "@/lib/users";

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
    return NextResponse.json({ id: user.id, email: user.email });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not create account.";
    return NextResponse.json({ error: message }, { status: 409 });
  }
}
