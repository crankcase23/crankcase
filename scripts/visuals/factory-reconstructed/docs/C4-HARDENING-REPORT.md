**THIS GUIDE FACTORY IMPLEMENTATION IS RECONSTRUCTED FROM SURVIVING EVIDENCE. IT IS NOT THE LOST ORIGINAL IMPLEMENTATION.**

# C-4 — Factory hardening report (2026-10-04)

Scope: isolated reconstruction only. Not integrated with Crankcase main (live GitHub still returns 403), Phase 1 untouched, Maze/LilithVoice untouched, nothing deployed or merged, `recovered/` bytes unchanged (SHA256SUMS verify).

## Locked policies — implemented
| lock | implementation | where |
|---|---|---|
| 1 ARCHITECTURE_V1 canonical; provenance rejection burns no cycle | `POLICIES.ARCHITECTURE_V1` non-provisional; non-canonical = any deviation in the three behavior fields (renaming does not launder it); needs `allowNonCanonical`; `policy.json` written at init; `approve()` refuses non-canonical (`POLICY_NON_CANONICAL`); verifier flags it; policy of an existing run cannot change (`POLICY_MISMATCH`) | `src/policy.mjs`, `src/machine.mjs`, `src/verify.mjs` |
| 2 Claude may do internal QA; Hermes is the independent final reviewer | new actor `hermes`; `submitQA` = internal (claude-qa only); `submitIndependentReview` = hermes only, refused if actor/model/system looks Claude-family; QR carries `reviewClass`; new phase `INTERNAL_QA_PASSED`; `admit()` and `approve()` require an independent PASS (gate `independentFinalReview`); overlay review must be independent | `src/qa.mjs`, `src/machine.mjs`, `src/artifact.mjs` |
| 3 Retry cap 3 → NEEDS_ANDY, labelled NEW | initial submission + 3 resubmissions; the 4th rejected submission escalates; label stored in `policy.mjs`, `policy.json`, docs | `src/policy.mjs` |
| 4 Step 10 conflicts, no guessing | nine OPEN rows from the five sources, every quote verified verbatim by test | `docs/STEP10-CONFLICT-TABLE.md`, `charger-step10/conflicts.mjs` |
| 6 Step 10 evidence package | AVAILABLE / MISSING / CONFLICTING / REQUIRES HUMAN DECISION, each with owner, acceptance check, blocking code | `docs/STEP10-EVIDENCE-PACKAGE.md` |

## Regressions added (`tests/hardening.test.mjs`)
Each starts from a verified-clean run and attacks it, including forgeries that are re-sealed and re-chained so structural hashes all pass: corrupted reference hash (cross-ref, event ref, SHA256SUMS line); mutated recovered contract file (harness now verifies SHA256SUMS before bundling); duplicate evidence ids (references, ledger rows, mustNotDepict, elements, QA checks, object ids on disk); broken event-chain link (edited, deleted, and consistently re-chained); out-of-order events; admitted output without provenance; artifact bytes no longer matching the manifest; normalization changing dimensions; QA verdict tampering; correction delta citing a nonexistent prior artifact; the fourth metadata retry; Claude self-QA presented as independent; provenance rejection consuming a cycle. No test asserts a test count or any historical number.

## New bugs / weaknesses found while hardening
1. **The verifier checked hashes, not history.** A chain-valid, hash-valid directory could contain an out-of-order or semantically impossible history (e.g. APPROVED straight after VC_LOCKED, GEN_ACCEPTED on a rejected generation). Fixed: replayed transition legality.
2. **QA verdict was trusted after the fact.** Verdicts were computed at submission but never recomputed; a re-sealed QR with a flipped verdict verified clean. Fixed: verdict + failedGates recomputed from the QR's own checks/findings.
3. **Provenance was checked once, at submission.** A forged attestation on an admitted generation verified clean. Fixed: provenance re-checked from the stored bytes for every generation and every admission.
4. **`protected[].priorPassRef` was never validated.** A correction delta could cite a prior pass that does not exist. Fixed in `cdProblems` and the verifier.
5. **Duplicate object ids on disk were silently collapsed** by the store (last file wins). Fixed: duplicates and file-name/id mismatches are flagged.
6. **Duplicate ledger rows / mustNotDepict ids / QA check ids were accepted.** Fixed.
7. **Re-chained history was undetectable.** A consistently rebuilt event chain verified clean. Fixed for approved runs: the registry preview pins the event-log head. Pre-approval tail truncation remains undetectable by a chain alone (U-24).
8. **Mutating a recovered file changed what the harness bundled**, silently. Fixed: integrity check before bundling.
9. **The normalizer trusted its resizer.** Added the dimension post-condition (plus a test seam).
10. **Policy could be bypassed by renaming** an override. Fixed: canonical is decided by behavior fields, not name.

## Mutation testing (2026-10-04)
21 mutants of the new logic. 18 caught first run; 1 survivor killed by a new assertion (only `hermes` may be independent); 1 string-mismatch re-run by hand and caught. 2 survivors are redundant defense-in-depth layers (normalizer's second dimension check; `admit()`'s own independent-review check, duplicated by the phase gate, `approve()` and the verifier).

## Not done / still open
Live GitHub still 403: nothing about current main, Neon, or deployment is known. U-22 (retry-cap counting), U-23 (Hermes strings), U-24 (truncation), U-04, U-15, and the nine Step 10 conflicts remain OPEN. No generation of any Step 10 image was attempted.

## Ready for live-main integration when GitHub returns?
**Not yet.** The factory is ready to be *evaluated* against live main (it is isolated, hardened, 116 deterministic tests green), but integration needs: (1) GitHub read access; (2) a diff of live main's `scripts/visuals` and registry against `recovered/` (the export is an early revision); (3) Hermes confirming reviewer strings (U-23) and Andy confirming U-22; (4) the original SVG/photo paths are not reconstructed (U-18), so any live path other than generated-raster still needs the original code if it survives.
