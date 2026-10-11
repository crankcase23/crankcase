**THIS GUIDE FACTORY IMPLEMENTATION IS RECONSTRUCTED FROM SURVIVING EVIDENCE. IT IS NOT THE LOST ORIGINAL IMPLEMENTATION.**

# C-5 — Step 10 canonicalization report (2026-10-04)

Scope: isolated reconstruction. No artwork generated. Not integrated with stale main, Phase 1 untouched, Maze/LilithVoice untouched, nothing deployed or merged, `recovered/` unchanged (SHA256SUMS verify).

## Locks applied
1. **U-22** — canonical: initial submission + up to 3 resubmissions; 4th rejection → NEEDS_ANDY. Behavior unchanged; label now says canonical (policy.mjs, policy.json). Test: c5-locks #1.
2. **Independent reviewer** — Hermes / ChatGPT / GPT-5.6 Sol. New strictness: actor hermes + GPT/ChatGPT model string + Hermes/ChatGPT/OpenAI system string + sha256 of the raw response, re-validated by the verifier. Honest limit: the factory cannot prove authorship; relabelling a Claude result fails, a wholesale forgery of every field would not (the raw-response hash is there so Andy can audit it against the real transcript).
3. **Ownership** — project asset subject to the provider's usage rights; recorded as `assetClass` + `rightsBasis` + provider terms; `ownershipAsserted` stays false; missing terms or any ownership claim is a provenance rejection (GR_LICENSE_TERMS / GR_OWNERSHIP_CLAIM / GR_ASSET_CLASS). The recovered resolver still accepts the record.
4. **U-24** — kept OPEN. A test records the known gap (truncated, re-chained, unapproved history verifies clean).

## Deliverable
`docs/STEP10-CANONICAL-SPEC.md` (generated from `charger-step10/canonical-step10.mjs`): the proposed canonical contract, nine resolutions, terminology dictionary, representation rules, evidence and QA requirements, the eight vehicle-verification items (VV-01…VV-08), withdrawn legacy constraints, readiness, deterministic brief.

## Regressions (tests/step10-canonical.test.mjs)
One family per CF-01…CF-09: reintroduce the old contradiction into the canonical content and the oracle must name it. The OLD prompt/manifest/shot-list wording is also run through the oracle and must trip CF-01…CF-08. A resolution↔regression linkage test fails if any resolution loses its regression. Mutation check: 10/10 mutants of the oracle and the new locks killed.

## Where the priority rule overrode old wording (needs your explicit acceptance)
Grommet shown (was banned); resonator part of the hero (was banned, 'no seam' withdrawn); clamp tightening point visible (was turned away); connector fully visible (was partly hidden). In each case the guide's own action requires it. None of these draws a fact from memory: all remain gated by reference evidence (VV-01…VV-05).

## Ready?
Ready to gather reference evidence: YES. Ready for image generation: NO (no references; VV-01…VV-08 unverified; acceptance of the proposal pending).
