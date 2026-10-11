# BMW 328i (E90) — image pipeline audit and first pipeline test

Status: nothing certified, no image produced. The pipeline is a reconstruction (`scripts/visuals/factory-reconstructed/`), not the lost original.

## What was tested
`npm run bmw:pipeline` drives two oil-change visuals through the factory using cited evidence (`docs/bmw-e90/image-evidence/`). A ledger fact counts as established only with 2+ sources on different hosts; otherwise the picture must omit it.

| Visual | Result | Why |
|---|---|---|
| `oil-drain-plug-access` | Reaches `GEN_REQUESTED`: evidence packet SUFFICIENT, visual contract LOCKED, generation prompt built | Drain plug and access hatch existence and location are each established by 2+ hosts. Plug orientation, plug head shape and hatch fasteners are not established, so the contract forbids drawing them. |
| `oil-filter-cap` | Stops at `EP_INSUFFICIENT` | No source says where on the engine the filter housing cap sits (side or end). The factory refuses to proceed. |

Both runs pass the event-log and directory integrity check. Tests: `npm run bmw:test` (8 pass), including "no image file may exist" and "nothing is certified".

## What is missing to turn a locked contract into a certified image
Ranked by what blocks the most images.

1. **Reference evidence for geometry.** Text sources can establish that a part exists and roughly where. They cannot establish orientation, head shapes, connector styles or clamp sides. No BMW exploded view (RealOEM/ETK) was reachable. Highest-value fix: the owner's own photos of this car (factory kind `user-supplied-photo`, rights are clean). Needed: underside with the hatch open, top of the engine showing the filter cap and filler cap.
2. **An image generator.** The original generator adapters were lost. Only `FileDrop` (a human drops a PNG plus claims file), a scripted test double and an "unavailable" stub exist. Connecting a generation service costs money, so it needs owner approval. The adapter must return the provenance claims the factory checks (text-only prompt, no reference-image input, no tracing, no baked text).
3. **Independent QA actor.** By the owner's lock (U-20/U-23) the independent reviewer is Hermes / ChatGPT, never Claude. The factory needs a workflow that exports the QA packet and imports the raw response with its sha256. Claude's internal QA can pre-screen but can never admit an image.
4. **Owner sign-off.** `verified` status requires Andy's sign-off. The factory records `andyFinal: required` on every approved artifact.
5. **Registry integration.** `INTEGRATED`/`REVOKED` states are not built (U-12). The recovered resolver reads the registry, which is empty.
6. **No-cost alternative for simple diagrams.** The original-artwork SVG path (U-18) is not reconstructed. It would let code draw plain generic diagrams without any generator spend. It still needs QA and sign-off, and a diagram can only be as accurate as the evidence behind it. It needs an owner decision before building.

## Recommended order
1. Owner photos and the BMW option list (see `OWNER-INPUTS.md`). Two photos unblock the filter-cap visual and upgrade the drain-plug visual.
2. Decide on generator spend versus the SVG path.
3. Build the Hermes QA export/import workflow (no spend).
4. Generate, QA, sign off, integrate. Repeat per guide step that needs a picture.

Other guides' pictures follow the same rule: each step image needs an evidence packet first. A per-guide image shot list was not generated, because steps that depend on unconfirmed configuration (engine code, drive type, lighting, key type) would produce pictures of the wrong car.
