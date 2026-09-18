import { sql, eq, desc, gte } from "drizzle-orm";
import { db } from "@/db";
import { loginEvents, users, adminRoles } from "@/db/schema";

// Security-page queries. These live here rather than inline in the page so
// that time-dependent values (Date.now) are computed inside a function call
// rather than during render.

export interface LoginBurst {
  userId: string | null;
  email: string | null;
  n: number;
}

/**
 * Accounts with an unusual number of sign-ins in the last hour.
 *
 * Deliberately a single, explainable threshold rather than a scoring model:
 * an alert nobody can explain is an alert nobody acts on.
 */
export async function getLoginBursts(withinMinutes = 60, threshold = 10): Promise<LoginBurst[]> {
  const since = new Date(Date.now() - withinMinutes * 60 * 1000);
  return db
    .select({
      userId: loginEvents.userId,
      email: users.email,
      n: sql<number>`count(*)::int`,
    })
    .from(loginEvents)
    .leftJoin(users, eq(users.id, loginEvents.userId))
    .where(gte(loginEvents.loggedInAt, since))
    .groupBy(loginEvents.userId, users.email)
    .having(sql`count(*) >= ${threshold}`);
}

export async function getRecentLogins(limit = 25) {
  return db
    .select({
      id: loginEvents.id,
      loggedInAt: loginEvents.loggedInAt,
      userId: loginEvents.userId,
      email: users.email,
    })
    .from(loginEvents)
    .leftJoin(users, eq(users.id, loginEvents.userId))
    .orderBy(desc(loginEvents.loggedInAt))
    .limit(limit);
}

export async function listAdmins() {
  return db
    .select({
      id: users.id,
      email: users.email,
      status: users.status,
      lastLoginAt: users.lastLoginAt,
      roles: sql<string>`coalesce(string_agg(${adminRoles.role}, ','), '')`,
    })
    .from(users)
    .leftJoin(adminRoles, eq(adminRoles.userId, users.id))
    .where(eq(users.isAdmin, true))
    .groupBy(users.id, users.email, users.status, users.lastLoginAt);
}
