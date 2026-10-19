import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import bcrypt from "bcryptjs";
import { randomUUID } from "node:crypto";
import { isUniqueViolation } from "@/lib/safeError";

export async function findUserByEmail(email: string) {
  const rows = await db
    .select()
    .from(users)
    .where(eq(users.email, email.toLowerCase().trim()))
    .limit(1);
  return rows[0] ?? null;
}

/** The email is already registered. The message is customer-facing and safe to show as is. */
export class EmailTakenError extends Error {
  constructor() {
    super("An account with that email already exists.");
    this.name = "EmailTakenError";
  }
}

// Used by /signup. Throws EmailTakenError if the email is already registered: found by the pre-check, or lost to a simultaneous
// signup (the unique constraint on users.email fires on insert). Any other failure is rethrown untouched for the caller to handle.
export async function createUser(email: string, password: string) {
  const normalized = email.toLowerCase().trim();
  const existing = await findUserByEmail(normalized);
  if (existing) {
    throw new EmailTakenError();
  }
  const passwordHash = await bcrypt.hash(password, 12);
  try {
    const [user] = await db
      .insert(users)
      .values({ id: randomUUID(), email: normalized, passwordHash })
      .returning();
    return user;
  } catch (err) {
    if (isUniqueViolation(err)) throw new EmailTakenError();
    throw err;
  }
}

export async function verifyPassword(email: string, password: string) {
  const user = await findUserByEmail(email);
  if (!user) return null;
  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) return null;
  // Accounts disabled from /admin keep all their data but can no longer sign
  // in. Every pre-existing row defaults to "active" (see src/db/schema.ts), so
  // this changes nothing for normal accounts.
  if (user.status === "disabled") return null;
  return user;
}


export async function findUserById(id: string) {
  const rows = await db.select().from(users).where(eq(users.id, id)).limit(1);
  return rows[0] ?? null;
}

export async function updatePassword(userId: string, newPassword: string) {
  const passwordHash = await bcrypt.hash(newPassword, 12);
  await db.update(users).set({ passwordHash }).where(eq(users.id, userId));
  return passwordHash;
}
