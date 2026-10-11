# 2010 BMW 328i (E90) package

Nothing here is published or certified. Draft guides are admin-only (`/admin/guides`, same gate as the Charger test guide).

| Path | What |
|---|---|
| `evidence/guide-NN.json` | Per-guide research ledger: tools, parts, fluids, torque, steps, each tagged VERIFIED / SINGLE_SOURCE / CONFLICT / MISSING with source URLs |
| `EVIDENCE-SUMMARY.md` | Generated per-guide counts, missing evidence and owner inputs |
| `OWNER-INPUTS.md` | What only the owner can supply, ranked |
| `IMAGE-PIPELINE-AUDIT.md` | Image factory audit and first pipeline test |
| `image-evidence/` | Sources and prompts for the oil-change visuals, plus the committed pipeline run |

Commands: `npm run bmw:drafts` (regenerate drafts and summary from the evidence), `npm run bmw:pipeline` (oil-change visuals through the factory), `npm run bmw:test`.

To update a guide: edit its `evidence/guide-NN.json`, run `npm run bmw:drafts`, commit both. Never edit `src/data/admin-test-guides/bmw-2010-328i-drafts.ts` by hand.
