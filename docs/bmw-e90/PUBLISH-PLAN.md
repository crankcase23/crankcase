# BMW 328i (E90): publishing all 16 guides on the customer site

Date: 2026-10-11. Branch `claude/bmw-guide-build`, PR #38. **Nothing is merged, deployed or published yet.** Merging PR #38 into `main` is the publication event (Vercel deploys `main` to production), and that needs the owner's direct approval naming the PR.

## What changes for customers

- The 2010 BMW 328i vehicle page lists all 16 guide categories, and each opens its own guide page at `/vehicles/2010-bmw-328i-3.0l/repairs/bmw-2010-328i-<job>`.
- Every guide opens with a plain "Incomplete guide: not yet verified against BMW service data" summary and a first safety warning saying the same. Guides with blocked steps add "N step(s) are BLOCKED in this guide".
- All 16 are marked free. The house convention would make 15 of them premium, but unverified guides should not sit behind a purchase once payments are switched on. Flip per guide when it is certified.
- Customers see the full guide (tools, parts, torque table, steps, warnings). Wrench Mode is **not** on customer guide pages for any vehicle today; it exists on the admin route only. Adding it is a platform change for every vehicle and is not part of this package.

## What stays restricted (identical to the admin drafts, enforced by tests)

- Blocked steps: engine-bay fuses, xenon low-beam bulb, idler pulley replacement.
- Any torque that is not VERIFIED or confirmed by 2+ independent hosts prints "VERIFY EXACT TORQUE BEFORE SERVICE" with no number. That includes the rear caliper guide screws, idler pulley, battery terminal / hold-down, bleeder screw and drain plugs.
- Configuration-dependent items (brake package, caliper screw head type, differential plug type, drivetrain) remain "check your car" steps.
- The owner's own VIN, VIN-tail serial and decode results are removed from the public copy.

## Generated, not hand-written

`scripts/bmw/build-drafts.mjs` now writes two files from the same evidence: the admin review drafts and `src/data/repairs-bmw-e90.ts` (public). `src/data/repairs.ts` gains one import and one spread line. The public file must never be edited by hand.

## Validation receipts

- `bmw:test` 60/60, including `customer.test.mjs` (access, parity with drafts, blocked steps, no unverified numbers, incomplete labelling, VIN privacy, no REQUIRED validator gap, other vehicles untouched).
- Real routes against a production build and a throwaway local database, a normal signed-up customer: 37/37 customer routes (vehicle page lists 16, every guide page at desktop and phone, every step present in order with warnings, blocked steps stay blocked, 404s, admin route still refuses customers, Jeep page unchanged). Admin routes 37/37.
- Existing e2e: vehicle-home and marketing pass; 3 `garage.spec.ts` tests fail on stale selectors in `/garage/add` (unrelated, untouched code; the test last changed Oct 4, the page Sep 19).

## Deployment plan

1. Owner reviews the Vercel preview for PR #38 (the PR's branch deploys a preview; the vehicle page and any guide can be opened there).
2. Owner approves **by direct message, naming the operation**: "merge PR #38" (this also approves publishing uncertified guides).
3. On that message: merge through the GitHub API (never a push), watch the Vercel production deployment, then smoke-check `/vehicles/2010-bmw-328i-3.0l`, one guide page, and a blocked-step guide on the live site.
4. Rollback: revert PR (new branch, new PR); or remove the one spread line in `repairs.ts`.

## Not done, and why

- The Oracle (Perplexity) report was not attached to this session, so none of its claims could be imported. Nothing from it changed a specification.
- Idler vs alternator pulley: the claim that 40 and 80 Nm are different components is **not supported** by the cited primary pages (FCP names 40 Nm as the idler bolt; Pelican's 80 Nm is a staff reply about an idler). Idler stays conflicted and blocked. Recorded in the guide 6 ledger.
- Coolant bleeding and fuse-panel BMW documentation: not in hand. The guides keep the existing wording (accelerator-method bleed from two agreeing sources; owner's manual describes the glove-box fuse box only, engine-bay boxes blocked).
