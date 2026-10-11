# Crankcase Garage visual standard CG-VS-1.0

Approved by the owner on 2026-10-10 for **style only**. The reference illustration's BMW accuracy was not certified and was rejected as an accuracy reference (`visual-standard/STYLE-REFERENCE-REVIEW.md`). Reference file: `visual-standard/reference/oil-drain-style-reference.png`.

## The look
Clean realistic 3D technical illustration. Light neutral background. Tight component framing. Minimal unnecessary detail. Orange guidance (`#FE6C01`) for highlights, arrows and the step banner.

## Three image types (every BMW visual has an `imageType`)
| Type | Job | Framing | Tools |
|---|---|---|---|
| LOCATE | Find it | Wide enough to find the part; hero 15-30% of frame width | none |
| IDENTIFY | This is it | Tight close-up, hero 40-60% of frame | none |
| DO | Do it | Tight close-up with the listed tool in working position | only tools listed as elements, never hands |

Current counts are in `image-evidence/output/PIPELINE-REPORT.json` (`summary.byType`).

## Rules that keep it honest
- Style never overrides evidence. Realism is for materials and light. Anything the ledger does not establish is a plain generic shape or left out, as before. The prompt says so explicitly.
- If an element's orientation is not established, IDENTIFY and DO view it end-on with no ground, horizon or body-edge cue.
- Orange, banners, step numbers, labels, outline boxes and arrows are NOT in the generated image. They are an editable vector overlay (`overlay.spec.json` per locked contract, rendered to SVG by `node scripts/bmw/visual-standard.mjs overlay --spec ... --out ...`). Highlight regions stay empty until an accepted image exists; nothing is drawn at an invented position.
- The generated ground is plain light neutral. `fit-frame` pads native images only when the touching edges are plain (any brightness).
- Evidence rule, contract lock, independent Hermes QA, normalization and owner sign-off are unchanged. The Guide Factory code is hash-locked and was not modified; the standard lives in the BMW pipeline layer, is inside the prompt the factory hashes, and is stamped into `PIPELINE-REPORT.json`.

## Applying it to the rest without blindly regenerating
No BMW image exists yet, so nothing is regenerated. Every one of the 35 contracts got a type and a re-rendered prompt; contracts that were evidence-insufficient stay blocked (list in `image-evidence/output/COVERAGE.md`). Visuals that would show a hand or a tool must list the tool as an element with evidence; today only the two DO visuals do.

## Not done yet (honest list)
- The factory's own overlay QA stage is not wired to the overlay spec. The spec is the editable source; hooking it into the factory means a factory change, which needs your approval because the factory files are hash-locked.
- No image has been generated, reviewed by Hermes or approved.
