# BMW 328i (E90) — image generation options (investigated, nothing spent)

Status: read-only investigation. No image was generated, no API was called, no credits were used.

## What the factory needs from a generator
A PNG that is exactly 16:10 and at least 1600x1000, produced from the locked text prompt only (no reference image, no tracing), plus a claims file with the generator's own attestation, request id, and the provider's usage terms. The generator must be a different system from the reviewer. The attestation is a statement by whoever ran the generator; the factory refuses the image if any flag is not true.

## Routes found

| Route | Cost to owner | Fits the factory? | Notes |
|---|---|---|---|
| **ElevenLabs connector in this workspace** (image models listed: GPT Image 1 / 1.5 / 2 / 2.5, Nano Banana family, FLUX.1 Kontext / FLUX.2 / FLUX 3, Recraft V4 family, Krea 2, Runway Gen-4 Image) | Draws on the owner's existing ElevenLabs credits. Not new money, but it is a finite quota | Best fit: custom width/height up to 3840 (1600x1000 or 2400x1500 is exact 16:10), text-only prompt, runs from here | **Not used.** Generating spends credits and the owner said no spend without approval. Needs one yes. Each generation call charges; a visual may need up to 4 cycles |
| **ChatGPT subscription (manual FileDrop)** | Included in the subscription, no API cost | Partly. Owner pastes the prompt, saves the PNG, drops it in. But ChatGPT image sizes are fixed ratios (for example 3:2); the factory refuses anything not exactly 16:10, and normalisation does not crop or re-ratio. Needs a size that is exactly 16:10, or a no-crop pad/resize step that the factory does not have | Same vendor as the independent reviewer. The factory only compares system strings, so it would not catch this: Andy should decide whether ChatGPT-generates and ChatGPT-reviews is acceptable. Safer: generate elsewhere, review in ChatGPT |
| **Other subscriptions the owner already has (for example Gemini)** | Included | Same manual FileDrop route, same exact-16:10 problem | Not checked: no connector exists in this session |
| **Original-artwork SVG path** (U-18, not rebuilt) | None | Would suit plain generic diagrams only | Still needs QA and sign-off. Needs an owner decision before building |
| **OpenAI / other image API** | Pay per image | Would fit with an adapter | Needs approval for spend and credentials. Not pursued |

## Recommendation
1. Cheapest decision for the owner: approve a small, capped ElevenLabs credit spend (suggest: one hero visual first, for example `oil-drain-plug-access`, up to 4 cycles) with a model chosen for clean flat technical illustration (the workspace lists Recraft V4.x and GPT Image; check the model guide before prompting). Claude then runs it from the locked prompt, drops the PNG and claims into the FileDrop route, and the owner takes the Hermes review.
2. If the owner prefers zero credit use: the ChatGPT-subscription route works only if the PNG is exactly 16:10. A small pad-free resize step would have to be added to the factory (it is a locked, hashed component) or the owner would have to produce an exact 1600x1000 file.
3. Either way the review must come from Hermes / ChatGPT (`npm run bmw:qa`), and owner sign-off is still required before any image is approved.

## What is built and ready (no spend)
- 35 visuals rendered to locked prompts or provisional prompts: `docs/bmw-e90/image-evidence/output/`.
- Candidate import (`hermes-qa.mjs drop-template`, `drop-import`): validates the PNG and claims, refuses unfilled or false attestations.
- Independent review export/import (`hermes-qa.mjs export`, `import`): builds the packet, validates the raw reply, hashes it, records it as Hermes' review.
