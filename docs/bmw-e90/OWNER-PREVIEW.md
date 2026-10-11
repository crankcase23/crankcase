# BMW 328i (E90): owner preview and what is still unverified (2026-10-11)

All 16 guides are **admin-only drafts, not certified, not published**. Image production is paused; no BMW guide shows a picture.

## How to look at them
1. Sign in as an admin, open **Service Guides** (`/admin/guides`).
2. The list links all 16 BMW drafts (`/admin/guides/test/bmw-2010-328i-<job>`).
3. Each opens Planning Mode (overview, tools, parts, safety, torque, all steps). **Start Wrench Mode** walks it one step at a time; **Complete** ends with the service-history sheet (saving is intentionally unavailable on admin test guides).

## What was tested, and how
- **Real authenticated routes, production build.** The app was built and run with `next start` against a **throwaway local Postgres** (own data directory, own made-up auth secret, nothing shared with any real database). A test account was created through the normal sign-up form; only that account was promoted to admin, directly in the throwaway database. No real credentials, secrets or deployed systems were touched.
  - `tests/e2e/bmw-admin-guides.spec.ts`: **37/37 passed**: all 16 guides at desktop (1280) and phone (390): Planning Mode, every Wrench step forward, blocked-step display, Complete sheet, Back, Finish Without Saving, leave to Overall Guide and Resume at the same step, Exit dialog (Keep / Exit), keyboard arrows (desktop), reload recovery; plus access control (signed-out goes to login, signed-in non-admin is bounced, unknown slug is a 404, the admin list links all 16, the customer side never exposes a draft).
  - The spec **refuses to run** unless `DATABASE_URL` is a local database, so it cannot touch a real one.
- **Render harness** (`npm run bmw:preview`): all 16 guides at 320, 390 and 1280 widths plus 5 error states (unknown slug, no steps, no torque data, no tools/parts, a picture that fails to load): **53/53 passed**. Includes a check for text running off the screen.
- **Unit and regression tests** (`npm run bmw:test`): 50/50. Factory tests 143 passed, 0 failed (1 skipped).
- Receipts and screenshots: `preview-receipts/2026-10-11-real-route/` (screenshots come from the real authenticated production-build route).

## What changed for customers in this pass
- The pre-job "confirm your configuration" wall of text is now 2-5 short **Before you start** steps.
- 10+ other long steps were split in two (every word kept; warnings repeated on both parts).
- Internal evidence jargon was replaced with plain words: no `[secondary]` tags, `BUILDABLE`, `ETK`, `TIS`, `CONFLICT`, file names or "ledger". Uncertainty is still shown: "(one source only: confirm)", "(sources disagree: confirm)", "(not confirmed)", "Confirm before relying on it", and **VERIFY EXACT TORQUE BEFORE SERVICE**.
- Guides went from 196 to 248 walkthrough steps because of the split and regrouping.

## Still unverified (exact list)
1. **Mechanical correctness is not certified.** No BMW service manual (TIS) was reachable. Of 43 torque rows, 27 are flagged VERIFY (no figure shown, or conflicting). 63 steps rest on independent websites only, 23 on a single source, 6 have sources that disagree, 2 have no source. No mechanic has reviewed any guide.
2. **Blocked on purpose (3 steps):** engine-bay fuse boxes (location unsourced), xenon bulb replacement (BMW: workshop only), idler pulley replacement (torque conflict). They stay blocked until a BMW source resolves them.
3. **Car configuration:** rear-wheel drive, automatic, and the N52 engine variant are probable from the VIN decode, not proven. The "Before you start" steps say so.
4. **Not run on a deployed environment.** The Vercel preview/production site was not tested: that needs a real login, which I will not create or use. Production behaviour is covered only by the local `next start` run above.
5. **Real devices and other browsers.** Only Chromium with phone-size, touch-enabled emulation. Not tested on real iPhone/Android, Safari, Firefox, landscape, or with a screen reader.
6. **Completion saving** to Service History is not exercised: admin test guides have no signed-in vehicle, by design.
7. **Wording** was reviewed by me, not by you or a mechanic; some steps still contain a single long sentence (about 350-400 characters).
8. **Staged hatch picture (not displayed):** it is keyed to step 4 but the hatch step is now step 7. A test blocks wiring it with the wrong number; remap before image work resumes.
9. The browser tests use a throwaway database and a test account; nothing about real accounts, payments or email was exercised.
