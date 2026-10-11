**THIS GUIDE FACTORY IMPLEMENTATION IS RECONSTRUCTED FROM SURVIVING EVIDENCE. IT IS NOT THE LOST ORIGINAL IMPLEMENTATION.**

# Charger #001 Step 10 — evidence package for a legitimate proving run

Produced in C-4 under Andy's lock #6. This is the exact checklist of what a legitimate Step 10 proving run needs. **No substitute evidence was fabricated to get a green result**: today the run stops at evidence sufficiency, correctly. `tests/step10-evidence.test.mjs` checks that AVAILABLE items exist and are intact, MISSING items are really absent, and every blocker code named here is one the factory actually emits.

## AVAILABLE — Available

### A-01 — Guide step 10 text (five actions) and step 2 (engine cover)
- Where: `recovered/src/data/admin-test-guides/charger-2016-sxt-multi-job.ts`
- Caveat: Recovered code. It is the canonical step text, but see CF-01…CF-08 for where other sources disagree with it.

### A-02 — Step 10 image prompt (spec for a text-only generated raster)
- Where: `recovered/doc-derived/step-10-handoff-prompt.txt`
- Caveat: DOCUMENTATION-DERIVED: the original prompt file is lost; this is the text a report quoted. It is a SPEC, not evidence about the car.

### A-03 — Old Step 10 manifest (PENDING — empty photo-route skeleton)
- Where: `recovered/visual-sources/2016-dodge-charger-sxt-36/step-10-intake-duct.manifest.json`
- Caveat: Contains no source, licence or verification; useful only for its callout list and component string.

### A-04 — Shot-list slot for step 10 and the recovered (empty) Charger visuals registry
- Where: `recovered/src/data/guide-visuals/charger-2016-sxt-multi-job.ts and recovered/src/data/guide-visuals/charger-2016-sxt-multi-job.visuals.json`
- Caveat: Registry holds 0 visuals; step 10 shows nothing today.

### A-05 — Recovered contract layer (types, resolver rules, callout rules) and vehicle registry
- Where: `recovered/src/types/guideVisuals.ts, recovered/src/lib/guideVisuals.ts, recovered/scripts-visuals/lib.mjs, recovered/visual-sources/applications.json`
- Caveat: Unmodified; hashes verified against SHA256SUMS before every harness run (C-4).

### A-06 — The reconstructed factory itself (pipeline, canonical policy, independent-review path, replay verifier) and its tests
- Where: `src/, tests/`
- Caveat: RECONSTRUCTED, not the lost original. Proven on SYNTHETIC fixtures only.


## MISSING — Missing (not fabricated; each has an owner and an acceptance check)

### M-01 — At least ONE real reference item for the intake system (OEM figure/text, parts-catalog entry, third-party guide, or an Andy-supplied photo), each with kind, source, sourceRef that lets a reviewer re-open it, rights, and what it establishes
- Who supplies it: Andy (or claude-research from a source Andy approves)
- Acceptance check: referenceProblems() clean for every item; usage is reference-only or corroborating-text (never an image input); ids unique
- Why it is MISSING: recovered manifest raw.source/sourceRef are empty; V3 spec lost
- Blocks: 2 reference evidence intake / EP sufficiency — codes: `EP_NO_REFERENCES`

### M-02 — ESTABLISHED ledger rows (existence + location, each citing a real reference id) for every hero/target element that survives the conflict decisions: under the C-5 proposed contract: intake hose/resonator assembly, throttle-body clamp, air-cleaner-housing clamp, IAT connector, retaining grommet, throttle body, air-cleaner housing (canonical EP skeleton: charger-step10/canonical-step10.mjs canonicalEPSkeleton). The IAT connector's position appears only in the old prompt, with no evidence behind it
- Who supplies it: claude-research, from M-01
- Acceptance check: sufficiencyProblems() empty: every hero/target has established existence and location
- Why it is MISSING: every ledger row in the draft EP is not-established (asserted by tests/charger-step10.test.mjs)
- Blocks: 3b EP sufficiency (objective gate) — codes: `EP_HERO_NOT_ESTABLISHED`

### M-03 — Only if a decision lets the image SHOW them: established fine-detail evidence for clamp fastener position / head type and for the connector's release-mechanism geometry
- Who supplies it: claude-research, from M-01
- Acceptance check: ledger rows for SAFETY_CRITICAL attributes are established with evidence, or render stays omit/occlude (LEDGER_SAFETY_SHOWN otherwise)
- Why it is MISSING: no evidence exists for any of these attributes
- Blocks: 3 evidence ledger — codes: `LEDGER_SAFETY_SHOWN`, `LEDGER_UNSUPPORTED_DRAWN`

### M-04 — The original Step 10 reference list / V3 artwork spec named by the shot list
- Who supplies it: Andy (if it exists anywhere, e.g. in the live repo or an older export)
- Acceptance check: file present at the path the shot list names; its references can then satisfy M-01
- Why it is MISSING: visual-sources/.../artwork/step-10-intake-duct.v3.spec.md is not in the recovered tree
- Blocks: 2 reference evidence intake — codes: `EP_NO_REFERENCES`

### M-05 — A generated candidate: candidate.png (16:10, >= 1600x1000, PNG) plus candidate.claims.json (generator system/model/provider, attestation flags, empty imageInputs, contractAck, licence terms)
- Who supplies it: an image generator run by Andy/Hermes against the LOCKED contract's prompt — never by Claude fabricating one
- Acceptance check: checkGeneration() ok: attestation by image-generator, no image inputs, valid PNG, 16:10, hash and prompt match
- Why it is MISSING: no charger-step10/drop/candidate.png
- Blocks: 5 generator capture / 6-8 provenance and admission — codes: `ACTOR_UNAVAILABLE`

### M-06 — The generation provider's usage-rights terms for the provider/model actually used (U-15 decided in C-5: project asset subject to those rights)
- Who supplies it: Andy
- Acceptance check: license.terms.summary non-empty; ownershipAsserted false; assetClass/rightsBasis as canonical (GR_LICENSE_TERMS / GR_OWNERSHIP_CLAIM / GR_ASSET_CLASS otherwise)
- Why it is MISSING: no generator has been run
- Blocks: 6 provenance checks — codes: `GR_LICENSE_TERMS`

### M-07 — INDEPENDENT final QA of the candidate by Hermes / ChatGPT / GPT-5.6 Sol, plus an optional internal claude-qa pass first
- Who supplies it: Hermes / ChatGPT / GPT-5.6 Sol (independent); claude-qa (internal)
- Acceptance check: submitIndependentReview accepts reviewer {actor: hermes, model matching GPT/ChatGPT, system matching Hermes/ChatGPT/OpenAI, rawResponseSha256} with no Claude-family names; verdict computed by code; an internal Claude PASS never admits
- Why it is MISSING: no candidate exists to review
- Blocks: 10 QA / admission — codes: `QR_SELF_QA_NOT_INDEPENDENT`

### M-08 — Callout geometry (target and labelAt in image coordinates) for each final callout, and an independent overlay QA PASS_OVERLAY
- Who supplies it: overlay tool/Andy for geometry; Hermes for overlay QA
- Acceptance check: each callout has label/target/labelAt; overlayCheck by hermes returns PASS_OVERLAY (max 3 rounds)
- Why it is MISSING: no image exists, so no coordinates can exist
- Blocks: 10 QA (overlay) / approval — codes: `GATE_overlayQaPass`, `GATE_calloutsVerified`

### M-09 — Alt text and caption for the finished image
- Who supplies it: Andy (or drafted by Claude and approved by Andy)
- Acceptance check: both non-empty; caption carries 'Simplified illustration' (appended automatically if absent)
- Why it is MISSING: not written
- Blocks: 11 final artifact / manifest — codes: `PRESENTATION`

### M-10 — Andy's final sign-off {approvedBy: andy, approvedOn: YYYY-MM-DD}
- Who supplies it: Andy
- Acceptance check: provenance.status becomes 'verified' (otherwise the recovered resolver refuses with 'not verified' and nothing is shown)
- Why it is MISSING: no approval exists
- Blocks: 11 final artifact / manifest — codes: `not verified`

### M-11 — Live Crankcase main (guide registry, current Phase 1, current visuals registry) for integration
- Who supplies it: GitHub access (add_repo) — outside the proving run
- Acceptance check: gh api repo read returns 200
- Why it is MISSING: gh api returns 403 for crankcase23/crankcase
- Blocks: integration (NOT part of the proving run) — codes: `GITHUB_403`

### M-12 — Vehicle-specific verification of the eight facts the C-5 canonical contract refuses to assume (VV-01 grommet identity; VV-02 assembly composition; VV-03 air-box = air-cleaner housing; VV-04 clamp style/tightening side/head; VV-05 connector location/type/release; VV-06 guide sequence completeness; VV-07 attached breather/snorkel; VV-08 single-viewpoint adequacy)
- Who supplies it: Andy, from OEM service documentation or a physical 2016 Charger SXT 3.6L; recorded as reference evidence + ledger rows
- Acceptance check: each VV becomes established ledger rows citing a real reference (or the contract is amended where the evidence disagrees)
- Why it is MISSING: no reference evidence exists (docs/STEP10-CANONICAL-SPEC.md §VV)
- Blocks: 3 evidence ledger / 4 contract lock — codes: `EP_HERO_NOT_ESTABLISHED`


## CONFLICTING — Conflicting (see the conflict table)

### C-01 — What the hero part is and what it is called
- Conflict rows: CF-01, CF-03
- Blocks: 1b cross-source consistency / EP elements

### C-02 — Grommet and resonator: required by step text, banned by the prompt
- Conflict rows: CF-02, CF-03, CF-05
- Blocks: EP elements / VC mustNotDepict

### C-03 — Callout target list, order and wording
- Conflict rows: CF-04, CF-06
- Blocks: VC callouts

### C-04 — Clamp and connector detail vs the actions the guide asks for
- Conflict rows: CF-07, CF-08
- Blocks: 3 evidence ledger (safety-critical attributes)

### C-05 — Production route (photo vs vector vs generated raster)
- Conflict rows: CF-09
- Blocks: everything downstream of the route


## REQUIRES HUMAN DECISION — Requires a human decision

### D-01 — Resolve CF-01…CF-09: C-5 proposes ONE resolution per row (docs/STEP10-CANONICAL-SPEC.md). Until Andy/Hermes accept it the recovered originals are unchanged and no ledger/contract is written
- Decider: Andy / Hermes
- Blocks: EP authoring

### D-02 — Accept the C-5 proposed production route for CF-09 (text-only generated raster through the Guide Factory; photo and vector rejected)
- Decider: Andy / Hermes
- Blocks: everything

### D-03 — Accept (or amend) the C-5 PROPOSED canonical Step 10 contract (docs/STEP10-CANONICAL-SPEC.md) as the answer to CF-01…CF-09 — in particular the three places where it overrides old visual wording because the guide text is the mechanical anchor: grommet shown (CF-02), resonator part of the hero (CF-03), clamp tightening point + connector visible (CF-07/08)
- Decider: Andy / Hermes
- Blocks: EP authoring

