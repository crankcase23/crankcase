# Independent image QA: oil-drain-plug-loosen

You are the INDEPENDENT reviewer for an instructional illustration in a DIY car-repair app (2010 BMW 328i, Sedan (E90)). You are not the author of the image or of the contract. **PREVIEW: the contract is locked but the candidate image has not been generated yet. Do not review anything from this file; the final packet is issued with the image.**

Review the attached image (candidate.png, sha256 (set when the image exists), size set when the image exists) against the contract below and nothing else. Do not give general design feedback. Do not be generous: one failed required item means the image fails.

## How to judge
- Every **must-depict** item must be clearly visible and plausible as described. FAIL if absent. NOT_VISIBLE if present but too small/occluded to judge.
- Every **must-not-depict** item must NOT appear in any recognisable form. FAIL if it does.
- Parts the contract lists as not established must be plain generic shapes, with no invented detail (head shapes, brand marks, fastener types, orientation).
- No text, letters, numbers, arrows, labels or watermarks anywhere. The top 3%-17% and bottom 83%-97% bands of the height must be plain.
- PROVENANCE: PASS only if there is no sign of copied or traced imagery and no baked-in text.
- A FAIL on a must-depict, must-not-depict or PROVENANCE item needs a finding with severity CRITICAL or CONTRACT citing that item id. Cosmetic issues are severity COSMETIC and do not fail the image.

## Contract items (answer every one)
- **MD-drain-plug** MUST DEPICT drain-plug (hero, critical). The engine oil drain plug seen end-on, a short external hex head with a copper-coloured crush washer, with the socket fitted over its head. Established attributes: existence, location, fastener-head-type.
- **MD-tool-socket-and-ratchet** MUST DEPICT tool-socket-and-ratchet (target, procedure). A plain chrome 17 mm socket fitted over the plug head, on a plain ratchet whose handle extends away from the plug; no markings or engraving. Established attributes: existence, location.
- **MN-excl-pan-bolts-and-ribs** MUST NOT DEPICT pan-bolts-and-ribs: Pan fasteners and rib layout are not established for the automatic pan; left out.
- **PROVENANCE** Answer PASS only if the image shows no sign of copied/traced source imagery, and contains no baked-in text. The generator's attestation is in the packet.

## Technical details to verify independently
For each must-depict part, the facts below were established from the cited sources (the car is a 2010 BMW 328i E90, N52 3.0L inline-6, rear-wheel drive and automatic, halogen headlights and standard key as decoded from its option codes by one free decoder; treat those three as probable, not proven). Check the image against them using your own knowledge and any source you can open. "Not established" attributes must appear only as plain generic shapes; if the image shows specific detail there, that is a finding.
- **drain-plug** (hero, critical): The engine oil drain plug seen end-on, a short external hex head with a copper-coloured crush washer, with the socket fitted over its head.
  - established existence: https://5series.net/forums/diy-do-yourself-14/n52-oil-change-question-wheres-drain-plug-97653 (third-party-guide: N52: drain plug is behind a small removable access panel on the underside; panel shape and fasteners differ by poster (a triangular panel; three screws); plug orientation reports differ (straight down vs facing right).); https://www.team-bhp.com/forum/diy-do-yourself/70233-diy-oil-change-bmw-e90-e91-e92-e93.html (third-party-guide: E90/E91/E92/E93 DIY: the drain bolt is behind an access hatch just behind the front-centre jack point, opened with a coin; 17 mm socket on a ratchet; copper crush washer replaced each time; the pan is placed a few inches to the right of the bolt.); https://g42.bimmerpost.com/forums/showthread.php?p=29969477 (third-party-guide: 17 mm plug with copper crush washer; oil exits sideways.)
  - established location: https://5series.net/forums/diy-do-yourself-14/n52-oil-change-question-wheres-drain-plug-97653 (third-party-guide: N52: drain plug is behind a small removable access panel on the underside; panel shape and fasteners differ by poster (a triangular panel; three screws); plug orientation reports differ (straight down vs facing right).); https://www.team-bhp.com/forum/diy-do-yourself/70233-diy-oil-change-bmw-e90-e91-e92-e93.html (third-party-guide: E90/E91/E92/E93 DIY: the drain bolt is behind an access hatch just behind the front-centre jack point, opened with a coin; 17 mm socket on a ratchet; copper crush washer replaced each time; the pan is placed a few inches to the right of the bolt.); https://us.haynes.com/blogs/step-by-step-guides/oil-change-bmw-x3-2003-2010 (third-party-guide: Haynes (X3 2003-2010, engine code not named): sump plug on the base of the engine, 17 mm spanner or socket, replace the plug washer.)
  - established fastener-head-type: https://www.turnermotorsport.com/p-54317188-engine-oil-drain-plug/ (parts-catalog: Turner: engine oil drain plug is a classic 17 mm external male hex head, M12x1.5x16, sold with its crush washer; fitment table lists E90 328i N52.); https://www.ecstuning.com/b-genuine-bmw-parts/screw-plug/11137535106/ (parts-catalog: ECS: genuine screw plug 11137535106 for the oil change or a damaged hex head; fitment table lists E90 328i N52; crush washer sold separately.)
  - NOT established orientation (omit): Not established for this car. Oil pan variant: Turner lists separate engine oil pans for manual (11137553164) and automatic (11137552414) cars; the RealOEM 328i diagram shows only the manual pan (S205A = No). This car is an automatic (S205), so plug position and orientation on ITS pan are not established; keep the pan a plain generic mass.
- **tool-socket-and-ratchet** (target, procedure): A plain chrome 17 mm socket fitted over the plug head, on a plain ratchet whose handle extends away from the plug; no markings or engraving.
  - established existence: https://www.team-bhp.com/forum/diy-do-yourself/70233-diy-oil-change-bmw-e90-e91-e92-e93.html (third-party-guide: E90/E91/E92/E93 DIY: the drain bolt is behind an access hatch just behind the front-centre jack point, opened with a coin; 17 mm socket on a ratchet; copper crush washer replaced each time; the pan is placed a few inches to the right of the bolt.); https://g42.bimmerpost.com/forums/showthread.php?p=29969477 (third-party-guide: 17 mm plug with copper crush washer; oil exits sideways.); https://us.haynes.com/blogs/step-by-step-guides/oil-change-bmw-x3-2003-2010 (third-party-guide: Haynes (X3 2003-2010, engine code not named): sump plug on the base of the engine, 17 mm spanner or socket, replace the plug washer.)
  - established location: https://www.team-bhp.com/forum/diy-do-yourself/70233-diy-oil-change-bmw-e90-e91-e92-e93.html (third-party-guide: E90/E91/E92/E93 DIY: the drain bolt is behind an access hatch just behind the front-centre jack point, opened with a coin; 17 mm socket on a ratchet; copper crush washer replaced each time; the pan is placed a few inches to the right of the bolt.); https://www.turnermotorsport.com/p-54317188-engine-oil-drain-plug/ (parts-catalog: Turner: engine oil drain plug is a classic 17 mm external male hex head, M12x1.5x16, sold with its crush washer; fitment table lists E90 328i N52.); https://us.haynes.com/blogs/step-by-step-guides/oil-change-bmw-x3-2003-2010 (third-party-guide: Haynes (X3 2003-2010, engine code not named): sump plug on the base of the engine, 17 mm spanner or socket, replace the plug washer.)
  - NOT established fine-detail-geometry (omit): Only one thread says 1/2 inch drive; others are silent.

## Prompt the image was generated from
```
Create ONE clean, polished, instructional illustration for a DIY car-repair guide. Text-only prompt: do not use, request or trace any reference image.

SUBJECT: Oil drain: loosening the drain plug with a 17 mm socket, on a 2010 BMW 328i (E90) with the 3.0L inline-6, shown so a home mechanic can see what the step is about. Step: "Drain the sump".

FRAMING: Landscape, exactly 16:10 (deliver 1600x1000 px or larger at 16:10). End-on view straight along the axis of the part, against a plain simplified surface; no ground, horizon or body edges visible. DO image: tight close-up of the hero part with the listed tool in working position, no hands. If an element's orientation is listed as not established, view it end-on with no ground, horizon, body edge or gravity cue. Style (CG-VS-1.0): clean, realistic 3D technical illustration; light neutral studio background (soft white to light grey); matte materials, soft light, soft contact shadows; tight component framing; minimal unnecessary detail. Realism applies to materials and lighting only: it does NOT license invented detail, so every part not listed below stays a plain generic shape. No orange or other saturated accent colours anywhere (a copper-coloured part may be copper); highlights and arrows are added later as an editable overlay.

MUST SHOW (clearly, in this order of importance):
1. HERO: The engine oil drain plug seen end-on, a short external hex head with a copper-coloured crush washer, with the socket fitted over its head. Do NOT depict its orientation: keep it a plain generic shape.
2. A plain chrome 17 mm socket fitted over the plug head, on a plain ratchet whose handle extends away from the plug; no markings or engraving. Do NOT depict its fine detail: keep it a plain generic shape.

MAY SHOW, SIMPLIFIED AND DIM (background only): oil pan surface. Keep every one of these generic and low-contrast. Never invent detail on them.

MUST NOT SHOW (leave these out entirely, do not substitute): pan bolts and ribs (Pan fasteners and rib layout are not established for the automatic pan; left out), hands, people, engine badges, logos, brand marks, licence plates.

NO TEXT of any kind: no labels, letters, numbers, markings on tools, arrows, callout lines, highlight outlines, banners, watermarks or captions anywhere in the image.

CLEAR SPACE: keep one horizontal band plain and uncluttered (light neutral background only): the top 3%-17% of the height, across the full width. The step banner and labels are added later in software.

Do not add any part not listed above. If unsure how a real part looks, draw a plain generic shape or leave it out.
```

## Reply format
Reply with ONE JSON object in a single ```json block and nothing else. Copy candidateSha256 exactly. Every item id above needs exactly one entry in "checks".

```json
{
  "candidateSha256": "(sha256 of candidate.png)",
  "rubricVersion": "CG-QA-v1.0",
  "provenanceCheck": {
    "validated": "true|false",
    "notes": "short"
  },
  "checks": [
    {
      "contractItemId": "MD-drain-plug",
      "result": "one of PASS|FAIL|NOT_VISIBLE|NA"
    },
    {
      "contractItemId": "MD-tool-socket-and-ratchet",
      "result": "one of PASS|FAIL|NOT_VISIBLE|NA"
    },
    {
      "contractItemId": "MN-excl-pan-bolts-and-ribs",
      "result": "one of PASS|FAIL|NOT_VISIBLE|NA"
    },
    {
      "contractItemId": "PROVENANCE",
      "result": "one of PASS|FAIL|NOT_VISIBLE|NA"
    }
  ],
  "findings": [
    {
      "id": "F1",
      "severity": "CRITICAL|CONTRACT|COSMETIC|IGNORE",
      "contractItemRef": "an item id above",
      "element": "element id",
      "attribute": "e.g. location",
      "description": "what is wrong",
      "requiredChange": "what to change",
      "fixType": "modify|remove|suppress|simplify|relocate|add",
      "gate": "VISUAL_ACCURACY",
      "evidenceDeficiency": false,
      "regression": false
    }
  ],
  "regressionCheck": []
}
```
