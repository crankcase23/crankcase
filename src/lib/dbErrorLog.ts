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

/** "class=DrizzleQueryError code=57P01": safe to log. Never includes SQL, parameters, messages or stacks. */
export function describeError(err: unknown): string {
  return `class=${errorLabel(err)} code=${errorCode(err) ?? "none"}`;
}

const looksLikePg = (e: unknown): boolean => {
  const o = e as { code?: unknown; severity?: unknown } | null | undefined;
  return typeof o?.code === "string" && /^[0-9A-Z]{5}$/.test(o.code) && typeof o?.severity === "string";
};
const looksLikeNetwork = (e: unknown): boolean => {
  const o = e as { syscall?: unknown; address?: unknown } | null | undefined;
  return typeof o?.syscall === "string" || typeof o?.address === "string";
};

/** True for anything whose message may carry SQL, bound parameters, a quoted value or a connection address. */
export function isSensitiveError(err: unknown): boolean {
  if (err === null || typeof err !== "object") return false;
  const o = err as { query?: unknown; params?: unknown; cause?: unknown };
  if (typeof o.query === "string" || Array.isArray(o.params)) return true;
  if (looksLikePg(err) || looksLikeNetwork(err)) return true;
  if (looksLikePg(o.cause) || looksLikeNetwork(o.cause)) return true;
  return err instanceof Error && err.message.startsWith("Failed query:");
}

const FRAME = /^\s+at /;

/** What error_events stores. Ordinary errors: unchanged. Sensitive errors: class + code, and the stack frames without the header. */
export function recordableError(err: unknown): { message: string; stack: string | null; sensitive: boolean } {
  if (isSensitiveError(err)) {
    const summary = describeError(err);
    const frames = err instanceof Error ? (err.stack ?? "").split("\n").filter((l) => FRAME.test(l)) : [];
    return { message: summary, stack: [summary, ...frames].join("\n").slice(0, 8000), sensitive: true };
  }
  return {
    message: err instanceof Error ? err.message : String(err),
    // Stack traces can be long; cap them so one runaway error can't bloat a row.
    stack: err instanceof Error ? err.stack?.slice(0, 8000) ?? null : null,
    sensitive: false,
  };
}
