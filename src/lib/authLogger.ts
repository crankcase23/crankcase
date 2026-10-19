import { safeErrorSummary } from "@/lib/safeError";

// Auth.js writes errors to the server log through this object (wired in src/auth.ts). Its built-in logger is not safe for customer
// data (build 104-F):
//   * for an expired or invalid session cookie it prints the DECODED TOKEN ([auth][details]): user id, email, password-version
//     stamp, token id. Expired cookies are ordinary traffic, so that is customer data in the logs on normal requests
//   * for a failure inside sign-in it prints the thrown error's full stack ([auth][cause]); a drizzle error's text is the SQL plus
//     the bound parameters, which include the email being signed in
// This logger keeps what an operator needs to diagnose a problem, the Auth.js error type and the cause's class and short code
// (e.g. "JWTSessionError cause: class=JWTExpired code=ERR_JWT_EXPIRED"), and never reads message, stack or any cause details.
// Warnings keep Auth.js's default (they print a warning code only).
const TOKEN = /^[A-Za-z0-9_]{1,40}$/;

export const authLogger = {
  error(error: Error) {
    // Logging must never be the thing that fails: a throw here would turn an Auth.js redirect into a 500.
    try {
      const type = (error as { type?: unknown } | null | undefined)?.type;
      const name = (error as { name?: unknown } | null | undefined)?.name;
      const label = typeof type === "string" && TOKEN.test(type) ? type : typeof name === "string" && TOKEN.test(name) ? name : "Error";
      const inner = (error?.cause as { err?: unknown } | undefined)?.err;
      console.error("[auth][error]", label, inner === undefined ? "" : "cause: " + safeErrorSummary(inner));
    } catch {
      console.error("[auth][error] (unprintable error)");
    }
  },
};
