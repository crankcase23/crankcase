**THIS GUIDE FACTORY IMPLEMENTATION IS RECONSTRUCTED FROM SURVIVING EVIDENCE. IT IS NOT THE LOST ORIGINAL IMPLEMENTATION.**

# Charger #001 Step 10 — proving run report

Fixture only. Nothing published, nothing integrated, nothing fabricated. Produced by `npm run prove:charger-step10`; output committed under `charger-step10/output/`.

**Does Step 10 pass? NO.** Stages 2-11 are BLOCKED by missing evidence/artwork. The factory correctly refuses to proceed; it was not forced green.

| stage | status | evidence tag | detail |
|---|---|---|---|
| 0 recovered inputs intact | **PASS** | RECOVERED | 6 surviving Step 10 inputs match SHA256SUMS |
| 1 visual specification intake | **PASS** | RECOVERED-FROM-DOCUMENTATION | parsed handoff prompt: 6 ranked must-show, 8 may-simplify, 16 must-not-show, no-text=true, clear space [{"band":"top","fromPct":3,"toPct":17},{"band":"bottom","fromPct":83,"toPct":97}], 16:10 >= 1600x1000 |
| 1b cross-source consistency (diagnostic) | **PASS_WITH_CONFLICTS** | RECONSTRUCTED diagnostic | 2 headline conflict(s) detected by the diagnostic; the full 9-row Step 10 source-conflict table (docs/STEP10-CONFLICT-TABLE.md, charger-step10/conflicts.mjs) is OPEN for Andy/Hermes; none resolved here |
| 2 reference evidence intake | **BLOCKED** | UNKNOWN (lost) | 0 reference items survive for Step 10 (the older manifest's raw.source/sourceRef are empty; the V3 spec and its reference list are lost). Nothing was invented. |
| 3 evidence ledger | **BLOCKED** | INFERRED | ledger candidates derived from the prompt, all marked not-established (omit); hero/target existence+location are NOT established |
| 3b EP sufficiency (objective gate) | **BLOCKED** | VERIFIED FROM DOCUMENTATION (rule) + reconstructed code | EP INSUFFICIENT: EP_NO_REFERENCES, EP_HERO_NOT_ESTABLISHED (15 problems) |
| 4 visual contract compile/lock | **BLOCKED** | reconstructed code | refused WRONG_STATE: WRONG_STATE: compileContract not allowed in phase EP_INSUFFICIENT (needs EP_SUFFICIENT) |
| 5 generator abstraction / generation capture | **BLOCKED** | UNKNOWN (lost) | no generator output: no candidate.png + candidate.claims.json in charger-step10/drop. No generated Step 10 image survives; V3/V4 artwork and the draft PNG are lost. Run is not in a state that allows a generation request. |
| 6 provenance checks | **BLOCKED** | n/a | no candidate to check. Stage logic is exercised on SYNTHETIC fixtures in tests/, never on Step 10. |
| 7 no-source-pixels / generator attestation | **BLOCKED** | n/a | no candidate attestation exists. Stage logic is exercised on SYNTHETIC fixtures in tests/, never on Step 10. |
| 8 admission/rejection gate | **BLOCKED** | n/a | no candidate to admit. Stage logic is exercised on SYNTHETIC fixtures in tests/, never on Step 10. |
| 9 normalization | **BLOCKED** | n/a | no admitted candidate. Stage logic is exercised on SYNTHETIC fixtures in tests/, never on Step 10. |
| 10 QA (CG-QA-v1.0 content + overlay) | **BLOCKED** | n/a | no admitted candidate and no independent QA result. Stage logic is exercised on SYNTHETIC fixtures in tests/, never on Step 10. |
| 11 final artifact / manifest | **BLOCKED** | n/a | nothing admitted; no AA can exist. Stage logic is exercised on SYNTHETIC fixtures in tests/, never on Step 10. |
| 12 event log + directory integrity | **PASS** | reconstructed code | 2 events, 2 objects, problems=0 |
| 13 recovered visual-contract layer integration | **PASS** | RECOVERED code (unmodified) | recovered resolver bundles and runs; recovered registry holds 0 visuals; resolveStepVisuals(step 10) -> 0 visuals (shows nothing, as the recovered design requires). Accepting a reconstructed record is proven on SYNTHETIC fixtures in tests/recovered-integration.test.mjs. |

## What the pipeline CAN reproduce from surviving evidence
- Visual specification intake from the Step 10 handoff prompt (framing 16:10 >= 1600x1000, 6 ranked must-show items, 8 may-simplify, 16 must-not-show, no-text clause, clear-space bands 3-17% / 83-97%).
- The objective evidence gates: an EP with no references and unestablished hero/target facts is correctly declared INSUFFICIENT and the run stops there.
- An intact, verifiable event log + directory for the blocked run.
- Integration with the RECOVERED visual-contract layer (it loads unmodified; the recovered registry correctly shows nothing for step 10; reconstructed approvals on SYNTHETIC fixtures are accepted/refused exactly as the recovered resolver dictates).

## Where evidence is missing (and therefore where it is blocked)
- **Reference evidence for Step 10: none survives** (V3 spec and its reference list are lost; the older manifest has empty source fields).
- **Ledger facts**: only candidates (all not-established) can be derived from the prompt, saved as `charger-step10/output/ledger-candidates.INFERRED.json`.
- **Generated artwork / V3 / V4 / draft PNG**: none survives. No generator output, no attestation, no QA result.

## Conflicts found between surviving sources (reported, not resolved)
- **U-10a**: Guide step 10 text names hose grommet + resonator, but the Step 10 prompt lists them under MUST NOT SHOW — UNRESOLVED -> NEEDS_ANDY
- **U-10b**: Older Step 10 manifest lists 'Retaining grommet' as a callout target; the handoff prompt excludes the grommet; the shot-list slot has no grommet but adds 'Intake hose' — UNRESOLVED -> NEEDS_ANDY

## Does the recovered visual-contract layer integrate cleanly?
Yes, for the parts that can be exercised: the recovered `guideVisuals.ts` bundles and runs unmodified (one type-only stub for the un-recovered `Vehicle` types), and it accepts a reconstructed, QA-passed, Andy-signed raster record while refusing 16 independent tampering cases with its own messages (tests/recovered-integration.test.mjs). That proves shape and rule compatibility on SYNTHETIC data only. It does not prove a real Step 10 image would pass: there is none.

## To unblock Step 10 (inputs only a human/other system can supply)
1. The reference list for the intake-duct step (real OEM figure/text references with sourceRef + what each establishes), or a decision to start the research over.
2. Andy/Hermes decisions on the nine rows of docs/STEP10-CONFLICT-TABLE.md (CF-01…CF-09; supersedes U-10a/U-10b).
3. A generator output (candidate.png + candidate.claims.json) dropped into `charger-step10/drop/`, produced from the compiled contract — only possible after 1.
4. An independent (Hermes) QA result and Andy's sign-off. The exact checklist is docs/STEP10-EVIDENCE-PACKAGE.md.
