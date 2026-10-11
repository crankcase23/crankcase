# Independent image QA: oil-drain-hatch-locate

You are the INDEPENDENT reviewer for an instructional illustration in a DIY car-repair app (2010 BMW 328i, Sedan (E90)). You are not the author of the image or of the contract. Review the attached image (candidate.png, sha256 f1c6a719b791399507d80c6c73dfddc2c3ed0b98239774b789e2e1f88dde3a34, 1600x1000) against the contract below and nothing else. Do not give general design feedback. Do not be generous: one failed required item means the image fails.

## How to judge
- Every **must-depict** item must be clearly visible and plausible as described. FAIL if absent. NOT_VISIBLE if present but too small/occluded to judge.
- Every **must-not-depict** item must NOT appear in any recognisable form. FAIL if it does.
- Parts the contract lists as not established must be plain generic shapes, with no invented detail (head shapes, brand marks, fastener types, orientation).
- No text, letters, numbers, arrows, labels or watermarks anywhere. The top 3%-17% and bottom 83%-97% bands of the height must be plain.
- PROVENANCE: PASS only if there is no sign of copied or traced imagery and no baked-in text.
- A FAIL on a must-depict, must-not-depict or PROVENANCE item needs a finding with severity CRITICAL or CONTRACT citing that item id. Cosmetic issues are severity COSMETIC and do not fail the image.

## Contract items (answer every one)
- **MD-access-hatch** MUST DEPICT access-hatch (hero, critical). A small closed access hatch set into the lower undertray near the front-centre of the underside, drawn as a plain flat panel with a simple outline. Established attributes: existence, location.
- **MN-excl-front-bumper-and-grille** MUST NOT DEPICT front-bumper-and-grille: No source establishes the lower front styling for this car; left out.
- **MN-excl-suspension-and-subframe** MUST NOT DEPICT suspension-and-subframe: No source establishes the surrounding chassis layout; left out.
- **PROVENANCE** Answer PASS only if the image shows no sign of copied/traced source imagery, and contains no baked-in text. The generator's attestation is in the packet.

## Technical details to verify independently
For each must-depict part, the facts below were established from the cited sources (the car is a 2010 BMW 328i E90, N52 3.0L inline-6, rear-wheel drive and automatic, halogen headlights and standard key as decoded from its option codes by one free decoder; treat those three as probable, not proven). Check the image against them using your own knowledge and any source you can open. "Not established" attributes must appear only as plain generic shapes; if the image shows specific detail there, that is a finding.
- **access-hatch** (hero, critical): A small closed access hatch set into the lower undertray near the front-centre of the underside, drawn as a plain flat panel with a simple outline.
  - established existence: https://5series.net/forums/diy-do-yourself-14/n52-oil-change-question-wheres-drain-plug-97653 (third-party-guide: N52: drain plug is behind a small removable access panel on the underside; panel shape and fasteners differ by poster (a triangular panel; three screws); plug orientation reports differ (straight down vs facing right).); https://www.team-bhp.com/forum/diy-do-yourself/70233-diy-oil-change-bmw-e90-e91-e92-e93.html (third-party-guide: E90/E91/E92/E93 DIY: the drain bolt is behind an access hatch just behind the front-centre jack point, opened with a coin; 17 mm socket on a ratchet; copper crush washer replaced each time; the pan is placed a few inches to the right of the bolt.); https://g42.bimmerpost.com/forums/showthread.php?p=29969477 (third-party-guide: 17 mm plug with copper crush washer; oil exits sideways.)
  - established location: https://5series.net/forums/diy-do-yourself-14/n52-oil-change-question-wheres-drain-plug-97653 (third-party-guide: N52: drain plug is behind a small removable access panel on the underside; panel shape and fasteners differ by poster (a triangular panel; three screws); plug orientation reports differ (straight down vs facing right).); https://www.team-bhp.com/forum/diy-do-yourself/70233-diy-oil-change-bmw-e90-e91-e92-e93.html (third-party-guide: E90/E91/E92/E93 DIY: the drain bolt is behind an access hatch just behind the front-centre jack point, opened with a coin; 17 mm socket on a ratchet; copper crush washer replaced each time; the pan is placed a few inches to the right of the bolt.)
  - NOT established fine-detail-geometry (omit): Not established: one poster describes a triangular panel, others a small removable panel.
  - NOT established fastener-position (omit): Conflict: three screws vs coin-operated catch.

## How the image was prepared
The generator's native file (1586x992) was padded, not stretched or cropped, to an exact 16:10 canvas (1600x1000): padding left 7, right 7, top 4, bottom 4 px of edge-replicated background. Judge the illustration, not the padding. Native sha256 37fc4a493990d5af47bc677d224d0f71b80eede67096d66252228378d451876e.

## Prompt the image was generated from
```
Create ONE clean, polished, instructional illustration for a DIY car-repair guide. Text-only prompt: do not use, request or trace any reference image.

SUBJECT: Oil drain: where the undertray access hatch is, on a 2010 BMW 328i (E90) with the 3.0L inline-6, shown so a home mechanic can see what the step is about. Step: "Open the undertray access hatch".

FRAMING: Landscape, exactly 16:10 (deliver 1600x1000 px or larger at 16:10). Low view from beneath the front of the car looking rearward, mild perspective. LOCATE image: wide enough that a mechanic can find the part. Show the hero in its simplified surrounding structure, the hero taking roughly 15-30% of the frame width, the surroundings plain and simplified. MARGIN: leave a plain, empty, light neutral margin of at least 8% of the image width on the left and right and at least 8% of the height at the bottom; no part, panel, shadow or structure may touch or run off the left, right or bottom edge of the image. The subject floats on the plain ground, fully inside the frame. Style (CG-VS-1.0): clean, realistic 3D technical illustration; light neutral studio background (soft white to light grey); matte materials, soft light, soft contact shadows; tight component framing; minimal unnecessary detail. Realism applies to materials and lighting only: it does NOT license invented detail, so every part not listed below stays a plain generic shape. No orange or other saturated accent colours anywhere (a copper-coloured part may be copper); highlights and arrows are added later as an editable overlay.

MUST SHOW (clearly, in this order of importance):
1. HERO: A small closed access hatch set into the lower undertray near the front-centre of the underside, drawn as a plain flat panel with a simple outline. Do NOT depict its fine detail, where its fasteners sit: keep it a plain generic shape.

MAY SHOW, SIMPLIFIED AND DIM (background only): undertray panel. Keep every one of these generic and low-contrast. Never invent detail on them.

MUST NOT SHOW (leave these out entirely, do not substitute): front bumper and grille (No source establishes the lower front styling for this car; left out), suspension and subframe (No source establishes the surrounding chassis layout; left out), wrench or socket, hands, people, engine badges, logos, brand marks, licence plates.

NO TEXT of any kind: no labels, letters, numbers, markings on tools, arrows, callout lines, highlight outlines, banners, watermarks or captions anywhere in the image.

CLEAR SPACE: keep one horizontal band plain and uncluttered (light neutral background only): the top 3%-17% of the height, across the full width. The step banner and labels are added later in software.

Do not add any part not listed above. If unsure how a real part looks, draw a plain generic shape or leave it out.
```

## Reply format
Reply with ONE JSON object in a single ```json block and nothing else. Copy candidateSha256 exactly. Every item id above needs exactly one entry in "checks".

```json
{
  "candidateSha256": "f1c6a719b791399507d80c6c73dfddc2c3ed0b98239774b789e2e1f88dde3a34",
  "rubricVersion": "CG-QA-v1.0",
  "provenanceCheck": {
    "validated": "true|false",
    "notes": "short"
  },
  "checks": [
    {
      "contractItemId": "MD-access-hatch",
      "result": "one of PASS|FAIL|NOT_VISIBLE|NA"
    },
    {
      "contractItemId": "MN-excl-front-bumper-and-grille",
      "result": "one of PASS|FAIL|NOT_VISIBLE|NA"
    },
    {
      "contractItemId": "MN-excl-suspension-and-subframe",
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
