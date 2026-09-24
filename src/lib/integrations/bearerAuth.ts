import { createHash, timingSafeEqual } from "node:crypto";

// ---------------------------------------------------------------------------
// Constant-time bearer check, shared by every machine-to-machine endpoint.
//
// Lifted verbatim from src/app/api/admin/report/route.ts so the two routes
// that use it cannot drift apart. The behaviour is deliberately boring:
//
//   * FAIL CLOSED. No configured secret, or one shorter than the caller's
//     minimum, means the endpoint is closed - never open. A misconfiguration
//     must not publish anything.
//   * Bearer only. Basic, cookies, query strings and custom headers are all
//     refused, so this can never be satisfied by the site's password gate or
//     by an admin session.
//   * Both sides are SHA-256 hashed before timingSafeEqual, so the compare is
//     over two fixed-length buffers. A raw timingSafeEqual throws on a length
//     mismatch, and guarding that with an early length check would leak the
//     secret's length to anyone willing to time the 401s.
//
// The caller decides what to do with `false`. It should be one identical 401
// for every failure mode - distinguishing "absent" from "wrong" from "not
// configured" is free reconnaissance.
// ---------------------------------------------------------------------------

export interface BearerCheckOptions {
  /** The configured secret (typically process.env.SOMETHING). */
  expected: string | undefined;
  /**
   * Shortest secret the endpoint will accept as *configured*. Anything shorter
   * is treated as unset. /api/admin/report uses 24 (its historical value);
   * new integrations should use 32 or more.
   */
  minLength: number;
}

export function bearerAccepted(header: string | null, options: BearerCheckOptions): boolean {
  const { expected, minLength } = options;

  if (!expected || expected.length < minLength) return false;
  if (!header || !header.startsWith("Bearer ")) return false;

  const digest = (value: string) => createHash("sha256").update(value, "utf8").digest();
  return timingSafeEqual(digest(header.slice(7)), digest(expected));
}
