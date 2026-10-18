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
- A stolen session stays valid until the owner's password changes (no "sign out everywhere" button, no per-session list). Password
  reset is the only durable revocation lever. Disabling the account blocks access only while it stays disabled (next bullet).
- **Re-enabling a disabled account can revive old sessions.** Disabling denies every request (and clears the cookie in any
  browser that sends it), but nothing changes the stored password hash, so the `pwv` stamp in an already issued cookie still matches.
  A session token that was never presented while the account was disabled (for example a stolen or backed-up copy, or a browser
  that stayed closed) works again the moment the account is re-enabled, until the token expires (30-day rolling lifetime).
  Confirmed from the code: the admin disable/enable toggle writes only `status`, `disabled_at` and `disabled_reason`; the password
  hash is written only by `updatePassword`. Documented limitation, not changed here; a fix needs a per-account session epoch (a
  schema and policy change, out of scope). See "Re-enabling a disabled account" below for the safe procedure.
- No change-password screen exists; if one is added it must go through `updatePassword` so it revokes sessions the same way.
- The 30-day rolling session lifetime is unchanged.

## Re-enabling a disabled account (admin procedure)
Re-enabling alone does not end sessions that were issued before the account was disabled. If the account may have been compromised
(the usual reason to disable it), revoke first, then re-enable:
1. Leave the account disabled.
2. Have the account holder reset the password through "Forgot password" (the reset flow does not check account status, so it works
   while the account is disabled; verified by reading `forgot-password` and `reset-password`, not by a live run). A completed reset
   rewrites the password hash, which revokes every earlier session, including a thief's.
3. Only after the reset is completed, re-enable the account in `/admin`. The holder signs in with the new password.
4. If the holder cannot be verified as the mailbox owner, do not re-enable. Leave it disabled or delete the account (deleting also
   ends every session).
There is no admin "sign out everywhere" button. Do not edit `password_hash` by hand to revoke sessions.

## Tests
- `scripts/auth/tests/session-guard.test.mjs` (`npm run auth:test`): the real Auth.js session action driven with the real callbacks and
  an injected lookup: disabled, deleted, reset, no stamp, database failure (cookie not cleared, token not altered, recovery by itself),
  plus wiring scans.
- `tests/e2e/session-security.spec.ts` (SS-1..SS-5): real server and database, including the two-browser reset check.
