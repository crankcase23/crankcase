// Server-side email client for maintenance-reminder emails and the
// one-click unsubscribe flow (src/app/api/cron/maintenance-reminders,
// src/app/api/account/unsubscribe). Uses Resend -- picked for the same
// reason as Open Labor Project's client (src/lib/openLaborProject.ts):
// pure HTTP API, no native binaries, works fine from Vercel serverless.
//
// Never throws. If RESEND_API_KEY isn't set yet (Andy hasn't signed up /
// added the env var), this just logs a warning and no-ops so nothing else
// breaks -- same graceful-degradation pattern as the OLP integration.

const RESEND_API_URL = "https://api.resend.com/emails";

// Resend's sandbox "onboarding@resend.dev" sender works with no domain
// verification for testing; swap RESEND_FROM_EMAIL once crankcasegarage.com
// is verified in Resend (Settings -> Domains -> add DNS records) so real
// users see a crankcasegarage.com sender instead.
const FROM_EMAIL = process.env.RESEND_FROM_EMAIL || "Crankcase Garage <onboarding@resend.dev>";

export interface SendEmailResult {
ok: boolean;
error?: string;
}

export async function sendEmail(to: string, subject: string, html: string): Promise<SendEmailResult> {
const apiKey = process.env.RESEND_API_KEY;
if (!apiKey) {
console.warn("[email] RESEND_API_KEY not set -- skipping send to", to, subject);
return { ok: false, error: "not_configured" };
}
try {
const res = await fetch(RESEND_API_URL, {
method: "POST",
headers: { Authorization: "Bearer " + apiKey, "Content-Type": "application/json" },
body: JSON.stringify({ from: FROM_EMAIL, to: [to], subject, html }),
});
if (!res.ok) {
const body = await res.text().catch(() => "");
console.error("[email] Resend send failed", res.status, body);
return { ok: false, error: "resend_" + res.status };
}
return { ok: true };
} catch (err) {
console.error("[email] Resend request threw", err);
return { ok: false, error: "request_failed" };
}
}
