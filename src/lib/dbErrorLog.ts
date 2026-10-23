import { errorCode } from "@/lib/safeError";

// Safe descriptions of DATABASE errors for server logs and for the error_events table (build 104-G).
//
// WHY: drizzle wraps every failed query in a DrizzleQueryError whose `message` and `stack` begin with the full SQL text followed by the
// bound parameters ("Failed query: insert into "feedback" ... params: <user id>,<email>,<the customer's text>"). Handing that object to
// console.error, or storing its message/stack, copies the schema and a customer's data into the log and into a second table. A raw pg
// error can quote the offending value in its message too, and a network error carries the database host and port.
//
// WHAT IS KEPT: the error class, the short SQLSTATE or network code (diagnosable: "57P01", "23505", "ECONNREFUSED"), and for a stored
// error the stack FRAMES (file and line only: they locate the bug and carry no data). The caller supplies the subsystem tag.
// WHAT IS NEVER READ for such an error: message, query, params, detail, or the stack's header.
//
// Ordinary (non-database) errors are not touched: their message and stack are recorded exactly as before.

const LABEL = /^[A-Za-z0-9_]{1,40}$/;

/** The error's class name when it is a plain identifier (safeError.ts caps this at 16 characters, which turns DrizzleQueryError into NonError). */
export function errorLabel(err: unknown): string {
  return err instanceof Error && LABEL.test(err.name) ? err.name : "NonError";
}

/** The short code on the error or on any of the first few errors down its `cause` chain (drizzle wraps pg; wrappers wrap drizzle). */
function codeDeep(err: unknown): string | null {
  let e: unknown = err;
  for (let i = 0; i < 4 && e !== null && typeof e === "object"; i++) {
    const c = errorCode(e);
    if (c) return c;
    e = (e as { cause?: unknown }).cause;
  }
  return null;
}

/** "class=DrizzleQueryError code=57P01": safe to log. Never includes SQL, parameters, messages or stacks. Never throws (it runs inside catch blocks). */
export function describeError(err: unknown): string {
  try {
    return `class=${errorLabel(err)} code=${codeDeep(err) ?? "none"}`;
  } catch {
    return "class=NonError code=none";
  }
}

const looksLikePg = (e: unknown): boolean => {
  const o = e as { code?: unknown; severity?: unknown } | null | undefined;
  return typeof o?.code === "string" && /^[0-9A-Z]{5}$/.test(o.code) && typeof o?.severity === "string";
};
const looksLikeNetwork = (e: unknown): boolean => {
  const o = e as { syscall?: unknown; address?: unknown } | null | undefined;
  return typeof o?.syscall === "string" || typeof o?.address === "string";
};

/** True for anything whose message may carry SQL, bound parameters, a quoted value or a connection address (also when it only wraps one). */
export function isSensitiveError(err: unknown): boolean {
  let e: unknown = err;
  for (let i = 0; i < 4 && e !== null && typeof e === "object"; i++) {
    const o = e as { query?: unknown; params?: unknown; cause?: unknown };
    if (typeof o.query === "string" || Array.isArray(o.params)) return true;
    if (looksLikePg(e) || looksLikeNetwork(e)) return true;
    if (e instanceof Error && e.message.startsWith("Failed query:")) return true;
    e = o.cause;
  }
  return false;
}

const FRAME = /^\s+at /;

/**
 * Stack frames only. A stack is "<name>: <message>\n    at frame..." and for a database error the message is the SQL plus the bound
 * parameters, which can themselves contain lines that look like frames ("hello\n   at the shop 4pm"). So the header is cut out BY ITS
 * CONTENT (the message, wherever the engine put it) before the frames are picked, and a stack that does not contain the message at all
 * (reassigned, or built by something else) is not trusted: no frames are kept.
 */
function framesOf(err: unknown): string[] {
  if (!(err instanceof Error) || typeof err.stack !== "string") return [];
  const message = typeof err.message === "string" ? err.message : "";
  let body = err.stack;
  if (message !== "") {
    const at = body.indexOf(message);
    if (at < 0) return [];
    body = body.slice(0, at) + body.slice(at + message.length);
  }
  return body.split("\n").filter((l) => FRAME.test(l));
}

/** What error_events stores. Ordinary errors: unchanged. Sensitive errors: class + code, and the stack frames without the header. */
export function recordableError(err: unknown): { message: string; stack: string | null; sensitive: boolean } {
  if (isSensitiveError(err)) {
    const summary = describeError(err);
    return { message: summary, stack: [summary, ...framesOf(err)].join("\n").slice(0, 8000), sensitive: true };
  }
  return {
    message: err instanceof Error ? err.message : String(err),
    // Stack traces can be long; cap them so one runaway error can't bloat a row.
    stack: err instanceof Error ? err.stack?.slice(0, 8000) ?? null : null,
    sensitive: false,
  };
}
