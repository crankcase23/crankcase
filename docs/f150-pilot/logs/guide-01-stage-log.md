# Guide 01 (Front Brake Pads) stage log: 2015 F-150 XLT SuperCrew 4x4 5.0L (`2015-ford-f150-5.0l`)

Research only. No git, no builds, no image generation. Ledger: `docs/f150-pilot/evidence/guide-01.json`. Clock is `date -u` inside the sandbox, as instructed.

## Stage timings (UTC)

| Stage | Start | End | Note |
|---|---|---|---|
| 1 Source discovery | 04:50:26 | 05:00:21 | Interleaved with stage 2 (see below) |
| 2 Evidence extraction | 04:50:26 | 05:00:21 | Not separable: the fetch tool returns a model summary of each page, so discovery and extraction were one search-fetch loop. I did not log a boundary at the time; reporting the merged span honestly. |
| 3 Ledger writing | 05:00:21 | 05:04:07 | One Write plus one small Edit |
| 4 Validation / fixes | 05:04:07 | 05:04:29 | Validator clean on first run (0 errors, 0 warnings). The 22 s includes my own mutation probe of the validator (see defects), which was extra work, not a fix. |
| 5 Donor comparison | 05:04:29 | 05:05:22 | Read Tacoma `tacoma-brake-pads-front`, GM `gm-k2xx-front-brake-pads`, F-150 catalog entry, D5 policy |

Elapsed total 04:50:26 to 05:05:22 (about 15 minutes of sandbox clock).

## Source counts

- Web searches run: 33
- Pages fetched successfully with usable content: 36 distinct URLs (several fetched twice for different extractions)
- Pages fetched but with no usable content (nav or metadata only): 3 (lmr.com wheel torque, ford.com how-to change tires, ford.com how-to add brake fluid)
- Pages that failed or were blocked (host, reason):
  - brakeandfrontend.com `/brake-job-2009-2014-ford-f150/` (fetch error; the other Brake & Front End URL `?p=154205` worked)
  - fordservicecontent.com owner-manual index page (WebFetch provenance rule: URL not previously returned by search)
  - api.nhtsa.gov recallsByVehicle (provenance rule)
  - rockauto.com 5.0L pad page (robots disallowed)
  - parts.ford.com brakes (robots disallowed)
  - fordservicecontent.com 2015 owner's manual Version 1 PDF (302 redirect loop https to http; not followed)
  - ford.com `/product/disc-brake-pad-set-p4000071291` (proxy HTTP 429 rate limit; not retried, per the tool's instruction)
  - motorcraft.com DOT 4 LV page (302 to ford.com/motorcraft/products, not followed)
  - curl direct from the sandbox: brakeandfrontend.com, fordservicecontent.com, ford.com all returned proxy 403 (CONNECT rejected); curl is not a usable path here
  - Partially readable (not failures but truncated): the 2015 F-150 Owner's Manual Version 4 PDF and the 2016 Version 1 PDF both returned text only up to about page 57 (121,407 characters). The Brakes, Brake Fluid Check, Breaking-In, Changing a Road Wheel and Capacities chapters were not reached.
- Distinct origin groups consulted: 18 (Ford owner docs fordservicecontent; ford.com Motorcraft catalog; Ford FCSD chemicals; NHTSA; O'Reilly; Babcox [tirereview.com + brakeandfrontend.com count once]; Blue Springs Ford Parts; go-parts; kevinsautos; Ford Raptor Forum; f150gen14 forum; Summit Racing; fordoempartsdirect; cjponyparts; Porterfield; carcarekiosk; f150hub; steemit). Of these, only about 8 carry anything usable for this truck; f150hub (1997-2003), steemit (1997), carcarekiosk (Transit) and NHTSA 16V-345 (2013-2014 3.5L) were read and discarded as non-applicable.
- Caveat on every fetched fact: WebFetch returns a small-model summary, not raw HTML. Quoted numbers (184, 27, 150, 13 mm, 21 mm, part numbers) were each asked for explicitly and recur across independent pages, but I could not diff them against raw page text.

## Primary-source reachability

primarySourceFound = false. Exactly what was and was not readable:

- READ (Ford): 2015 F-150 Quick Reference Guide v3 (fordservicecontent.com `2015-F-150-Version-3_QG_EN-US_8_2015.pdf`): "Always use proper jacking points", "Do not use any part of the power running boards to lift your vehicle when jacking", EPB "on certain models". No brake-fluid text, no torque.
- READ (Ford), not covering the job: Ford FCSD brake-fluid product pages (DOT 3 WSS-M6C65-A1 PM-1-C; DOT 4 LV WSS-M6C65-A2 PM-20; not vehicle-specific); NHTSA Part 573 16V-345 (2013-2014 3.5L only); ford.com Motorcraft pad pages for BRF1581/JU9Z2001A, BRF1955/FR3Z2001Q, BRF1905/JL3Z2001B, BRF1874/KB3Z2001A (SKU and marketing text only; "Fits These Vehicles" never loaded).
- NOT READABLE: the 2015 owner's manual brake, jacking, lug-torque, brake-fluid and break-in text (PDF text stops near p.57; HTML owner-manual pages that surfaced were for Super Duty, a 2014 motorhome and a 2022 Expedition, all rejected); any Ford workshop-manual page for the 2015 F-150 (206-03 etc.); Motorcraft/Ford fitment tables; RockAuto and parts.ford.com (robots).
- Ford workshop pages for other vehicles surfaced (Mustang 2014 on reichwein.it, Ranger 2019 on a storage mirror). Not used as evidence.

## Facts by status tag (validator output, `node scripts/f150-pilot/validate.mjs`)

```
guide 1 Front Brake Pads: {"VERIFIED":1,"VERIFIED_SECONDARY":22,"SINGLE_SOURCE":7,"CONFLICT":2,"MISSING":5,"other":0}
2 guides, 0 error(s), 0 warning(s)    (guide 2 belongs to another author)
```

Counts cover tools, parts, fluids, torque rows and steps (37 nodes). Breakdown by node type:

- Steps (15): VERIFIED 1 (step 3, lift/support: Ford QRG plus two agreeing hosts), VERIFIED_SECONDARY 11, SINGLE_SOURCE 2 (steps 1, 15), MISSING 1 (step 7, rotor measurement)
- Torque rows (4): VERIFIED_SECONDARY 3 (lug nuts 150 lb-ft, bracket 184 lb-ft, pin bolts 27 lb-ft), MISSING 1 (rotor discard thickness)
- Parts (8): CONFLICT 2 (pad kit number; pad shape families), VERIFIED_SECONDARY 1 (BRF1899 exists as an F-150 kit), SINGLE_SOURCE 4 (BRF1956, FL3Z-2001-C/JL3Z-2001-A, wear indicator, clips/hardware), MISSING 1 (brake fluid part)
- Tools (9): VERIFIED_SECONDARY 7, SINGLE_SOURCE 1 (bleeder tool), MISSING 1 (micrometer)
- Fluids (1): MISSING (spec for this truck not found)

Honesty note on the VERIFIED_SECONDARY torques: the validator accepted them because 2+ different hostnames appear, but the independent-origin count is lower. tirereview.com and brakeandfrontend.com are one Babcox article; go-parts and kevinsautos appear to repeat one embedded video. Independent origins that agree on 184/27/150: Babcox (2009-2014 truck), O'Reilly (2012 demo truck, "similar" through 2020), go-parts video (2015-2020), Raptor Forum (2022 Raptor, bracket and pin only), f150gen14 (2022 manual quoted by a user, lug only). No Ford document read for the 2015 truck. The row `conflicts` text says all of this.

## Donor comparison (done after the ledger was built)

Donors: `src/data/repairs-toyota-tacoma.ts` (id `tacoma-brake-pads-front`, fixed 4-piston caliper, so mostly NOT comparable) and `src/data/repairs-gm-k2xx.ts` (id `gm-k2xx-front-brake-pads`, floating caliper, the true analogue).

| # | F-150 step | Class | Why |
|---|---|---|---|
| 1 | Confirm truck brakes and parts | DIFFERENT_PROCEDURE | Donors say "look before you disassemble"; ours is a VIN/pad-shape/EPB identification step that has no donor content |
| 2 | Park, chock, loosen lug nuts | NUMBERS_SWAPPED | GM step 1 text, 22 mm becomes 21 mm |
| 3 | Lift and support | DIFFERENT_PROCEDURE | Donors name stand positions ("front crossmember", "frame rails"); ours must carry the D5 policy wording with no position |
| 4 | Remove wheel | REUSABLE_AS_IS | GM step 1 tail ("pull both front wheels") |
| 5 | Remove caliper, support off hose | NUMBERS_SWAPPED | GM step 3; 13 mm slide bolts; GM hang-points (coil spring, upper arm) not copied because unsourced for the P552 |
| 6 | Remove pads, note inner/outer | DIFFERENT_PROCEDURE | GM step 5 has no ear/chamfer orientation and tells the reader to wire-brush the ledges; O'Reilly (F-150) says do not wire-brush the bracket |
| 7 | Inspect rotor and caliper | REUSABLE_AS_IS | GM step 2 (scoring, weeping boot); donors give no discard thickness either |
| 8 | Optional bracket / rotor branch | NUMBERS_SWAPPED | GM steps 6-9; 170 becomes 184 lb-ft, 22 mm lugs become 21 mm; note GM warns of a 221 lb-ft heavy-brake column trap, no F-150 equivalent known |
| 9 | Clean and lubricate | REUSABLE_AS_IS | GM step 10 (grease pins, boots, clips, no grease on friction face); grease type (silicone per O'Reilly vs high-temp brake grease per GM) needs a Ford answer |
| 10 | Retract piston | REUSABLE_AS_IS | GM step 4 (C-clamp with old pad, watch reservoir); Tacoma 4-piston method does not apply |
| 11 | Fit new pads | DIFFERENT_PROCEDURE | GM fits by wear-indicator position; F-150 fits by ears/orientation and no wear sensor is documented |
| 12 | Refit caliper, torque slide bolts | NUMBERS_SWAPPED | GM step 11; 74 ft-lb becomes 27 ft-lb (a near 3x difference, which is why figures must never be carried over) |
| 13 | Wheel on, lower, torque lugs | NUMBERS_SWAPPED | GM step 12 first half; 140 becomes 150 ft-lb |
| 14 | Pump pedal, check fluid | REUSABLE_AS_IS | GM step 12 and Tacoma step 9 pump-before-moving; the fluid spec itself is MISSING for this truck |
| 15 | Bed in pads | NUMBERS_SWAPPED | Donors 6-8 stops 35 to 10 mph; O'Reilly (single source) 15-20 slowdowns 50 to 30 mph |

Counts: REUSABLE_AS_IS 5, NUMBERS_SWAPPED 6, DIFFERENT_PROCEDURE 4, NO_DONOR 0 (total 15).

Reading of the result: roughly 1/3 reusable text, 2/5 reusable structure with swapped numbers (the risky category, since every swapped number is exactly where a safety error would hide), and 4 steps that need real content. The donors save wording effort, not research effort: the number swaps are the research.

## Image needs (`public/steps/*.svg`)

Existing generics: airbox-open, brake-caliper-remove, brake-inspect, brake-install, brake-lubricate, brake-piston-compress, cabin-filter-access, filter-airflow, generic-cleanup, generic-lower-vehicle, generic-park-secure, generic-raise-vehicle, oil-drain, oil-fill-check, oil-filter-cartridge, oil-filter-install, oil-filter-spinon-remove, tire-inspect, tire-rotation-fwd, tire-rotation-rwd, wheel-torque, wiper-arm-lift, wiper-blade-release (23 files; I did not open the SVGs, so "covers" means by name and the donor guides' own use).

| Step | Generic that covers it | Bespoke? |
|---|---|---|
| 1 | brake-inspect | no |
| 2 | generic-park-secure | no |
| 3 | generic-raise-vehicle | no |
| 4 | generic-raise-vehicle (wheel off) | no |
| 5 | brake-caliper-remove | no |
| 6 | brake-inspect | YES: inner vs outer pad ears (proposed visual f150-inner-outer-pad-orientation); a generic cannot show the distinction |
| 7 | brake-inspect | no |
| 8 | brake-install | no |
| 9 | brake-lubricate | no |
| 10 | brake-piston-compress | no |
| 11 | brake-install | YES (same bespoke image as step 6) |
| 12 | brake-install | no |
| 13 | wheel-torque, generic-lower-vehicle | no |
| 14 | generic-cleanup (weak: no pedal image exists) | no |
| 15 | generic-cleanup | no |

Count: 13 steps covered by generics, 2 steps (6 and 11) need 1 shared bespoke image. Two further proposed visuals (f150-front-caliper-bracket-fasteners IDENTIFY, f150-caliper-hung-off-hose DO) are optional upgrades: the generic brake-caliper-remove covers them if the guide does not show the 13/21 mm sizes. All three have mustNotDepict entries because several details (slide-bolt top/bottom, ear geometry on the 2015 pad, hanger attachment point) have no source.

## Surprises

1. WebFetch can only fetch URLs that already appeared in a search result (provenance rule), so reaching a Ford primary document means getting the search engine to return it; I could not type in a known URL. Domain-restricted searches (`allowed_domains`) were what surfaced the fordservicecontent PDFs and NHTSA reports.
2. The Ford owner's manual PDF is readable only to about page 57 through the fetch tool; the chapters that matter for this guide are all later. A "Ford primary found" check based on whether a PDF loads would give a false yes.
3. Several Ford.com Motorcraft pad pages exist but their fitment tables never load. One (BRF1955, FR3Z2001Q, titled "Front 5.0L") would be a tempting wrong answer for a 5.0L F-150; the FR3Z prefix points at a different Ford vehicle and it was rejected.
4. At least five different pad kits/shape families (BRF1956, BRF1899, shapes 1414/1770/2087, plus FL3Z-2001-C) are listed for a 2015 F-150 with no readable mapping to brake package. Pad choice is genuinely a VIN-decision, not a research-decision.
5. The most detailed F-150 brake how-tos (O'Reilly, Babcox) are titled for the 2009-2014 truck; O'Reilly claims "similar on 2015-2020". That is a generation boundary (P552 starts in 2015) and the guide treats it as unproven.
6. A kevinsautos Q&A page gives 129 lb-ft and 184 lb-ft for the same 2012 caliper bracket on the same page.
7. Brake-fluid spec for this truck could not be found, yet the catalog states "DOT 3" flatly (see defect 5).
8. The sandbox clock advanced about 15 minutes for roughly 100 tool calls, and the per-call latency inside WebFetch was not visible; stage times are as measured by `date`, not reconstructed.

## Defects found in existing proven pieces

Real defects (things that can let a wrong or unsupported claim through), then friction.

1. `scripts/bmw/validate-evidence.mjs:15` (`HARDWARE` regex): `/hardware|connector|clamp|release|fastener|bolt|screw|latch|tab/i` has no `nut`, `pin`, `stud`, `clip`, `spring` or `hose`. Probe: adding an element `{id:"lug-nuts", criticality:"cosmetic"}` and one `{id:"guide-pins", criticality:"cosmetic"}` to a visual produced 0 errors. The rule's stated purpose (hardware may not be cosmetic) is silently unenforced for lug nuts and guide pins, which are the safety-critical hardware in a brake guide. Real defect (the BMW ledgers happened to name elements with "bolt"/"screw", which hid it).
2. `scripts/bmw/validate-evidence.mjs:43-47` (status check) and the loop at 54-64: a tool, part, fluid or step with status VERIFIED or VERIFIED_SECONDARY and an empty `sources` array passes. Probe: setting a part to VERIFIED with `sources: []` and a step to VERIFIED with `sources: []` produced 0 errors. Only torque rows are checked for source count (line 58). A VERIFIED part number with no source is exactly the invented-number failure the header says to prevent. Real defect.
3. `scripts/bmw/validate-evidence.mjs:57-60`: a torque row with `value: ""` and status VERIFIED_SECONDARY passes; the only value check is the regex `/missing/i`. Real but minor.
4. `scripts/bmw/validate-evidence.mjs:58` host-count independence: two pages of the same article on different hostnames (tirereview.com and brakeandfrontend.com are one Babcox article) count as 2 hosts. Probe: a VERIFIED torque row with those two hosts and `primary:true` passed. This cannot be fixed mechanically (origin identity is a judgement), so it is a known limitation rather than a bug, but it means the validator's "2+ independent hosts" is weaker than the build-drafts text promises ("confirmed by 2+ independent sources"). Flagging because build-drafts prints VERIFIED_SECONDARY torques as numbers to customers.
5. `src/data/vehicles.ts:188-191` (2015-ford-f150-5.0l, Brake Fluid): `spec: "DOT 3"` with no `notes` and no `provenance` field (the oil and coolant entries in the same object carry `provenance` and CORRECTED notes). In this research no readable source states DOT 3 vs DOT 4 LV for this truck (Ford sells both and says check the cap). The catalog states one flatly. This is an unverified safety-relevant fluid spec, not a proven error: it may be right, and the 2015 manual would settle it. Real defect in the sense of unsupported provenance, not a known wrong value.
6. `docs/bmw-e90/certification/D5-JACK-STAND-POLICY-PROPOSAL.md:3` says "Status: APPROVED ... applied", but lines 30-39 ("What would change if Boss approves", "Decision for Boss ... Until then the guides keep their current wording and Rear Brake Pads stays restricted") were not updated. A reader taking the bottom half as current would conclude the policy is unapproved. Real documentation defect in a safety-policy file; low runtime impact.

Friction only (not defects):

7. `validate-evidence.mjs:31` hardcodes "expected 16 guide files" (the pilot wrapper filters it; measured reuse friction already known).
8. `validate-evidence.mjs:15`: `tab` matches inside unrelated words (`stabilizer`, `table`), a false-positive risk for cosmetic elements.
9. The D5 policy sentence is not parameterised: "the plastic pad" (line 22) is BMW-specific and had to be edited by hand for the F-150 (adapted to "lift point" only, as instructed). `scripts/bmw/tests/jack-stand-policy.test.mjs` is BMW-only, so nothing enforces the policy sentence on pilot ledgers.
10. The pilot validator does not check that `primarySourceFound` agrees with any `primary:true` row, or that a visual's `evidenceSteps` avoid steps whose status is MISSING. Both passed in my probes.
11. Donor guides name stand positions ("front crossmember", "frame rails") while the D5 policy for BMW deliberately names none; the two policies are inconsistent across vehicles (donor wording may be separately sourced; I did not audit that).
12. GM donor step `torque` entries carry `value: ""` (repairs-gm-k2xx.ts lines 120, 244, 373, 387) with the real figures in per-vehicle `figures`. This looks intentional (overlay model) but is easy to mistake for a missing value.

## Confidence caveats

- Not certified, not verified against Ford service data. No Ford workshop or owner's-manual text for this truck was read on the brake job, torques, fluid or jacking.
- Every torque is VERIFIED_SECONDARY from sources that are mostly about the 2009-2014 (12th generation) truck; only go-parts names 2015-2020 front-axle figures, and it likely repeats a video. Treat 184, 27 and 150 lb-ft as strong candidates that need a Ford confirmation, not as settled.
- The fetch tool summarises pages, so exact digits were not diffed against raw text; the three torque figures and the 13/21 mm sizes did recur across independent pages, which is the only cross-check available.
- Part number and pad shape are unresolved by design. Rotor size and discard thickness, brake fluid, jacking positions, EPB service-mode requirement, wear sensor presence and 2WD/4WD differences are all open questions recorded in `variantDependencies`, `missingEvidence` and `ownerInputsNeeded`.
- The step statuses are deliberately conservative where only 2009-2014 sources exist; a reviewer who thinks 2015 equals 2014 for brakes could reasonably upgrade several steps, but I have no source that says so.
