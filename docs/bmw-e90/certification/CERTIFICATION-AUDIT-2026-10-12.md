# 2010 BMW 328i (E90) guide certification audit, initial pass (2026-10-12)

Vehicle: 2010 BMW 328i sedan, automatic, rear-wheel drive (LCI build, 09/2009 onward; N52 most likely, N51 SULEV possible).
Scope: all 16 guide categories, as a signed-in owner sees them (customer catalog resolved through the configuration resolver), plus the admin drafts.
Nothing here touches Production, the database, or any feature flag.

## Bottom line

- **Certified: 0 of 16.** No BMW document (TIS, Bentley, full owner's manual) was reachable, so every torque, capacity and fluid spec is secondary-source (two or more independent sites at best). That alone blocks certification of every guide. Boss's review is the way through it.
- **Audit result after corrections: 13 PASS-WITH-NOTES, 3 FAIL (open items need a decision).** Failures: Rear Brake Pads, Battery Replacement, PCV / Crankcase Ventilation.
- **Ten real defects were found and corrected, each with a permanent regression test** (13 new audit tests; the 11 defect and drift tests fail on the old guides and pass on the corrected ones). The two sweep tests passed on the old guides, which is useful evidence: no configuration ever leaked a figure or procedure from a withheld step.
- Sources of defects: internal contradictions (blocked procedures leaking elsewhere in the same guide), a wrong-engine part number, steps in an impossible order, a mislabelled code list, a short shopping list. None were wrong torque numbers: nothing here could be proved wrong against a BMW document, because none could be read.

## What was run

| Check | Result |
|---|---|
| Evidence ledger validation (`npm run bmw:validate`) | 16 guides, 0 errors, 1 pre-existing warning (guide 3 has no visuals, by design) |
| BMW unit and regression tests (`npm run bmw:test`) | 84 / 84 pass (71 existing + 13 new audit tests; one existing pipeline test was updated, see #11) |
| Configuration tests (`npm run config:test`) | 29 / 29 |
| VIN tests (`npm run vin:test`) | 38 pass, 1 skipped (needs a scratch server), 0 fail |
| DB tests (`npm run db:test`) | 4 / 4 |
| Browser tests on a local production build, scratch database | 101 / 101: all 16 admin drafts walked in Wrench Mode at desktop and phone width (planning, wrench walk, blocked steps, completion, recovery), the customer Automatic+RWD walkthrough, and the full vehicle-configuration suite (restricted and unavailable behaviour, all 16 categories under every configuration) |
| Source audit | 4 independent reviewers, 4 guides each, web research only (no BMW documents reachable), findings re-checked against the generated guides before any change |

## Defects corrected (all with regression tests in `scripts/bmw/tests/certification-audit.test.mjs`)

| # | Guide | Defect | Fix | Test |
|---|---|---|---|---|
| 1 | Fuse & Bulb | The guide blocks xenon work (BMW: BMW center only) yet still listed the xenon tool kit (T20/T30, LUX retrofit liner route, cap-tab pliers), sold the D1S burner and the adaptive-only H3 bulb, and steps 11-12 described a finned-cap route for xenon cars | Removed from tools, parts and steps; the H7 and parking/halo steps now open with "Halogen headlights only: if your car has xenon or adaptive headlights, stop"; safety note fixed | AUDIT-01 |
| 2 | Serpentine Belt | The idler replacement is BLOCKED, but the inspect step said "replace tensioner and idler together (kit recommended)", the tool list carried the 16 mm idler socket, and the parts list sold the idler pulley and caps | Removed; inspect step now sends a worn idler to a BMW-qualified shop; kit row labelled | AUDIT-02 |
| 3 | Engine Air Filter | Part 13717556961 is the N54 element (335i, 135i, Z4 35i per BMW UK parts listing), not the N52; the closing step said "refit the six screws" while the research says six or seven | Part removed; step says "every screw you removed" | AUDIT-03 |
| 4 | Front Brake Pads | The optional rotor-replacement branch came after the caliper was refitted (it needs the carrier off) and then said "continue from step 12"; the retract step clamped "against the old inner pad" after the pads were already out; a rear-axle "leave the parking brake off" sentence sat in the front job | Branch moved to directly after the rotor inspection; retract step uses the old pad as a spacer; sentence removed; visual step map carried with the move | AUDIT-04 |
| 5 | Front Brake Pads | Steps hard-coded wear sensor 34356789440, which is only for cars built up to 03/2010; cars built from 03/2010 (roughly half of model-year 2010) need 34356792560 | Steps give both numbers by build date and point to the door-jamb label or a VIN check | AUDIT-05 |
| 6 | Oxygen Sensor | Said P0031, P0037, P0051 and P0057 are typical bank 2 sensor 1 codes. In OBD-II numbering they are four different sensors | Rewritten: use the bank and sensor the scan tool reports | AUDIT-06 |
| 7 | Coolant | Asks for a ~9 L 1:1 fill (about 4.5 L concentrate) but listed one 3.8 L gallon | Row says one gallon is not enough and points to the 1 L bottle or a second gallon | AUDIT-07 |
| 8 | Differential Fluid | Safety says BMW-approved gear oil only, parts list sold a Red Line oil kit | Kit removed | AUDIT-08 |
| 9 | Battery | No recycling / core-return line; jump-start warning did not say "engine-bay terminal only" | Two safety lines added | AUDIT-09 |
| 10 | Engine Air Filter, Serpentine, Battery (admin draft) | Doubled brand words in customer text ("BMW's BMW service manual", "BMW BMW parts catalog") | Reworded | AUDIT-10 |
| 11 | (test suite) | The image-pipeline test could not accept the owner-approved oil-drain-hatch run, so regenerating the report (as the README says to) failed it. The committed report predated the owner's sign-off in c412b2f | Test now allows APPROVED only with `owner-approval.json` present | existing test, updated |

Two sweep tests were added: every guide x nine saved configurations (not set, not sure, partial, xDrive, manual, automatic+RWD): steps stay numbered 1..n, no dangling "step N", withheld steps carry no figure, part number or procedure, an unavailable guide shows one stop step and no tools, parts or torque, blocked steps are identical in every configuration and carry no tool size or procedure.

## PASS / FAIL by guide

"Audit result" = my audit after corrections. "Certified" is NO for all, see blockers.

| # | Guide | Audit result | Corrected here | Still open (for Boss or evidence) |
|---|---|---|---|---|
| 1 | Front Brake Pads | PASS-WITH-NOTES | #4, #5 | Stand policy differs from Tire Rotation (see B5); carrier bolts 110 Nm (one forum says about 80); rotor screw hex 6 mm vs 5 mm and its 16 Nm have no E90 source; rotor numbers 34118848417 vs 34116792219 ordering; whether carrier bolts must be renewed |
| 2 | Fuse & Bulb | PASS-WITH-NOTES | #1 | Parking/halo bulb type disputed (guide says match the old bulb); high-beam bulb type on xenon cars unknown (now gated to halogen); fog-lamp route is single-source; 50 A and 60 A fuses listed although not in the glove box (minor) |
| 3 | Key Fob Battery | PASS-WITH-NOTES | none needed | Part numbers 66126912985 and 61319217643 unverified; CR2032 orientation undocumented; re-sync caveat wording; steps 1 and 2 repeat each other |
| 4 | Oxygen Sensor | PASS-WITH-NOTES | #6 | 50 Nm secondary only; shield E8 screws and strut-brace torques not found; pre-cat lead lengths unsupported; tie-rod note is about bank 1 sensor 2 on the source thread; add 5 mm Allen for the engine cover; consider a "check the shared O2 fuse if all four heater codes appear" note (one source) |
| 5 | Rear Brake Pads | **FAIL (open)** | none | Guide-screw size and torque unresolved (13 mm / 35 Nm in one source, 7 mm hex expected from the part number being shared with the front); "Method B preferred" because its torque is better documented, not because it is the better job; handbrake shoe adjustment after a rotor change is missing; no "put it in Park"; stand policy (B5) |
| 6 | Serpentine Belt | PASS-WITH-NOTES | #2, #10 | Idler bolt torque conflict (40 vs 80 Nm, BMW erratum unreadable) is why the step stays blocked; tensioner lock-pin order unclear; "retaining disc on the new pulley" vague |
| 7 | Battery Replacement | **FAIL (open)** | #9, #10 | Part 61216806755 ("Original BMW AGM 92 Ah") is listed first but fitment is unsupported for this car and the research says the probable factory battery is 80 Ah flooded; safety-terminal wording; the registration menu path and the claim that phone apps can register an E-series battery are unsupported |
| 8 | Coolant Flush & Fill | PASS-WITH-NOTES | #7 | Capacity unconfirmed (8.1 to 8.4 L here, 10 L in an E60 document); sources conflict on headlights during the bleed cycle; add "do not press the brake when starting" and chocks |
| 9 | Fluid Checks & Top-Offs | PASS-WITH-NOTES | none | Transmission fluid grade unverified (GM-built unit, Dexron-type, exact grade not confirmed); iDrive path needs "if equipped"; 6.0 L washer capacity and "125 miles" figure unsupported |
| 10 | Cabin Air Filter | PASS-WITH-NOTES | none | "Driver's side" claim unsupported; add "clean the housing before closing"; screw type if one is lost; airflow-arrow direction unsupported |
| 11 | PCV / Crankcase Ventilation | **FAIL (open)** | none | Access is understated: sources say the cowl, cabin-filter housing and plenum come off to reach the back of the valve cover, but the guide says remove the engine cover only; hose replacement has more than one connection (some under the intake manifold) and is described as two tabs. Decide: re-scope step 7 as a shop job, or write the full access procedure |
| 12 | Engine Air Filter | PASS-WITH-NOTES | #3, #10 | Airbox location wording conflicts between its sources; silicone tip is one Z4 poster; MAF-safe cleaner wording |
| 13 | Tire Rotation | PASS-WITH-NOTES | none | Stand policy contradicts the brake guides (B5); the car is probably staggered (225/45R17 front, 255/40R17 rear on the Sport Package): lead with "read the sidewalls"; TPMS menu paths conflict; style 285 wheel identity unconfirmed |
| 14 | Wiper Blades | PASS-WITH-NOTES | none | Release direction conflict (already flagged in the step); alternative set 61612468941 unsupported |
| 15 | Differential Fluid | PASS-WITH-NOTES | #8 | Add the jack/chock cross-reference; capacity 1.0 vs 1.2 L (guide says fill to the plug); 60 Nm secondary |
| 16 | Engine Oil & Filter Change | PASS-WITH-NOTES | none | 6.5 L, 25 Nm cap and plug are secondary (three or more sites agree); "if equipped" on the iDrive route; chock and parking-brake line before lifting; the "26-29 mm hex cap" aside is probably the tool's drive hex, not the cap (86 mm, 16-flat is what the tool listings say) |

## Certification blockers

1. **B1: No BMW primary document for any spec.** Every torque, capacity, fluid grade and interval needs a TIS or Bentley line. Boss can pull these, or the owner can supply a TIS subscription window. Until then nothing can be certified.
2. **B2: Rear Brake Pads**, items above (guide-screw size/torque, Method B default, handbrake adjustment).
3. **B3: Battery** part-number fitment and AGM vs flooded for this car.
4. **B4: PCV** scope: shop job vs full access procedure.
5. **B5: One jack-stand policy.** Tire Rotation says no stand position is known and to use a lift; the brake guides put the stand under the factory side pad. Both cannot be the customer's instruction. This is a safety wording decision for Boss; I did not change either.
6. **B6: Build facts the guides depend on** (engine code N51 vs N52, key type, headlight type, build date relative to 03/2010) are checked by the owner on the car; the guides already say so.
7. **B7: Not yet done:** real-device checks (iOS Safari, camera), Preview-deployment end-to-end with a disposable account.

## Wrench Mode and restricted steps

- Walked start to finish in a browser for all 16 guides at desktop and phone width, with blocked steps, completion and recovery: 101 / 101.
- Blocked steps (Fuse & Bulb engine-bay fuses and xenon bulb; Serpentine idler) stay visible as a stop in every configuration, with the reason and the safe alternative and no procedure.
- Unconfirmed configuration: steps that depend on transmission or drivetrain show "RESTRICTED" with no procedure and no number. A confirmed build the research does not cover (manual or xDrive) gets one "NOT AVAILABLE" stop and no tools, parts or torque.
- Usability findings (minor, not changed): several steps still run to four or five sentences; the "(part 1 of 2)" step titles are clear in Wrench Mode but read oddly in Planning Mode.

## Out of scope and untouched

Production, Preview, database, feature flags, branch protection, other branches. The audit branch is `claude/bmw-328i-certification-audit`, cut from `origin/main` at the PR #56 merge.
