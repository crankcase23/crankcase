import Link from "next/link";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users, garageEntries, vehicleUnlocks } from "@/db/schema";
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

const [entries, unlocks] = await Promise.all([
db.select().from(garageEntries).where(eq(garageEntries.userId, id)),
db.select().from(vehicleUnlocks).where(eq(vehicleUnlocks.userId, id)),
]);

const unlockedIds = new Set(unlocks.map((u) => u.garageEntryId));

function vehicleName(entry: typeof entries[number]) {
if (entry.kind === "catalog") {
const v = entry.vehicleId ? getVehicleById(entry.vehicleId) : undefined;
return v ? `${v.year} ${v.make} ${v.model} ${v.trim}` : entry.vehicleId ?? "Unknown vehicle";
}
return [entry.year, entry.make, entry.model, entry.trim].filter(Boolean).join(" ") || "Custom vehicle";
}

return (
<div style={{ maxWidth: 800, margin: "0 auto", padding: "2rem 1rem" }}>
<Link href="/admin">Back to admin</Link>
<h1>{user.email}</h1>
<p style={{ fontSize: 13, color: "#94a3b8" }}>Signed up {user.createdAt.toISOString().slice(0, 10)} -- email reminders {user.emailRemindersOptOut ? "off" : "on"}</p>
<h2>Vehicles</h2>
{entries.length === 0 && <p>No vehicles in garage.</p>}
{entries.map((entry) => {
const unlocked = unlockedIds.has(entry.id);
return (
<div key={entry.id} style={{ borderBottom: "1px solid #334155", padding: "0.75rem 0" }}>
<div style={{ fontWeight: 600 }}>{vehicleName(entry)}</div>
<div style={{ fontSize: 13, color: "#94a3b8" }}>{unlocked ? "Unlocked" : "Locked"}</div>
<form action="/api/admin/unlocks" method="post" style={{ marginTop: "0.5rem" }}>
<input type="hidden" name="userId" value={id} />
<input type="hidden" name="garageEntryId" value={entry.id} />
<input type="hidden" name="action" value={unlocked ? "revoke" : "grant"} />
<button type="submit">{unlocked ? "Revoke unlock" : "Gift unlock"}</button>
</form>
</div>
);
})}
</div>
);
}
