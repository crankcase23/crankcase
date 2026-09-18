import { sql, eq, and, or, ilike, count, desc, asc } from "drizzle-orm";
import { db } from "@/db";
import {
  users,
  garageEntries,
  serviceEntries,
  vehicleUnlocks,
  loginEvents,
  subscriptions,
  purchases,
  adminRoles,
  odometerReadings,
} from "@/db/schema";

// ---------------------------------------------------------------------------
// User administration queries.
//
// Scale note, because this is where the old admin page would have died: the
// previous version loaded EVERY user, EVERY garage entry and EVERY service
// entry into Node and counted them with .length. That's fine at 3 users and
// fatal at 10,000.
//
// Here, counts are correlated subqueries computed in Postgres, the result set
// is paginated with LIMIT/OFFSET, and the total is a separate COUNT(*). The
// work per request is bounded by page size, not by table size.
// ---------------------------------------------------------------------------

export const USER_SORTS = ["email", "created", "lastLogin", "vehicles", "services"] as const;
export type UserSort = (typeof USER_SORTS)[number];

export interface UserListRow {
  id: string;
  email: string;
  name: string | null;
  status: string;
  isAdmin: boolean;
  createdAt: Date;
  lastLoginAt: Date | null;
  emailRemindersOptOut: boolean;
  vehicleCount: number;
  serviceCount: number;
  unlockCount: number;
  subscriptionStatus: string | null;
}

export interface ListUsersOptions {
  q?: string;
  status?: "active" | "disabled";
  role?: "admin";
  sort?: UserSort;
  dir?: "asc" | "desc";
  page?: number;
  pageSize?: number;
}

// Correlated subqueries -- one indexed lookup per row on the page only.
const vehicleCountSql = sql<number>`(select count(*)::int from ${garageEntries} where ${garageEntries.userId} = ${users.id})`;
const serviceCountSql = sql<number>`(select count(*)::int from ${serviceEntries} where ${serviceEntries.userId} = ${users.id})`;
const unlockCountSql = sql<number>`(select count(*)::int from ${vehicleUnlocks} where ${vehicleUnlocks.userId} = ${users.id})`;
const subscriptionStatusSql = sql<
  string | null
>`(select ${subscriptions.status} from ${subscriptions} where ${subscriptions.userId} = ${users.id} order by ${subscriptions.createdAt} desc limit 1)`;

export async function listUsers(options: ListUsersOptions = {}): Promise<{
  rows: UserListRow[];
  total: number;
  page: number;
  pageCount: number;
}> {
  const { q, status, role, sort = "created", dir = "desc", page = 1, pageSize = 25 } = options;

  const conditions = [];
  if (q && q.trim()) {
    const term = `%${q.trim()}%`;
    conditions.push(or(ilike(users.email, term), ilike(users.name, term)));
  }
  if (status) conditions.push(eq(users.status, status));
  if (role === "admin") conditions.push(eq(users.isAdmin, true));
  const where = conditions.length ? and(...conditions) : undefined;

  const direction = dir === "asc" ? asc : desc;
  const orderBy = (() => {
    switch (sort) {
      case "email":
        return direction(users.email);
      case "lastLogin":
        // NULLS LAST so "never logged in" doesn't dominate the top of a desc sort.
        return sql`${users.lastLoginAt} ${sql.raw(dir === "asc" ? "asc" : "desc")} nulls last`;
      case "vehicles":
        return sql`${vehicleCountSql} ${sql.raw(dir === "asc" ? "asc" : "desc")}`;
      case "services":
        return sql`${serviceCountSql} ${sql.raw(dir === "asc" ? "asc" : "desc")}`;
      case "created":
      default:
        return direction(users.createdAt);
    }
  })();

  const safePage = Math.max(1, page);

  const [rows, totalRows] = await Promise.all([
    db
      .select({
        id: users.id,
        email: users.email,
        name: users.name,
        status: users.status,
        isAdmin: users.isAdmin,
        createdAt: users.createdAt,
        lastLoginAt: users.lastLoginAt,
        emailRemindersOptOut: users.emailRemindersOptOut,
        vehicleCount: vehicleCountSql,
        serviceCount: serviceCountSql,
        unlockCount: unlockCountSql,
        subscriptionStatus: subscriptionStatusSql,
      })
      .from(users)
      .where(where)
      .orderBy(orderBy)
      .limit(pageSize)
      .offset((safePage - 1) * pageSize),
    db.select({ n: count() }).from(users).where(where),
  ]);

  const total = totalRows[0]?.n ?? 0;
  return {
    rows,
    total,
    page: safePage,
    pageCount: Math.max(1, Math.ceil(total / pageSize)),
  };
}

// --- detail -----------------------------------------------------------------

export interface UserDetail {
  user: UserListRow;
  roles: string[];
  vehicles: {
    id: string;
    kind: string;
    vehicleId: string | null;
    year: string | null;
    make: string | null;
    model: string | null;
    trim: string | null;
    engine: string | null;
    vin: string | null;
    createdAt: Date;
    unlocked: boolean;
    unlockSource: string | null;
    serviceCount: number;
    odometer: number | null;
  }[];
  services: {
    id: string;
    garageEntryId: string;
    date: string;
    mileage: number;
    title: string;
    notes: string | null;
    loggedAt: Date;
  }[];
  logins: { id: string; loggedInAt: Date }[];
  purchases: {
    id: string;
    description: string | null;
    amountCents: number;
    status: string;
    createdAt: Date;
  }[];
  subscriptions: {
    id: string;
    plan: string;
    status: string;
    priceCents: number;
    currentPeriodEnd: Date | null;
    createdAt: Date;
  }[];
}

export async function getUserDetail(userId: string): Promise<UserDetail | null> {
  const userRows = await db
    .select({
      id: users.id,
      email: users.email,
      name: users.name,
      status: users.status,
      isAdmin: users.isAdmin,
      createdAt: users.createdAt,
      lastLoginAt: users.lastLoginAt,
      emailRemindersOptOut: users.emailRemindersOptOut,
      vehicleCount: vehicleCountSql,
      serviceCount: serviceCountSql,
      unlockCount: unlockCountSql,
      subscriptionStatus: subscriptionStatusSql,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  const user = userRows[0];
  if (!user) return null;

  const [roleRows, vehicles, services, logins, purchaseRows, subscriptionRows] = await Promise.all([
    db.select({ role: adminRoles.role }).from(adminRoles).where(eq(adminRoles.userId, userId)),
    db
      .select({
        id: garageEntries.id,
        kind: garageEntries.kind,
        vehicleId: garageEntries.vehicleId,
        year: garageEntries.year,
        make: garageEntries.make,
        model: garageEntries.model,
        trim: garageEntries.trim,
        engine: garageEntries.engine,
        vin: garageEntries.vin,
        createdAt: garageEntries.createdAt,
        unlockSource: sql<
          string | null
        >`(select ${vehicleUnlocks.source} from ${vehicleUnlocks} where ${vehicleUnlocks.garageEntryId} = ${garageEntries.id} and ${vehicleUnlocks.userId} = ${garageEntries.userId} limit 1)`,
        serviceCount: sql<number>`(select count(*)::int from ${serviceEntries} where ${serviceEntries.garageEntryId} = ${garageEntries.id})`,
        odometer: sql<
          number | null
        >`(select ${odometerReadings.miles} from ${odometerReadings} where ${odometerReadings.garageEntryId} = ${garageEntries.id} limit 1)`,
      })
      .from(garageEntries)
      .where(eq(garageEntries.userId, userId))
      .orderBy(desc(garageEntries.createdAt)),
    db
      .select({
        id: serviceEntries.id,
        garageEntryId: serviceEntries.garageEntryId,
        date: serviceEntries.date,
        mileage: serviceEntries.mileage,
        title: serviceEntries.title,
        notes: serviceEntries.notes,
        loggedAt: serviceEntries.loggedAt,
      })
      .from(serviceEntries)
      .where(eq(serviceEntries.userId, userId))
      .orderBy(desc(serviceEntries.loggedAt))
      .limit(50),
    db
      .select({ id: loginEvents.id, loggedInAt: loginEvents.loggedInAt })
      .from(loginEvents)
      .where(eq(loginEvents.userId, userId))
      .orderBy(desc(loginEvents.loggedInAt))
      .limit(20),
    db
      .select({
        id: purchases.id,
        description: purchases.description,
        amountCents: purchases.amountCents,
        status: purchases.status,
        createdAt: purchases.createdAt,
      })
      .from(purchases)
      .where(eq(purchases.userId, userId))
      .orderBy(desc(purchases.createdAt))
      .limit(20),
    db
      .select({
        id: subscriptions.id,
        plan: subscriptions.plan,
        status: subscriptions.status,
        priceCents: subscriptions.priceCents,
        currentPeriodEnd: subscriptions.currentPeriodEnd,
        createdAt: subscriptions.createdAt,
      })
      .from(subscriptions)
      .where(eq(subscriptions.userId, userId))
      .orderBy(desc(subscriptions.createdAt))
      .limit(10),
  ]);

  return {
    user,
    roles: roleRows.map((r) => r.role),
    vehicles: vehicles.map((v) => ({ ...v, unlocked: v.unlockSource !== null })),
    services,
    logins,
    purchases: purchaseRows,
    subscriptions: subscriptionRows,
  };
}
