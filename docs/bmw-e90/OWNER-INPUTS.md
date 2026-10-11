# BMW 328i (E90) — what only the owner can supply

Research was exhausted first: the VIN was decoded through RealOEM (N52N, 09/2009 build, rear-wheel drive indicated), BMW owner's-manual and training-document text was used wherever reachable, and 77 of 120 image-evidence gaps were closed from the web. What remains needs the car or a decision. Per-guide detail is in `EVIDENCE-SUMMARY.md`; per-visual gaps in `image-evidence/output/COVERAGE.md`.

## Decisions (these gate the most work)
1. **Image generation spend.** Approve a small capped ElevenLabs credit spend for one visual first, or choose another route. See `IMAGE-GENERATION-OPTIONS.md`. Without it, no image can exist.
2. **Hermes QA channel.** Each image needs a ChatGPT review: run `npm run bmw:qa -- export`, give ChatGPT the packet, paste its reply back. Confirm you want to do that, and whether ChatGPT is also allowed to generate (same vendor as the reviewer).
3. **PCV Valve scope.** The draft assumes an inspect-and-hose-check guide with valve-cover replacement marked advanced (the later N52 has no standalone PCV valve). Confirm or change.

## One lookup that settles most configuration questions
4. **Factory option list for VIN WBAPH7C58AA175760** (BMW dealer or build-data lookup): headlight type, key type (Comfort Access or not), transmission, wheel and brake package, limited-slip or open rear differential.

## Photos of the car (also usable as image evidence)
5. Top of the engine with the filter cap and oil filler cap visible, and whether a plastic engine cover is fitted.
6. Underside with the undertray hatch open and the drain plug visible; the rear differential plug from below.
7. The headlight rear (halo cap or xenon cap), battery label and trunk compartment, both keys front and back, glovebox fuse panel, airbox, cabin-filter cowl.
8. Door-jamb sticker; numbers on the old belt and tensioner when they next come off.

## Documents
9. Owner's manual pages (Capacities, Lamps & Bulbs, Engine oil). One BMW document moves many single-source facts to verified; BMW TIS/ETK access for this VIN would be better still.

## Housekeeping
10. Close PR #34 (the permission-hook change closing is outside the approved hook shapes).
