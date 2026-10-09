**THIS GUIDE FACTORY IMPLEMENTATION IS RECONSTRUCTED FROM SURVIVING EVIDENCE. IT IS NOT THE LOST ORIGINAL IMPLEMENTATION.**

# Charger #001 Step 10 — PROPOSED canonical contract (C-5)

**Status: PROPOSED (C-5) — pending Andy/Hermes acceptance. Recovered originals unchanged. No artwork generated.** Source of truth for the code: `charger-step10/canonical-step10.mjs` (this file is generated from it). Recovered originals are untouched.

**Priority rule (Andy):** mechanical truth beats old visual wording. The only surviving statement of the mechanical procedure is the guide's own step-10 text, so it is the anchor, quoted verbatim. Where an old image constraint would make the picture misrepresent that action, the constraint is withdrawn. Nothing about how the real parts look is invented: every such fact is isolated in §VV and gates drawing.

## Step 10 in plain English
Title: **Remove intake duct**. The owner reads the guide's five sentences exactly as written. One picture of the engine bay (cover already off) shows the intake hose/resonator assembly between the throttle body and the air-cleaner housing, with everything the five actions touch in plain view: the IAT connector, both clamps (tightening points visible), the retaining grommet, and the assembly itself. Five labels, in the order of the five actions. Nothing is drawn from memory or from the old prompt: every drawn fact must first be established from a reference.

## Exact title
Remove intake duct

## Exact owner-facing instruction text (verbatim from the guide)
Disconnect the IAT electrical connector. Loosen the clamp at the throttle body. Loosen the clamp at the air-cleaner housing. Release the intake assembly from its retaining grommet. Remove the intake hose/resonator assembly.

## Visual subject
The engine bay of a 2016 Dodge Charger SXT with the 3.6L Pentastar V6, engine cover already removed (guide step 2), showing the intake assembly between the throttle body and the air-cleaner housing with every part that the five actions touch unobstructed in one view.

## Required visible components (ranked)
1. `intake-hose-resonator-assembly` (hero)
2. `throttle-body-clamp` (target)
3. `air-cleaner-housing-clamp` (target)
4. `iat-connector` (target)
5. `retaining-grommet` (target)
6. `throttle-body` (target)
7. `air-cleaner-housing` (target)

May appear, simplified and dim, never with invented detail: cowl trough along the top edge; radiator-support cover along the bottom edge; inner fender walls; strut-tower caps as plain domes; plain engine-top mass; plain coolant reservoir; plain washer-fluid bottle; intake plenum (only if established); one plain de-emphasized box for the battery/power-distribution box.

## Prohibited
- engine cover (removed in step 2)
- the engine-cover fixings of step 2
- breather hose (unless VV-07 shows it is attached to the assembly)
- fresh-air snorkel (unless VV-07 shows it is attached to the assembly)
- wipers
- hood hinges or struts
- wiring looms
- coolant hoses
- ABS unit
- oil cap or dipstick
- engine badges, logos, brand marks, licence plates
- any release/locking/fastener detail not established by evidence
- any part not listed in mustShow or maySimplifyDim
- text of any kind in the image

## Required callouts and labels (in order) / action sequence represented
| # | guide action (verbatim) | callout label | target element |
|---|---|---|---|
| 1 | Disconnect the IAT electrical connector. | **IAT connector** | `iat-connector` |
| 2 | Loosen the clamp at the throttle body. | **Throttle-body clamp** | `throttle-body-clamp` |
| 3 | Loosen the clamp at the air-cleaner housing. | **Air-cleaner housing clamp** | `air-cleaner-housing-clamp` |
| 4 | Release the intake assembly from its retaining grommet. | **Retaining grommet** | `retaining-grommet` |
| 5 | Remove the intake hose/resonator assembly. | **Intake hose/resonator** | `intake-hose-resonator-assembly` |

Five actions, one image, five callouts (limit is six). Callout geometry cannot exist before an image does.

## Terminology dictionary
| term | status | meaning | where used |
|---|---|---|---|
| intake duct | CANONICAL (title only) | The guide step's title word for the removable intake assembly of this step. Used in the step title only. | title |
| intake hose/resonator assembly | CANONICAL (assembly name) | The one removable assembly named in the guide's action 5 and referred to as 'the intake assembly' in action 4. Hose and resonator are parts of this single assembly in this step; neither is a separately removed part. | instruction text (verbatim), alt text, callout 'Intake hose/resonator' |
| intake hose | CANONICAL (part of the assembly) | The hose portion of the assembly. Not a separate callout; the assembly is the callout target. | descriptive only |
| resonator | CANONICAL (part of the assembly) | The resonator portion of the assembly, as named by the guide. Never listed as separately removed, shown, or hidden. Whether it is a visibly distinct section is VV-02. | descriptive only |
| air-cleaner housing | CANONICAL (component name) | The component at the far end of the assembly from the throttle body, named in guide action 3. | instruction text, callout 'Air-cleaner housing clamp' |
| throttle body | CANONICAL | The component at the engine end of the assembly, named in guide action 2. | instruction text, callout 'Throttle-body clamp' |
| IAT electrical connector | CANONICAL; short form 'IAT connector' for callouts | The electrical connector named in guide action 1. | instruction text; callout 'IAT connector' |
| retaining grommet | CANONICAL | The grommet that retains the intake assembly (guide action 4). Not the engine-cover grommets of guide step 2. | instruction text, callout 'Retaining grommet' |
| air inlet duct | LEGACY alias (old manifest 'component') | Same assembly as 'intake duct' by the manifest's own usage. Not used in any customer-facing text or in the visual brief. | never |
| air intake hose | LEGACY alias (old prompt 'Step:') | Old prompt's name for the hero. Narrower than the guide's 'intake hose/resonator assembly'. Banned from customer-facing text and the brief. | never |
| air box | LEGACY alias (old prompt/shot list); ASSUMED same component as air-cleaner housing | Not confirmed to be the same part as the air-cleaner housing (VV-03). Banned from customer-facing text and the brief; the guide's term wins. | never |
| IAT clip | LEGACY alias (old shot-list rationale) | Guide says 'IAT electrical connector'; a 'clip' is a different claim about the mechanism. Banned. | never |

## Representation rules
- **Clamps.** Both clamps are shown as clamps on the assembly, each unobstructed, with its TIGHTENING point visible to the viewer, because the action is to LOOSEN it and an image that hides the tightening point misrepresents the action. The tightening feature's TYPE, HEAD and side are drawn ONLY from established evidence (ledger attributes fastener-position and fastener-head-type, both safety-critical); until established the step is BLOCKED, not guessed. No torque, size or direction-of-turn is stated.
- **Connector.** The IAT connector is shown fully visible and unobstructed, as a plain connector attached to what it connects to, with its callout arrow touching it. Release or locking detail is drawn ONLY if established (release-mechanism-geometry is safety-critical); otherwise it is drawn plain, the instruction text carries the action, and the standing 'Simplified illustration' disclosure applies. No colours, tabs, pins or latches are invented.
- **Retaining grommet.** The retaining grommet IS shown and IS the fourth callout, because guide action 4 acts on it. Its type and location are drawn only from established evidence (VV-01). The engine-cover fixings of step 2 are never drawn (the cover is already removed).
- **Resonator / hero.** The resonator is NOT a separate part, callout or prohibition. The hero is the guide's intake hose/resonator assembly. Only the sections evidence establishes are drawn (hose, resonator, and the join between them as evidence shows it); no section, seam or ring is invented or denied.

## Visual production route
generated-raster-text-only — reconstructed Guide Factory (EP → VC → generation → QA → normalization → overlay → approval). Image inputs: none; reference evidence is reference-only and never an image input. Rejected: raw photograph (old manifest route: no source, licence or verification survives); original vector artwork (shot-list route: its controlling v3 spec is lost; factory has no SVG path, U-18).
Framing: 16:10, ≥1600x1000, front-elevated, about 50-55 degrees above horizontal, centred at the front of the bay, looking rearward, mild perspective; simplified flat-shaded technical illustration, not photorealistic; clear-space bands top 3–17% and bottom 83–97% (VV-08: all five callout targets must be unobstructed from this viewpoint; if not, the viewpoint changes, the actions are not hidden).

## Evidence requirements
- Per element: ESTABLISHED ledger rows citing real reference ids for existence and location of all seven mustShow elements.
- Relationships: the assembly runs between the throttle body and the air-cleaner housing; each clamp sits at its end; the grommet retains the assembly; the connector's attachment point.
- If drawn: clamp: hardware-type, fastener-position, fastener-head-type (safety-critical); connector: hardware-type, release-mechanism-geometry (safety-critical); grommet: hardware-type, relationship (what it retains); assembly: fine-detail-geometry of its sections (hose, resonator, join).
- Never: an image input, a trace, or any fact taken from an old prompt/manifest/shot list instead of a reference.
- Ownership: Generated Crankcase assets are Redline Origin / Crankcase project assets, subject to the generation provider's applicable usage rights. No ownership claim beyond the rights the provider actually grants.

## QA requirements
- Internal: claude-qa content-stage review (may fail/pass; never certifies its own output).
- Independent: Hermes / ChatGPT / GPT-5.6 Sol — actor hermes, GPT/ChatGPT model string, Hermes/ChatGPT/OpenAI system string, sha256 of the raw response; only this PASS admits output.
- Contract checks: every mustShow element present and unobstructed; every mustNotShow item absent; PROVENANCE; all five callout targets visible from the chosen viewpoint; clamp tightening point visible and drawn only from evidence; connector fully visible; release detail only if established; retaining grommet shown; hero composition matches evidence (no invented sections or seams); no text anywhere in the image; 16:10, ≥1600x1000, clear-space bands plain.
- Overlay: hermes confirms each of the five callout arrows touches the component its label names (PASS_OVERLAY, max 3 rounds).
- Disclosure: "Simplified illustration". Caps: initial generation + 3 corrections; metadata retry: initial + up to 3 resubmissions, 4th rejection → NEEDS_ANDY (canonical, U-22).

## Resolution of each conflict (CF-01 … CF-09)
| id | surviving conflicting requirements (verbatim, from the conflict table) | proposed canonical interpretation | why it matches the mechanical procedure | still needs vehicle verification | locking regression |
|---|---|---|---|---|---|
| **CF-01** What the step / hero part is called | **GUIDE**: “step(10, P4, "Remove intake duct",”<br>**GUIDE**: “Remove the intake hose/resonator assembly.”<br>**PROMPT**: “Step: "Remove the air intake hose."”<br>**MANIFEST**: “"component": "Air inlet duct, IAT connector, clamps, grommet"”<br>**SHOTLIST**: “"Intake hose",” | Title 'Remove intake duct' (guide, unchanged). The removable thing is the 'intake hose/resonator assembly' (guide wording, unchanged). 'air inlet duct', 'air intake hose' are legacy aliases and are banned from customer-facing text and the brief. | The guide is the surviving statement of the procedure; the aliases are later visual-pipeline wordings that narrow it (a 'hose' alone drops the resonator the guide removes). | VV-02, VV-03 | `tests/step10-canonical.test.mjs` “STEP10 CANONICAL CF-01” |
| **CF-02** Retaining grommet — required by the step, banned by the prompt, split between manifest and shot list | **GUIDE**: “Release the intake assembly from its retaining grommet.”<br>**PROMPT**: “engine cover, hose grommet, resonator, any second or red locking feature on the connector”<br>**MANIFEST**: “"Retaining grommet"”<br>**SHOTLIST**: “Every callout target below is a component the step's own text names; none is added by us.” | The retaining grommet is SHOWN and is callout 4 'Retaining grommet'. The old MUST NOT SHOW 'hose grommet' is withdrawn. Step-2 engine-cover grommets stay out of the picture. | Action 4 is 'release the intake assembly from its retaining grommet'. An image that cannot show the grommet cannot illustrate a fifth of the procedure, and the manifest itself lists it as a target. | VV-01 | `tests/step10-canonical.test.mjs` “STEP10 CANONICAL CF-02” |
| **CF-03** Resonator — named in the step text, banned by the prompt | **GUIDE**: “Remove the intake hose/resonator assembly.”<br>**PROMPT**: “MUST NOT SHOW (leave these out entirely, do not substitute): engine cover, hose grommet, resonator,”<br>**PROMPT**: “No seam, joint or ring between the two sections.” | The resonator is part of the hero assembly, not a separate part and not prohibited. The hero is drawn only with the sections evidence establishes; 'no seam, joint or ring' is withdrawn. | Action 5 removes a 'hose/resonator assembly'. Forbidding the resonator and mandating a seamless single hose contradicts the guide and asserts a construction nobody has verified. | VV-02 | `tests/step10-canonical.test.mjs` “STEP10 CANONICAL CF-03” |
| **CF-04** Callout target set and order (manifest vs shot list vs step text vs callout spec) | **MANIFEST**: “"IAT electrical connector",”<br>**MANIFEST**: “"Clamp at the throttle body",”<br>**MANIFEST**: “"Clamp at the air-cleaner housing",”<br>**SHOTLIST**: “"IAT connector",”<br>**SHOTLIST**: “"Air-box clamp",”<br>**SHOTLIST**: “Four actions on one assembly: IAT clip, two clamps, then lift the hose out.”<br>**CALLOUT_SPEC**: “Components the step text itself names, in the order they should be called out.” | Exactly five callouts, in the guide's action order: IAT connector; Throttle-body clamp; Air-cleaner housing clamp; Retaining grommet; Intake hose/resonator. | The recovered callout rule says targets are the components the step text names, in the order they should be called out. The manifest list lacks the assembly, the shot-list lacks the grommet; the union in step-text order satisfies the rule and is under the 6-callout limit. | VV-01, VV-03 | `tests/step10-canonical.test.mjs` “STEP10 CANONICAL CF-04” |
| **CF-05** Number of actions illustrated | **GUIDE**: “Disconnect the IAT electrical connector. Loosen the clamp at the throttle body. Loosen the clamp at the air-cleaner housing. Release the intake assembly from its retaining grommet. Remove the intake hose/resonator assembly.”<br>**SHOTLIST**: “Four actions on one assembly: IAT clip, two clamps, then lift the hose out.” | Five actions are represented, one per callout, by one image. The shot-list 'Four actions… IAT clip' rationale is withdrawn. | The guide has five actions; dropping the grommet release misstates the procedure. | VV-06, VV-08 | `tests/step10-canonical.test.mjs` “STEP10 CANONICAL CF-05” |
| **CF-06** 'Air-cleaner housing' vs 'air box' | **GUIDE**: “Loosen the clamp at the air-cleaner housing.”<br>**MANIFEST**: “"_needs": "Air-inlet system from the throttle body back to the air-cleaner housing, all clamps and the connector in view."”<br>**PROMPT**: “Air box: a low rounded box with a ribbed lid and an inlet collar on its engine-side end”<br>**SHOTLIST**: “"Air-box clamp",” | 'Air-cleaner housing' is canonical (callout 'Air-cleaner housing clamp'). 'Air box' is a banned alias. | The guide and manifest use 'air-cleaner housing'; only the prompt/shot list say 'air box', and nothing proves they mean the same part. | VV-03 | `tests/step10-canonical.test.mjs` “STEP10 CANONICAL CF-06” |
| **CF-07** Clamps — step says loosen them, prompt forbids drawing the loosening hardware | **GUIDE**: “Loosen the clamp at the throttle body.”<br>**PROMPT**: “Do NOT show the screw, screw head, screw housing, or any tightening hardware”<br>**MANIFEST**: “all clamps and the connector in view” | Clamp tightening point is visible, drawn only from established evidence; hiding it is prohibited. See RULES.clamp. | The action is 'loosen the clamp'. A clamp with its tightening point turned away misrepresents that action; a guessed tightening point would misrepresent safety-critical hardware — so evidence gates it. | VV-04 | `tests/step10-canonical.test.mjs` “STEP10 CANONICAL CF-07” |
| **CF-08** IAT connector — 'disconnect' vs 'no release/locking features'; 'partly hidden' vs 'in view' vs a callout that must touch it | **GUIDE**: “Disconnect the IAT electrical connector.”<br>**PROMPT**: “Plain block only: no release tab, no pins, no colours, no locking features.”<br>**PROMPT**: “partly hidden behind the hose edge”<br>**MANIFEST**: “all clamps and the connector in view”<br>**CALLOUT_SPEC**: “someone must confirm each arrow points at its component” | Connector fully visible, never partly hidden; release/locking detail only if established. See RULES.connector. | The action is 'disconnect'; the callout must touch a visible connector and the overlay QA must be able to confirm it. A plain connector is a simplification, not a false claim; an invented latch would be. | VV-05 | `tests/step10-canonical.test.mjs` “STEP10 CANONICAL CF-08” |
| **CF-09** How the image is produced — photo vs vector artwork vs text-only generated raster | **MANIFEST**: “"file": "raw/step-10-intake-duct.jpg"”<br>**MANIFEST**: “The pipeline refuses this manifest until every field below is real.”<br>**SHOTLIST**: “Original Crankcase artwork (vector), engine cover already removed:”<br>**SHOTLIST**: “see visual-sources/.../artwork/step-10-intake-duct.v3.spec.md.”<br>**PROMPT**: “Text-only prompt: do not use, request or trace any reference image.” | Route: text-only generated raster through the reconstructed Guide Factory; no image inputs. Photo and vector routes rejected for Step 10. | Not a mechanical question: the photo manifest has no source/licence/verification, the vector route's controlling spec is lost and the factory has no SVG path, and the generated-raster route is the only one with implemented, tested gates. Reference evidence still decides every drawn fact. | none (not a mechanical question) | `tests/step10-canonical.test.mjs` “STEP10 CANONICAL CF-09” |

## §VV — facts that REQUIRE vehicle-specific verification (isolated; nothing is drawn from them until established)
| id | fact | blocks | ledger attributes |
|---|---|---|---|
| **VV-01** | What the 'retaining grommet' is: which part retains the intake assembly, its type and location, and that it is not one of the step-2 engine-cover grommets | grommet drawing + callout 4 | existence, location, hardware-type, relationship |
| **VV-02** | Composition of the intake hose/resonator assembly on this vehicle: its sections, whether the resonator is a visibly distinct section, and how sections join | hero drawing | existence, relationship, fine-detail-geometry |
| **VV-03** | Whether 'air box' and 'air-cleaner housing' are the same component (assumed, unproven) and the customer-facing name the vehicle's own service documentation uses | air-cleaner housing drawing + callout 3 label | existence, location |
| **VV-04** | Clamp style on both ends, where each tightening point sits relative to the viewpoint, and its head type | clamp drawing + callouts 2-3 | hardware-type, fastener-position, fastener-head-type (safety-critical) |
| **VV-05** | IAT connector: where it sits (on the assembly, on a sensor in it, on the housing), connector type, release mechanism, lead | connector drawing + callout 1 | location, hardware-type, release-mechanism-geometry (safety-critical) |
| **VV-06** | That the guide's action ORDER and completeness are mechanically right for this vehicle (anything attached to the assembly that the five actions omit) | acceptance of the step text itself | action, relationship |
| **VV-07** | Whether a breather hose, fresh-air snorkel or other hose is attached to the assembly (if so the step text is incomplete and CF-02/CF-03 reopen) | mustNotShow list for breather/snorkel | existence, relationship |
| **VV-08** | That one front-elevated viewpoint can show all five callout targets unobstructed | viewpoint / single-image decision | orientation, location |

## Legacy constraints withdrawn (and why)
- **CF-02**: MUST NOT SHOW: hose grommet — withdrawn because guide action 4 acts on the grommet.
- **CF-03**: MUST NOT SHOW: resonator; 'No seam, joint or ring between the two sections' — withdrawn because guide action 5 removes a hose/resonator assembly; the seamless construction is unverified.
- **CF-07**: 'Do NOT show the screw … rotate the clamp so that side faces away from the viewer' — withdrawn because the action is to loosen the clamp; hiding the tightening point misrepresents it.
- **CF-08**: 'partly hidden behind the hose edge'; 'no release tab, no pins, no colours, no locking features'; 'any second or red locking feature' as a blanket ban — withdrawn because the callout must touch a visible connector; release detail is evidence-gated rather than banned.
- **CF-05**: 'Four actions on one assembly: IAT clip, two clamps, then lift the hose out.' — withdrawn because the guide has five actions and says connector, not clip.
- **CF-01/06**: 'air intake hose', 'air inlet duct', 'air box' — withdrawn because legacy aliases; the guide's wording wins.

## Readiness
- Ready to gather reference evidence: **YES**
- Ready for image generation: **NO** — blocked by 10 items: M-01, M-02, VV-01, VV-02, VV-03, VV-04, VV-05, VV-06, VV-07, VV-08.

## Canonical visual brief (deterministic; input to prompt writing, not artwork)
```
SUBJECT: The engine bay of a 2016 Dodge Charger SXT with the 3.6L Pentastar V6, engine cover already removed (guide step 2), showing the intake assembly between the throttle body and the air-cleaner housing with every part that the five actions touch unobstructed in one view.
FRAMING: landscape 16:10, at least 1600x1000 px; front-elevated, about 50-55 degrees above horizontal, centred at the front of the bay, looking rearward, mild perspective; simplified flat-shaded technical illustration, not photorealistic.
MUST SHOW, in order of importance: 1. intake-hose-resonator-assembly; 2. throttle-body-clamp; 3. air-cleaner-housing-clamp; 4. iat-connector; 5. retaining-grommet; 6. throttle-body; 7. air-cleaner-housing. Every part the five actions touch is unobstructed. One assembly, drawn as the assembly the evidence shows, running from the throttle body to the air-cleaner housing.
CLAMPS: Both clamps are shown as clamps on the assembly, each unobstructed, with its TIGHTENING point visible to the viewer, because the action is to LOOSEN it and an image that hides the tightening point misrepresents the action. The tightening feature's TYPE, HEAD and side are drawn ONLY from established evidence (ledger attributes fastener-position and fastener-head-type, both safety-critical); until established the step is BLOCKED, not guessed. No torque, size or direction-of-turn is stated.
CONNECTOR: The IAT connector is shown fully visible and unobstructed, as a plain connector attached to what it connects to, with its callout arrow touching it. Release or locking detail is drawn ONLY if established (release-mechanism-geometry is safety-critical); otherwise it is drawn plain, the instruction text carries the action, and the standing 'Simplified illustration' disclosure applies. No colours, tabs, pins or latches are invented.
GROMMET: The retaining grommet IS shown and IS the fourth callout, because guide action 4 acts on it. Its type and location are drawn only from established evidence (VV-01). The engine-cover fixings of step 2 are never drawn (the cover is already removed).
ASSEMBLY: The resonator is NOT a separate part, callout or prohibition. The hero is the guide's intake hose/resonator assembly. Only the sections evidence establishes are drawn (hose, resonator, and the join between them as evidence shows it); no section, seam or ring is invented or denied.
MAY SHOW, SIMPLIFIED AND DIM (background only, never invent detail): cowl trough along the top edge; radiator-support cover along the bottom edge; inner fender walls; strut-tower caps as plain domes; plain engine-top mass; plain coolant reservoir; plain washer-fluid bottle; intake plenum (only if established); one plain de-emphasized box for the battery/power-distribution box.
MUST NOT SHOW: engine cover (removed in step 2); the engine-cover fixings of step 2; breather hose (unless VV-07 shows it is attached to the assembly); fresh-air snorkel (unless VV-07 shows it is attached to the assembly); wipers; hood hinges or struts; wiring looms; coolant hoses; ABS unit; oil cap or dipstick; engine badges, logos, brand marks, licence plates; any release/locking/fastener detail not established by evidence; any part not listed in mustShow or maySimplifyDim; text of any kind in the image.
NO TEXT, labels, numbers, arrows or callout lines in the image; labels are added later in software. Keep the top 3-17% and bottom 83-97% of the height plain and low-contrast.
If unsure how a real part looks, draw a plain generic shape or leave it out — except where this brief requires the part to be shown, in which case generation is blocked until evidence exists.
```
