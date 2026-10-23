// Safe descriptions of errors for logs and responses.
//
// WHY THIS EXISTS: drizzle wraps every failed query in a DrizzleQueryError whose `message` is the full SQL text followed by the
// bound parameters ("Failed query: insert into "users" ... params: <id>,<email>,<bcrypt hash>"). Returning or logging
// `err.message` therefore hands a stranger the schema and the caller's password hash (build 104-E, signup). Nothing in this file
// ever reads `message`, `query`, `params` or `stack`: only the error class and the short database / network error code.

const CODE = /^[A-Za-z0-9_]{1,16}$/;

/** The pg SQLSTATE or Node network code (e.g. "23505", "57P01", "ECONNREFUSED"), or null. Looks one level into `cause`. */
export function errorCode(err: unknown): string | null {
  const read = (e: unknown): string | null => {
    const c = (e as { code?: unknown } | null | undefined)?.code;
    return typeof c === "string" && CODE.test(c) ? c : null;
  };
  return read(err) ?? read((err as { cause?: unknown } | null | undefined)?.cause);
}

/** "class=DrizzleQueryError code=08006": safe to log and diagnosable. Never includes SQL, parameters, messages or stacks. */
export function safeErrorSummary(err: unknown): string {
  const name = err instanceof Error && CODE.test(err.name) ? err.name : "NonError";
  return `class=${name} code=${errorCode(err) ?? "none"}`;
}

/** True for a Postgres unique-constraint violation (SQLSTATE 23505), however deep drizzle wrapped it. */
export function isUniqueViolation(err: unknown): boolean {
  return errorCode(err) === "23505";
}
