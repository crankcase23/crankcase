**THIS GUIDE FACTORY IMPLEMENTATION IS RECONSTRUCTED FROM SURVIVING EVIDENCE. IT IS NOT THE LOST ORIGINAL IMPLEMENTATION.**

# Reconstructed test inventory

Every test is labeled `RECONSTRUCTED TEST`. These are NEW tests derived from surviving documented behavior. **The lost 158 / 94 / 90 (plus 27 photo / 76 artwork) suites are not restored and their counts are not a target.**

Last full run: **138 tests, 137 pass, 0 fail, 1 skipped** (`npm test`, Node v22.22.0).
Test titles registered: 138.

## Coverage of the C-3 minimum list and the C-4 additions
| required area | tests |
|---|---|
| valid reference evidence accepted | 1 |
| missing evidence rejected | 3 |
| malformed evidence rejected | 2 |
| provenance failure rejected | 5 |
| no-source-pixels attestation required | 1 |
| rejected generation cannot become admitted output | 1 |
| normalization contract | 5 |
| artifact manifest integrity | 3 |
| event log integrity | 1 |
| deterministic repeated execution | 4 |
| policy-switch behavior (correction-cycle ambiguity) | 9 |
| Charger #001 Step 10 scenario | 8 |
| C-4 hardening regressions (13 + policy locks) | 38 |
| C-4 Step 10 conflict table | 5 |
| C-4 Step 10 evidence package | 7 |
| C-5 canonical Step 10 regressions | 0 |
| C-5 locks | 0 |

## By file

### tests/c5-locks.test.mjs (7)
Derived from: C-5 locks: U-22 count, Hermes/ChatGPT identity strictness, generated-asset ownership posture, U-24 known gap

- RECONSTRUCTED TEST [C-4 HARDENING #1]: U-22 canonical: initial submission + up to 3 resubmissions; the 4th rejection escalates to NEEDS_ANDY; labelled canonical reconstructed behavior
- RECONSTRUCTED TEST [C-4 HARDENING #2]: independent reviewer identity: Hermes / ChatGPT / GPT-5.6 Sol — relabelling a Claude result 'Hermes' does not satisfy independent review
- RECONSTRUCTED TEST [C-4 HARDENING #2]: identity is re-validated by the VERIFIER: a re-sealed, re-chained history whose independent QR is relabelled is flagged (identity, raw hash, Claude model)
- RECONSTRUCTED TEST [C-4 HARDENING #2]: Claude may do internal QA but cannot certify its own output: internal PASS never admits, and the final registry QA reviewer is the independent one
- RECONSTRUCTED TEST [C-4 HARDENING #3]: generated output ownership: project asset subject to the provider's usage rights; the factory records the provider's terms and asserts no ownership beyond them
- RECONSTRUCTED TEST [C-4 HARDENING #3]: the RECOVERED resolver still accepts the record (it requires generated-original and no ownership assertion) — the ownership posture does not break recovered rules
- RECONSTRUCTED TEST [C-4 HARDENING #4]: U-24 stays OPEN and documented: a pre-approval truncated tail is NOT detected today (known gap); once approved, the pinned head catches it

### tests/charger-step10.test.mjs (6)
Derived from: surviving Step 10 handoff prompt, manifest, guide text, shot list (C-3 §5)

- Step 10 — spec intake passes; evidence/ledger/sufficiency/contract/generation and everything downstream are BLOCKED; Step 10 does NOT pass
- Step 10 — nothing is fabricated: zero references, no generation record, no candidate/normalized/approved file, no registry entry
- Step 10 — the draft EP is structurally VALID (so the block is for missing evidence, not malformed input)
- Step 10 — surviving sources conflict and the conflict is REPORTED, not resolved (grommet/resonator vs MUST NOT SHOW; callout lists differ)
- Step 10 — event log + directory of the blocked run verify clean, and the recovered resolver integrates (shows nothing)
- Step 10 — deterministic repeated execution (identical report bytes)

### tests/evidence.test.mjs (17)
Derived from: VD arch §1.1 (EP validation); VC types/lib (ledger, reference rules); Step 10 prompt format (spec intake)

- valid reference evidence is accepted (no problems, sufficient)
- missing evidence is rejected — no references at all is never sufficient
- missing evidence is rejected — an established ledger row must cite evidence
- missing evidence is rejected — citing a reference id that does not exist
- hero/target without ESTABLISHED existence+location is insufficient
- malformed reference evidence is rejected (enum, sourceRef, usage, establishes, rights)
- a reference flagged as an image input is rejected
- malformed packet shapes are rejected (non-list ledger, bad element, unknown ledger element, bad envelope)
- unsupported attributes may never be drawn; safety-critical geometry only omit/occlude
- unsupported rows on critical/identification/procedure elements may only be omit|occlude
- mustNotDepict must trace to an omit|occlude ledger row
- first EP cannot supersede; superseding without a QR deficiency finding is refused
- criticality — hardware-looking elements cannot be cosmetic (template rule)
- registerEP refuses invalid evidence and writes nothing
- visual specification intake parses the surviving Step 10 prompt
- spec intake rejects a prompt with a missing section or no NO-TEXT clause
- spec intake is deterministic and hashes the source prompt

### tests/hardening.test.mjs (16)
Derived from: C-4 locks (Andy): canonical ARCHITECTURE_V1, hermes independent QA, retry cap; 13 deterministic regressions with re-sealed/re-chained forgeries

- RECONSTRUCTED TEST [C-4 HARDENING #0]: a clean run verifies clean under the hardened verifier (baseline: every attack below starts from a verified-clean directory)
- RECONSTRUCTED TEST [C-4 HARDENING #L1]: ARCHITECTURE_V1 is canonical; any deviation needs allowNonCanonical, cannot be laundered by renaming, is recorded in policy.json, and can never be approved
- RECONSTRUCTED TEST [C-4 HARDENING #L2]: verifier: a run approved under a non-canonical policy (policy.json edited after the fact) is flagged; missing policy.json is flagged
- RECONSTRUCTED TEST [C-4 HARDENING #1]: corrupted reference hash — a cross-reference {id, sha256}, an event ref, and the recovered SHA256SUMS entry are each caught
- RECONSTRUCTED TEST [C-4 HARDENING #2]: mutated recovered contract file — the harness refuses to bundle a recovered tree whose bytes differ from SHA256SUMS.txt
- RECONSTRUCTED TEST [C-4 HARDENING #3]: duplicate evidence IDs — duplicate reference ids, ledger rows, mustNotDepict ids, element ids, QA check ids, and duplicate object ids on disk are all refused/flagged
- RECONSTRUCTED TEST [C-4 HARDENING #4]: broken event-chain link — an edited prev link, a deleted event, and a CONSISTENTLY re-chained rewrite (caught by the head pinned in the registry preview) are all caught
- RECONSTRUCTED TEST [C-4 HARDENING #5]: out-of-order events — swapped lines break the chain; a validly RE-CHAINED reorder or injected event is caught by transition legality
- RECONSTRUCTED TEST [C-4 HARDENING #6]: admitted output without required provenance — a re-sealed, re-chained forgery of the generation's attestation is caught by re-checking the stored bytes
- RECONSTRUCTED TEST [C-4 HARDENING #7]: artifact bytes no longer matching the manifest — candidate bytes, normalized bytes, and the registry preview are each checked
- RECONSTRUCTED TEST [C-4 HARDENING #8]: normalization unexpectedly changing dimensions — a faulty resizer is refused; real inputs always land on exactly the frame; a wrong-size derivative on disk is flagged
- RECONSTRUCTED TEST [C-4 HARDENING #9]: QA verdict tampering — a naive edit, a re-sealed edit, and a fully re-sealed + re-chained forgery (verdict recomputed from the QR's own checks) are all caught
- RECONSTRUCTED TEST [C-4 HARDENING #10]: correction delta referencing a nonexistent prior artifact — refused at creation (cdProblems with a store) and flagged on disk (re-sealed forgery)
- RECONSTRUCTED TEST [C-4 HARDENING #11]: fourth metadata retry forces NEEDS_ANDY — exact counting (initial + 3 resubmissions), no cycle burned, 5th submission refused, labelled NEW reconstructed behavior, and an un-escalated history is flagged
- RECONSTRUCTED TEST [C-4 HARDENING #12]: Claude self-QA presented as independent QA — refused by actor, by model/system name, by class claim, by admission, by approval, by overlay, and by the verifier
- RECONSTRUCTED TEST [C-4 HARDENING #13]: provenance rejection must not consume a correction cycle — behavior, replayed history, forged burn flag, and forged cycle number

### tests/integrity.test.mjs (8)
Derived from: VD arch §0 (content-addressed, hash-chained), §2 (events.jsonl), §1.6 (AA gates); Brick A (event log checks)

- an untouched approved run verifies clean (objects, events, files, manifest)
- canonical hashing is order-independent, strict about types, and content-addressed
- manifest integrity — altering any recorded object breaks its own hash AND every reference to it
- manifest integrity — candidate file, prompt file, normalized file and registry preview are each hash-checked
- manifest integrity — an AA with a gate flipped to false is detected
- event log integrity — deletion, reordering, edits, forged tail and truncation are each detected
- event log is hash-chained with seq starting at 1 and prev=null on the first event
- the AA records the event-log head it was derived from (registry preview carries eventsSeq/head)

### tests/machine.test.mjs (25)
Derived from: VD arch §3 (state flow), §1.4/§1.5, CG-QA-v1.0 §2/§17/§18, Brick C (refused = byte-identical; overlay cap); policy conflict (arch §3 vs Brick C)

- full happy path reaches APPROVED with every gate true and a verified directory
- deterministic repeated execution — two runs with the same inputs and clock are byte-identical
- commands out of order are refused and leave the directory byte-identical
- only factory-code or andy may decide EP sufficiency
- QA verdict is COMPUTED — an actor cannot assert PASS over a failing check
- QA refused — reviewer not independent, missing check, FAIL without finding, uncited finding, bad rubric, bad regression ref
- COSMETIC and IGNORE findings never block a PASS
- correction delta is 1:1 with blocking findings, protected/mayChange are disjoint, and the next generation must cite it
- generation cap — initial + 3 corrections; the 4th generation failing QA ESCALATES to NEEDS_ANDY
- EVIDENCE_DEFICIENT reopens the EP only via a superseding EP citing the finding; cycles do NOT reset
- superseding with a QR that is not an evidence deficiency is refused
- [POLICY] ARCHITECTURE_V1 is the LOCKED canonical policy (Andy C-4); BRICK_C_REPORT is a rejected non-canonical alternative
- [POLICY] ARCHITECTURE_V1 — a metadata-class provenance rejection burns NO cycle; the retry is the same cycle
- [POLICY] ARCHITECTURE_V1 — rejected generations never count toward the 4-generation cap
- [POLICY] ARCHITECTURE_V1 — retry cap (NEW reconstructed behavior, Andy C-4 lock — not recovered original) escalates the 4th consecutive rejection
- [POLICY] ARCHITECTURE_V1 — a SUBSTANTIVE provenance failure fails closed to NEEDS_ANDY without burning a cycle
- [POLICY] BRICK_C_REPORT — ANY provenance rejection consumes a cycle and goes to NEEDS_ANDY (terminal)
- [POLICY] the two policies diverge on the SAME input sequence (this is the conflict, made executable)
- [POLICY] policy is overridable per field, validated, and recorded on the rejection event
- [POLICY] substantive handling is itself switchable (ARCHITECTURE_V1 + burn-cycle-needs-andy)
- callouts need overlay QA before approval; PASS_OVERLAY unlocks it; reviewer must be independent
- overlay rounds are capped at 3, then NEEDS_ANDY
- a contract with no callouts has overlay gates 'na' and overlay QA is refused
- vehicleVerified is an objective registry match — an unregistered application is refused at approval
- approval requires alt text and caption; objects are immutable (rewriting a record is refused)

### tests/normalize.test.mjs (8)
Derived from: VD arch §4 (raster ops, downscale-only, metadata stripped, C2PA recorded); VC types normalizedArtifact rules

- normalization strips every metadata chunk (C2PA recorded on the source), hashes are distinct, frame is 1600x1000
- same-size normalization preserves every pixel (it cannot change what the picture shows)
- a larger 16:10 source is downscaled (never upscaled) to exactly 1600x1000
- normalization refuses upscaling, wrong aspect, animated, unreadable, and unsupported PNG variants
- a source already identical to its normalized form is refused (resolver requires distinct hashes) — UNRESOLVED U-09
- normalization is deterministic (identical bytes in -> identical bytes and hash out)
- box downscale averages (2x2 -> 1x1 of [0,100,200,40] = 85)
- PNG codec round-trips and decodes all five filter types

### tests/provenance.test.mjs (11)
Derived from: VD arch §1.3 (GR validation); VC lib rasterRefusal/artworkRefusal; VC types noSourcePixels

- a clean generation passes provenance and records its C2PA presence without requiring it
- provenance failure — generation used image inputs (substantive) is rejected
- provenance failure — attestation flags false (substantive) / missing (metadata) / wrong attester
- provenance failure — wrong magic bytes, corrupt PNG, wrong aspect, too small, animated, too large, wrong media type
- provenance failure — recorded hash/dimensions that disagree with the real file are caught on re-check
- provenance — attestation by the QA actor is refused
- no-source-pixels attestation is REQUIRED for original artwork where documented
- the raster-path attestation (the generated-raster analogue) is required and complete
- a provenance-rejected generation cannot become admitted output (QA, admit, normalize, approve all refused)
- a rejected GR is still recorded as immutable evidence but never reaches approved.json
- admission gate refuses when the candidate file no longer matches its record

### tests/quarantine.test.mjs (6)
Derived from: quarantine rules (C-3 §1); recovered hash freeze (C-2 master index)

- recovered/ files still match their frozen SHA256 (nothing modified)
- recovered/ files are read-only on disk
- every src/*.mjs carries the RECONSTRUCTED-V1 / not-the-original header
- no src file writes into recovered/
- the banner text is exact
- fixture registry equals the recovered applications.json

### tests/recovered-integration.test.mjs (7)
Derived from: RECOVERED src/lib/guideVisuals.ts run unmodified against reconstructed output

- recovered resolver loads unmodified and exposes its public API
- a reconstructed, human-signed, QA-passed approval is ACCEPTED by the recovered resolver (SYNTHETIC fixture)
- the same record WITHOUT Andy's sign-off is refused as 'not verified' (no human, nothing shown)
- a reconstructed record with overlay QA + callouts is accepted by the recovered resolver
- the recovered resolver independently refuses each tampering of a reconstructed record (reconstruction and recovered rules agree)
- callouts shown without a passing overlay QA are refused by the recovered resolver
- the recovered Charger registry is empty, so step 10 shows nothing (consistent with the proving run)

### tests/step10-canonical.test.mjs (15)
Derived from: C-5: one regression family per resolved Step 10 conflict + legacy-source oracle

- RECONSTRUCTED TEST [C-4 HARDENING #ANCHOR]: title and instruction text are the guide's step-10 text VERBATIM; recovered originals are unmodified; canonical content passes its own oracle
- RECONSTRUCTED TEST [C-4 HARDENING #CF-01]: naming: guide title + 'intake hose/resonator assembly'; legacy aliases are banned everywhere customer-facing or in the brief
- RECONSTRUCTED TEST [C-4 HARDENING #CF-02]: retaining grommet: shown, called out, never prohibited
- RECONSTRUCTED TEST [C-4 HARDENING #CF-03]: resonator: part of the hero assembly, never prohibited, no mandated seamless hose
- RECONSTRUCTED TEST [C-4 HARDENING #CF-04]: callouts: exactly the five canonical labels in the guide's action order, never more than six
- RECONSTRUCTED TEST [C-4 HARDENING #CF-05]: five actions, one callout each, in order; no 'four actions' / 'IAT clip' rationale
- RECONSTRUCTED TEST [C-4 HARDENING #CF-06]: air-cleaner housing is the term; 'air box' never appears; its callout is 'Air-cleaner housing clamp'
- RECONSTRUCTED TEST [C-4 HARDENING #CF-07]: clamps: tightening point visible and evidence-gated; the old 'hide the screw' wording is rejected
- RECONSTRUCTED TEST [C-4 HARDENING #CF-08]: connector: fully visible, never partly hidden, release detail evidence-gated rather than blanket-banned or invented
- RECONSTRUCTED TEST [C-4 HARDENING #CF-09]: route: text-only generated raster through the Guide Factory; photo and vector routes and any image input are rejected
- RECONSTRUCTED TEST [C-4 HARDENING #LEGACY]: the OLD sources fail the oracle: the legacy prompt, manifest wording and shot-list wording reintroduce CF-01…CF-08 and are detected
- RECONSTRUCTED TEST [C-4 HARDENING #TERMS]: terminology dictionary covers intake duct / air inlet duct / hose / resonator / air box / air-cleaner housing; canonical terms are statused, legacy aliases are banned
- RECONSTRUCTED TEST [C-4 HARDENING #RESOLUTIONS]: all nine conflicts have exactly one proposed resolution, each with a why, verification ids that exist, and a regression in this file
- RECONSTRUCTED TEST [C-4 HARDENING #VV]: unverified vehicle facts are ISOLATED: the contract draws nothing from them; the EP skeleton is valid but every fact is not-established with no references; generation is NOT ready
- RECONSTRUCTED TEST [C-4 HARDENING #PRIORITY]: mechanical truth beats old visual wording: every withdrawn constraint is documented with the guide action that overrides it, and none appears in the canonical brief

### tests/step10-conflicts.test.mjs (5)
Derived from: C-4 lock #4: five surviving Step 10 sources quoted verbatim

- RECONSTRUCTED TEST [STEP10 CONFLICTS]: the recovered files the table quotes are intact (hashes match SHA256SUMS)
- RECONSTRUCTED TEST [STEP10 CONFLICTS]: every quote in every conflict and agreement row appears VERBATIM in its recovered source file
- RECONSTRUCTED TEST [STEP10 CONFLICTS]: every conflict row has source, exact requirement, contradiction and decision required; ids unique; all OPEN; none resolved or altered
- RECONSTRUCTED TEST [STEP10 CONFLICTS]: the table covers all five requested sources
- RECONSTRUCTED TEST [STEP10 CONFLICTS]: canonical Step 10 requirements are UNALTERED — the recovered Step 10 prompt/manifest/slot files still match their SHA256SUMS entries

### tests/step10-evidence.test.mjs (7)
Derived from: C-4 lock #6: AVAILABLE/MISSING/CONFLICTING/REQUIRES_HUMAN_DECISION checklist verified against the tree

- RECONSTRUCTED TEST [STEP10 EVIDENCE]: every item has a legal status, a unique id, and the four required groups are all present
- RECONSTRUCTED TEST [STEP10 EVIDENCE]: AVAILABLE items point at files that exist, and the recovered ones are intact
- RECONSTRUCTED TEST [STEP10 EVIDENCE]: MISSING items with a named file are genuinely absent (nothing was fabricated to fill them)
- RECONSTRUCTED TEST [STEP10 EVIDENCE]: the blocker codes named for M-01/M-02/M-05 are exactly what the proving run really emits today
- RECONSTRUCTED TEST [STEP10 EVIDENCE]: the other named blocker codes are real codes the factory emits (PRESENTATION, QR_SELF_QA_NOT_INDEPENDENT, ACTOR_UNAVAILABLE, GR_GENERATOR)
- RECONSTRUCTED TEST [STEP10 EVIDENCE]: every CONFLICTING item cites real conflict-table rows, and every conflict row is covered by a CONFLICTING item or D-01
- RECONSTRUCTED TEST [STEP10 EVIDENCE]: MISSING and CONFLICTING items name who supplies/decides them; human decisions name a decider

## Notes
- Fixtures are SYNTHETIC (tests/support/fixtures.mjs): obvious fake references, gradient PNGs, a scripted generator. None is Charger artwork or evidence.
- Defense-in-depth checks (e.g. admit() re-checking provenance status; overlay gates evaluated twice) are redundant by design: a mutation removing ONE copy is not caught, removing BOTH is (C-3 mutation testing: 8 mutations, all caught except the two single-copy redundancies). C-4 mutation testing (2026-10-04): 21 mutants of the hardening logic — 18 caught on first run, 1 more caught after adding a test (only-hermes-may-be-independent), 1 mutant text did not match and was re-run by hand and caught; 2 survivors are redundant defense-in-depth (the normalizer's second dimension check duplicates the first; admit()'s independent-review check duplicates the phase gate and approve()'s gate and the verifier's).
- C-4: hardening tests attack a CLEAN run's on-disk history: they re-seal objects and rebuild the event hash chain so every structural hash check passes, leaving only the semantic replay in verify.mjs to catch the forgery. No test asserts a count of tests or any historical number.
- Tests that need esbuild report SKIPPED, not pass, when it is missing.
- A test found a real weakness during development: cross-reference checks trusted the stored contentHash field instead of recomputing from content (fixed; regression test: "altering any recorded object breaks its own hash AND every reference to it").
