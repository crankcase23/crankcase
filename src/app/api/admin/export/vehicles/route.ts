import { NextResponse } from "next/server";
import { requireAdminUserId } from "@/lib/adminAuth";
import { db } from "@/db";
import { users, garageEntries, vehicleUnlocks } from "@/db/schema";
import { getVehicleById } from "@/data/vehicles";

// CSV export of every vehicle across every garage, for the admin Overview
// page -- opens directly in Excel/Sheets without a real .xlsx dependency.
function csvCell(value: string) {
  if (/[",\n]/.test(value)) return '"' + value.replace(/"/g, '""') + '"';
  return value;
}

function csvRow(values: (string | number)[]) {
  return values.map((v) => csvCell(String(v))).join(",") + "\r\n";
}

export async function GET() {
  const adminUserId = await requireAdminUserId();
  if (!adminUserId) return NextResponse.json({ error: "Not authorized." }, { status: 403 });

const [allUsersRows, allEntries, allUnlocks] = await Promise.all([
  db.select({ id: users.id, email: users.email }).from(users),
  db.select().from(garageEntries),
  db.select().from(vehicleUnlocks),
  ]);

const emailByUser: Record<string, string> = {};
  for (const u of allUsersRows) emailByUser[u.id] = u.email;

const unlockedSet = new Set(allUnlocks.map((u) => u.userId + ":" + u.garageEntryId));

let csv = csvRow(["Owner email", "Kind", "Year", "Make", "Model", "Trim", "Engine", "VIN", "Unlocked", "Added"]);
  for (const entry of allEntries) {
    let year = entry.year ?? "";
    let make = entry.make ?? "";
    let model = entry.model ?? "";
    let trim = entry.trim ?? "";
    let engine = entry.engine ?? "";
    if (entry.kind === "catalog" && entry.vehicleId) {
      const v = getVehicleById(entry.vehicleId);
      if (v) {
        year = String(v.year);
        make = v.make;
        model = v.model;
        trim = v.trim ?? "";
        engine = v.engine ?? "";
      }
    }
    csv += csvRow([
      emailByUser[entry.userId] ?? "unknown",
      entry.kind,
      year,
      make,
      model,
      trim,
      engine,
      entry.vin ?? "",
      unlockedSet.has(entry.userId + ":" + entry.id) ? "yes" : "no",
      entry.createdAt.toISOString().slice(0, 10),
      ]);
  }

return new NextResponse(csv, {
  headers: {
    "Content-Type": "text/csv",
    "Content-Disposition": `attachment; filename="crankcase-vehicles-${new Date().toISOString().slice(0, 10)}.csv"`,
  },
});
}
