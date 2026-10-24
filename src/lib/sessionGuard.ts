import { createHash } from "node:crypto";
import * as React from "react";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { describeError } from "@/lib/dbErrorLogSafe";

// SESSION SECURITY. Sessions are stateless JWTs (src/auth.ts), so on their own a token stays valid for its whole lifetime even
// after the account is disabled or deleted, or its password is reset. This module re-checks the account on every auth() call
// (the jwt callback runs on every session decode) with one indexed primary-key read, and turns the answer into one of three
// verdicts:
//
//   valid       carry on.
//   denied      the account is disabled or gone, the password changed since this session was issued (reset or any other
//               change), or the token carries no password-version stamp. The jwt callback returns null: Auth.js clears the
//               session cookie and auth() returns null.
//   unverified  the database could not be read. Access is DENIED for this request (the session callback hands back no user,
//               and the auth() wrapper in src/auth.ts turns that into null) but the cookie is NOT touched and the token is
//               not altered, so the session comes back by itself when the database does. Never "let them in because we
//               cannot check", never "log everyone out because of a blip".
//
// PASSWORD-VERSION STAMP (`pwv`). sha256 of the stored password hash, truncated. It is written into the token at sign-in and
// compared on every request, so changing the password (the reset flow rewrites the hash) revokes every older session at once,
// including one held by whoever the reset was meant to lock out. The hash itself never goes into the token.
//
// NO GRANDFATHERING. A token issued before this change has no stamp. The only way to accept it would be to stamp it now with
// the CURRENT hash, and nothing records when the password last changed, so a stolen token from before an earlier reset
// would be silently blessed. That cannot be shown safe, so a token without a stamp is denied: every existing customer signs
// in once more after this deploys.

export const passwordVersion = (passwordHash: string): string =>
  createHash("sha256").update(`crankcase-pwv:${passwordHash}`).digest("base64url").slice(0, 16);

export interface SessionUserRow {
  status: string | null;
  passwordHash: string;
}
export type SessionLookup = (userId: string) => Promise<SessionUserRow | null>;
export type DenyReason = "no-user-id" | "missing-user" | "disabled" | "no-version" | "password-changed";
export type SessionVerdict = { kind: "valid" } | { kind: "denied"; reason: DenyReason } | { kind: "unverified" };

/** The decision itself, pure. */
export function judgeSession(token: { userId?: unknown; pwv?: unknown }, row: SessionUserRow | null): SessionVerdict {
  if (typeof token.userId !== "string" || token.userId === "") return { kind: "denied", reason: "no-user-id" };
  if (!row) return { kind: "denied", reason: "missing-user" };
  if (row.status === "disabled") return { kind: "denied", reason: "disabled" };
  if (typeof token.pwv !== "string" || token.pwv === "") return { kind: "denied", reason: "no-version" };
  if (token.pwv !== passwordVersion(row.passwordHash)) return { kind: "denied", reason: "password-changed" };
  return { kind: "valid" };
}

// One read per request even when a page calls auth() several times. React's cache() only exists on the server layer, so
// elsewhere (tests) it is a plain call.
const memo: <A extends unknown[], R>(fn: (...a: A) => R) => (...a: A) => R =
  typeof (React as { cache?: unknown }).cache === "function" ? ((React as unknown as { cache: <F>(f: F) => F }).cache) : (f) => f;

export const lookupSessionUser: SessionLookup = memo(async (userId: string) => {
  const rows = await db.select({ status: users.status, passwordHash: users.passwordHash }).from(users).where(eq(users.id, userId)).limit(1);
  return rows[0] ?? null;
});

export async function verifySessionToken(
  token: { userId?: unknown; pwv?: unknown },
  lookup: SessionLookup = lookupSessionUser,
  log: (...a: unknown[]) => void = console.error,
): Promise<SessionVerdict> {
  // A token with no user id cannot be looked up and is denied without touching the database.
  if (typeof token.userId !== "string" || token.userId === "") return { kind: "denied", reason: "no-user-id" };
  let row: SessionUserRow | null;
  try {
    row = await lookup(token.userId);
  } catch (err) {
    // Class and code only: drizzle's message is the lookup SQL plus the user's id, and this line runs on every authenticated request while the database is down.
    log("[session-guard] account lookup failed; denying this request, session cookie left untouched", describeError(err));
    return { kind: "unverified" };
  }
  return judgeSession(token, row);
}

// Tokens whose lookup failed on THIS request. A WeakSet, not a field on the token: the token is re-signed into the cookie
// after the callbacks run, so anything written onto it would be persisted.
const unverified = new WeakSet<object>();

/** The jwt and session callbacks for src/auth.ts, with the lookup injectable so tests can drive the real Auth.js flow. */
export function createSessionCallbacks(lookup: SessionLookup = lookupSessionUser, log: (...a: unknown[]) => void = console.error) {
  return {
    async jwt({ token, user }: { token: Record<string, unknown>; user?: unknown }): Promise<Record<string, unknown> | null> {
      if (user) {
        // Sign-in: the credentials provider has just verified the password and returns the version stamp.
        const u = user as { id?: string; pwv?: string };
        token.userId = u.id;
        token.pwv = u.pwv;
        return token;
      }
      const verdict = await verifySessionToken(token, lookup, log);
      if (verdict.kind === "denied") return null;
      if (verdict.kind === "unverified") unverified.add(token);
      return token;
    },
    async session<S extends { expires: string; user?: { id?: string } }>({ session, token }: { session: S; token: Record<string, unknown> }): Promise<S> {
      if (unverified.has(token)) return { expires: session.expires } as S; // no user: every caller treats this as signed out
      if (session.user) session.user.id = token.userId as string;
      return session;
    },
  };
}
