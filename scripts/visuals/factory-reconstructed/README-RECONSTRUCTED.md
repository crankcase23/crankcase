**THIS GUIDE FACTORY IMPLEMENTATION IS RECONSTRUCTED FROM SURVIVING EVIDENCE. IT IS NOT THE LOST ORIGINAL IMPLEMENTATION.**

# guide-factory-reconstructed-v1 (quarantined)

Branch/workspace designation: `guide-factory-reconstructed-v1`. Created 2026-10-04 (Crankcase C-3). Local-only git repo, no remote.

## Status labels used everywhere

| Label | Meaning |
|---|---|
| **RECOVERED** | Original bytes that survived (copied read-only into `recovered/`, hashes frozen) |
| **RECOVERED-FROM-DOCUMENTATION** | Text lifted out of a Project doc (e.g. the Step 10 handoff prompt) |
| **RECONSTRUCTED** | New code/tests written here from surviving docs + recovered contracts. Every `src/*.mjs` opens with a `RECONSTRUCTED-V1 | NOT the lost original` header naming its sources |
| **INFERRED** | A reconstruction choice the evidence implies but does not state (tagged in the header comment or UNRESOLVED list) |
| **UNRESOLVED** | Evidence conflicts or is missing; exposed as an explicit policy/config switch or left unimplemented (see docs/UNRESOLVED-DECISIONS.md) |

## Quarantine rules
- `recovered/` is read-only (chmod a-w) and hash-checked on every test run. No code here writes into it.
- Nothing here imports from, patches, or is wired into Crankcase `main`. No registry or `public/` is ever written; approvals produce a **preview** only (`registry-entry.preview.json`).
- The old 158 / 94 / 90 suites are gone and are NOT claimed. The tests here are new (`RECONSTRUCTED TEST`).
- Integration against Crankcase is gated on live GitHub access (still blocked).

## C-4 locks (Andy, 2026-10-04)
1. **Cycle policy**: `ARCHITECTURE_V1` is canonical; a provenance-rejected generation does NOT consume a correction cycle. `BRICK_C_REPORT` and per-field overrides are rejected alternatives: they need `allowNonCanonical`, are recorded in `policy.json`, and can never be approved.
2. **Independent QA**: `claude-qa` = INTERNAL QA (`submitQA`). `hermes` (Hermes / ChatGPT) = INDEPENDENT final reviewer (`submitIndependentReview`, and overlay review). Claude reviewing Claude is not independent QA; only an independent PASS admits output.
3. **Metadata retry cap**: max 3 resubmissions, then NEEDS_ANDY. **NEW reconstructed behavior — not recovered original behavior.** (Counting interpretation: U-22.)
4. **Step 10 conflicts**: one OPEN table, nothing decided: `docs/STEP10-CONFLICT-TABLE.md`.
5. **Step 10 evidence package**: `docs/STEP10-EVIDENCE-PACKAGE.md` (AVAILABLE / MISSING / CONFLICTING / REQUIRES HUMAN DECISION).
Report: `docs/C4-HARDENING-REPORT.md`.

## C-5 (2026-10-04)
Step 10 canonicalization: `docs/STEP10-CANONICAL-SPEC.md` (PROPOSED, pending Andy/Hermes), `docs/C5-CANONICALIZATION-REPORT.md`, code in `charger-step10/canonical-step10.mjs`. Locks: U-22 canonical; independent reviewer = Hermes / ChatGPT / GPT-5.6 Sol (strict identity); generated assets = project assets subject to provider rights; U-24 stays open.

## Run
```
npm test                       # deterministic, no network; needs Node >= 22
npm run prove:charger-step10   # Charger #001 Step 10 proving run (expected: principled BLOCK)
```
The recovered-resolver integration tests need `esbuild` (set `ESBUILD_PATH`); without it they report SKIPPED, not pass.

## Layout
`recovered/` originals (read-only) · `src/` reconstructed pipeline · `tests/` reconstructed tests · `integration/` harness that runs the recovered resolver · `charger-step10/` proving run + committed output · `docs/` architecture map, provenance map, test inventory, unresolved decisions, differences, proving-run report.
