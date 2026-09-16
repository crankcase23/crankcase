import Link from "next/link";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { requireUserId } from "@/lib/apiAuth";

export default async function AccountPage() {
  const userId = await requireUserId();
  let optedOut = false;
  let isAdmin = false;
  if (userId) {
    const rows = await db.select().from(users).where(eq(users.id, userId));
    optedOut = rows[0]?.emailRemindersOptOut ?? false;
    isAdmin = rows[0]?.isAdmin ?? false;
  }
  return (
    <div style={{ maxWidth: 480, margin: "0 auto", padding: "2rem 1rem" }}>
      <h1>Account Settings</h1>
      <h2>Maintenance Reminder Emails</h2>
      <p>
        {optedOut ? "You are currently unsubscribed from maintenance reminder emails." : "You are currently subscribed to maintenance reminder emails."}
      </p>
      <form action="/api/account/notifications/toggle" method="post">
      <input type="hidden" name="optOut" value={optedOut ? "false" : "true"} />
      <button type="submit">{optedOut ? "Resubscribe" : "Unsubscribe"}</button>
      </form>
      {isAdmin && (
      <div style={{ marginTop: "2rem", paddingTop: "1rem", borderTop: "1px solid #334155" }}>
        <Link href="/admin">Admin dashboard</Link>
      </div>
      )}
    </div>
    );
}
