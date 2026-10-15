# Wrench Mode: persistent resume, Back guard, screen Wake Lock

**Status:** approved owner decision (2026-10-14, "upgrade existing in-page Resume to support persistent, device-local progress").
**Behaviour change:** Wrench Mode progress used to live in React memory only, and a reload deliberately reset it. On customer
routes it is now saved on the device and survives a refresh, a browser restart and in-app navigation.

This is a customer-experience feature. It reads the guide the page already resolved and fingerprints it; it never writes guide
data, never touches the resolver, fitment or evidence, and adds no database tables or migrations.

## What the customer sees

| Situation | Before | Now |
|---|---|---|
| Refresh mid-job | "Start Wrench Mode", progress gone | "Resume Wrench Mode", "Step N of M", one tap to continue |
| Close and reopen the browser | gone | resumes |
| Leave the guide in the app and come back | gone | resumes |
| Browser Back while Wrench Mode is open | left the guide, progress gone | closes Wrench Mode, session kept, still on the guide |
| Browser Back with Wrench Mode closed | leaves | leaves (unchanged) |
| Screen while Wrench Mode is open | sleeps on its own | kept awake; sleeps again as soon as it closes |

A restored session opens on the Overall Guide. It never opens the Wrench Mode overlay by itself.

## Where it applies

Only to a real garage vehicle that **the signed-in viewer owns**: a **composite garage id** (`<catalog id>~<row id>`) the server
confirmed belongs to this account (`getViewerVehicle` hands the host a `progressScope` only on an exact match; a garage id in the
URL that is not the viewer's car gets none, so nothing is saved for it). See "Account isolation" below. The legacy bare catalog URL is resolved by the
page to the same composite id, so both URL forms share one record. The admin preview host has no garage id and stays in memory
exactly as before (`bmw-admin-guides.spec.ts` still asserts that a reload resets it).

## What is saved, and the key

`localStorage["crankcase:wrench:v1:<account scope>:<garage id>:<guide id>"]` holds one JSON record: the configuration identity the guide was
resolved under, a signature of the whole step plan, the identity (content fingerprint) of the current step, its position, the step
count and a timestamp. No personal data and no VIN.

Step identity is a hash of everything a customer reads or is told to do in the step (title, instructions, warning, torque, scope).
The plan signature is the hash of the ordered step identities.

## Account isolation (shared devices)

localStorage belongs to the browser, not the account, and a garage id is readable from it. So the garage id is not a boundary.
Every record is scoped to the account (`scope`: an opaque digest of the user id computed on the server, `src/lib/wrenchScope.ts`).

- **Never read or deleted across accounts:** a load only touches the key of its own scope; a record copied under another account's
  key is rejected (`scope`) and removed.
- **Cleared on every sign-out path:** the Log out buttons call `signOutAndClear` (purges all Wrench records, then signs out). A
  test fails if any other file calls `signOut` directly. Sign-outs that bypass the button (session expiry, cleared cookies, signing
  in from another tab or device) are covered by `WrenchProgressGuard`, mounted by the app, admin and marketing/login layouts: on
  every page load it removes records of any other account (signed in) or all records (signed out).
- **Not persisted for a car the viewer does not own:** without a server-issued scope the host stays in memory.

Known edge: a tab that stays open on an old session after the same browser signed out elsewhere can still write one record under
the old scope; the next page load in any tab removes it.

## What is rejected (and deleted, never retried)

- a different account, garage vehicle or guide than the page is showing
- a different configuration (transmission / drivetrain identity)
- **any change to the guide's content**: an edited step, an added, removed or reordered step. A saved position can therefore
  never land on a different step than the customer left. They start again instead.
- a step whose identity does not match the step now at that position, or a position outside the guide
- an unreadable, incomplete or foreign-version record, or one saved more than 14 days ago

## When progress is cleared

Cleared by: a confirmed **Exit Wrench Mode**, a finished job (saved to Service History, or finished without saving), a
configuration change, or a rejected record. An explicit restart is Exit, then Start (Start always begins at step 1).

**Not** cleared by: "← Overall Guide", the browser Back gesture, "Keep Wrenching", navigating away, a failed Service History save
(nothing was finished), or closing the browser.

## Back guard

While the overlay is open it owns one history entry for the current URL (native `pushState`, which Next integrates with its router;
same URL, so nothing navigates). Back pops it and closes the overlay. Closing any other way pops the entry so the customer never
has to press Back twice on the page. With the overlay closed the hook does nothing.

Known edges: `history.back()` is applied asynchronously, so a script that navigates in the same millisecond as closing the overlay
can be undone by the pending pop (a person cannot tap that fast). A reload while the overlay is open leaves one extra same-URL
entry, so the first Back after that reload stays on the page.

## Wake Lock

Requested when the overlay opens, released when it closes or unmounts, and requested again when the tab becomes visible after the
browser dropped it (phone locked, app switched). A browser without the API, or one that refuses (battery saver, policy), runs
Wrench Mode exactly as before: nothing is shown and nothing is retried in a loop. `data-wake-lock` on the Wrench Mode dialog
(`pending | active | released | denied | unsupported`) exists for tests. Automation can prove the request is made, released and
re-made; whether a particular phone's screen stays on needs a real device.

## Storage that is unavailable

If the browser denies localStorage (private mode, blocked site data) or a write fails, Wrench Mode falls back to the old
in-memory Resume. No error is shown or thrown.

## Tests

- `scripts/wrench/tests/wrench-progress.test.mjs` (`npm run wrench:test`): the save, load, reject and clear rules, with no browser.
- `tests/e2e/wrench-privacy.spec.ts`: account isolation (PV-1..5), phone and desktop; the sign-out wrapper rule is in the unit suite.
- `tests/e2e/wrench-resume.spec.ts`: Wake Lock (WL-1..4), Back (BK-1..5), persistence (PR-1..13), phone and desktop emulation.
- `tests/e2e/bmw-admin-guides.spec.ts`, `tests/e2e/vehicle-config.spec.ts` (test 13): unchanged behaviour, still passing.

Code: `src/lib/wrenchProgress.ts`, `src/lib/wrenchScope.ts`, `src/lib/signOutAndClear.ts`, `src/components/WrenchProgressGuard.tsx`, `src/lib/useWrenchBackGuard.ts`, `src/lib/useScreenWakeLock.ts`,
`src/components/GuideWithWrenchMode.tsx`, `src/components/WrenchMode.tsx`.
