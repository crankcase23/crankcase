# BMW 328i (E90, VIN WBAPH7C58AA175760): guide status, 2026-10-10

> **2026-10-11 PIVOT: image factory paused. Working guides first.** Current readiness (all 16 working, 3 steps blocked, 1 section inapplicable, browser-tested desktop + phone) is in `READINESS-MATRIX.md`; screenshots and the JSON receipt are in `preview-receipts/2026-10-11/`. Re-run with `npm run bmw:preview -- --out DIR`. The table below predates the pivot (step counts changed: blocked/inapplicable handling) and is kept for the evidence columns.


Certified guides: **0 of 16**. Usable uncertified drafts (admin-only): **16 of 16** (guide 3 has no visuals by design). No image is certified. Two ChatGPT-generated images exist in the repo and are NOT certified: `oil-drain-hatch-locate` (OVERLAY_PASSED, waiting for owner sign-off) and `oil-drain-plug-identify` (image QA passed and normalized; overlay QA failed 3x, factory phase NEEDS_ANDY, see `image-intake/overlay-qa/oil-drain-plug-identify/FINDING.md`). Guide 16 (Engine Oil & Filter Change) is the only guide with images in progress; the other 15 are unchanged.

| # | Guide | Status | Steps | Torque rows (verified) | Visuals | Open missing-evidence items |
|---|---|---|---|---|---|---|
| 1 | Front Brake Pads | BUILDABLE | 20 | 6 (5) | 2 | 9 |
| 2 | Fuse & Bulb Replacement | BUILDABLE_PARTIAL | 12 | 1 (0) | 2 | 9 |
| 3 | Key Fob Battery | BUILDABLE_PARTIAL | 8 | 1 (1) | 0 | 6 |
| 4 | Oxygen Sensor | BUILDABLE | 12 | 3 (1) | 3 | 8 |
| 5 | Rear Brake Pads | BUILDABLE_PARTIAL | 16 | 7 (4) | 2 | 9 |
| 6 | Serpentine Belt | BUILDABLE_PARTIAL | 11 | 4 (1) | 2 | 8 |
| 7 | Battery Replacement | BUILDABLE_PARTIAL | 15 | 3 (0) | 2 | 7 |
| 8 | Coolant Flush & Fill | BUILDABLE | 15 | 5 (2) | 2 | 8 |
| 9 | Fluid Checks & Top-Offs | BUILDABLE_PARTIAL | 7 | 2 (1) | 2 | 8 |
| 10 | Cabin Air Filter | BUILDABLE_PARTIAL | 8 | 1 (0) | 2 | 8 |
| 11 | PCV / Crankcase Ventilation — Inspection & Diagnosis | BUILDABLE_PARTIAL | 9 | 0 (0) | 1 | 6 |
| 12 | Engine Air Filter | BUILDABLE | 10 | 1 (0) | 2 | 8 |
| 13 | Tire Rotation | BUILDABLE_PARTIAL | 11 | 2 (1) | 3 | 7 |
| 14 | Wiper Blades | BUILDABLE | 6 | 1 (0) | 1 | 8 |
| 15 | Differential / Transfer Case Fluid | BUILDABLE | 8 | 4 (1) | 2 | 7 |
| 16 | Engine Oil & Filter Change | BUILDABLE_PARTIAL | 13 | 2 (2) | 7 | 11 |

Per-guide resolved/open detail lives in each ledger's `resolutionNotes` and `missingEvidence` (`evidence/guide-NN.json`).

## Why none is certified
- No BMW TIS document was reachable. Torques and capacities are secondary-source only unless the ledger says VERIFIED.
- Video evidence is title-level only (`video-evidence/`, 94 candidates, 0 viewed). It cannot certify torque or safety.
- Certification also needs the Hermes review, factory gates and owner sign-off.

## Correction
The earlier claim that RealOEM lists only the manual oil pan was wrong: a later read found the automatic pan 11137552414 with plug 11137535106 and washer 07119963151. Plug location and orientation on that pan are still unestablished.
