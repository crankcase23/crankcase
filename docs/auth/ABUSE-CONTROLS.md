# Authentication abuse controls

**Status:** PR A of the authentication security work (2026-10-15). Session revocation is a separate change (PR B).
Design: project doc `crankcase-auth-abuse-remediation-design-2026-10-15`.

Before this change nothing limited how fast anyone could guess passwords (`/api/auth/callback/credentials`), create accounts
(`/api/signup`), send reset mail (`/api/auth/forgot-password`) or grind reset tokens (`/api/auth/reset-password`).

## Limits (rolling windows)

| Flow | Limits | Over a limit | Limiter store error |
|---|---|---|---|
| Login | per (account, address) **8 failures / 15 min**; per address **40 / 15 min**; per account **30 / hour** | **429** + `Retry-After`, before the password is checked; body identical for real and unknown emails | **Fail open for throttling only**; the password is still fully verified; logged `[auth-limiter] FAIL-OPEN` + an `error_events` row |
| Signup | per address **10 / h**; per email **3 / h** | 429 + `Retry-After`, before the bcrypt hash | **Fail closed**: 503 `Retry-After: 30`, nothing created |
| Forgot-password | per address **5 / h** -> 429 + `Retry-After`; per email **3 / h** -> the same generic 200, no mail | as stated | **Fail closed**: generic 503, no mail |
| Reset-password | per address **10 / h**; per user named in the token **10 / h** | 429 + `Retry-After` | **Fail closed**: 503, password unchanged |

Login: a successful sign-in hands its slots back, so only failures spend the budget. The login 429 is JSON `{url: ".../login?error=RateLimited&code=<seconds>"}`
because `next-auth/react`'s `signIn()` reads `data.url`; the form turns it into "Try again in about N minutes".

## Mechanism ("reserve, check, release", `src/lib/authGuard.ts`)
One database transaction per attempt: take a Postgres advisory lock per limiter key (sorted, so no deadlock), count live rows per key,
and if ANY key is full return a denial and write NOTHING; otherwise write one row per key. Counters are rows in `app_events`
(type `auth.throttle`, `object_type` = limiter scope, `object_id` = salted hash). No new table, service, schema change or migration.

Why not the existing insert-then-count scheme (`vinGuard.ts`): measured on the old code, 80 and 300 parallel attempts admitted **0**
(every request counted everyone else's rows), 3 processes sending 30 attempts against a limit of 20 admitted 15, 16 and 19, and denied attempts stayed in
the window. The lock scheme is exact:

| Check | Result |
|---|---|
| 80 parallel wrong logins, one (account, address), limit 8 | exactly 8 admitted, 72 denied, 8 password checks |
| 300 parallel signups, one address, limit 10 | exactly 10 admitted and created |
| 40 parallel forgot-password, one address, limit 5 | exactly 5 / 35 denied |
| 3 OS processes x 40 parallel (120 attempts), limit 8 | exactly 8 admitted in total |
| denied attempts | write no row: a flood neither extends the lock nor holds slots |

The lock is transaction-scoped (released on commit or a dropped connection) and different keys never contend. It works across Vercel
instances because it lives in the database. Transaction-level advisory locks are supported by PgBouncer transaction pooling; if the
production database sits behind a pooler in *session* mode there is nothing to change either. **UNKNOWN: not run on Preview or Production**
(no access from the build environment); verified locally only.

## What is stored
Only salted SHA-256 hashes (`AUTH_SECRET` salt, per scope) of the lower-cased email and of the network address. No raw email, no raw address,
no password, `user_id` null, no metadata. With no address available (no `x-forwarded-for` / `x-real-ip`) the address keys are skipped: there is no
shared "unknown" bucket that one client could fill to lock out everyone. An empty email gets no account keys for the same reason.
Rows older than 3 h (longer than any window) are swept by roughly 2% of reservations; nothing reads them after their window.

## Enumeration
- **Forgot-password:** same status and body whether or not the account exists. The account lookup and the send run after the response (`after()`),
  so timing does not leak either; the per-email limit is keyed on what was typed, so it behaves identically for unknown emails; only the per-address limit
  says 429 and it says nothing about accounts.
- **Login:** the 429 is identical for a real and an unknown email.
- **Signup (RESIDUAL RISK, accepted for this scope):** it still answers "An account with that email already exists" (409), so an address can be
  checked for an account. Limits cap how fast (10 / h per address, 3 / h per email) but do not remove it. Closing it needs an email-verification
  step (send a link instead of answering), which is not built.

## Known limits of this design
- The address comes from `x-forwarded-for`, set by Vercel; behind any other proxy it is only as trustworthy as that proxy. Address limits are loose on purpose
  (carrier and office networks share addresses).
- An attacker who knows a victim's email can spend the victim's per-(account, address) budget only from the attacker's own address; the victim on another address is
  not blocked (tested), but the per-account 30 / h limit is shared across addresses, so a distributed attacker can lock one account's logins for up to an hour.
  Accepted trade-off; the alternative is unlimited guessing against it.
- The reset-token per-user key uses the user id inside the (still unverified) token, so someone who knows a victim's user id can spend that user's reset budget.
  User ids are not shown publicly. Accepted.
- Limiter cost: 1 lock + up to 3 counts + 1 insert per attempt. Measured locally on **no index** with 59k counter rows: one count = 6.6 ms (seq scan). The migrations
  in `migrations/2026-09-18-admin-command-center*.sql` define `app_events (type, created_at)`; **whether Production has them is UNKNOWN** (no authorized
  read-only access from here). A partial index on `(object_id, created_at) where type = 'auth.throttle'` would make the counts constant-time; it needs a migration and is
  deliberately NOT part of this change.
- The Production site-wide password gate (`SITE_PASSWORD`, `src/proxy.ts`) sits in front of `/api/auth/*`; its current Production state is UNKNOWN from here.
  These controls do not depend on it either way.
- Limits are constants in `LIMITS` (authGuard.ts); tune with a code change.

## Tests
- `npm run throttle:test` (`scripts/auth/tests/auth-guard.test.mjs`, needs `DATABASE_URL` for a throwaway Postgres): the real guard and the real four route handlers against a real
  database. R1 limits + generic body, R2 other address unaffected, R3 success releases, denied writes nothing, window rolls, R4 login fail-open (password still checked),
  R5 signup burst + fail-closed, R6 forgot-password sameness / limits / slow mail after response / fail-closed, R7 reset limits + fail-closed, R8 parallel and recovery,
  R9 hashes only, no shared bucket, pruning, R10 wiring scan. Mutation-checked: an off-by-one, a missing release, a missing lock and a fail-closed login each turn it red.
- `tests/e2e/auth-abuse.spec.ts` (AB-1..AB-7): the same through the real Auth.js handler, a real browser form and the real database. Red on main's routes, green here.
