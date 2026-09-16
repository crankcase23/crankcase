import Link from "next/link";
import { desc, ilike } from "drizzle-orm";
import { db } from "@/db";
import { users, garageEntries, serviceEntries, vehicleUnlocks } from "@/db/schema";

export default async function AdminPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q } = await searchParams;

const [allUsers, allEntries, allServiceEntries, allUnlocks] = await Promise.all([
  q
  ? db.select().from(users).where(ilike(users.email, "%" + q + "%")).orderBy(desc(users.createdAt))
  : db.select().from(users).orderBy(desc(users.createdAt)),
  db.select({ userId: garageEntries.userId, kind: garageEntries.kind }).from(garageEntries),
  db.select({ id: serviceEntries.id }).from(serviceEntries),
  db.select({ userId: vehicleUnlocks.userId }).from(vehicleUnlocks),
  ]);

const vehicleCounts: Record<string, number> = {};
  for (const entry of allEntries) {
    vehicleCounts[entry.userId] = (vehicleCounts[entry.userId] ?? 0) + 1;
  }
  const catalogCount = allEntries.filter((e) => e.kind === "catalog").length;
  const customCount = allEntries.filter((e) => e.kind === "custom").length;
  return (
    <div style={{ maxWidth: 900, margin: "0 auto", padding: "2rem 1rem" }}>
      <h1>Admin</h1>
    <div style={{ display: "flex", gap: "1.5rem", flexWrap: "wrap", margin: "1rem 0 1.5rem", fontSize: 14 }}>
    <div><strong>{allUsers.length}</strong> accounts{q ? " (filtered)" : ""}</div>
    <div><strong>{allEntries.length}</strong> vehicles ({catalogCount} catalog, {customCount} custom)</div>
    <div><strong>{allServiceEntries.length}</strong> service entries logged</div>
    <div><strong>{allUnlocks.length}</strong> unlocks granted</div>
    </div>
    
    <form action="/admin" method="get" style={{ marginBottom: "1rem" }}>
    <input type="text" name="q" defaultValue={q ?? ""} placeholder="Search by email" style={{ padding: "0.4rem", width: 240 }} />
    <button type="submit" style={{ marginLeft: "0.5rem" }}>Search</button>
      {q && <Link href="/admin" style={{ marginLeft: "0.5rem" }}>Clear</Link>}
    </form>
        <div style={{ display: "flex", gap: "1rem", marginBottom: "1.5rem", fontSize: 14 }}>
        <a href="/api/admin/export/users">Export users CSV</a>
        <a href="/api/admin/export/vehicles">Export vehicles CSV</a>
        </div>

      {allUsers.map((u) => (
      <div key={u.id} style={{ borderBottom: "1px solid #334155", padding: "0.75rem 0" }}>
        <div style={{ fontWeight: 600 }}>{u.email}{u.isAdmin ? " (admin)" : ""}</div>
        <div style={{ fontSize: 13, color: "#94a3b8" }}>Signed up {u.createdAt.toISOString().slice(0, 10)} -- last login {u.lastLoginAt ? u.lastLoginAt.toISOString().slice(0, 10) : "never"} -- {vehicleCounts[u.id] ?? 0} vehicle(s) -- email reminders {u.emailRemindersOptOut ? "off" : "on"}</div>
        <Link href={"/admin/users/" + u.id}>Manage</Link>
      </div>
      ))}
      {allUsers.length === 0 && <p>No accounts match &quot;{q}&quot;.</p>}
        </div>
        );
                                         }
