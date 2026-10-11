# recovered/ — COPIES of recovered original evidence (READ-ONLY)

Tag: **RECOVERED / ORIGINAL** (bytes), except `doc-derived/` which is **RECOVERED-FROM-DOCUMENTATION** (text copied out of a Project doc; whitespace not byte-verified).

- The ORIGINALS stay untouched on AndyLaptop (`<owner laptop path redacted>`, tgz SHA256 47a2a87b…52d9). These are working copies so the reconstruction can read/run them. Hashes are in SHA256SUMS.txt and match the C-2 master index.
- Files are chmod a-w. Nothing under `src/` of the reconstruction may write here. `tests/quarantine.test.mjs` verifies the hashes on every run.
- `src/types/guideVisuals.ts`, `src/lib/guideVisuals.ts`, `src/data/guide-visuals/*` come from `charger-guide-001-deploy-bundle.tgz` (the newer 11,165 B / 8,365 B contract layer).
- `visual-sources/*` and `scripts-visuals/lib.mjs` come from the laptop working tree (older, pre-factory visual pipeline).
- `doc-derived/step-10-handoff-prompt.txt` = Project doc `claude/guide-factory-charger-proving-run-step10-handoff-2026-09-26.md`.
