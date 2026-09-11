import { auth } from "@/auth";

// Shared by every /api/garage* route handler — resolves the signed-in
// user's id from the session, or null if there isn't one.
export async function requireUserId(): Promise<string | null> {
  const session = await auth();
  return session?.user?.id ?? null;
}
