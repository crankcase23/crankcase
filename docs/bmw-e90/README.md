# 2010 BMW 328i (E90) package

Nothing here is published or certified. Draft guides are admin-only (`/admin/guides`, same gate as the Charger test guide).

| Path | What |
|---|---|
| `evidence/guide-NN.json` | Per-guide research ledger: tools, parts, fluids, torque, steps, evidence tier, proposed visuals; each fact tagged VERIFIED / VERIFIED_SECONDARY / SINGLE_SOURCE / CONFLICT / MISSING with source URLs |
| `EVIDENCE-SUMMARY.md` | Generated per-guide counts, readiness, missing evidence and owner inputs |
| `OWNER-INPUTS.md` | What only the owner can supply, ranked |
| `IMAGE-PIPELINE-AUDIT.md` | Image factory status and what is missing for certified images |
| `IMAGE-GENERATION-OPTIONS.md` | Generator routes investigated (no spend) and a recommendation |
| `image-evidence/output/` | Committed pipeline run: coverage table and per-visual factory records (no images) |

Commands: `npm run bmw:validate` (ledger schema), `npm run bmw:drafts` (regenerate drafts and summary), `npm run bmw:pipeline` (all visuals through the factory), `npm run bmw:qa -- <export|import|drop-template|drop-import>` (independent QA and candidate import), `npm run bmw:test`.

To update a guide: edit its `evidence/guide-NN.json`, run `npm run bmw:validate && npm run bmw:drafts && npm run bmw:pipeline`, commit all outputs. Never edit `src/data/admin-test-guides/bmw-2010-328i-drafts.ts` by hand.

Live image work should use `npm run bmw:pipeline -- --out <untracked dir>` so real candidates never land in the committed output folder.
