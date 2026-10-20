import { describeError as baseDescribe, errorLabel, isSensitiveError as baseSensitive, recordableError as baseRecordable } from "@/lib/dbErrorLog";

// TLS-, certificate- and AggregateError-aware wrappers around dbErrorLog.ts (Build 104-J).
//
// WHY A SEPARATE FILE: dbErrorLog.ts and safeError.ts are byte-identical copies of the ones PR #88 adds. Editing #89's copy would turn the
// merge into a content conflict; a new file merges clean and the integration collapses it into dbErrorLog.ts (see the 104-J evidence doc).
//
// WHAT THE BASE MISSES (all reproduced, all logged err.message before this file):
//   * ERR_TLS_CERT_ALTNAME_INVALID: message and `reason` / `host` name the DATABASE HOST ("Host: db.internal.example. is not in the cert's
//     altnames: DNS:..."). It has no `syscall` and no `address`, and its code is not a SQLSTATE, so isSensitiveError() said "safe".
//   * the other certificate failures (DEPTH_ZERO_SELF_SIGNED_CERT, CERT_HAS_EXPIRED, UNABLE_TO_VERIFY_LEAF_SIGNATURE, ERR_SSL_*): the message
//     often names the host, and their codes are longer than safeError.ts's 16-character cap, so describeError() printed "code=none".
//   * AggregateError (a connect that tried several addresses): empty message, but the inner errors name every address.
//
// recordableError() never throws (it runs inside catch blocks): an object that throws when inspected is recorded as class=NonError code=none.
//
// WHAT IS KEPT: class + the short code, now up to 48 characters of [A-Za-z0-9_]: "class=Error code=ERR_TLS_CERT_ALTNAME_INVALID".
// WHAT IS NEVER READ for a sensitive error: message, reason, host, cert, query, params, stack header.

const CODE = /^[A-Za-z0-9_]{1,48}$/;
const TLS_CODE = /^(?:ERR_(?:TLS|SSL|OSSL)_\w+|\w*(?:CERT|ISSUER|SELF_SIGNED|HOSTNAME_MISMATCH)\w*|UNABLE_TO_VERIFY_LEAF_SIGNATURE)$/i;

/** The error and everything reachable through `cause` and `errors[]` (AggregateError), breadth- and depth-limited. */
function related(err: unknown): unknown[] {
  const seen: unknown[] = [];
  let level: unknown[] = [err];
  for (let depth = 0; depth < 8 && level.length > 0; depth++) {
    const next: unknown[] = [];
    for (const e of level) {
      if (e === null || typeof e !== "object" || seen.includes(e)) continue;
      seen.push(e);
      const o = e as { cause?: unknown; errors?: unknown };
      if (o.cause !== undefined) next.push(o.cause);
      if (Array.isArray(o.errors)) next.push(...o.errors.slice(0, 8));
    }
    level = next;
  }
  return seen;
}

const codeOf = (e: unknown): string | null => {
  const c = (e as { code?: unknown } | null | undefined)?.code;
  return typeof c === "string" && CODE.test(c) ? c : null;
};

const looksLikeTls = (e: unknown): boolean => {
  const o = e as { code?: unknown; reason?: unknown; host?: unknown; hostname?: unknown; hostName?: unknown; servername?: unknown; cert?: unknown } | null | undefined;
  // any error that carries the name of a host it was talking to quotes that host somewhere
  if (typeof o?.host === "string" || typeof o?.hostname === "string" || typeof o?.hostName === "string" || typeof o?.servername === "string") return true;
  const c = typeof o?.code === "string" ? o.code : "";
  if (TLS_CODE.test(c)) return true;
  // a certificate-verification error carries its detail (the host) in `reason` / `host` / `cert`
  return typeof o?.reason === "string" && (typeof o?.host === "string" || (o?.cert !== null && typeof o?.cert === "object"));
};

/** dbErrorLog's check, plus TLS / certificate errors and AggregateErrors, also when they only appear as a cause or an inner error. */
export function isSensitiveError(err: unknown): boolean {
  try {
    if (baseSensitive(err)) return true;
    return related(err).some((e) => looksLikeTls(e) || e instanceof AggregateError || baseSensitive(e));
  } catch {
    return true; // fail closed: never log the message of something we could not inspect
  }
}

/** "class=Error code=ERR_TLS_CERT_ALTNAME_INVALID": safe to log. Never includes a message, reason, host, SQL, parameters or stack. Never throws. */
export function describeError(err: unknown): string {
  try {
    for (const e of related(err)) {
      const c = codeOf(e);
      if (c) return `class=${errorLabel(err)} code=${c}`;
    }
    return baseDescribe(err);
  } catch {
    return "class=NonError code=none";
  }
}

/** What error_events stores: the base behaviour, and for the extra sensitive shapes class + code only (no message, no stack at all). Never throws. */
export function recordableError(err: unknown): { message: string; stack: string | null; sensitive: boolean } {
  try {
    const base = baseRecordable(err);
    if (base.sensitive || !isSensitiveError(err)) return base;
    const summary = describeError(err);
    return { message: summary, stack: summary, sensitive: true };
  } catch {
    // an object that throws when inspected (a hostile getter or proxy): record nothing of its own
    const summary = "class=NonError code=none";
    return { message: summary, stack: summary, sensitive: true };
  }
}

export { errorLabel };
