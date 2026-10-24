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
no password, `user_id` null, no metadata. The address is canonical (see "Client address" below). With NO trustworthy address, login still applies all three limits with the address replaced by one shared
`untrusted` pseudo-address (a flood of unidentifiable requests trips the per-address limit, 40 / 15 min, for everyone in that state; this is the safe direction and is logged as `NO-TRUSTED-IP`),
and signup, forgot-password and reset-password refuse with a 503 (fail closed). An empty email gets no account keys, but is still charged to the address.
Rows older than 3 h (longer than any window) are swept by roughly 1% of reservations, at most 5,000 rows per sweep (batched delete), so a sweep can never hold a long lock;
nothing reads them after their window.

## One parse, one identity (review H1, H2)
The review showed the limiter and Auth.js each parsed the login body their own way: a JSON body (Auth.js accepts it, the old limiter ignored it) or a repeated `email`
field (limiter read the first, Auth.js the last) let guesses bypass every limit. Now `src/app/api/auth/[...nextauth]/route.ts` is the only parser:
- Accepted: `application/x-www-form-urlencoded` or `application/json` (case-insensitive), at most 16 KB (read in pieces and cut off at the limit, so an endless chunked body is not read to the end), string values only, `email` + `password` present.
- A repeated form field is refused (400). A repeated JSON `email` key: the last copy wins (that is what `JSON.parse` does, and a parser cannot see the earlier copy), and that same last copy is what is counted AND what Auth.js
  authenticates, so the two cannot disagree. It is not refused; an earlier version of this document said it was (that was wrong; unit R30 pins the real behaviour).
- Every spelling of the callback path is guarded: trailing slash, other case, doubled slashes and percent-encoding all reach the same limiter (unit R26).
- The email is canonicalised once (trim + lower-case, same as `findUserByEmail`), counted, and Auth.js is handed a NEW request rebuilt from the validated fields.
  Auth.js never sees the original body, so what is counted is exactly what is authenticated.
- Anything else (other content type, malformed or non-object JSON, non-string values, duplicate form keys, oversize, empty, missing fields) is a generic 400, evaluates no password, and is charged to the
  network address (40 / 15 min), so malformed requests cannot be sprayed. No trustworthy account exists to charge.

## Bounded waiting (review M3)
The advisory lock used to wait forever and every waiter held a pooled connection. Now (`BOUNDS` in `authGuard.ts`): per-key in-process FIFO with a 3 s deadline and at most 200 waiters per key
(400 overall); at most 5 concurrent limiter transactions per instance (the pool default is 10, so page queries keep headroom); `lock_timeout` 1.5 s and `statement_timeout` 4 s inside the transaction.
Hitting any bound returns BUSY: **a denial (503, `Retry-After: 2`, generic body; a real limit hit stays 429; forgot-password answers BUSY with the same 503 for every address typed, never a silent success), never a pass-through.** Patch 12 (Build 106): BUSY used to answer 429 "too many attempts", which told a customer a limit was reached when none was. Each BUSY now writes one log line, `[auth-limiter] BUSY flow=<flow> reason=<lock_timeout|statement_timeout|queue_deadline> retry_after=2 held_back=<n>`, at most one per flow and reason per second; it carries no key, address or email. The login body keeps `error=RateLimited` so the form does not say "Wrong email or password." (a BUSY-specific message needs a LoginForm change, O-2). BUSY is deliberately not the store-error path:
failing open on contention would let a flood turn off the password limiter. Cost: during an overload a legitimate user on the same key sees 429 and retries. Measured locally with 400 requests, 60 in parallel, on one key:
an unrelated user's login took 0.03-0.06 s (idle 0.02-0.03 s); on the baseline the same test took 0.85-0.98 s and the lock test hung with no bound. No infrastructure, service or migration is involved.

## Limiter database access and deadlines (104-A, `src/lib/limiterDb.ts`)
The review of #81 found that a database that accepts connections and then goes silent, or connections that are reset at the wrong moment, wedged the limiter until a restart and could take the app's shared pool with it:
the shared pool has no connect or query timeout, and drizzle's `transaction()` runs `BEGIN` outside its `try`, so a connection that dies right then is never released.
The limiter now owns a **dedicated pool, at most 5 connections per instance** (opened on demand, closed after 10 s idle) and does its own `BEGIN` / `COMMIT` / `ROLLBACK`:

| Bound | Value | What happens at the bound |
|---|---|---|
| wait for a limiter slot in this process | 3 s | BUSY: 503 (denial, nothing written) |
| connect (free client + new connection incl. handshake) | 2.5 s | store failure |
| each statement, client side | 4.5 s | store failure (covers a server that stops answering) |
| `lock_timeout` / `statement_timeout`, server side | 1.5 s / 4 s | the database answered: BUSY (denial) |
| one unit of work end to end | 6 s | store failure; the connection is destroyed |

- **Contention vs failure.** A lock or statement timeout reported by the database is BUSY and always denies (it also proves the store is alive).
  While the store is demonstrably failing (a real store failure within the last 15 s and nothing answered since), a request that finds no free slot within the queue deadline is shed as a STORE FAILURE instead of BUSY, because the slots are
  held by hung work; otherwise a hung store would answer most requests with 429 instead of each flow's approved failure mode (review 104-A: 7,970 of 8,000 reserves; unit R21b). Pure load never arms this. No answer in time, cannot connect, reset connection, terminated backend or pool error is a STORE FAILURE: login fails open for throttling only
  (the password is still fully verified); signup, forgot-password and reset-password fail closed (503). Throttling is never weakened by contention.
- **No leak.** Every unit of work ends within its deadline and its connection is either returned healthy (the server answered and the transaction rolled back cleanly) or destroyed; the in-process slot is freed in a `finally`. A killed
  backend, a hung client or a failed `BEGIN` therefore costs one connection that is replaced on the next call, not capacity. Recovery needs no restart (unit R21, R22; live runs below).
- Store failures are logged (`[auth-limiter] FAIL-OPEN|FAIL-CLOSED`). They are **not** written to the error table: that table is in the same database, and with the database hung each such write parks a connection of the shared pool for good.
- The login body is read under a 5 s deadline as well as the 16 KB cap, so a slow-drip sender is cut off like an endless one (unit R25b).
  Observed on `next dev`: a body that never completes does not reach the route at all (the request is held earlier, by the framework / `src/proxy.ts` layer), so this deadline and the cap only act once the body is delivered; whether Vercel's edge cuts such requests off is UNKNOWN from here.
- Housekeeping (`prune`) and `release` use the same pool with short deadlines; prune is never awaited and only runs when a transaction slot is spare.
- **The shared pool (`src/db/index.ts`) needed the same protection, and got the minimum (a separate, droppable part of this change).** Measured against a real server with the database hung: after 14 hung logins every
  connection of the shared pool was parked for good, and login, signup and reset-password all stayed dead after the database came back, until a restart (the limiter itself had recovered). Now: connect / wait-for-a-connection gives up after 10 s,
  a query after 60 s (a timed-out query releases its connection as broken, so the pool replaces it), keep-alive on, and an error listener exists on every client from the moment it is created (a backend terminated while connecting
  or idle was an uncaught exception, which can crash the process). Both limits are far above a normal request and are tunable with `DB_CONNECT_TIMEOUT_MS` / `DB_QUERY_TIMEOUT_MS`. Same run after the change: healed within 1 s of the database returning.
  **Residual:** `db.transaction()` (used by `keysEntitlements`) checks a connection out by hand, and a transaction on a connection that went silent is not covered by `query_timeout` on the checkout path; Auth.js's own database calls during a hung
  database still wait up to the connect / query limits (login is slow, not wrongly open). That is an owner decision if a tighter bound is wanted.

## Connection capacity (104-A; a MERGE GATE the owner has to check)
Per warm server instance the app can now hold up to **10 (shared pool default) + 5 (limiter) = 15** database connections (the limiter's are opened only while auth traffic exists). Facts from Neon's documentation: the Free plan's
smallest compute (0.25 CU) allows `max_connections` 104 (about 97 usable); the pooled (PgBouncer, `-pooler` host) endpoint accepts up to 10,000 client connections and works with transaction-level advisory locks and `set_config(..., true)`,
which is all the limiter uses. **UNKNOWN from here:** whether `DATABASE_URL` in Production and `PREVIEW_DB_DATABASE_URL` in Preview use the pooled or the direct host, the compute size, and the real peak connection count.
If the host is direct, about 7 warm instances can reach the usable limit (7 x 15 = 105 > 97) and ordinary pages would then fail to connect; if pooled, capacity is not a concern at this scale. Before merging: confirm the host is the `-pooler` one
(or lower `LIMITER_POOL.max` in `limiterDb.ts`) and look at Neon's connection graph.

## Client address (104-A, `authGuard.clientIp`)
The address used to be entry 0 of `x-forwarded-for`, raw. A client can send that header, so it chose its own key (rotating the value was a fresh bucket per request) and `x-forwarded-for: ,` produced no key at all, which skipped every address limit.
Now only a header the platform sets is read, and it must hold exactly one valid address:
- **Vercel** (`VERCEL` set): `x-vercel-forwarded-for` and `x-real-ip` (Vercel documents that it overwrites `x-forwarded-for` and does not forward external values; the first is not overwritten by an upstream proxy). Both present and different = ambiguous = untrusted. A client-sent `x-forwarded-for` is never read.
- **Self-hosted:** only the header named in `AUTH_TRUSTED_IP_HEADER`, which must be set by a proxy you control and stripped from clients. Without it nothing is trusted in production.
- **`NODE_ENV` other than production** (`next dev`, tests): `x-forwarded-for` (one entry) or `x-real-ip`, so local runs and suites can choose an address.
- Canonical form: every spelling of an IPv4 address is one key (leading/trailing space, port, `::ffff:1.2.3.4`, `::ffff:102:304`); an IPv6 client is keyed by its /64. Leading zeros, zone ids (`%eth0`), lists, ranges, hex/octal forms, brackets without a port form and anything over 64 characters are untrusted.
- Untrusted address: login keeps all three limits on the shared `untrusted` address; the other three flows refuse (503). **Residual:** the VIN guard and the admin audit log still read `x-forwarded-for` the old way; they are outside this change.

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
- The address comes from the platform headers described under "Client address"; an IPv6 /64 is one client. Address limits are loose on purpose (carrier and office networks share addresses).
- After every idle limiter connection is killed at once (a database restart), the first few requests can see a store failure (login fails open, the other flows 503) before fresh connections replace the dead ones; measured 3 of 8. Not retried: a retry would hide a real outage from the log.
- IPv6 clients are keyed by their /64, so a holder of a /48 or larger has many address buckets; the per-account, per-email and per-user limits still hold. `::`, `::1` and IPv4-compatible `::a.b.c.d` share one key (not reachable from Vercel).
- With no trustworthy address (for example a customer-controlled proxy in front of Vercel, whose address the platform headers then carry), unidentifiable traffic shares one login bucket: 40 requests / 15 min can lock login for everyone in that state. Documented direction: safe, not free.
- The release-on-success check looks for `authjs.session-token=`; a session cookie split into chunks (a JWT over ~4 KB) would not match and its slots would age out instead of being returned.
- Failing open for login on a store failure is deliberate and bounded: the request is slowed by at most the 6 s deadline, then goes on to a full password check. During a sustained outage that means no throttling, not no authentication.
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
- 104-A additions in the same file: R21 hung database (all four flows, fail-open / fail-closed, recovery with no restart, shared pool untouched), R22 / R22b / R22c killed backends (reset sockets, a real `pg_terminate_backend` storm under load,
  FATAL in the same chunk as ReadyForQuery) with no uncaught exception in either pool, R23 / R23b waiting-room and queue-deadline bounds, R24 lock order, R25 endless chunked body, R26 callback path spellings, R28 client address
  (canonical forms, Vercel contract, forged / rotated `x-forwarded-for`, the `,` bypass, untrusted-address policy for all four flows), R29 slow database (hard deadline), R30 repeated JSON key and this document, R31 shared pool recovery. A fault proxy (real sockets between the code and Postgres)
  freezes, delays, resets or kills connections on demand.
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

## Build 104-A remediation (PR #81, 2026-10-16)
Red = reproduced on the reviewed head `5d24669` (new tests, old code: 14 of 45 failed); green = this branch. Real Postgres, real routes; the fault proxy and a real Next server for the live runs.

| Finding | Regression (permanent) | Baseline (red) | Fixed |
|---|---|---|---|
| Hung database wedges the limiter and parks the shared pool | unit R21, R29; live run | no answer within 9.5 s; after 14 hung logins login / signup / reset never answered again until restart | every flow answered in <= ~9 s (limiter work hard-capped at 6 s); recovery within 1 s of the database returning, no restart |
| Killed backend / failed BEGIN leaks capacity or crashes the process | unit R22, R22b, R22c; live run | uncaught `Connection terminated unexpectedly` (also 150-228 uncaught 57P01 in a live kill storm) | 0 uncaught in the live storm; no connection left checked out; limiter and shared pool answer afterwards |
| Waiting-room / queue deadline | unit R23, R23b | peak depth not observable; 6 x lock_timeout | bounded by the 3 s queue deadline (M5 mutation now red) |
| Opposite-order lock sets | unit R24 | passed on baseline (guard, not a confirmed bug) | unchanged |
| Endless chunked login body read to the end | unit R25 | 5000 of 5000 chunks pulled | stops after the 16 KB limit |
| Callback path spellings skipped the limiter | unit R26 | 12 password checks (limit 8) | all six spellings limited |
| `x-forwarded-for: ,` and rotating / forged header | unit R28 (x6) | per-address limits off; any value chose its own key | platform-set header only, canonical, single address; untrusted address keeps login limits and fails the other three closed |
| Repeated JSON `email` key documented wrongly | unit R30 | document said "refused" | document states last-copy-wins, which is what is counted and authenticated |
| Dirty-database prune test | unit R27 | failed on a database with 23,000 old counter rows | unique keys and a bounded loop: passes on a clean and on a dirty database |
| Shared pool: no timeouts, no error listener | unit R31 | uncaught on a reset idle connection; queries hung forever | see "Limiter database access" |

Mutation checks (each turns the suite red): all 12 of the second reviewer's mutations (duplicate-key refusal, busy as pass-through, no transaction cap, no lock / statement timeout, no queue deadline, case-sensitive email key, release on failure, reset budget before
verification, no account limit, no forgot per-email limit, signup fail-open, no per-key waiter cap) plus: failed clients handed back to the pool, no hard deadline, no error listener, error recording on a store failure, trusting `x-forwarded-for` on Vercel, reading the whole body, exact path match.
Counts: unit 50 / 50 (3 consecutive runs, process exits by itself), e2e `auth-abuse` 12 / 12, PR #80 and #81 merged: unit 50 + 13, e2e 17 / 17.
Independent review of this head: no way found to leak limiter or shared-pool capacity, crash the process, bypass the address policy or the approved fail modes; its two findings (hung store reported as busy, no body read deadline) are fixed above (R21b, R25b);
the third (every count is an unindexed scan of `app_events`: ~200 ms per count at 3 M rows, 80% of 40 concurrent logins denied as busy) is the index merge gate below.

## Release gates still open (owner)
1. Neon: pooled (`-pooler`) or direct host in Production and Preview, compute size / `max_connections`, peak connections (see "Connection capacity"). UNKNOWN from here.
2. `app_events` indexes in Production: **required before merge**, not optional. Without an index each limiter count is a sequential scan (~200 ms at 3 M rows; 10 concurrent reservations p50 3.7 s; 40 concurrent: 32 denied as busy).
   Apply the partial index below (a migration, owner-run) or confirm `(type, created_at)` exists. UNKNOWN in Production.
3. Preview, with the final code and the real proxy chain: a forged `x-forwarded-for` echo test, then multi-instance concurrency (the advisory lock is exercised across instances only locally), then an outage injection.
4. `SITE_PASSWORD` gate state in Production (UNKNOWN).
5. Owner decisions: H3 (account lockout), M1 (forgot-password suppression), the shared-pool timeouts (10 s / 60 s), and `db.transaction()` on a silent connection.

## Proposed policy changes (NOT applied; they change the approved policy)
**H3 account-lockout DoS.** Evidence: after 30 failures from any addresses the real owner's correct password from a fresh address is a 429 for up to an hour. Candidate: a signed known-device cookie
(HMAC, issued only on successful login) that gets its own 30 / h per (account, device) budget; no cookie means the shared 30 / h cap is unchanged, so an attacker is still capped at 30 guesses / h / account and cannot raise it.
Trade-off: cookie theft; first login on a new device during an attack still waits.
**M1 forgot-password suppression.** Candidate: replace the silent per-email refusal with a spaced cooldown (one mail per N minutes per email, same generic 200 either way), so a flood cannot starve the next real request beyond N minutes and never sends unlimited mail.
**Index (needs a migration, not applied, Production state UNKNOWN):** `create index concurrently if not exists app_events_auth_throttle_idx on app_events (object_id, created_at) where type = 'auth.throttle';`
