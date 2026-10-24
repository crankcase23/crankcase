import { randomUUID, createHash } from "node:crypto";
import { db } from "@/db";
import { errorEvents } from "@/db/schema";
import { describeError, recordableError } from "@/lib/dbErrorLogSafe";

// ---------------------------------------------------------------------------
// First-party error capture -- the "glitches" view Andy originally asked for.
//
// Deliberately NOT Sentry. Sentry would need a third-party account, a DSN in
// the environment, and an extra dependency; this needs none of those and the
// data stays in the database we already run. If Sentry ever does get set up,
// this keeps working alongside it.
//
// Errors are grouped by `fingerprint` -- a hash of source + a normalised
// message -- so one recurring bug shows as a single row with a count rather
// than five hundred identical lines.
// ---------------------------------------------------------------------------

export type ErrorLevel = "warning" | "error" | "fatal";

// Strips the volatile parts of a message (ids, numbers, quoted values) so the
// same bug hitting different records still groups into one row.
function fingerprintFor(source: string, message: string): string {
  const normalised = message
    .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, "<uuid>")
    .replace(/\b\d+\b/g, "<n>")
    .replace(/"[^"]*"/g, '"<v>"')
    .slice(0, 300);
  return createHash("sha1").update(`${source}::${normalised}`).digest("hex").slice(0, 16);
}

interface RecordErrorInput {
  source: string;
  error: unknown;
  level?: ErrorLevel;
  path?: string;
  userId?: string | null;
  metadata?: Record<string, unknown>;
}

// Never throws. An error in the error recorder must not replace the original
// error, so the fallback is a console log and nothing more.
export async function recordError(input: RecordErrorInput): Promise<void> {
  try {
    // A database error's message and stack START with the SQL and its bound parameters (a customer's user id, email, feedback text,
    // a password hash), so those are stored as class + code + stack frames only. Everything else is stored exactly as before
    // (build 104-G, see src/lib/dbErrorLog.ts).
    const { message, stack, sensitive } = recordableError(input.error);

    await db.insert(errorEvents).values({
      id: randomUUID(),
      // A sensitive summary is already normalised, and its code must keep its digits (23503 and 23505 are different bugs).
      fingerprint: sensitive ? createHash("sha1").update(`${input.source}::${message}`).digest("hex").slice(0, 16) : fingerprintFor(input.source, message),
      level: input.level ?? "error",
      source: input.source,
      message: message.slice(0, 1000),
      stack,
      path: input.path ?? null,
      userId: input.userId ?? null,
      status: "open",
      metadata: input.metadata ?? null,
    });
  } catch (writeErr) {
    // Class and code only: the failed INSERT's own message repeats every value it was storing.
    console.error("[errors] failed to record error from", input.source, describeError(writeErr));
  }
}

export function recordErrorAsync(input: RecordErrorInput): void {
  void recordError(input);
}

// Wraps an async operation so any throw is captured and re-thrown untouched.
// Use at the edges (route handlers, cron jobs) where an error would otherwise
// vanish into a 500 with no trace.
export async function captureErrors<T>(source: string, fn: () => Promise<T>, path?: string): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    await recordError({ source, error: err, path });
    throw err;
  }
}
