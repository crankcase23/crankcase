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

Over the limit, or "could not decide in bounded time" (BUSY, see below), is always a denial. Only a limiter *store error* fails open (login) or closed (the rest).

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
Rows older than 3 h (longer than any window) are swept by roughly 1% of reservations, at most 5,000 rows per sweep (batched delete), so a sweep can never hold a long lock;
nothing reads them after their window.

## One parse, one identity (review H1, H2)
The review showed the limiter and Auth.js each parsed the login body their own way: a JSON body (Auth.js accepts it, the old limiter ignored it) or a repeated `email`
field (limiter read the first, Auth.js the last) let guesses bypass every limit. Now `src/app/api/auth/[...nextauth]/route.ts` is the only parser:
- Accepted: `application/x-www-form-urlencoded` or `application/json` (case-insensitive), at most 16 KB, string values only, no repeated key, `email` + `password` present.
- The email is canonicalised once (trim + lower-case, same as `findUserByEmail`), counted, and Auth.js is handed a NEW request rebuilt from the validated fields.
  Auth.js never sees the original body, so what is counted is exactly what is authenticated.
- Anything else (other content type, malformed or non-object JSON, non-string values, duplicate keys, oversize, empty, missing fields) is a generic 400, evaluates no password, and is charged to the
  network address (40 / 15 min), so malformed requests cannot be sprayed. No trustworthy account exists to charge.

## Bounded waiting (review M3)
The advisory lock used to wait forever and every waiter held a pooled connection. Now (`BOUNDS` in `authGuard.ts`): per-key in-process FIFO with a 3 s deadline and at most 200 waiters per key
(400 overall); at most 5 concurrent limiter transactions per instance (the pool default is 10, so page queries keep headroom); `lock_timeout` 1.5 s and `statement_timeout` 4 s inside the transaction.
Hitting any bound returns BUSY: **a denial (429, `Retry-After: 2`; forgot-password says 429 too, never a silent success), never a pass-through.** BUSY is deliberately not the store-error path:
failing open on contention would let a flood turn off the password limiter. Cost: during an overload a legitimate user on the same key sees 429 and retries. Measured locally with 400 requests, 60 in parallel, on one key:
an unrelated user's login took 0.03-0.06 s (idle 0.02-0.03 s); on the baseline the same test took 0.85-0.98 s and the lock test hung with no bound. No infrastructure, service or migration is involved.

## Reset-password budget order (review M2)
The per-address budget (10 / h) is spent before the token is looked at. The per-user budget (10 / h) is spent only AFTER the token signature verifies, so forged tokens naming a victim's user id cannot burn the victim's budget
(this replaces the "someone who knows a user id can spend that budget" residual risk below). A garbage token with no usable address is still not throttled (it costs a signature check, not a DB lookup).

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
- (OPEN POLICY DECISION H3, not changed here) An attacker who knows a victim's email can spend the victim's per-(account, address) budget only from the attacker's own address; the victim on another address is
  not blocked (tested), but the per-account 30 / h limit is shared across addresses, so a distributed attacker can lock one account's logins for up to an hour.
  Accepted trade-off; the alternative is unlimited guessing against it.
- Limiter cost: 1 lock + up to 3 counts + 1 insert per attempt. Measured locally (scratch DB, 78k `app_events` rows, 60k of them counters): one count = 8.6 ms with no index (seq scan), 7.4 ms with an `(type, created_at)` index
  (bitmap scan; the type+time index is not selective on the salted hash), and **0.09 ms with the proposed partial index**. Counter growth is bounded: one row per admitted attempt per key, 3 h retention, denied attempts write nothing,
  a sweep deletes at most 5,000 old rows (47 ms measured for 5,000 with the `(type, created_at)` index). The migrations
  in `migrations/2026-09-18-admin-command-center*.sql` define `app_events (type, created_at)`; **whether Production has them is UNKNOWN** (no authorized
  read-only access from here). A partial index on `(object_id, created_at) where type = 'auth.throttle'` would make the counts constant-time; it needs a migration and is
  deliberately NOT part of this change.
- The Production site-wide password gate (`SITE_PASSWORD`, `src/proxy.ts`) sits in front of `/api/auth/*`; its current Production state is UNKNOWN from here.
  These controls do not depend on it either way.
- Forgot-password (OPEN POLICY DECISION M1, not changed here): the per-email limit (3 / h, silent) can be spent by anyone who types a victim's email, after which the victim's own request sends nothing and says nothing.
  Mails already sent keep working for 1 h, so the harm is mail spam plus a silent no-op on the victim's own request, not takeover.
- Limits are constants in `LIMITS` (authGuard.ts); tune with a code change.

## Tests
- `npm run throttle:test` (`scripts/auth/tests/auth-guard.test.mjs`, needs `DATABASE_URL` for a throwaway Postgres): the real guard and the real four route handlers against a real
  database. R1 limits + generic body, R2 other address unaffected, R3 success releases, denied writes nothing, window rolls, R4 login fail-open (password still checked),
  R5 signup burst + fail-closed, R6 forgot-password sameness / limits / slow mail after response / fail-closed, R7 reset limits + fail-closed, R8 parallel and recovery,
  R9 hashes only, no shared bucket, pruning, R10 wiring scan. Mutation-checked: an off-by-one, a missing release, a missing lock and a fail-closed login each turn it red.
- `tests/e2e/auth-abuse.spec.ts` (AB-1..AB-12): the same through the real Auth.js handler, a real browser form and the real database. Red on main's routes, green here.

## Review remediation (PR #81, 2026-10-15)
Red = reproduced on the reviewed head `e057809`; green = this branch. All against real Postgres, real Auth.js, real routes.

| Finding | Regression (permanent) | Baseline | Fixed |
|---|---|---|---|
| H1 JSON body bypasses the throttle | unit R16 (x3), e2e AB-8 | red: 45+ JSON guesses all evaluated, correct password logs in past the limit | JSON counted; form and JSON share one budget; distributed JSON hits the 30 / h account limit |
| H2 duplicate `email` bypass | unit R17, e2e AB-9 | red: first-copy counted, last copy authenticated | refused with 400, both orderings |
| Ambiguous / unreadable bodies | unit "ambiguous bodies" (15 variants + 43-request spray), e2e AB-10 | red: evaluated or uncounted | 400, no password check, charged to the address (40 then 429) |
| M2 reset user budget spent before verification | unit R19 (x2) + store-down, e2e AB-12 | red: forged tokens spent the budget | spent only after verification |
| M3 unbounded lock wait / pool queueing | unit R20 (x3) + prune bound | red: waits hang with no bound, unrelated user 0.85-0.98 s | denied within ~1.5 s, 5-tx cap, unrelated user ~0.05 s |

Mutation checks (each turns the suite red): BUSY treated as pass-through, no transaction cap, user budget spent before verification, plus the earlier off-by-one / missing release / missing lock / fail-closed login.
Accepted encodings still work for the owner (JSON, form, any spelling of the email): e2e AB-11.

## Proposed policy changes (NOT applied; they change the approved policy)
**H3 account-lockout DoS.** Evidence: after 30 failures from any addresses the real owner's correct password from a fresh address is a 429 for up to an hour. Candidate: a signed known-device cookie
(HMAC, issued only on successful login) that gets its own 30 / h per (account, device) budget; no cookie means the shared 30 / h cap is unchanged, so an attacker is still capped at 30 guesses / h / account and cannot raise it.
Trade-off: cookie theft; first login on a new device during an attack still waits.
**M1 forgot-password suppression.** Candidate: replace the silent per-email refusal with a spaced cooldown (one mail per N minutes per email, same generic 200 either way), so a flood cannot starve the next real request beyond N minutes and never sends unlimited mail.
**Index (needs a migration, not applied, Production state UNKNOWN):** `create index concurrently if not exists app_events_auth_throttle_idx on app_events (object_id, created_at) where type = 'auth.throttle';`
