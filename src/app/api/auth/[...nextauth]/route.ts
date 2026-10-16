import { NextRequest, NextResponse } from "next/server";
import { handlers } from "@/auth";
import { recordError } from "@/lib/errors";
import { clientIp, loginRules, reserve, release, logLimiterFailure, type Reservation } from "@/lib/authGuard";

export const { GET } = handlers;

// LOGIN THROTTLING (docs/auth/ABUSE-CONTROLS.md). Only the credentials callback is guarded; everything else passes through.
//
// Before the password is even looked at (bcrypt is the expensive part) one attempt is reserved against three limits:
//   8 failures / 15 min per (account, network address), 40 / 15 min per address, 30 / hour per account.
// Over a limit: 429 + Retry-After, a generic body that is identical for a real and a non-existent email, and no password check.
// A successful login (the response sets the session cookie) hands its slots back, so only failures use up the budget.
//
// If the limiter store is unreachable this FAILS OPEN FOR THROTTLING ONLY: the request still goes to Auth.js, which still
// verifies the password (and the disabled-account rule) exactly as before. A database outage cannot turn into a free pass:
// verifying the password needs the same database. The failure is logged ("[auth-limiter] FAIL-OPEN") and recorded.
//
// The 429 body is JSON {url}, because next-auth/react's signIn() reads data.url: it surfaces error=RateLimited and
// code=<seconds to wait> to the login form.
export async function POST(req: NextRequest) {
  const url = new URL(req.url);
  if (!url.pathname.endsWith("/callback/credentials")) return handlers.POST(req);

  let email = "";
  try {
    const value = (await req.clone().formData()).get("email");
    if (typeof value === "string") email = value;
  } catch {
    // unreadable body: Auth.js will reject it; only the address limit applies
  }

  let reservation: Reservation | null = null;
  try {
    const slot = await reserve(loginRules(email, clientIp(req)));
    if (!slot.ok) {
      return NextResponse.json(
        { url: `${url.origin}/login?error=RateLimited&code=${slot.retryAfter}` },
        { status: 429, headers: { "Retry-After": String(slot.retryAfter) } },
      );
    }
    reservation = slot.reservation;
  } catch (err) {
    logLimiterFailure("login", "FAIL-OPEN", err);
    void recordError({ source: "auth-limiter", error: err, level: "warning", path: url.pathname, metadata: { mode: "fail-open", flow: "login" } });
  }

  const res = await handlers.POST(req);
  if (reservation && res.headers.getSetCookie().some((c) => /(^|[^A-Za-z-])(__Secure-)?authjs\.session-token=[^;]/.test(c))) {
    await release(reservation);
  }
  return res;
}
