import { auth } from "@/auth";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";

// Gates /admin (src/app/admin) and its API routes. Separate from
// requireUserId() (src/lib/apiAuth.ts) -- being logged in isn't enough,
// the account also needs users.isAdmin set, which only happens by hand in
// the DB. Returns the admin's userId, or null if not logged in / not an
// admin (callers redirect or 403 either way, so one null case is enough).
export async function requireAdminUserId(): Promise<string | null> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return null;
  const rows = await db.select({ isAdmin: users.isAdmin }).from(users).where(eq(users.id, userId)).limit(1);
  if (!rows[0]?.isAdmin) return null;
  return userId;
}
