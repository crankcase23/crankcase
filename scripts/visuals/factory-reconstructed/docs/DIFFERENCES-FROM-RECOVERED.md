**THIS GUIDE FACTORY IMPLEMENTATION IS RECONSTRUCTED FROM SURVIVING EVIDENCE. IT IS NOT THE LOST ORIGINAL IMPLEMENTATION.**

# Differences: recovered evidence vs reconstructed behavior

| area | recovered / documented original | reconstruction | consequence |
|---|---|---|---|
| contract types + runtime resolver | RECOVERED `guideVisuals.ts` (types + artworkRefusal + rasterRefusal + visualRefusal) | used **unmodified**, bundled by esbuild in tests; reconstruction emits records in that exact shape | integrates cleanly (tests prove accept + 16 refusal cases) |
| pipeline code | LOST (`scripts/visuals/factory/*.mjs`, raster.mjs, raster-build.mjs, factory-run/check) | new ESM modules; programmatic API, not the original CLI | command names/flags differ; behavior follows docs |
| tests | LOST (158 / 94 / 90 + 27 + 76) | 88+ new RECONSTRUCTED tests, derived from documented behavior | counts are not comparable; no restoration claimed |
| image library | `sharp` (INF) | dependency-free PNG codec (decode, box downscale, filter-0 encode) | deterministic, but encoded bytes differ from anything historic |
| media types | png + webp | png only | webp refused (U-07) |
| source types | original-artwork (SVG) + generated-raster | generated-raster pipeline + original-artwork *record validator* only | SVG path absent (U-18) |
| correction cycle on provenance rejection | docs conflict | **LOCKED (C-4) ARCHITECTURE_V1**; alternatives need `allowNonCanonical`, are recorded in policy.json, and can never be approved | U-01 decided |
| retry cap | none documented | **NEW reconstructed behavior (Andy C-4 lock)**: max 3 resubmissions, then NEEDS_ANDY | not recovered original behavior; counting U-22 |
| stage order QA vs normalize | arch: QA on generator file, normalize after admission | same | brief's list order differs (U-11) |
| EP sufficiency | Brick A: proposal in object, decision is an event | same | — |
| mustNotDepict | Brick A dev. 4: objects with ids | objects with ids + required trace to an omit/occlude ledger row | trace rule is INF |
| verified status | recovered types: "verified by a human" | registry preview is `pending` until an Andy sign-off is passed to `approve` | stricter than "APPROVED means usable" |
| integration lifecycle | INTEGRATED / REVOKED, mark-integrated, spot-check | not built | U-12 |
| ref hashing | arch: refs carry sha256 | refs verified against hash **recomputed from content** (found by a test: trusting the stored field let a content edit go unnoticed in ref checks) | stronger than a naive reading |
| Step 10 inputs | V3 spec + reference list + artwork + draft PNG | none survive; only prompt (doc), manifest (empty), step text, shot list | proving run blocked at evidence |
| QA actors | arch enum: `claude-qa` only | + `hermes`; `claude-qa` = internal, `hermes` = independent final reviewer (C-4 lock) | internal Claude PASS never admits; a Claude-family reviewer can never be independent |
| verifier | event chain + hashes | + transition legality, GR-cycle replay, provenance re-check from bytes, verdict recomputation, independence, CD prior-ref existence, normalized dimensions, pinned event-head | forgeries that are fully re-sealed and re-chained are caught |
| recovered tree | hash-frozen | harness verifies SHA256SUMS before bundling | a mutated recovered file is refused |
