# Session security: disabled accounts, deleted accounts, password reset

**Status:** PR B of the authentication security work (2026-10-15). Throttling is a separate change (PR A).

Sessions are stateless JWTs (`src/auth.ts`, no database adapter). On their own a token stays valid for its whole lifetime, so an
account disabled in `/admin`, a deleted account, or a password reset by the real owner did not end sessions already issued.

## What happens now
Every `auth()` call decodes the session and runs the jwt callback, which does ONE indexed primary-key read of the account
(`src/lib/sessionGuard.ts`, memoised per request) and returns one verdict:

| Verdict | When | Result |
|---|---|---|
| valid | account active, stamp matches | session returned |
| denied | account disabled or gone; password changed since the session was issued; token has no password-version stamp; token has no user id | jwt callback returns `null`: Auth.js clears the cookie, `auth()` is null, APIs answer 401, pages redirect to /login |
| unverified | the database could not be read | access denied for THIS request, cookie left alone, token unchanged, failure logged |

**Password-version stamp (`pwv`).** sha256 of the stored password hash, truncated, written into the token at sign-in. The reset
flow rewrites the hash, so every older session fails the comparison: a reset signs out every other browser, including an attacker's.
The hash itself is never in the token.

**Database failure.** Never "let them in because we cannot check" and never "sign everyone out because of a blip". The session
callback returns no user (the `auth()` wrapper in `src/auth.ts` turns that into `null` for every caller, including the ones that only
test truthiness), but the cookie is re-signed unchanged, so the session comes back by itself when the database does. The marker
for "unverified" lives in a WeakSet, not on the token, so it is never persisted into the cookie.
Limitation: `/api/auth/session` (used by client `useSession`) returns `{expires}` with no user during an outage; the client sees a
session object with no user. Every server-side check uses the wrapped `auth()`. During a database outage the app layout cannot
load the account anyway.

## No grandfathering (owner rule: "if safe grandfathering cannot be demonstrated, require one-time reauthentication")
A token issued before this change has no stamp. Accepting it would mean stamping it now with the CURRENT hash, and nothing
records when a password last changed, so a stolen token from before an earlier reset would be silently blessed. That cannot be shown
safe. **Every signed-in customer signs in once more after this deploys.** Expect a one-time wave of "please sign in" the first minute
after the deploy; nothing is lost.

## Cost
One extra `select status, password_hash from users where id = $1` (primary key) per `auth()` call, 2 to 4 per page, once per request
thanks to React `cache()`. The app layout already read `users` for `isAdmin`. No schema change, no migration, no new service.

## Residual risks
- A stolen session stays valid until the owner's password changes or the account is disabled (no "sign out everywhere" button, no
  per-session list). Password reset is the revocation lever.
- No change-password screen exists; if one is added it must go through `updatePassword` so it revokes sessions the same way.
- The 30-day rolling session lifetime is unchanged.

## Tests
- `scripts/auth/tests/session-guard.test.mjs` (`npm run auth:test`): the real Auth.js session action driven with the real callbacks and
  an injected lookup: disabled, deleted, reset, no stamp, database failure (cookie not cleared, token not altered, recovery by itself),
  plus wiring scans.
- `tests/e2e/session-security.spec.ts` (SS-1..SS-5): real server and database, including the two-browser reset check.
