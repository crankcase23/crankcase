# BMW 328i (E90): publishing all 16 guides on the customer site

Date: 2026-10-11. Branch `claude/bmw-guide-build`, PR #38. **Nothing is merged, deployed or published yet.** Merging PR #38 into `main` is the publication event (Vercel deploys `main` to production), and that needs the owner's direct approval naming the PR.

## What changes for customers

- The 2010 BMW 328i vehicle page lists all 16 guide categories, and each opens its own guide page at `/vehicles/2010-bmw-328i-3.0l/repairs/bmw-2010-328i-<job>`.
- Every guide opens with a plain "Incomplete guide: not yet verified against BMW service data" summary and a first safety warning saying the same. Guides with blocked steps add "N step(s) are BLOCKED in this guide".
- **Entitlement:** tiers follow the Get the Keys model (oil change free, the other 15 premium: $20 first vehicle, $18 second, $16 third, $15 fourth and up, presentation-only today), but every BMW guide also carries `preview: true`. Preview means readable by everyone, never gated, never sold, never counted as paid content, and badged "Preview" instead of "Keys". Anything that grants or charges for premium must go through `isSellable()` (`src/lib/guideAccess.ts`), which is false for a preview. To certify a guide: clear its `preview` flag (generator), after the evidence, mechanic review and payment readiness. There is no unlock backend yet, so nothing can charge anyone today.
- **Customer Wrench Mode:** BMW guides now open in the existing Overall Guide + Wrench Mode component (`GuideWithWrenchMode`) via a thin client wrapper, `GuideWithServiceSave`, which supplies the Service History save (the same POST the garage UI uses). It is opt-in per guide (`wrenchMode: true`), so every other vehicle's guide page is unchanged.

## What stays restricted (identical to the admin drafts, enforced by tests)

- Blocked steps: engine-bay fuses, xenon low-beam bulb, idler pulley replacement.
- Any torque that is not VERIFIED or confirmed by 2+ independent hosts prints "VERIFY EXACT TORQUE BEFORE SERVICE" with no number. That includes the rear caliper guide screws, idler pulley, battery terminal / hold-down, bleeder screw and drain plugs.
- Configuration-dependent items (brake package, caliper screw head type, differential plug type, drivetrain) remain "check your car" steps.
- The owner's own VIN, VIN-tail serial and decode results are removed from the public copy.

## Generated, not hand-written

`scripts/bmw/build-drafts.mjs` now writes two files from the same evidence: the admin review drafts and `src/data/repairs-bmw-e90.ts` (public). `src/data/repairs.ts` gains one import and one spread line. The public file must never be edited by hand.

## Validation receipts

- `bmw:test` 62/62, including `customer.test.mjs` (access, parity with drafts, blocked steps, no unverified numbers, incomplete labelling, VIN privacy, no REQUIRED validator gap, entitlement/preview rules, other vehicles untouched).
- Real routes against a production build and a throwaway local database, a normal signed-up customer: 39/39 customer routes. For each of the 16 guides at desktop and phone: page loads, Preview banner and incomplete summary, no paid-unlock wording, Wrench Mode walks every step with correct progress, blocked steps show BLOCKED, the completion sheet **really saves** a Service History entry (verified through the API), Overall Guide / resume / exit recovery. Plus: vehicle page lists 16 with "Preview" badges (no "Keys"), existing premium Jeep guide keeps its paid-unlock banner and gets no Wrench Mode button, signed-out visitors are treated the same on BMW and other guides, 404s, admin route still refuses customers. Admin routes 37/37.
- Existing e2e: vehicle-home and marketing pass; 3 `garage.spec.ts` tests fail on stale selectors in `/garage/add` (unrelated, untouched code; the test last changed Oct 4, the page Sep 19).

## Deployment plan

1. Owner reviews the Vercel preview for PR #38 (the PR's branch deploys a preview; the vehicle page and any guide can be opened there).
2. Owner approves **by direct message, naming the operation**: "merge PR #38" (this also approves publishing uncertified guides).
3. On that message: merge through the GitHub API (never a push), watch the Vercel production deployment, then smoke-check `/vehicles/2010-bmw-328i-3.0l`, one guide page, and a blocked-step guide on the live site.
4. Rollback: revert PR (new branch, new PR); or remove the one spread line in `repairs.ts`.

## Evidence notes (no new research this pass)

- Idler pulley: FCP supports 40 Nm for the N52 idler mounting bolt (verified from the page). A report says an indexed BMW 80 Nm entry concerns an alternator freewheel pulley; that document was not supplied to me and I could not inspect it, so nothing changed. Bentley's correction body is still unread. The idler torque stays unresolved and the replacement step stays **blocked**.
- Electric coolant-pump bleeding sequence and the glove-box fuse panel: both were already in the ledgers as VERIFIED from BMW primary text (owner's-manual copy, BMW training documents) and are already in the guides (guide 8 "Run the automatic venting routine"; guide 2 "Open the glove-box fuse panel"). No further import was possible without the report's citations. The engine-bay fuse boxes remain blocked: the manual describes only the glove-box box.

## Still not done

- Wrench Mode customer completion is tested against the catalog vehicle with a signed-in user; a signed-out save fails and the sheet says so without ending the job.
- The 3 failing `garage.spec.ts` tests (stale selectors in `/garage/add`) were not touched.
