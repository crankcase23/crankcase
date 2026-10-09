**THIS GUIDE FACTORY IMPLEMENTATION IS RECONSTRUCTED FROM SURVIVING EVIDENCE. IT IS NOT THE LOST ORIGINAL IMPLEMENTATION.**

# File / source provenance map

Class: **R** = recovered original (copied read-only) · **D** = recovered-from-documentation · **C** = reconstructed code · **T** = reconstructed test · **I** = inferred element inside a reconstructed file · **U** = unresolved (switch or gap).

## Recovered (copies; originals untouched on AndyLaptop)
| file | class | origin | SHA256 (prefix) |
|---|---|---|---|
| recovered/src/types/guideVisuals.ts | R | tgz charger-guide-001-deploy-bundle (11,165 B) | 32303ced |
| recovered/src/lib/guideVisuals.ts | R | same tgz (8,365 B) | 5f0131d8 |
| recovered/src/data/guide-visuals/charger-2016-sxt-multi-job.ts | R | same tgz | e01deafb |
| recovered/src/data/guide-visuals/…visuals.json | R | same tgz (`{ "visuals": [] }`) | 4c98e9ec |
| recovered/src/data/admin-test-guides/charger-2016-sxt-multi-job.ts | R | same tgz (CRLF-only diffs vs branch b12b387) | 64705582 |
| recovered/visual-sources/applications.json | R | laptop working tree | 6dcbc972 |
| recovered/visual-sources/…/step-10-intake-duct.manifest.json | R | laptop working tree (status PENDING, empty) | 8917f3f6 |
| recovered/scripts-visuals/lib.mjs | R | laptop working tree (older pre-factory pipeline) | cfd68d57 |
| recovered/doc-derived/step-10-handoff-prompt.txt | D | Project doc claude/guide-factory-charger-proving-run-step10-handoff-2026-09-26.md | a71ebdfb |

## Reconstructed source (all headers say RECONSTRUCTED-V1 / NOT the lost original)
| file | class | primary sources | inferred / unresolved inside |
|---|---|---|---|
| src/canon.mjs | C | arch §0.1 | I: canonicalization rules |
| src/enums.mjs | C | VC types/lib (enums, TREATMENT_VERSION, disclosure); arch §1–3; Brick C (MAX_OVERLAY_ROUNDS=3); rubric (version) | I: gate-id vocabulary, DEFAULT_MAX_BYTES (U-08); U: webp (U-07) |
| src/policy.mjs | C | arch §3 (no cycle burn); Brick C deviations (burn + NEEDS_ANDY) | U-01/02/03: switch + provenanceRetryCap (invented safety bound) |
| src/eventlog.mjs | C | arch §2 event line fields; Brick A (hash-chained) | I: chain construction |
| src/objects.mjs | C | arch §0 envelope; VC lib (norm/applicationMatches/slug) | — |
| src/evidence.mjs | C | arch §1.1; VC types (ReferenceEvidence, ledger); VC lib artworkRefusal rules | I: mustNotDepict trace rule placement |
| src/spec-intake.mjs | C | Step 10 prompt format (D) | I: parser; original v3 spec format LOST |
| src/contract.mjs | C | arch §1.2 | I: template contents + never-cosmetic keywords (original template LOST); prompt text |
| src/actors.mjs | C | arch §0/§1.3 | adapters LOST; interface INF |
| src/provenance.mjs | C | arch §1.3; VC lib rasterRefusal/artworkRefusal; VC types noSourcePixels | I: substantive vs metadata split |
| src/png.mjs, src/normalize.mjs | C | arch §4; VC types normalizedArtifact rules | I: encoder/filter; box-filter downscale; U-09 |
| src/qa.mjs | C | arch §1.4/1.5; CG-QA-v1.0; Brick A (PROVENANCE implicit item; PASS_OVERLAY) | I: overlay verdict names beyond PASS_OVERLAY; U-20 actor |
| src/artifact.mjs | C | arch §1.6; VC types GeneratedRasterRecord/VisualProvenance; Brick C (vehicleVerified = registry match) | I: status pending until Andy; caption disclosure append; INTEGRATED/REVOKED not built |
| src/store.mjs, src/verify.mjs | C | arch §2; Brick C (refused commands leave dir byte-identical) | — |
| src/machine.mjs | C | arch §3 states; Brick C commands/actors | I: API names (CLI LOST); evidence-deficient accounting (U-05) |

## Reconstructed tests / harness / proving run
| file | class | derived from |
|---|---|---|
| tests/*.test.mjs (+ tests/support/fixtures.mjs) | T | documented behavior only; see docs/TEST-INVENTORY.md. Fixtures are SYNTHETIC (no real evidence or artwork) |
| integration/recovered-resolver.mjs | C | harness: bundles the RECOVERED lib unmodified; one STUB (types/vehicle.ts, type-only) because the real Vehicle/ResolvedGuide types were not recovered |
| charger-step10/run-proving.mjs | C | surviving Step 10 materials only |
| charger-step10/output/* | derived output of the proving run (committed as evidence) |

## Not present at all (UNKNOWN / lost): original factory runner code, CLI (factory-run/factory-check), original tests (158/94/90 + photo 27 + artwork 76), V3/V4 SVGs, step-10 v3 spec + reference list, criticality-template.json, raster.mjs/raster-build.mjs.
