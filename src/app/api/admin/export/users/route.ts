import { NextResponse } from "next/server";
import { desc } from "drizzle-orm";
import { requireAdminUserId } from "@/lib/adminAuth";
import { db } from "@/db";
import { users, garageEntries, vehicleUnlocks } from "@/db/schema";

// CSV export of every account for the admin Overview page -- opens
// directly in Excel/Sheets without adding a real .xlsx-writing dependency.
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

const [allUsers, allEntries, allUnlocks] = await Promise.all([
  db.select().from(users).orderBy(desc(users.createdAt)),
  db.select({ id: garageEntries.id, userId: garageEntries.userId }).from(garageEntries),
  db.select({ userId: vehicleUnlocks.userId }).from(vehicleUnlocks),
  ]);

const vehicleCountByUser: Record<string, number> = {};
  for (const e of allEntries) vehicleCountByUser[e.userId] = (vehicleCountByUser[e.userId] ?? 0) + 1;

const unlockCountByUser: Record<string, number> = {};
  for (const u of allUnlocks) unlockCountByUser[u.userId] = (unlockCountByUser[u.userId] ?? 0) + 1;

let csv = csvRow(["Email", "Signed up", "Last login", "Vehicles", "Unlocks", "Admin", "Email reminders"]);
  for (const u of allUsers) {
    csv += csvRow([
      u.email,
      u.createdAt.toISOString().slice(0, 10),
      u.lastLoginAt ? u.lastLoginAt.toISOString().slice(0, 10) : "never",
      vehicleCountByUser[u.id] ?? 0,
      unlockCountByUser[u.id] ?? 0,
      u.isAdmin ? "yes" : "no",
      u.emailRemindersOptOut ? "off" : "on",
      ]);
  }

return new NextResponse(csv, {
  headers: {
    "Content-Type": "text/csv",
    "Content-Disposition": `attachment; filename="crankcase-users-${new Date().toISOString().slice(0, 10)}.csv"`,
  },
});
}
