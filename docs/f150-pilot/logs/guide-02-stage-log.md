# Guide 02 (Battery Replacement) stage log

Vehicle: 2015 Ford F-150 XLT SuperCrew 4x4, 5.0L Coyote Gen 2, 6R80 (`2015-ford-f150-5.0l`).
Output: `docs/f150-pilot/evidence/guide-02.json`. Research only; no git, no builds, no images.

## Stage timings (UTC, from `date -u +%H:%M:%S`)

| # | Stage | Start | End | Elapsed |
|---|-------|-------|-----|---------|
| 0 | Orientation (read BMW guide-07, guide-10, validator, build-drafts header, pilot validator, catalog entry) | 04:50:38 | 04:50:50 | 0:12 (reads only; ran in parallel with the first calls) |
| 1 | Source discovery (searches + fetches) | 04:50:50 | 05:00:13 | 9:23 |
| 2 | Evidence extraction | 05:00:13 | 05:02:01 | 1:48 |
| 3 | Ledger writing | 05:02:01 | 05:04:17 | 2:16 |
| 4 | Validation / fixes | 05:04:17 | 05:04:17 | 0:00 (validator passed on first run, nothing to fix) |
| 5 | Donor comparison + defect hunt | 05:04:22 | 05:05:37 | 1:15 |

Honest caveat on stages 1 and 2: they overlap. WebFetch returns an already extracted answer to a prompt, so extraction happened inside the fetch calls during stage 1. The stage 2 interval is only the consolidation pass (deciding what each source could and could not establish and planning statuses). Most of the wall time in stage 1 went to dead ends (Ford hosts, JS-rendered retailer pages, forum fetch errors), not to reading.

## Counts

- Web searches run: 37 (all `WebSearch`; 3 in "extended" mode).
- Page fetches attempted: 62 `WebFetch` calls (+ 6 `curl` probes of Ford hosts).
- Fetched successfully: 49 `WebFetch` calls returned content. Of those, about 8 returned only navigation, empty fitment tabs or truncated text (see "Readable but empty").
- Failed or blocked: 13 `WebFetch` calls + 6 curl probes.
  - Provenance refusal (URL had not appeared in a search result): fordservicecontent.com owner-manual PDF (first try, before it surfaced in search), motorcraftservice.com search page.
  - Generic fetch error: autofiles.com, ford.oempartsonline.com (x1), f150forum.com `battery-type-2015-2018-models-405514` (x2), f150forum.com `new-battery-reset-bms-no-460039` (x2), f150forum.com `new-battery-question-502570`, ford-trucks.com `1569579-dual-battery-locations-in-2015-f150`, ford-trucks.com `1588152-battery-monitor-system`, f150ecoboost.net `battery-swap-procedure`.
  - robots.txt disallow: f150ownersmanual.com.
  - curl denied by the egress proxy (CONNECT 403, "organization policy"): www.ford.com, www.fordservicecontent.com (x4 including variants). WebFetch could read fordservicecontent.com and ford.com even though curl could not; I did not try to route around the proxy.
- Distinct origin groups consulted: 25. Cited in the ledger: 19.
  Cited groups: (1) Ford/Motorcraft documents (ford.com product pages, parts.ford.com PDF, fordservicecontent.com owner's manual PDF; the dealereprocess.org copy is a mirror of the same Ford PDF); (2) Ford-catalog relay sites, counted as ONE origin (fordpartsdeal, tascaparts, fordoempartsdirect, autonationparts, bluespringsfordparts); (3) Advance Auto Parts; (4) Batteries Plus; (5) Autopadre; (6) TruckPowered; (7) fourwheelask; (8) O'Reilly; (9) ford-trucks.com; (10) f150forum.com; (11) TowRatings; (12) CarCareKiosk (two pages, one origin); (13) GembaAutomotive; (14) KBB; (15) luffi; (16) Tohline; (17) TrueDelta/CarComplaints (TSB aggregators); (18) aftermarket sensor listings (brookealvinston/moveonup, same listing copy); (19) manualslib/manua.ls/fordownersmanual.org (owner's manual TOC mirrors).
  Consulted but not cited: f150gen14.com (wrong generation, 2021+), ebay.com, 2carpros.com, bolidenforum.de, americanmuscle.com, baterias.com.
- Facts by status tag, as printed by `scripts/f150-pilot/validate.mjs` (tools + parts + fluids + torque + steps only): `{"VERIFIED":0,"VERIFIED_SECONDARY":16,"SINGLE_SOURCE":11,"CONFLICT":2,"MISSING":5,"other":0}` = 34 rows.
- Facts by status tag in the `specs` array (NOT counted by the validator; counted by hand): VERIFIED 2, VERIFIED_SECONDARY 3, SINGLE_SOURCE 1, CONFLICT 2, MISSING 1 = 9 rows. Combined: VERIFIED 2, VERIFIED_SECONDARY 19, SINGLE_SOURCE 12, CONFLICT 4, MISSING 6 = 43 rows.
- Validator result for my file: 0 errors, 0 warnings (`2 guides, 0 error(s), 0 warning(s)` with guide 1 present from another author).

## Primary-source reachability (Ford documents)

Readable:
- `https://www.fordservicecontent.com/Ford_Content/Catalog/owner_information/2015-F-150-Owners-Manual-version-4_om_EN-US_08_2015.pdf` (Aug-2015 4th printing). Only ~121k characters of text come back, which ends near printed page 60. Read: table of contents (Jump Starting p.279, Changing the 12V Battery p.309), symbols glossary (Battery, Battery acid, Explosive gas, no smoking/flames/sparks), California Prop 65 lead warning, key-fob battery text. NOT read: battery location, "Changing the 12V Battery", "Jump Starting the Vehicle" bodies. Versions 2 (Feb 2015) and the dealereprocess.org May-2015 copy truncate the same way.
- `https://www.ford.com/product/vehicle-battery-p4000118066` (Motorcraft BXT65650: Group 65, 650 CCA, 3-year warranty; "Fits These Vehicles" list not captured).
- `https://www.ford.com/product/vehicle-battery-p4000013419` (BXT94RH7730: Group 94, 730 CCA; fitment not captured).
- `https://www.ford.com/product/vehicle-battery-p4000039379` (BXT36R) and `-p4000108127` (BXT40R) read but irrelevant.
- `https://parts.ford.com/content/dam/ford-parts/resources/motorcraftpdf/TESTED_TOUGH_MAX_Batteries.pdf` (Motorcraft Tested Tough MAX flyer: BXT 65-850 for "Heavy Duty Group 65 Applications"; no vehicle list).
- `https://www.fordservicecontent.com/Ford_Content/vdirsnet/OwnerManual/Home/Content?variantid=8440...` read, but it is a table-of-contents index for an unidentifiable (newer, SYNC 3/4 era) Ford variant; not used.

Not readable: any Ford page body with the replacement procedure, battery location, fitment list for this truck, torque specs, BMS reset text; ford.com support jump-start how-to (navigation only, JS-rendered). No Ford workshop manual page (414-01) for this truck was found; one for a 2014 Mustang exists on a third-party mirror and was not used.

Result: `primarySourceFound = false`.

## Key finding on the catalog claim

`src/data/vehicles.ts:148` says `Group size 65, ~750 CCA` for this truck. No independent 2015 F-150 fitment list contains Group 65. Ford-catalog relay (fordpartsdeal, 2015-17): BXT-48H6-610, BAGM-48H6-760, BAGM-94RH7-800, BXT-94RH7-730 plus covers for "48 series" and "94 series". Advance and Batteries Plus: Group 48/H6 and 94R/H7 only. Autopadre: H7 for the 2015 V6, H6 for the 2019 5.0L. TruckPowered: H7 for 2015, H6 for 2016-20, Group 65 for 2009-2014. Group 65 is confirmed for 2004-2008 (O'Reilly) and a 2005 truck (ford-trucks.com), and the Motorcraft Group 65 line exists (BXT65650/65750/65-850), so the number is probably a previous-generation carry-over (inference). Only fourwheelask (low quality, self-contradicting CCA figures) says some early 13th-gen trucks shipped with 65. Which of 48 or 94R, and what CCA/chemistry, the 5.0L XLT 4x4 uses is NOT settled by any source: left UNKNOWN. `~750 CCA` is not a Ford catalog rating for the model line (610/730/760 AGM/800 AGM) though it is close to 730/760.

## Readable but empty (cost of discovery)

ford.com support how-to pages (navigation only); ford.com product pages (fitment tab empty); kbb.com (no data); baterias.com (no data); several f150forum threads (fetch errors); retailer fitment lists that do not split by engine (Advance, Batteries Plus); aggregator pages with low reliability (fourwheelask, truckpowered).

## Donor comparison

Donors read: `tacoma-battery` (repairs-toyota-tacoma.ts:862), `rav4-battery` (repairs-toyota-rav4.ts:592), `jeep-grand-cherokee-battery` (repairs-jeep-wk2.ts:215), `gm-k2xx-battery` (repairs-gm-k2xx.ts:629). Classification of MY 15 steps:

| # | My step | Class | Why |
|---|---------|-------|-----|
| 1 | Confirm the battery is the problem | NO_DONOR | None of the four donors has a diagnose-first step. |
| 2 | Read old label, choose replacement | DIFFERENT_PROCEDURE | Donors state the group size ("Buy Group 24F/47/94R"); here no source settles it, so the step must be "read the label and match". |
| 3 | Prepare truck and yourself | REUSABLE_AS_IS | Tacoma 2 / GM 2 text carries over (adds the radio-code note). |
| 4 | Open hood, find battery, remove cover | NUMBERS_SWAPPED | Location text differs (Jeep is under the seat; Tacoma/RAV4/GM engine bay); side and cover for this truck unknown. |
| 5 | Disconnect negative first | NUMBERS_SWAPPED | Same step as Tacoma 3 / RAV4 3 / GM 3 / Jeep 4; donor "10 mm" cannot be reused (no size found). |
| 6 | Disconnect positive | NUMBERS_SWAPPED | Tacoma 4 / RAV4 4; nut size unknown; red cover only reported for 2004-08. |
| 7 | Release hold-down, lift out | NUMBERS_SWAPPED | Tacoma 4-5 / RAV4 4-5 / GM 4; hold-down size and geometry unknown. |
| 8 | Clean tray and cable ends | REUSABLE_AS_IS | Tacoma 5 / RAV4 5 / GM 5 are the same text. |
| 9 | Seat new battery, secure hold-down | NUMBERS_SWAPPED | Tacoma 6 / RAV4 6 / GM 6; RAV4's 14 ft-lb and GM's 13 ft-lb cannot be carried over (MISSING here). |
| 10 | Reconnect positive then negative | NUMBERS_SWAPPED | Tacoma 7 / RAV4 7 / GM 7; terminal torques removed. |
| 11 | Refit cover, optional protectant | REUSABLE_AS_IS | Protectant text matches Tacoma 8 / RAV4 8; the cover sentence is new but small. |
| 12 | Start truck, expect settings to need restoring | NUMBERS_SWAPPED | Tacoma 8 / RAV4 8 / GM 8 claim idle and transmission relearn; my sources only support presets, radio code and transmission adaptation, so the claim set is narrowed. |
| 13 | Battery monitoring reset (if equipped) | NO_DONOR | No donor has it. |
| 14 | Recycle old battery | REUSABLE_AS_IS | Tacoma 9 / RAV4 9 identical. |
| 15 | Tightening torques | REUSABLE_AS_IS | Tacoma's "Snug only, no figure published" pattern is the shape needed. |

Counts: REUSABLE_AS_IS 5 (steps 3, 8, 11, 14, 15); NUMBERS_SWAPPED 7 (4, 5, 6, 7, 9, 10, 12); DIFFERENT_PROCEDURE 1 (2); NO_DONOR 2 (1, 13). Total 15.

Surprises:
1. The donors' main reusable value is shape and safety text, not facts. Every donor hard-codes a socket size and a group size; for this generation I found neither the socket size nor an agreed group size.
2. The biggest evidence gap for the job is the Ford owner's manual body, which exists, is on a Ford host, and still cannot be read past page ~60 with the available fetch tool.
3. The egress proxy blocks curl to Ford hosts but WebFetch reaches them; WebFetch also refuses any URL that did not first appear in a search result (provenance rule), so discovery order matters.
4. Retailer fitment pages never split by engine, so engine-specific facts (5.0L) are structurally unreachable from them.
5. Ford's own catalog lists battery covers by series (48 vs 94), which is positive evidence that two sizes ship on this model line.

## Image needs (public/steps/*.svg: 23 files)

Files present: airbox-open, brake-caliper-remove, brake-inspect, brake-install, brake-lubricate, brake-piston-compress, cabin-filter-access, filter-airflow, generic-cleanup, generic-lower-vehicle, generic-park-secure, generic-raise-vehicle, oil-drain, oil-fill-check, oil-filter-cartridge, oil-filter-install, oil-filter-spinon-remove, tire-inspect, tire-rotation-fwd, tire-rotation-rwd, wheel-torque, wiper-arm-lift, wiper-blade-release. None is battery-specific. The donors use `generic-park-secure.svg` and `generic-cleanup.svg` as placeholders on battery steps.

| Step | Image need |
|------|-----------|
| 1 | NONE_NEEDED (text only) |
| 2 | NEW_BESPOKE (proposed visual `f150-battery-label-identify`) |
| 3 | GENERIC (generic-park-secure.svg) |
| 4 | NEW_BESPOKE (`f150-battery-bay-locate`; evidence cannot support the engine-bay side or cover shape, so depiction must stay non-positional) |
| 5 | NEW_BESPOKE (`f150-battery-cable-order-do`) |
| 6 | NEW_BESPOKE (same visual as 5) |
| 7 | NEW_BESPOKE (hold-down geometry unknown; no visual proposed, blocked by evidence) |
| 8 | GENERIC (generic-cleanup.svg, as donors do) |
| 9 | GENERIC (generic-cleanup.svg, as donors do) |
| 10 | NEW_BESPOKE (same visual as 5/6) |
| 11 | GENERIC (generic-cleanup.svg) |
| 12 | NONE_NEEDED |
| 13 | NONE_NEEDED |
| 14 | GENERIC (generic-cleanup.svg, as donors do) |
| 15 | NONE_NEEDED |

Counts: GENERIC 5, NEW_BESPOKE 6 steps (3 visuals proposed, step 7 unserved), NONE_NEEDED 4.

## Defects in existing proven pieces (genuine, with reason)

1. `src/data/vehicles.ts:148`: `{ label: "Battery", value: "Group size 65, ~750 CCA" }` for `2015-ford-f150-5.0l`. Genuine defect: no independent 2015 F-150 fitment list contains Group 65 (see above); every list read shows Group 48/H6 and 94R/H7; the Group 65 evidence is for 2004-2014 trucks. A customer-facing spec built on it can send someone to the parts counter for the wrong battery. It should be treated as unverified and replaced by "read the old battery's label" until a Ford document or VIN-level fitment settles it.
2. `src/data/vehicles.ts:216` and `:283`: 2020 Silverado 1500 5.3L and 2020 Sierra 1500 5.3L both say `Group size 78 (H6), ~730 CCA`. Genuine defect (internal contradiction): "78" and "H6" are different standards (H6 = Group 48; 78 is a GM side-terminal size), and `src/data/repairs-gm-k2xx.ts:633,658` says these V8 trucks take Group 94R/H7, 800 CCA and that a Group 48 "will sit loose in this tray". The catalog and the guide cannot both be right.
3. `src/data/repairs-gm-k2xx.ts:690` and `:697`: `torque: [{ fastener: "...", value: "" }]` empty-string values in the shared `gm-k2xx-battery` guide, while the step text on `:689` and `:696` prints "about 13 ft-lb (18 Nm)" and "about 11 ft-lb (15 Nm)", and the per-vehicle notes at `:720-744` call these "Reference figure from a single published procedure". Genuine defect: a single-source number is shown as an instruction in the shared text, and empty torque rows can render blank. This contradicts the pilot rule that a number needs 2+ independent hosts.
4. `src/data/repairs-jeep-wk2.ts:244` and `:250` ("5 ft-lb (7 Nm)", "9 ft-lb (12 Nm)") are "Curated reference figure ... Confirm against the factory service manual". Friction rather than a proven defect: the rows are labelled as unverified, but numbers are printed with no evidence status, which the BMW pipeline explicitly avoids.

Friction (not defects, recorded for the pilot):
- `scripts/f150-pilot/validate.mjs` counts tags only over `tools/parts/fluids/torque/steps`; `specs` rows are never validated or counted, and the BMW validator never checks `specs` statuses. In my ledger that is 9 of 43 rows.
- `scripts/bmw/validate-evidence.mjs:10-64`: only torque rows are checked for host counts. A step, tool or part can be VERIFIED with `sources: []` and pass. The "2+ hosts" test counts hostnames, not origins, so two mirrors of one catalog satisfy it (the Ford-catalog relay sites here are five hosts, one origin); the rule that copying hosts are one origin is enforceable only by author discipline.
- `scripts/bmw/validate-evidence.mjs:15` HARDWARE regex `/...|tab/i` also matches "table", "stable", "portable" etc., so an element id such as `battery-table` would be forced to non-cosmetic. No hit here, but it is a false-positive risk.
- `scripts/bmw/validate-evidence.mjs:31` hard-codes "expected 16 guide files"; the pilot wrapper filters that one message (already known friction).
- Tooling: the owner's manual PDF is unreadable past ~page 60 through WebFetch, which makes `primarySourceFound` depend on the fetch tool's extraction limit, not on whether Ford published the answer.

## Confidence caveats

- Nothing in this ledger is verified against Ford service data. No Ford workshop manual, owner's manual procedure page, TSB text or recall text for this truck was read.
- High confidence: Group 65 is unsupported for the 2015 F-150; Group 48/H6 and 94R/H7 are the sizes retailers and Ford catalog data list; negative-off-first/negative-on-last and match-the-old-label are consistent across sources.
- Low confidence: battery position (side), tray and hold-down, tool sizes, CCA/chemistry for the 5.0L, whether the truck has a battery sensor, whether a reset is needed, what resets after power loss, and any torque.
- Several steps rest on previous-generation how-tos (O'Reilly 2004-08, CarCareKiosk 2013); step text marks them.
- Two of my sources are low quality (fourwheelask, TruckPowered) and were used only as weak or corroborating evidence, never alone for a fact.
- Absence of Group 65 from retailer lists is weaker evidence than a statement; the ledger says "unsupported and contradicted by lists", not "proven false".
