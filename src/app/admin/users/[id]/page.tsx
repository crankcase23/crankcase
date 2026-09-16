import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { users, garageEntries, vehicleUnlocks, serviceEntries, odometerReadings, loginEvents } from "@/db/schema";
import { getVehicleById } from "@/data/vehicles";

export default async function AdminUserPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

const [user] = await db.select().from(users).where(eq(users.id, id)).limit(1);
  if (!user) {
    return (
      <div style={{ maxWidth: 800, margin: "0 auto", padding: "2rem 1rem" }}>
        <p>User not found.</p>
      <Link href="/admin">Back to admin</Link>
      </div>
      );
        }
const [entries, unlocks, serviceEntriesAll, odometerAll, logins] = await Promise.all([
  db.select().from(garageEntries).where(eq(garageEntries.userId, id)),
  db.select().from(vehicleUnlocks).where(eq(vehicleUnlocks.userId, id)),
  db.select().from(serviceEntries).where(eq(serviceEntries.userId, id)),
  db.select().from(odometerReadings).where(eq(odometerReadings.userId, id)),
  db.select().from(loginEvents).where(eq(loginEvents.userId, id)).orderBy(desc(loginEvents.loggedInAt)).limit(20),
  ]);

const unlockedIds = new Set(unlocks.map((u) => u.garageEntryId));

const serviceByEntry: Record<string, typeof serviceEntriesAll> = {};
  for (const s of serviceEntriesAll) {
    (serviceByEntry[s.garageEntryId] ??= []).push(s);
  }

const odometerByEntry: Record<string, number> = {};
  for (const o of odometerAll) {
    odometerByEntry[o.garageEntryId] = o.miles;
  }

function vehicleName(entry: typeof entries[number]) {
  if (entry.kind === "catalog") {
    const v = entry.vehicleId ? getVehicleById(entry.vehicleId) : undefined;
    return v ? `${v.year} ${v.make} ${v.model} ${v.trim}` : entry.vehicleId ?? "Unknown vehicle";
  }
  return [entry.year, entry.make, entry.model, entry.trim].filter(Boolean).join(" ") || "Custom vehicle";
}

function vehicleDetails(entry: typeof entries[number]) {
  const parts: string[] = [];
  if (entry.kind === "catalog") {
    const v = entry.vehicleId ? getVehicleById(entry.vehicleId) : undefined;
    if (v) parts.push(v.engine);
  } else if (entry.engine) {
    parts.push(entry.engine);
  }
  if (entry.vin) parts.push("VIN " + entry.vin);
  return parts.join(" -- ");
}
  return (
    <div style={{ maxWidth: 800, margin: "0 auto", padding: "2rem 1rem" }}>
      <Link href="/admin">Back to admin</Link>
    <h1>{user.email}</h1>
    <p style={{ fontSize: 13, color: "#94a3b8" }}>Signed up {user.createdAt.toISOString().slice(0, 10)} -- last login {user.lastLoginAt ? user.lastLoginAt.toISOString().slice(0, 10) : "never"} -- email reminders {user.emailRemindersOptOut ? "off" : "on"}</p>
    <h2>Vehicles</h2>
      {entries.length === 0 && <p>No vehicles in garage.</p>}
      {entries.map((entry) => {
      const unlocked = unlockedIds.has(entry.id);
      const details = vehicleDetails(entry);
      const history = serviceByEntry[entry.id] ?? [];
      const odometer = odometerByEntry[entry.id];
      return (
        <div key={entry.id} style={{ borderBottom: "1px solid #334155", padding: "0.75rem 0" }}>
          <div style={{ fontWeight: 600 }}>{vehicleName(entry)}</div>
          {details && <div style={{ fontSize: 13, color: "#94a3b8" }}>{details}</div>
          }
          <div style={{ fontSize: 13, color: "#94a3b8" }}>{unlocked ? "Unlocked" : "Locked"}{odometer !== undefined ? " -- " + odometer.toLocaleString() + " mi" : ""}</div>
          {history.length > 0 && (
          <ul style={{ fontSize: 13, color: "#cbd5e1", margin: "0.5rem 0", paddingLeft: "1.2rem" }}>
            {history.map((h) => (
            <li key={h.id}>{h.date} -- {h.title} ({h.mileage.toLocaleString()} mi)</li>
            ))}
          </ul>
          )}
          <form action="/api/admin/unlocks" method="post" style={{ marginTop: "0.5rem" }}>
            <input type="hidden" name="userId" value={id} />
            <input type="hidden" name="garageEntryId" value={entry.id} />
            <input type="hidden" name="action" value={unlocked ? "revoke" : "grant"} />
            <button type="submit">{unlocked ? "Revoke unlock" : "Gift unlock"}</button>
          </form>
        </div>
        );
    })}
      <h2>Login history</h2>
      {logins.length === 0 && <p>No recorded logins yet.</p>
      }
      {logins.length > 0 && (
      <ul style={{ fontSize: 13, color: "#cbd5e1", paddingLeft: "1.2rem" }}>
        {logins.map((l) => (
        <li key={l.id}>{l.loggedInAt.toISOString().slice(0, 19).replace("T", " ")}</li>
        ))}
      </ul>
      )}
    </div>
    );
}
