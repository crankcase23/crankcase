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

## Compact prompts, margins and the intake chain (current)
- The full evidence/contract prompt stays internal (`spec-prompt.full.txt`, parsed into the locked contract). What is sent to ChatGPT is a short compact prompt (`generation-prompt.txt`, factory-hashed): look, view, hero and "Do NOT depict" attributes, background-only parts, leave-out list, layout (8% plain margin left/right/bottom, plain 3-17% top band), no text. Critical constraints are never dropped to save length.
- The exact submitted text is recorded: the `intake` command requires `--attest`, writes `submittedPromptSha256` into the claims, the factory refuses a mismatch (`PROMPT_MISMATCH`), and the QA packet shows the prompt.
- IDENTIFY images show the hero plus a small isolated patch of surface floating on plain ground (a full-frame surface cannot satisfy the margin rule; found when attempt 1 failed `BORDER_NOT_PLAIN`).
- `fit-frame` pads, never stretches, and encodes the candidate at a zlib level whose bytes differ from the normaliser output (the normaliser refuses a byte-identical candidate; permanent regression tests cover this and pixel survival).
- Chain: `intake` (fit + claims + packet) -> independent review `import` -> `finish` (admit + normalise) -> `overlay-set` / `overlay-render` / `overlay-export` -> independent `overlay-import` (OVERLAY_PASSED) -> owner `sign-off` (APPROVED). Only `sign-off` makes anything certified, and only with the owner's own words.

## Not done yet (honest list)
- Reviewer and generator are both ChatGPT (separate chats): the factory's check passes, true independence is weak.
- Nothing is certified. `oil-drain-hatch-locate` is OVERLAY_PASSED and waits for owner sign-off.
