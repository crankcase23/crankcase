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

## Merge gate (state at 4523531, 2026-10-11)

| Check | State |
|---|---|
| Remote branch HEAD | `claude/bmw-guide-build` = `4523531` = local HEAD |
| PR #38 | open, not draft, `mergeable: true`, `mergeable_state: clean`, base `main` (`dd1f749`), 17 commits, 0 review comments, no requested reviewers |
| Production-check status | Vercel status `success` on `4523531` ("Deployment has completed"). The repo has no GitHub Actions workflows, so Vercel is the only check |
| Branch protection | `main` reports `protected: true`. The session token cannot read the rules (`Resource not accessible by integration`), so required reviews, status checks and merge-method restrictions are **unverified from here**. If a rule blocks the API merge, the merge call returns the exact refusal and I will report it instead of working around it |
| Merge method | Repo allows merge commit, squash and rebase. Earlier owner-approved merges (#35, #36, #37) used merge commits; I will use a merge commit unless told otherwise |
| Shared files in the diff | `src/types/vehicle.ts`, `src/components/tables.tsx`, `GuideGroups.tsx`, `src/data/repairs.ts`, the customer repair page, `package.json` (OWNER-REVIEW path: adds the `bmw:preview` script) |
| Preview-only and unsellable | `customer.test.mjs`: all 16 `preview: true`, `isSellable()` false for every one, Wrench Mode opt-in on exactly these 16, no other vehicle's guide carries either flag |
| Restrictions | Blocked steps (engine-bay fuses, xenon bulb, idler pulley) and every unverified torque (VERIFY, no number) are asserted identical to the admin drafts, on the unit and real-route tests |
| Customer Wrench Mode + Service History | 32 guide x viewport real-route runs: walk, blocked steps, completion sheet really saves a Service History entry (read back through the API), recovery |
| BMW tests | `bmw:test` 62/62; customer e2e 39/39; admin e2e 37/37; preflight PASS |

### The three existing failures in `tests/e2e/garage.spec.ts` (not caused by this PR)

None of these tests, `/garage`, or `/garage/add` is touched by this branch. They fail because the spec is stale against UI changes made on 2026-09-19 (spec last edited 2026-10-04 without re-running against them):

1. `starts empty and can add a catalog vehicle`: expects a link named "+ Add your first vehicle"; the link now reads "Add your first vehicle" (no plus), and `/garage/add` no longer has catalog vehicle buttons (it is VIN-decode-led since commit `e596585`).
2. `can add a custom vehicle we don't have data for…`: expects a button named exactly "Add to garage"; it now reads "+ Add to garage".
3. `removing a vehicle takes it out of the garage`: depends on the same removed catalog button ("Civic") on `/garage/add`.

Fix is a selector update in the spec, a separate change from this PR.

### After the owner says "merge PR #38"

1. Re-verify remote HEAD is still `4523531` and the PR is still `mergeable: clean`. If the head moved, stop and report.
2. Merge through the GitHub REST API only (never a push to `main`).
3. Find the production deployment for the new `main` SHA; wait for the Vercel status `success`.
4. Smoke test the live site: `/vehicles/2010-bmw-328i-3.0l` lists 16 guides badged Preview; one guide opens with the Preview banner; Wrench Mode starts and walks; a blocked step shows BLOCKED (fuse-bulb, serpentine-belt); an existing vehicle's guide page is unchanged. Do not save a Service History entry on the live site unless the owner asks.
5. Report the merge SHA, deployment status, live URLs and results. Rollback: a revert PR (new branch), then the same flow.
