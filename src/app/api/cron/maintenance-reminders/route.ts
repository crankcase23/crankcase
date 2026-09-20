import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users, garageEntries, reminderNotifications } from "@/db/schema";
import { listServiceEntries } from "@/lib/serviceEntriesDb";
import { getOdometer } from "@/lib/odometerDb";
import { computeReminders, maintenanceItemsFor } from "@/lib/reminders";
import { getVehicleById } from "@/data/vehicles";
import { sendEmail } from "@/lib/email";
import { makeUnsubscribeToken } from "@/lib/unsubscribeToken";

// Daily digest of newly-overdue/due-soon maintenance items, one email per
// opted-in user covering every vehicle in their garage. Vercel Cron hits
// this on the schedule in vercel.json and adds an
// Authorization: Bearer <CRON_SECRET> header automatically when CRON_SECRET
// is set as an env var on the project -- that's what stops anyone else from
// triggering this and spamming every user. Only emails when a maintenance
// item newly crosses into "due-soon" or "overdue" (reminder_notifications
// tracks what was last notified), so it won't nag daily for something
// that's been overdue for a week.
export async function GET(req: NextRequest) {
const cronSecret = process.env.CRON_SECRET;
if (!cronSecret) {
console.error("[cron/maintenance-reminders] CRON_SECRET not set -- refusing to run");
return NextResponse.json({ error: "not_configured" }, { status: 500 });
}
if (req.headers.get("authorization") !== "Bearer " + cronSecret) {
return NextResponse.json({ error: "unauthorized" }, { status: 401 });
}

const origin = new URL(req.url).origin;
const activeUsers = await db.select().from(users).where(eq(users.emailRemindersOptOut, false));

let emailsSent = 0;
let itemsNotified = 0;

for (const user of activeUsers) {
const vehicles = await db.select().from(garageEntries).where(eq(garageEntries.userId, user.id));
const digestLines: string[] = [];

for (const vehicle of vehicles) {
const [entries, odometer, existingNotifications] = await Promise.all([
listServiceEntries(vehicle.id),
getOdometer(vehicle.id),
db.select().from(reminderNotifications).where(eq(reminderNotifications.garageEntryId, vehicle.id)),
]);
// Same intervals the vehicle's own page shows: the factory schedule where
// we hold it, the generic table where we don't. A custom garage entry has no
// catalog record, so it keeps the generic set.
const catalogVehicle = vehicle.kind === "catalog" && vehicle.vehicleId ? getVehicleById(vehicle.vehicleId) : undefined;
const results = computeReminders(entries, odometer, maintenanceItemsFor(catalogVehicle));
const dueResults = results.filter((r) => r.status === "overdue" || r.status === "due-soon");

for (const result of dueResults) {
const prior = existingNotifications.find((row) => row.itemKey === result.item.key);
if (prior && prior.status === result.status) continue;

const vehicleName = [vehicle.year, vehicle.make, vehicle.model].filter(Boolean).join(" ") || "Your vehicle";
const statusLabel = result.status === "overdue" ? "Overdue" : "Due soon";
digestLines.push("<li><strong>" + vehicleName + "</strong> -- " + result.item.label + " (" + statusLabel + ")</li>");

await db
.insert(reminderNotifications)
.values({ garageEntryId: vehicle.id, itemKey: result.item.key, status: result.status })
.onConflictDoUpdate({
target: [reminderNotifications.garageEntryId, reminderNotifications.itemKey],
set: { status: result.status, notifiedAt: new Date() },
});
itemsNotified++;
}
}

if (digestLines.length > 0) {
const token = makeUnsubscribeToken(user.id);
const unsubscribeUrl = origin + "/api/account/unsubscribe?uid=" + user.id + "&token=" + token;
const html = "<!doctype html><html><body style=\"font-family: system-ui, sans-serif; max-width: 560px; margin: 40px auto; color: #0f172a;\"><h1>Maintenance reminders</h1><p>Here's what's due across your garage:</p><ul>" + digestLines.join("") + "</ul><p><a href=\"" + origin + "/account\">Manage your vehicles</a></p><hr style=\"margin: 32px 0; border: none; border-top: 1px solid #e2e8f0;\" /><p style=\"font-size: 12px; color: #64748b;\">Don't want these emails? <a href=\"" + unsubscribeUrl + "\">Unsubscribe</a></p></body></html>";
const result = await sendEmail(user.email, "Maintenance reminders from Crankcase Garage", html);
if (result.ok) emailsSent++;
}
}

return NextResponse.json({ ok: true, usersChecked: activeUsers.length, emailsSent, itemsNotified });
}
