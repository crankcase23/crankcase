# Style reference review: oil drain plug (2010 BMW 328i, E90, VIN WBAPH7C58AA175760)

Reviewed 2026-10-10 against `reference/oil-drain-style-reference.png` (sha256 `dec0ad25225c092ce562970f1e46fc5bd86924cb88ba45e58d2f02604451590e`).

## Verdict
- **Style: APPROVED** (owner decision). Recorded as standard CG-VS-1.0, see `../VISUAL-STANDARD.md`.
- **BMW mechanical accuracy: REJECT as a BMW accuracy reference.** It cannot be certified or used as a candidate image. Too much of it is unsupported or contradicted for a touch-up, and the oil pan itself is not established for this car (finding 1). Fix path: regenerate from the corrected briefs (the three oil-drain contracts, below). The style carries over, the geometry does not.

## Finding 1 (new, affects everything): this car is an automatic and uses a different oil pan
- Turner lists two engine oil pans for the same chassis and engines: manual `11137553164` and **automatic `11137552414`** ([Turner oil pans](https://www.turnermotorsport.com/BMW-E90-Parts/c-1211-bmw-oil-pans-and-baffles/m-151-genuine-bmw)). Pan bolt sets differ the same way (`11130396707` manual, `11132210959` automatic).
- The RealOEM 328i diagram we had been using lists only the manual pan, tagged "automatic S205A = No" ([RealOEM 11_3834](https://www.realoem.com/bmw/enUS/showparts?id=PH73-USA-09-2009-E90N-BMW-328i&diagId=11_3834), diagram image [diag_33i8.jpg](https://www.realoem.com/bmw/images/diag_33i8.jpg)).
- This VIN decodes with S205 (automatic). So plug position and orientation on **its** pan are not established by anything we have. The plug itself (M12x1.5, 17 mm hex, copper ring) is the same part number family either way.
- Caveat: those page reads were done through a summarising fetch tool. Please eyeball the RealOEM diagram for your VIN in a browser if you want this settled without a photo.

## What matches
| Item in the illustration | Support |
|---|---|
| Plug is an external hex head | Turner: "classic 17mm male hex head", M12x1.5x16; ECS: hex head, E90 328i N52 fitment |
| Copper-coloured crush washer under the head | RealOEM gasket ring A12x17-CU (07119963151); team-bhp: copper crush washer replaced each change |
| 17 mm socket on a ratchet removes it | team-bhp (17 mm on a ratchet), Haynes (17 mm spanner or socket), bimmerpost (17 mm) |
| Plug is on the underside of the pan; an access hatch in the undertray covers it | 5series.net, team-bhp, bimmerpost agree there is a small hatch/panel |
| Loosening arrow is counter-clockwise | Standard right-hand thread. Not a BMW-specific source; consistent, not proven |

## What is wrong or unverified
| # | Illustration | Evidence | Call |
|---|---|---|---|
| 1 | Oil pan shape, casting ribs, neighbouring hex bolts, tab | Automatic pan not catalogued (above). Catalog pan perimeter fasteners are single-use aluminium screws plus 3 small M6 nuts, not big hex bolts | UNSUPPORTED |
| 2 | Hatch drawn as a rounded rectangle with a moulded pull-handle | Sources say coin-operated half-turn catch (team-bhp), three screws (5series.net), one poster says triangular. Nobody describes a handle | UNSUPPORTED, likely wrong |
| 3 | Hatch dead-centre on a huge flat full-width plate with dozens of screws and rivets | Only "small hatch just behind the front-centre jack point". Undertray layout, screw count and plate shape are not established | UNSUPPORTED |
| 4 | Front bumper, grille, lower valance, subframe | No BMW identifiers visible; nothing establishes any of it for an E90. Looks like a generic car | UNSUPPORTED |
| 5 | Plug on a near-vertical side face, seen at an angle | Sources conflict: straight down, facing right, oil exits sideways. And the pan is the wrong variant (finding 1) | CONFLICT |
| 6 | Washer drawn about twice the head width, plus a separate silver boss ring | Catalog washer is 12x17 mm and the head is 17 mm, so the washer is about head-sized. No source shows a boss ring | WRONG PROPORTION / UNSUPPORTED |
| 7 | Ratchet looks 3/8 drive, socket engraved with markings | Only one thread names a drive (1/2 inch). Markings are baked-in text | UNVERIFIED / violates NO TEXT |
| 8 | Grease, grime and rivet texture everywhere | Realistic rendering invents detail. The standard keeps realism to materials and light only | RISK |
| 9 | Step banners, numbers, labels, arrows, outline boxes baked into the picture | Fine as style. Our factory contract forbids text and arrows inside a generated image, so these move to an editable vector overlay | HANDLED IN STANDARD |

Provenance: how the illustration was made is unknown, so it cannot enter the factory as a candidate anyway (attestation needs a truthful generator statement and a contract-clean image).

## Sources used
- https://www.turnermotorsport.com/p-54317188-engine-oil-drain-plug/
- https://www.ecstuning.com/b-genuine-bmw-parts/screw-plug/11137535106/
- https://www.realoem.com/bmw/enUS/showparts?id=PH73-USA-09-2009-E90N-BMW-328i&diagId=11_3834
- https://www.turnermotorsport.com/BMW-E90-Parts/c-1211-bmw-oil-pans-and-baffles/m-151-genuine-bmw
- https://www.team-bhp.com/forum/diy-do-yourself/70233-diy-oil-change-bmw-e90-e91-e92-e93.html
- https://5series.net/forums/diy-do-yourself-14/n52-oil-change-question-wheres-drain-plug-97653
- https://g42.bimmerpost.com/forums/showthread.php?p=29969477
- https://us.haynes.com/blogs/step-by-step-guides/oil-change-bmw-x3-2003-2010
- Not reachable: Pelican Parts E90 oil-change article (server error). No BMW service document (TIS) was reachable; every plug fact above is catalog or third-party.

## What needs to change
1. Regenerate from the corrected briefs, not edit the reference. The briefs are the locked prompts in `../image-evidence/output/oil-drain-hatch-locate`, `oil-drain-plug-identify`, `oil-drain-plug-loosen` (`generation-prompt.txt`). Corrections applied: hatch outline and fasteners left generic, no bumper, grille or chassis, plug seen end-on with no ground cue, hex head plus head-sized copper washer only, pan reduced to a plain surface, socket and ratchet plain and unmarked with drive size undefined, no baked text or highlights.
2. To make the plug and pan accurate rather than generic, one of: a photo of the plug on your car from below, or the RealOEM diagram for your VIN showing the automatic pan.

## Reference images
- RealOEM oil pan diagram (manual-pan variant): https://www.realoem.com/bmw/images/diag_33i8.jpg
- No photographs from authoritative sources were retrievable here. Forum photos exist behind the threads above but I cannot download or verify them from this environment, so none are redistributed.
