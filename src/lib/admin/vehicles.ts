import { sql, eq, and, or, ilike, count, desc, asc } from "drizzle-orm";
import { db } from "@/db";
import { garageEntries, users, serviceEntries, vehicleUnlocks, odometerReadings, appEvents } from "@/db/schema";
import { findVehicle } from "@/lib/data";

// ---------------------------------------------------------------------------
// Vehicle fleet queries.
//
// "Vehicles" here means rows in garage_entries -- the real cars real accounts
// have added -- not the curated catalog in src/data/vehicles.ts. The two are
// related (a "catalog" entry points at a curated vehicle by id) but the fleet
// view is about what users actually own, which is the more useful signal:
// every "custom" entry is a user telling you which vehicle to build next.
//
// All grouping and counting happens in Postgres.
// ---------------------------------------------------------------------------

export const VEHICLE_SORTS = ["created", "year", "make", "services"] as const;
export type VehicleSort = (typeof VEHICLE_SORTS)[number];

export interface VehicleRow {
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
  ownerId: string | null;
  ownerEmail: string | null;
  serviceCount: number;
  unlocked: boolean;
  odometer: number | null;
}

const serviceCountSql = sql<number>`(select count(*)::int from ${serviceEntries} where ${serviceEntries.garageEntryId} = ${garageEntries.id})`;
const unlockedSql = sql<boolean>`exists (select 1 from ${vehicleUnlocks} where ${vehicleUnlocks.garageEntryId} = ${garageEntries.id})`;
const odometerSql = sql<
  number | null
>`(select ${odometerReadings.miles} from ${odometerReadings} where ${odometerReadings.garageEntryId} = ${garageEntries.id} limit 1)`;

export interface ListVehiclesOptions {
  q?: string;
  kind?: "catalog" | "custom";
  sort?: VehicleSort;
  dir?: "asc" | "desc";
  page?: number;
  pageSize?: number;
}

export async function listVehicleEntries(options: ListVehiclesOptions = {}): Promise<{
  rows: VehicleRow[];
  total: number;
  page: number;
  pageCount: number;
}> {
  const { q, kind, sort = "created", dir = "desc", page = 1, pageSize = 25 } = options;

  const conditions = [];
  if (q && q.trim()) {
    const term = `%${q.trim()}%`;
    conditions.push(
      or(
        ilike(garageEntries.make, term),
        ilike(garageEntries.model, term),
        ilike(garageEntries.year, term),
        ilike(garageEntries.vin, term),
        ilike(garageEntries.vehicleId, term),
        ilike(users.email, term)
      )
    );
  }
  if (kind) conditions.push(eq(garageEntries.kind, kind));
  const where = conditions.length ? and(...conditions) : undefined;

  const direction = dir === "asc" ? asc : desc;
  const orderBy = (() => {
    switch (sort) {
      case "year":
        return direction(garageEntries.year);
      case "make":
        return direction(garageEntries.make);
      case "services":
        return sql`${serviceCountSql} ${sql.raw(dir === "asc" ? "asc" : "desc")}`;
      case "created":
      default:
        return direction(garageEntries.createdAt);
    }
  })();

  const safePage = Math.max(1, page);

  const [rows, totalRows] = await Promise.all([
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
        ownerId: users.id,
        ownerEmail: users.email,
        serviceCount: serviceCountSql,
        unlocked: unlockedSql,
        odometer: odometerSql,
      })
      .from(garageEntries)
      .leftJoin(users, eq(users.id, garageEntries.userId))
      .where(where)
      .orderBy(orderBy)
      .limit(pageSize)
      .offset((safePage - 1) * pageSize),
    db.select({ n: count() }).from(garageEntries).leftJoin(users, eq(users.id, garageEntries.userId)).where(where),
  ]);

  const total = totalRows[0]?.n ?? 0;
  return { rows, total, page: safePage, pageCount: Math.max(1, Math.ceil(total / pageSize)) };
}

// --- fleet aggregates -------------------------------------------------------

export interface FleetStats {
  total: number;
  catalog: number;
  custom: number;
  withVin: number;
  topMakes: { label: string; value: number }[];
  topModels: { label: string; value: number }[];
  topYears: { label: string; value: number }[];
  recent: VehicleRow[];
}

export async function getFleetStats(): Promise<FleetStats> {
  const [total, catalog, custom, withVin, makes, models, years, recent] = await Promise.all([
    db.select({ n: count() }).from(garageEntries),
    db.select({ n: count() }).from(garageEntries).where(eq(garageEntries.kind, "catalog")),
    db.select({ n: count() }).from(garageEntries).where(eq(garageEntries.kind, "custom")),
    db.select({ n: count() }).from(garageEntries).where(sql`${garageEntries.vin} is not null and ${garageEntries.vin} <> ''`),
    db
      .select({ label: sql<string>`coalesce(nullif(${garageEntries.make}, ''), 'Unknown')`, value: sql<number>`count(*)::int` })
      .from(garageEntries)
      .groupBy(sql`coalesce(nullif(${garageEntries.make}, ''), 'Unknown')`)
      .orderBy(sql`count(*) desc`)
      .limit(8),
    db
      .select({
        label: sql<string>`coalesce(nullif(concat_ws(' ', ${garageEntries.make}, ${garageEntries.model}), ''), 'Unknown')`,
        value: sql<number>`count(*)::int`,
      })
      .from(garageEntries)
      .groupBy(sql`coalesce(nullif(concat_ws(' ', ${garageEntries.make}, ${garageEntries.model}), ''), 'Unknown')`)
      .orderBy(sql`count(*) desc`)
      .limit(8),
    db
      .select({ label: sql<string>`coalesce(nullif(${garageEntries.year}, ''), 'Unknown')`, value: sql<number>`count(*)::int` })
      .from(garageEntries)
      .groupBy(sql`coalesce(nullif(${garageEntries.year}, ''), 'Unknown')`)
      .orderBy(sql`count(*) desc`)
      .limit(8),
    listVehicleEntries({ pageSize: 8, sort: "created", dir: "desc" }),
  ]);

  return {
    total: total[0]?.n ?? 0,
    catalog: catalog[0]?.n ?? 0,
    custom: custom[0]?.n ?? 0,
    withVin: withVin[0]?.n ?? 0,
    topMakes: makes,
    topModels: models,
    topYears: years,
    recent: recent.rows,
  };
}

// --- detail -----------------------------------------------------------------

export interface VehicleDetail {
  vehicle: VehicleRow;
  services: { id: string; date: string; mileage: number; title: string; notes: string | null; loggedAt: Date }[];
  guideViews: { objectId: string | null; n: number }[];
  dataIssues: string[];
}

/**
 * Data-integrity checks on a single user vehicle. These are the problems that
 * make a garage entry less useful to its owner -- not cosmetic gaps.
 */
function findDataIssues(v: VehicleRow): string[] {
  const issues: string[] = [];

  if (v.kind === "custom") {
    issues.push("No curated specifications — this vehicle isn't in the catalog yet.");
    if (!v.engine) issues.push("No engine recorded, so fluid and torque data can never be matched.");
  } else if (v.vehicleId) {
    const catalog = findVehicle(v.vehicleId);
    if (!catalog) {
      issues.push(`Points at catalog vehicle "${v.vehicleId}", which no longer exists in the data files.`);
    } else {
      if (catalog.specs.length === 0) issues.push("Catalog entry has no vehicle specifications.");
      if (catalog.fluids.length === 0) issues.push("Catalog entry has no fluid capacities.");
    }
  }

  if (!v.year || !v.make || !v.model) {
    if (v.kind === "custom") issues.push("Incomplete year/make/model.");
  }

  if (v.vin) {
    const vin = v.vin.trim().toUpperCase();
    if (vin.length !== 17) issues.push(`VIN is ${vin.length} characters — a valid VIN is 17.`);
    else if (/[IOQ]/.test(vin)) issues.push("VIN contains I, O or Q, which never appear in a real VIN.");
  }

  if (v.serviceCount === 0) issues.push("No service history logged.");
  if (v.odometer === null) issues.push("No odometer reading, so maintenance reminders can't be sharpened.");

  return issues;
}

export async function getVehicleDetail(id: string): Promise<VehicleDetail | null> {
  const rows = await db
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
      ownerId: users.id,
      ownerEmail: users.email,
      serviceCount: serviceCountSql,
      unlocked: unlockedSql,
      odometer: odometerSql,
    })
    .from(garageEntries)
    .leftJoin(users, eq(users.id, garageEntries.userId))
    .where(eq(garageEntries.id, id))
    .limit(1);

  const vehicle = rows[0];
  if (!vehicle) return null;

  const [services, guideViews] = await Promise.all([
    db
      .select({
        id: serviceEntries.id,
        date: serviceEntries.date,
        mileage: serviceEntries.mileage,
        title: serviceEntries.title,
        notes: serviceEntries.notes,
        loggedAt: serviceEntries.loggedAt,
      })
      .from(serviceEntries)
      .where(eq(serviceEntries.garageEntryId, id))
      .orderBy(desc(serviceEntries.loggedAt))
      .limit(50),
    vehicle.ownerId
      ? db
          .select({ objectId: appEvents.objectId, n: sql<number>`count(*)::int` })
          .from(appEvents)
          .where(and(eq(appEvents.userId, vehicle.ownerId), eq(appEvents.type, "guide.viewed")))
          .groupBy(appEvents.objectId)
          .orderBy(sql`count(*) desc`)
          .limit(10)
      : Promise.resolve([]),
  ]);

  return { vehicle, services, guideViews, dataIssues: findDataIssues(vehicle) };
}

/**
 * The demand report: user-added vehicles we have no curated data for,
 * grouped so the most-requested vehicle sits at the top. This is the
 * content backlog, written by users rather than guessed at.
 */
export async function getDemandReport(limit = 20): Promise<{ label: string; value: number }[]> {
  const rows = await db
    .select({
      label: sql<string>`nullif(trim(concat_ws(' ', ${garageEntries.year}, ${garageEntries.make}, ${garageEntries.model})), '')`,
      value: sql<number>`count(*)::int`,
    })
    .from(garageEntries)
    .where(eq(garageEntries.kind, "custom"))
    .groupBy(sql`nullif(trim(concat_ws(' ', ${garageEntries.year}, ${garageEntries.make}, ${garageEntries.model})), '')`)
    .orderBy(sql`count(*) desc`)
    .limit(limit);

  return rows.filter((r): r is { label: string; value: number } => Boolean(r.label));
}
