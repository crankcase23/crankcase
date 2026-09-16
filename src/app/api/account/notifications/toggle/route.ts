import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { requireUserId } from "@/lib/apiAuth";

export async function POST(req: Request) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.redirect(new URL("/login", req.url));
  const form = await req.formData();
  const optOut = form.get("optOut") === "true";
  await db.update(users).set({ emailRemindersOptOut: optOut }).where(eq(users.id, userId));
  return NextResponse.redirect(new URL("/account", req.url));
  }
