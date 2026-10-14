# Guide 03 (Coolant Drain & Fill) stage log - 2015 F-150 XLT SuperCrew 4x4, 5.0L Coyote Gen 2, 6R80

Ledger: `docs/f150-pilot/evidence/guide-03.json` (catalog id `2015-ford-f150-5.0l`). Research only; nothing certified; Ford Workshop Manual 303-03 and the 2015 owner's manual coolant pages were NOT read.
Evidence tier chosen: safety-critical (hot pressurized coolant scald, fan, toxic sweet coolant attractive to pets/children, optional under-vehicle work).

## Stage timings (UTC, from `date -u +%H:%M:%S`)

| Stage | Start | End | Elapsed |
|---|---|---|---|
| 1 Source discovery (searches + page fetches, extraction happened inline as pages returned) | 04:50:53 | 05:08:49 | 17 m 56 s |
| 2 Evidence extraction (consolidation of what the fetches returned; mostly done inline in stage 1) | 05:08:49 | 05:09:56 | 1 m 07 s |
| 3 Ledger writing (one Python generator file, one JSON output) | 05:09:56 | 05:12:13 | 2 m 17 s |
| 4 Validation / fixes (validator passed on the first run; one small text fix and rerun) | 05:12:13 | 05:12:20 | 0 m 07 s |
| 5 Donor comparison (5 donor guides read, classification, image needs, defect hunt) | 05:12:23 | 05:13:15 | 0 m 52 s (log writing extra) |

Note: stages 1 and 2 overlap in practice. Stage 1 timestamps include reading donor/format files at the very start (about 1 minute).

## Counts

- Web searches run: 21 (standard mode 20, extended mode 1).
- WebFetch calls: 38 (29 distinct URLs returned usable page text; 6 distinct URLs failed or were blocked; 3 extra calls were offset re-reads of the one 2015 owner's manual PDF).
- Pages fetched successfully (29): static.nhtsa.gov (6: TSB 18-2244, 18-2250, 19-2019, 19-2122, 20-2034, SSM 47740), parts.ford.com (Motorcraft brochure MA-19624), motorcraft.com (2: Orange prediluted, Yellow prediluted product pages), fordservicecontent.com (4: owner's manual 'Engine Coolant Check' x2 variants, 'Capacities and Specifications - 5.0L', and a Towing page that had no coolant text; plus the 2015 owner's manual PDF, readable only to about page 58), ranger5g.com (Ford Aug 2020 Orange/Yellow compatibility document as a forum attachment), oreillyauto.com, carcarekiosk.com (2), bobistheoilguy.com (3), f150forum.com, fordraptorforum.com, fordmasterx.com, 2carpros.com, f150hub.com (older trucks only, not used as evidence), truedelta.com, reichwein.it (heading only, no content), fordservicecontent TSB 10-7-5 (Super Duty 6.4L; fetched, not used).
- Pages failed or blocked (6 URLs, plus partials):
  - motorcraft.com Orange prediluted (non-/1000 URL): HTTP 302 to ford.com/motorcraft/products (fetch refused to follow); the `.../html/1000` variant of the same page worked.
  - motorcraft.com Yellow concentrated page: same 302 redirect, not readable.
  - ford.com/motorcraft/products: refused (not in provenance set).
  - fordservicecontent.com owner's manual Index URL (my guess): permission request withdrawn.
  - fordservicecontent.com 2015 owner's manual 'version-1' PDF (my guess): refused (not in provenance set). The 'version-4' PDF (taken from a search result) was readable but its text stops about page 58 of roughly 400.
  - curl to the same PDF: proxy HTTP 403 CONNECT (not worked around).
  - Partials: ford.com 'What engine coolant should I use' returned only its title (no answer text); reichwein.it Mustang 303-03A returned only the heading.
- Hosts consulted: 16 (static.nhtsa.gov, parts.ford.com, motorcraft.com, fordservicecontent.com, ranger5g.com, ford.com, oreillyauto.com, carcarekiosk.com, bobistheoilguy.com, f150forum.com, fordraptorforum.com, fordmasterx.com, 2carpros.com, f150hub.com, truedelta.com, reichwein.it).
- Distinct origin groups: 11 consulted, 10 that contributed to the ledger. Ford documents (NHTSA-hosted TSBs/SSM, brochure, Motorcraft pages, Ford online manual, the Aug 2020 mirrored document) counted as ONE origin group; then O'Reilly, carcarekiosk, BITOG, f150forum, fordraptorforum, fordmasterx, 2carpros, f150hub (read, not used as evidence for this config), truedelta, reichwein (empty). fordmasterx and the BITOG '15.9 qt' poster may share an origin (unproven).
- Facts by status tag (validator output, 42 evidence nodes = tools 8 + parts 9 + fluids 7 + torque 3 + steps 15):
  - VERIFIED 16, VERIFIED_SECONDARY 9, SINGLE_SOURCE 7, CONFLICT 3, MISSING 7.
  - CONFLICTs: coolant specification (Orange vs Yellow factory fill, no Ford doc settles it), total capacity (13.9 / 15.9 / 16.6 qt), bleed routine (heater setting: Ford WSM quote for a Raptor says climate OFF, O'Reilly says heater ON).

## Validator output (`node scripts/f150-pilot/validate.mjs`, run at 05:12:20)

```
guide 3 Coolant Drain & Fill: {"VERIFIED":16,"VERIFIED_SECONDARY":9,"SINGLE_SOURCE":7,"CONFLICT":3,"MISSING":7,"other":0}
3 guides, 0 error(s), 0 warning(s)
```
(Other agents' guide-01/02 were in the folder at the time; no errors for any file.)

## Primary-source reachability (Ford documents)

Readable and used: Ford TSBs 18-2244, 18-2250, 19-2019, 19-2122, 20-2034 (all cover 2015+ F-150 5.0L; via NHTSA), Ford SSM 47740, Motorcraft brochure MA-19624 (parts.ford.com), Motorcraft Orange and Yellow prediluted product pages, Ford online Owner's Manual pages (vehicle NOT identified on the pages; copyright 2026), Ford Aug 2020 Orange/Yellow compatibility document (read only as a forum attachment on ranger5g.com).
NOT readable: the 2015 F-150 owner's manual coolant/capacity/jacking pages (PDF text ends near p.58), Ford Workshop Manual 303-03, SSM 48778 (only quoted by a forum poster), Ford TSB 15-0073 (listing only).
primarySourceFound = true, but ONLY partial: no Ford document read states this truck's capacity, factory fill, drain valve position, fill/bleed routine, or any torque.

## Donor comparison (done AFTER the ledger was built)

Donors read: `tacoma-coolant` (repairs-toyota-tacoma.ts:373), `jeep-grand-cherokee-coolant` (repairs-jeep-wk2.ts:313), `gm-k2xx-coolant` (repairs-gm-k2xx.ts:951, shared by silverado/sierra 2018 overrides at 1023/1039), `rav4-coolant` (repairs-toyota-rav4.ts:703).

| My step | Class | Why |
|---|---|---|
| 1 Prepare cold, level, pets | REUSABLE_AS_IS | Same cold-only/scald/pet wording in all four donors |
| 2 Decide whether to raise the truck | NO_DONOR | Donors assert raise + undercover removal; no source says whether the F-150 drain needs that |
| 3 Release pressure, open degas bottle cap | NUMBERS_SWAPPED | GM surge-tank step is the analog; component name and cap type swapped, no numbers |
| 4 Drain at radiator drain valve | NUMBERS_SWAPPED | Petcock step from GM/Jeep; valve position, size, 'plastic hand-tight' claim not sourced for F-150 so not carried over |
| 5 Optional lower-hose drain | NO_DONOR | Donors use a clear spigot hose or petcock only |
| 6 Close the drain valve | REUSABLE_AS_IS | 'Close, hand-snug, no torque' appears in all donors; the F-150 'plastic' claim is not sourced |
| 7 Optional water flush | NO_DONOR | No donor has a flush step (Jeep only warns about a flush if the chemistry is unknown) |
| 8 Identify coolant and mix | NUMBERS_SWAPPED | Jeep step 1 pattern (confirm what is in it, no mixing) with Ford Orange/Yellow/Gold specifics |
| 9 Fill degas bottle | NUMBERS_SWAPPED | Donors' 'refill slowly' step with MAX FILL and Ford wording |
| 10 Run engine and bleed | DIFFERENT_PROCEDURE | Tacoma squeezes hoses at 2000-2500 rpm, RAV4 verifies an electric pump, Jeep/GM use a funnel and heater; the F-150 routine is Ford WSM and sources conflict |
| 11 Overheat and leak check | NUMBERS_SWAPPED | Jeep step 7 pattern plus Ford fail-safe-cooling and heater-hose TSB note |
| 12 Cool, recheck level, cap | REUSABLE_AS_IS | Tacoma 8, Jeep 8, GM 7 |
| 13 Verify cabin heat | REUSABLE_AS_IS | GM step 7 'cold heater at idle = trapped air' reasoning |
| 14 Dispose of used coolant | REUSABLE_AS_IS | Recycler wording in Jeep and GM safety lists |
| 15 Record what you put in | NO_DONOR | Driven by Ford's Authorized Modification label in the TSBs |

Counts: REUSABLE_AS_IS 5, NUMBERS_SWAPPED 5, DIFFERENT_PROCEDURE 1, NO_DONOR 4 (total 15). Honest read: the donors reuse cleanly only for the safety/closing steps; every number, the identification step, and the bleed routine needed fresh evidence, and for the number-bearing items (capacity, drain location, torque) the evidence was not found.

## Image needs (public/steps has 23 generic SVGs: airbox-open, brake-caliper-remove, brake-inspect, brake-install, brake-lubricate, brake-piston-compress, cabin-filter-access, filter-airflow, generic-cleanup, generic-lower-vehicle, generic-park-secure, generic-raise-vehicle, oil-drain, oil-fill-check, oil-filter-cartridge, oil-filter-install, oil-filter-spinon-remove, tire-inspect, tire-rotation-fwd, tire-rotation-rwd, wheel-torque, wiper-arm-lift, wiper-blade-release; none is coolant-specific)

- Generic schematic covers (11 steps): 1 generic-park-secure; 2 generic-raise-vehicle; 5 oil-drain (as donors do); 7 generic-cleanup; 9 oil-fill-check; 10 generic-cleanup; 11 generic-cleanup; 12 oil-fill-check; 13 generic-cleanup; 14 generic-cleanup; 15 generic-cleanup.
- Bespoke image would be needed (4 steps, 3 distinct images): steps 3 (degas bottle cap and level marks, visual `f150-degas-bottle-cap-and-level-marks`), 4 and 6 (radiator drain valve, visual `f150-radiator-drain-valve`, needs a user-supplied photo because no source gives the position), 8 (coolant jug spec-code label, visual `f150-coolant-jug-identification`).
- Caution: `oil-drain.svg` and `oil-fill-check.svg` depict oil, not coolant; donors reuse them for coolant, which is passable as a generic 'drain/fill' picture but not accurate.

## Surprises

1. Ford's own TSBs (five of them, all NHTSA-hosted) explicitly cover 2015 F-150 5.0L and convert the system to Motorcraft YELLOW VC-13-G. That is the strongest evidence in the ledger, and it reverses the catalog's framing that Orange is 'the factory fill here' with Yellow as an alternative.
2. Ford's brochure describes VC-7 Gold as 'yellow' colored while VC-13 Yellow is a different product: color words alone are unsafe for identifying coolant.
3. Ford's online owner's manual pages are not model- or year-labeled, and the 'Engine Coolant Check' page lists engines (2.3L EcoBoost) the 2015 F-150 did not offer; so the Ford-hosted 13.9 qt for '5.0L' cannot be assigned to this truck.
4. Sources conflict on the cabin-heater setting while bleeding (Ford WSM quote: climate OFF; O'Reilly: heater ON).
5. The 2015 owner's manual PDF is public on fordservicecontent.com but the fetch tool returns only roughly the first 58 pages, so the coolant and capacity pages are unreachable by this tool.
6. Validator passed first run; the wrapper's one-message filter worked as described.

## Defects found in existing proven pieces (genuine defects only; not fixed)

1. `src/data/vehicles.ts:162-164` (2015 F-150 5.0L 'Engine Coolant'): capacity '~16.6 qt (15.7 L)' has no source and is contradicted by two secondary hosts (15.9 qt / 15.0 L; fordmasterx 2015-2017 and a BITOG 2017 5.0L poster) and by a Ford-hosted page for an unnamed '5.0L' (13.9 qt). Real defect: a customer-facing number stated as curated fact that the evidence neither confirms nor settles.
2. Same entry, `spec`: 'WSS-M97B44-D, 50/50 premix (VC-3, VC-3DIL-B)' attaches the concentrate spec -D to the premix. Ford's brochure MA-19624 and the Motorcraft product page list -D for concentrate VC-3 and -D2 for prediluted VC-3DIL-B. Real (small) inaccuracy.
3. Same entry, `notes`: 'The factory fill here is Orange' is asserted but no Ford document read supports it for this truck, and the same note says Ford is 'phasing Orange out' (not confirmed anywhere read). Meanwhile five Ford TSBs refill 2015+ F-150 5.0L with Yellow. The note's central claim is unverified.
4. `src/data/vehicles.ts` lines 416, 1144, 3225, 3279, 3332, 3391 (2021 Explorer 2.3L, 2021 Bronco 2.3L, 2019 Fusion 2.5L, 2016 Focus 2.0L, 2018 Mustang 5.0L, 2021 Ranger 2.3L) and the 2021 Expedition 3.5L entry (~3452) carry the identical 'Motorcraft Orange, WSS-M97B44-D, 50/50 premix' spec. Ford SSM 47740 (read) says 2018 Expedition/Navigator, 2018-2019 F-Super Duty and 2019 F-150 (built from 2-Jan-2019) are factory-filled with Yellow. Not proven wrong for each model year, but the blanket copy-paste is a likely defect that needs a per-vehicle check. (Possible, not confirmed.)
5. `src/data/repairs-gm-k2xx.ts:998` (`gm-k2xx-coolant` step 4): `torque: [{ fastener: "Radiator drain petcock", value: "" }]`, one of 16 `value: ""` torque rows in that file (e.g. lines 120, 244, 373). An empty value in a torque row is a real defect (blank safety number rendered to the user), not friction; I did not check how the renderer treats it.
6. `src/data/repairs-gm-k2xx.ts:955, 991`: 'system holds 16.8 qt but only about 8 qt comes out' presented as fact in a guide; no source cited in the guide. Cannot confirm; flagged for evidence review (donor, not the F-150).
7. `scripts/bmw/build-drafts.mjs` (META, NOT_A_TORQUE, `g:` keys, GUIDE_CONFIG): keyed by BMW guide numbers (guide 3 = key fob battery, 8 = coolant). Reusing the builder for the F-150 pilot, where guide 3 = coolant, would apply the wrong metadata and the wrong NOT_A_TORQUE rules. Real reuse hazard, not friction, because it silently mislabels.
8. Friction only (not counted as defects): validator hardcodes 'expected 16 guide files'; validator's HARDWARE regex `/tab/` would flag element ids such as 'stable-...' or 'table-...' (false positive risk); validator enforces 2+ hosts only for torque rows, so a VERIFIED fluid/part row with a single source passes without any check that `primary:true` is truthful.
9. Friction only: donor safety lines use 'Never work under a vehicle supported only by a jack' wording (Tacoma/RAV4/GM) instead of the owner-approved D5 policy sentence; the Jeep coolant guide lists jack stands in tools but has no jack-stand line in its safety list.

## Confidence caveats

- High confidence: Ford documents say a radiator drain valve and a degas bottle exist on 2015+ F-150 5.0L, that Ford's repair refills with Yellow VC-13-G, and that coolant types must not be mixed.
- Medium: Orange/Yellow part numbers and spec codes (Motorcraft pages and brochure; Yellow prediluted page lists -A2 only).
- Low or none: capacity, factory fill color, drain valve position, wrench size, torque, bleed routine for this truck, jack points. Those are CONFLICT/MISSING by design.
- The 'Backward Compatibility' Ford document was read through a forum attachment, not a Ford host, and has no bulletin number. SSM 48778 is quoted only by a forum poster.
- Nothing here is certified or verified against Ford service data.
