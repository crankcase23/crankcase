import { NextRequest, NextResponse } from "next/server";
import { handlers } from "@/auth";
import { recordError } from "@/lib/errors";
import { clientIp, loginRules, normaliseEmail, reserve, release, logLimiterFailure, type Reservation } from "@/lib/authGuard";

export const { GET } = handlers;

// LOGIN THROTTLING (docs/auth/ABUSE-CONTROLS.md). Only the credentials callback is guarded; everything else passes through.
//
// ONE PARSE, ONE IDENTITY. The review (H1, H2) found that the limiter and Auth.js each parsed the body their own way: a JSON body
// or a repeated `email` field made the limiter see no email, or a different one, than the one Auth.js authenticated. So this
// wrapper is now the only parser. It reads the body strictly, derives ONE canonical email (trimmed, lower-cased: the same
// normalisation findUserByEmail applies), counts that email, and hands Auth.js a NEW request whose body is rebuilt from the
// values it validated. Auth.js never sees the original body, so the two cannot disagree. Ambiguous or unreadable bodies are
// refused with a generic 400, never evaluated, and charged to the network address so they cannot be sprayed.
//
// Before the password is even looked at (bcrypt is the expensive part) one attempt is reserved against three limits:
//   8 failures / 15 min per (account, network address), 40 / 15 min per address, 30 / hour per account.
// Over a limit: 429 + Retry-After, a generic body that is identical for a real and a non-existent email, and no password check.
// A successful login (the response sets the session cookie) hands its slots back, so only failures use up the budget.
//
// If the limiter store is unreachable this FAILS OPEN FOR THROTTLING ONLY: the request still goes to Auth.js, which still
// verifies the password (and the disabled-account rule) exactly as before. If the limiter cannot decide in bounded time
// (contention, full waiting room) it is BUSY: denied with a 429, never opened. The failure is logged ("[auth-limiter]
// FAIL-OPEN") and recorded.
//
// The 429 body is JSON {url}, because next-auth/react's signIn() reads data.url: it surfaces error=RateLimited and
// code=<seconds to wait> to the login form.

const MAX_BODY_BYTES = 16 * 1024;

type Parsed = { ok: true; fields: Record<string, string>; email: string } | { ok: false; reason: string };

/** Strict body reader for the credentials callback: urlencoded or JSON, every value a string, no repeated key. */
async function parseLoginBody(req: Request): Promise<Parsed> {
  const declared = Number(req.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > MAX_BODY_BYTES) return { ok: false, reason: "size" }; // do not even read it
  const mediaType = (req.headers.get("content-type") ?? "").split(";")[0].trim().toLowerCase();
  if (mediaType !== "application/x-www-form-urlencoded" && mediaType !== "application/json") return { ok: false, reason: "content-type" };
  let text: string;
  try {
    text = await req.text();
  } catch {
    return { ok: false, reason: "unreadable" };
  }
  if (text.length === 0 || text.length > MAX_BODY_BYTES) return { ok: false, reason: "size" };

  const fields: Record<string, string> = {};
  if (mediaType === "application/json") {
    let json: unknown;
    try {
      json = JSON.parse(text);
    } catch {
      return { ok: false, reason: "json" };
    }
    if (!json || typeof json !== "object" || Array.isArray(json)) return { ok: false, reason: "json-shape" };
    for (const [k, v] of Object.entries(json as Record<string, unknown>)) {
      if (typeof v !== "string") return { ok: false, reason: "non-string" };
      fields[k] = v;
    }
  } else {
    for (const [k, v] of new URLSearchParams(text)) {
      if (Object.prototype.hasOwnProperty.call(fields, k)) return { ok: false, reason: "duplicate" };
      fields[k] = v;
    }
  }
  if (typeof fields.email !== "string" || typeof fields.password !== "string") return { ok: false, reason: "missing" };
  const email = normaliseEmail(fields.email);
  if (!email) return { ok: false, reason: "empty-email" };
  return { ok: true, fields, email };
}

const rateLimited = (origin: string, retryAfter: number) =>
  NextResponse.json({ url: `${origin}/login?error=RateLimited&code=${retryAfter}` }, { status: 429, headers: { "Retry-After": String(retryAfter) } });

export async function POST(req: NextRequest) {
  const url = new URL(req.url);
  if (!url.pathname.endsWith("/callback/credentials")) return handlers.POST(req);

  const ip = clientIp(req);
  const parsed = await parseLoginBody(req);

  if (!parsed.ok) {
    // Refused, not evaluated. Charged to the address only (there is no trustworthy account to charge).
    try {
      const slot = await reserve(loginRules("", ip));
      if (!slot.ok) return rateLimited(url.origin, slot.retryAfter);
    } catch (err) {
      logLimiterFailure("login", "FAIL-OPEN", err); // nothing is evaluated either way
    }
    return NextResponse.json({ url: `${url.origin}/login?error=CredentialsSignin` }, { status: 400 });
  }

  let reservation: Reservation | null = null;
  try {
    const slot = await reserve(loginRules(parsed.email, ip));
    if (!slot.ok) return rateLimited(url.origin, slot.retryAfter);
    reservation = slot.reservation;
  } catch (err) {
    logLimiterFailure("login", "FAIL-OPEN", err);
    void recordError({ source: "auth-limiter", error: err, level: "warning", path: url.pathname, metadata: { mode: "fail-open", flow: "login" } });
  }

  // Auth.js gets a request rebuilt from the validated fields, with the canonical email: it authenticates exactly what was counted.
  const headers = new Headers(req.headers);
  headers.set("content-type", "application/x-www-form-urlencoded");
  headers.delete("content-length");
  const body = new URLSearchParams({ ...parsed.fields, email: parsed.email }).toString();
  const res = await handlers.POST(new NextRequest(req.url, { method: "POST", headers, body }));

  if (reservation && res.headers.getSetCookie().some((c) => /(^|[^A-Za-z-])(__Secure-)?authjs\.session-token=[^;]/.test(c))) {
    await release(reservation);
  }
  return res;
}
