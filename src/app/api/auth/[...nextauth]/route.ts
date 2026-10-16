import { NextRequest, NextResponse } from "next/server";
import { handlers } from "@/auth";
import { recordError } from "@/lib/errors";
import { LimiterStoreError } from "@/lib/limiterDb";
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
// The network address is only ever one a trusted proxy contract supplies (authGuard.clientIp). With none, the three limits still
// apply, keyed on one shared "untrusted" address, and the event is logged.
//
// The 429 body is JSON {url}, because next-auth/react's signIn() reads data.url: it surfaces error=RateLimited and
// code=<seconds to wait> to the login form.

const MAX_BODY_BYTES = 16 * 1024;
const BODY_READ_DEADLINE_MS = 5000; // a login form is a few hundred bytes: a client that cannot deliver it in 5 s is not a login

/**
 * Read the body in pieces and stop at the limit. `await req.text()` reads to the end first, so a client that never finishes a
 * chunked body (no content-length to refuse) held the request and its memory for as long as it liked (review, 104-A).
 */
async function readCapped(req: Request): Promise<{ text: string } | { reason: "size" | "unreadable" | "timeout" }> {
  if (!req.body) return { text: "" };
  const reader = req.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  let timedOut = false;
  // One deadline for the whole body (a slow-drip sender is cut off like an endless one). Cancelling resolves the pending read as done.
  const timer = setTimeout(() => { timedOut = true; void reader.cancel().catch(() => undefined); }, BODY_READ_DEADLINE_MS);
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (timedOut) return { reason: "timeout" };
      if (done) break;
      total += value.byteLength;
      if (total > MAX_BODY_BYTES) {
        await reader.cancel().catch(() => undefined); // stop the sender being read at all
        return { reason: "size" };
      }
      chunks.push(value);
    }
  } catch {
    return { reason: timedOut ? "timeout" : "unreadable" };
  } finally {
    clearTimeout(timer);
  }
  const all = new Uint8Array(total);
  let at = 0;
  for (const c of chunks) { all.set(c, at); at += c.byteLength; }
  return { text: new TextDecoder().decode(all) };
}

/**
 * Is this the credentials callback, however the path is spelled? Auth.js tolerates a trailing slash, other case, doubled slashes
 * and percent-encoding, so an exact `endsWith("/callback/credentials")` let those spellings skip the limiter (review, 104-A).
 * Anything that decodes to a /callback path is guarded; a path that cannot be decoded is guarded too.
 */
function isCallbackPath(pathname: string): boolean {
  let p = pathname;
  try { p = decodeURIComponent(pathname); } catch { return true; }
  p = p.toLowerCase().replace(/\/{2,}/g, "/");
  return /\/callback(\/|$)/.test(p);
}

type Parsed = { ok: true; fields: Record<string, string>; email: string } | { ok: false; reason: string };

/** Strict body reader for the credentials callback: urlencoded or JSON, every value a string, no repeated key. */
async function parseLoginBody(req: Request): Promise<Parsed> {
  const declared = Number(req.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > MAX_BODY_BYTES) return { ok: false, reason: "size" }; // do not even read it
  const mediaType = (req.headers.get("content-type") ?? "").split(";")[0].trim().toLowerCase();
  if (mediaType !== "application/x-www-form-urlencoded" && mediaType !== "application/json") return { ok: false, reason: "content-type" };
  const read = await readCapped(req);
  if ("reason" in read) return { ok: false, reason: read.reason };
  const text = read.text;
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
  if (!isCallbackPath(url.pathname)) return handlers.POST(req);

  const ip = clientIp(req);
  if (!ip) console.error("[auth-limiter] NO-TRUSTED-IP flow=login (limits apply to the shared untrusted address)");
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
    // A store failure is the same database recordError would write to: with it hung, that write parks a shared-pool connection
    // for good (the shared pool has no timeouts). The console line above is the record; only unexpected errors go to the table.
    if (!(err instanceof LimiterStoreError)) void recordError({ source: "auth-limiter", error: err, level: "warning", path: url.pathname, metadata: { mode: "fail-open", flow: "login" } });
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
