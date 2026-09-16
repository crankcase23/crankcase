import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { verifyUnsubscribeToken } from "@/lib/unsubscribeToken";

// One-click unsubscribe link sent at the bottom of every maintenance-reminder
// email (src/app/api/cron/maintenance-reminders). Deliberately GET + no
// login required -- that's how one-click List-Unsubscribe links work, and
// CAN-SPAM requires the opt-out to be that easy. The HMAC token
// (src/lib/unsubscribeToken.ts) is what stops randoms from unsubscribing
// someone else.
export async function GET(req: NextRequest) {
const uid = req.nextUrl.searchParams.get("uid");
const token = req.nextUrl.searchParams.get("token");

if (!uid || !token || !verifyUnsubscribeToken(uid, token)) {
return new NextResponse("This unsubscribe link is invalid or expired.", { status: 400 });
}

await db.update(users).set({ emailRemindersOptOut: true }).where(eq(users.id, uid));

const html = "<!doctype html><html><body style=\"font-family: system-ui, sans-serif; max-width: 480px; margin: 80px auto; text-align: center; color: #0f172a;\"><h1>You're unsubscribed</h1><p>You won't get any more maintenance reminder emails from Crankcase Garage. You can turn them back on any time from your account settings.</p></body></html>";

return new NextResponse(html, { status: 200, headers: { "Content-Type": "text/html" } });
}
