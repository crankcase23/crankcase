# Independent image QA: oil-drain-plug-access

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
- **MD-drain-plug** MUST DEPICT drain-plug (hero, critical). The engine oil drain plug at the underside of the oil pan, drawn as a small plain plug shape. Established attributes: existence, location.
- **MD-access-hatch** MUST DEPICT access-hatch (target, critical). The small access hatch in the lower undertray near the front-centre of the underside, drawn as a plain rectangular panel with the plug visible through or beside it. Established attributes: existence, location.
- **MN-excl-hatch-fasteners-unestablished-detail** MUST NOT DEPICT hatch-fasteners-unestablished-detail: Sources conflict on how the hatch is fastened.
- **MN-excl-engine-cover-unestablished-detail** MUST NOT DEPICT engine-cover-unestablished-detail: An engine cover exists on the N52 but its exact shape is not established; it is left out of the picture.
- **PROVENANCE** Answer PASS only if the image shows no sign of copied/traced source imagery, and contains no baked-in text. The generator's attestation is in the packet.

## Technical details to verify independently
For each must-depict part, the facts below were established from the cited sources (the car is a 2010 BMW 328i E90, N52 3.0L inline-6, rear-wheel drive and automatic, halogen headlights and standard key as decoded from its option codes by one free decoder; treat those three as probable, not proven). Check the image against them using your own knowledge and any source you can open. "Not established" attributes must appear only as plain generic shapes; if the image shows specific detail there, that is a finding.
- **drain-plug** (hero, critical): The engine oil drain plug at the underside of the oil pan, drawn as a small plain plug shape.
  - established existence: https://5series.net/forums/diy-do-yourself-14/n52-oil-change-question-wheres-drain-plug-97653 (third-party-guide: N52: drain plug is behind a small removable access panel on the underside; one poster says slightly left of center (driver side); orientation reports differ (down vs right); links a RealOEM diagram (not retrieved).); https://www.1addicts.com/forums/showthread.php?p=6151834 (third-party-guide: N52 DIY: remove the oil filter housing cap with a cap wrench, drop in new cartridge with two O-rings, refit until marks align.); https://www.team-bhp.com/forum/diy-do-yourself/70233-diy-oil-change-bmw-e90-e91-e92-e93.html (third-party-guide: General E90 DIY: with bonnet open remove filler cap before draining (engine type not named).)
  - established location: https://5series.net/forums/diy-do-yourself-14/n52-oil-change-question-wheres-drain-plug-97653 (third-party-guide: N52: drain plug is behind a small removable access panel on the underside; one poster says slightly left of center (driver side); orientation reports differ (down vs right); links a RealOEM diagram (not retrieved).); https://www.team-bhp.com/forum/diy-do-yourself/70233-diy-oil-change-bmw-e90-e91-e92-e93.html (third-party-guide: General E90 DIY: with bonnet open remove filler cap before draining (engine type not named).)
  - NOT established orientation (omit): Sources conflict: slightly left of centre facing right vs vertical vs oil exits sideways.
  - NOT established fastener-head-type (omit): Only the 17 mm socket size is established, not the head shape.
- **access-hatch** (target, critical): The small access hatch in the lower undertray near the front-centre of the underside, drawn as a plain rectangular panel with the plug visible through or beside it.
  - established existence: https://5series.net/forums/diy-do-yourself-14/n52-oil-change-question-wheres-drain-plug-97653 (third-party-guide: N52: drain plug is behind a small removable access panel on the underside; one poster says slightly left of center (driver side); orientation reports differ (down vs right); links a RealOEM diagram (not retrieved).); https://www.team-bhp.com/forum/diy-do-yourself/70233-diy-oil-change-bmw-e90-e91-e92-e93.html (third-party-guide: General E90 DIY: with bonnet open remove filler cap before draining (engine type not named).); https://g42.bimmerpost.com/forums/showthread.php?p=29969477 (third-party-guide: 17mm plug with copper crush washer; oil exits sideways.)
  - established location: https://5series.net/forums/diy-do-yourself-14/n52-oil-change-question-wheres-drain-plug-97653 (third-party-guide: N52: drain plug is behind a small removable access panel on the underside; one poster says slightly left of center (driver side); orientation reports differ (down vs right); links a RealOEM diagram (not retrieved).); https://www.team-bhp.com/forum/diy-do-yourself/70233-diy-oil-change-bmw-e90-e91-e92-e93.html (third-party-guide: General E90 DIY: with bonnet open remove filler cap before draining (engine type not named).)
  - NOT established fastener-position (omit): Conflict: three screws vs coin-operated catch.

## Prompt the image was generated from
```
Create ONE clean, polished, instructional illustration for a DIY car-repair guide. Text-only prompt: do not use, request or trace any reference image.

SUBJECT: Oil drain plug and the undertray access hatch, on a 2010 BMW 328i (E90) with the 3.0L inline-6, shown so a home mechanic can see what the step is about. Step: "Open the undertray access hatch".

FRAMING: Landscape, exactly 16:10 (deliver 1600x1000 px or larger at 16:10). Low view from beneath the front of the car looking rearward, mild perspective. Soft studio lighting, contact shadows, dark graphite context with the hero part clearly brightest. Modern flat-shaded technical-illustration look. Simplified, NOT photorealistic.

MUST SHOW (clearly, in this order of importance):
1. HERO: The engine oil drain plug at the underside of the oil pan, drawn as a small plain plug shape. Do NOT depict its orientation, its fastener head shape: keep it a plain generic shape.
2. The small access hatch in the lower undertray near the front-centre of the underside, drawn as a plain rectangular panel with the plug visible through or beside it. Do NOT depict where its fasteners sit: keep it a plain generic shape.

MAY SHOW, SIMPLIFIED AND DIM (background only): oil pan, hatch fasteners, engine cover. Keep every one of these generic and low-contrast. Never invent detail on them.

MUST NOT SHOW (leave these out entirely, do not substitute): hatch fasteners detail (Sources conflict on how the hatch is fastened), engine cover detail (An engine cover exists on the N52 but its exact shape is not established; it is left out of the picture), wrench or socket, hands, people, engine badges, logos, brand marks, licence plates.

NO TEXT of any kind: no labels, letters, numbers, arrows, callout lines, watermarks or captions anywhere in the image.

CLEAR SPACE: keep two horizontal bands plain and uncluttered (dark, low-contrast background only): the top 3%-17% of the height and the bottom 83%-97% of the height, across almost the full width. Labels will be added later in software.

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
      "contractItemId": "MD-access-hatch",
      "result": "one of PASS|FAIL|NOT_VISIBLE|NA"
    },
    {
      "contractItemId": "MN-excl-hatch-fasteners-unestablished-detail",
      "result": "one of PASS|FAIL|NOT_VISIBLE|NA"
    },
    {
      "contractItemId": "MN-excl-engine-cover-unestablished-detail",
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
