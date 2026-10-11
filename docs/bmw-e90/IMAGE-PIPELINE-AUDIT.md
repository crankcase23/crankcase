# BMW 328i (E90) — image pipeline audit and status

Status: **no image produced, nothing certified.** The pipeline is a reconstruction (`scripts/visuals/factory-reconstructed/`), not the lost original.

## What runs today
`npm run bmw:pipeline` drives every visual proposed in the 16 evidence ledgers (35 visuals) through the factory: evidence packet, objective sufficiency gate, visual contract lock, and generation request, using a prompt rendered from the structured visual. It stops at image generation because no generator is connected. Per-visual results and the exact missing facts are in `image-evidence/output/COVERAGE.md` and `PIPELINE-REPORT.json`.

Evidence rule for "established" (a fact the picture may draw): critical elements need 2+ distinct hosts; procedure/identification/cosmetic elements need 2+ distinct hosts, or 1 BMW-document or parts-catalog source. Anything not established must be omitted or drawn as a plain generic shape. Elements the sources disagree on become explicit "must not show" items.

## Coverage (see COVERAGE.md for the live numbers)
- Contract locked, prompt ready: 25 of 35 visuals.
- Evidence insufficient: 10 visuals. Their missing facts are listed per visual; most need the owner's photos of the car (headlight type, key fob, post-cat bracket, airbox fasteners, differential plug position, and similar).
- Certified images: 0. Images produced: 0.

A second research pass filled 77 of 120 hero/target existence and location gaps from the web. That pass also corrected an earlier assumption: the N52 does have a plastic ignition-coil engine cover (RealOEM, Turner); its shape is unknown, so it is a must-not-show item rather than "absent".

## What is built
- Evidence validator (`npm run bmw:validate`) and generator for prompts, contracts and the coverage report.
- Independent QA workflow (`npm run bmw:qa -- export|import`): exports a packet (image, contract, rubric, exact reply format; no internal Claude QA) for Hermes / ChatGPT, then validates and records the raw reply with its sha256. Claude-looking identities, wrong images, missing items and unfounded fails are refused with the run directory unchanged. Tested on synthetic fixtures only.
- Candidate import (`npm run bmw:qa -- drop-template|drop-import`): a person or another system produces `candidate.png` plus a claims file; nothing is pre-attested; false attestations are rejected by the provenance gate.

## Still missing for a certified image
1. **An image generator.** Spending needs owner approval; see `IMAGE-GENERATION-OPTIONS.md`. Exact 16:10 at 1600x1000 or larger is mandatory.
2. **The Hermes review itself** (a human relays the packet to ChatGPT and pastes the reply back).
3. **Owner sign-off.** `verified` status requires it; the factory records `andyFinal: required`.
4. **Registry integration** (`INTEGRATED` / `REVOKED`) is not built.
5. **Geometry facts** that text cannot give (fastener head shapes, release-tab shape, orientation). Owner photos of this car are the cheapest source.

## Order of work from here
1. Owner decision on generator spend (one visual first).
2. Generate, drop, review with Hermes, owner sign-off, repeat.
3. Owner photos close the 10 insufficient visuals.
