import Link from "next/link";
import { desc } from "drizzle-orm";
import { db } from "@/db";
import { users, garageEntries } from "@/db/schema";

export default async function AdminPage() {
const [allUsers, allEntries] = await Promise.all([
db.select().from(users).orderBy(desc(users.createdAt)),
db.select({ userId: garageEntries.userId }).from(garageEntries),
]);

const vehicleCounts: Record<string, number> = {};
for (const entry of allEntries) {
vehicleCounts[entry.userId] = (vehicleCounts[entry.userId] ?? 0) + 1;
}

return (
<div style={{ maxWidth: 800, margin: "0 auto", padding: "2rem 1rem" }}>
<h1>Admin</h1>
<p>{allUsers.length} total accounts.</p>
{allUsers.map((u) => (
<div key={u.id} style={{ borderBottom: "1px solid #334155", padding: "0.75rem 0" }}>
<div style={{ fontWeight: 600 }}>{u.email}</div>
<div style={{ fontSize: 13, color: "#94a3b8" }}>Signed up {u.createdAt.toISOString().slice(0, 10)} -- {vehicleCounts[u.id] ?? 0} vehicle(s) -- email reminders {u.emailRemindersOptOut ? "off" : "on"}</div>
<Link href={"/admin/users/" + u.id}>Manage</Link>
</div>
))}
</div>
);
}
