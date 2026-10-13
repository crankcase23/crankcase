# F-150 pilot report (2026-10-12/13)

Vehicle: 2015 Ford F-150 XLT SuperCrew 4x4, 5.0L Coyote Gen 2, 6R80 (catalog id `2015-ford-f150-5.0l`).
Guides: Front Brake Pads, Battery, Coolant. Unpublished drafts only. Nothing certified, nothing published, nothing in Production, no paid research.

## Three separate counts (never merged)

| Count | Value | Note |
|---|---|---|
| Certified masters | 0 | G1 needs 8/8. Each pilot guide fails check 3 (figures sourced) and has no independent review or owner sign-off |
| Verified guide/configuration combinations | 0 | Target is 1,000. Nothing here moves it |
| Unverified previews in the app | 16 | All 2010 BMW 328i. The 3 pilot drafts are not previews: not wired to any route |
| (context) published, uncertified legacy resolved guides | 180 | Never counted as coverage |

## Measured effort (three research agents in parallel, sandbox clock)

| Guide | Wall time | Sources | Ledger facts: VERIFIED / SECONDARY / SINGLE / CONFLICT / MISSING | Steps | Donor reuse (as-is / numbers swapped / different / none) | Bespoke images |
|---|---|---|---|---|---|---|
| Front Brake Pads | ~15 min | see log | 1 / 22 / 7 / 2 / 5 | 22 | 5 / 6 / 4 / 0 | 1 shared (steps 6, 11); 2 optional |
| Battery | ~15 min | see log | 0 / 16 / 11 / 2 / 5 | 20 | 5 / 7 / 1 / 2 | 3 proposed; step 7 unserved (hold-down geometry unknown) |
| Coolant | ~22 min | 21 searches | 16 / 9 / 7 / 3 / 7 | 21 | 5 / 5 / 1 / 4 | 3 distinct (degas cap, radiator drain valve needs a user photo, jug label) |

My own work on top (ledger corrections, validator wrapper, draft builder, Atlas sheet, 16 tests, catalog fixes) was not separately timed.
Honest read: donors save wording, not research. Every swapped number is exactly where a safety error would hide. Ford's own document was only partly readable (no paid access), so no guide reached full verification.

## Evidence quality

- No Ford primary source fully read for any guide. Torques that print a number need VERIFIED or VERIFIED_SECONDARY; missing ones render as "not confirmed", not guessed.
- Open per guide: brake rotor discard thickness MISSING, brake fluid spec unresolved, pad kit CONFLICT; battery terminal and hold-down torque MISSING, group/CCA unresolved; coolant capacity CONFLICT (catalog said 16.6 qt, sources say ~15.9), drain valve torque MISSING, factory fill unresolved.
- 5 step dispositions proposed (owner to confirm): see `build-drafts.mjs` DISPOSITION table.
- Fleet share of this configuration: UNKNOWN. Not claimed to be the most common F-150.

## Defects

Fixed, with permanent regression coverage (`scripts/f150-pilot/tests/pilot.test.mjs`, 16 tests, all pass):
- Catalog F-150 5.0L: battery row, coolant capacity (16.6 qt unsourced and contradicted), coolant spec. 3 lines in `src/data/vehicles.ts`.
- Pilot validator is stricter than the BMW one: unsourced VERIFIED rows, hardware-as-cosmetic with nuts/pins, torque printing rule.

Reported, not fixed (owner decision, outside the pilot vehicle or shared code):
1. BMW validator (`scripts/bmw/validate-evidence.mjs`): HARDWARE regex misses nut/pin/stud/clip/spring/hose; VERIFIED part/tool/step with empty `sources` passes. 46 BMW ledger findings under the stricter checks.
2. Silverado 1500 and Sierra 1500 2020 5.3L: catalog says Group 78 (H6), the GM battery guide says 94R (H7). Guide text has the receipts.
3. 2021 RAV4 2.5L: catalog says Group 35, guide says BCI 47 (LN2/H5).
4. Catalog F-150 brake fluid "DOT 3" has no provenance. May be right; manual settles it.
5. GM guide torque rows with `value: ""` (16 rows in `repairs-gm-k2xx.ts`, e.g. radiator drain petcock): blank safety number if rendered. May be overlay by design; unchecked.
6. D5 jack-stand policy doc says APPROVED at the top but the bottom half still reads as pending.
7. Donor guides name stand positions; BMW D5 policy names none. Policies inconsistent across vehicles.

Regression coverage for 2 and 3 exists as a ratchet: the list of known mismatches may only shrink.

## Reuse takeaways for the Guide Factory

The BMW draft builder reused with small changes (measured copy in `scripts/f150-pilot/build-drafts.mjs`). Extract to shared code only after the owner decides on validator promotion; do not refactor now.

## Blockers and decisions

- Independent reviewer (Hermes-class) for G1: Claude cannot be one. Required before any certified count.
- Ford primary-source access (paid, owner approval) for the MISSING torques and capacities.
- Confirm the 5 dispositions; confirm the "usable" and "1,000" definitions.
- Promote the stricter validator checks to the shared validator? Triage the 46 BMW findings?
- Silverado/Sierra and RAV4 battery group fixes; Ford coolant line copies.
- OWNER-REVIEW path touched: `package.json` (3 scripts: f150:validate, f150:drafts, f150:test).
