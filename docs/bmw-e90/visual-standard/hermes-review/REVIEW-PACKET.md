# Independent review: oil drain plug style-reference illustration

You are the INDEPENDENT reviewer (Hermes / ChatGPT, in a fresh chat). You did not make this image and you have not seen the author's notes. Judge ONLY whether the mechanical content of the attached illustration (`oil-drain-style-reference.png`, three panels) is supported for a **2010 BMW 328i sedan (E90), N52 3.0L, rear-wheel drive, automatic transmission**. Style, colour and layout are already approved and are not under review. Do not be generous. Use your own knowledge and any source you can open; say UNVERIFIABLE rather than guess.

## Facts the project holds (check them, do not just accept them)
- Plug: M12x1.5x16, external hex head, 17 mm wrench size, sold with a copper crush washer (catalog gasket ring A12x17-CU). Sources: Turner, ECS, RealOEM 328i oil pan diagram.
- Hatch: a small hatch in the lower undertray just behind the front-centre jack point; opened with a coin (team-bhp); another poster says three screws; another says a triangular panel.
- Plug orientation reports conflict (straight down, facing right, sideways).
- Oil pan: Turner lists a manual pan (11137553164) and an automatic pan (11137552414). This car is automatic.
- Tooling: 17 mm socket on a ratchet; only one thread names the drive size (1/2 inch).
- Source links: Turner plug https://www.turnermotorsport.com/p-54317188-engine-oil-drain-plug/ ; ECS https://www.ecstuning.com/b-genuine-bmw-parts/screw-plug/11137535106/ ; RealOEM https://www.realoem.com/bmw/enUS/showparts?id=PH73-USA-09-2009-E90N-BMW-328i&diagId=11_3834 ; Turner pans https://www.turnermotorsport.com/BMW-E90-Parts/c-1211-bmw-oil-pans-and-baffles/m-151-genuine-bmw ; team-bhp https://www.team-bhp.com/forum/diy-do-yourself/70233-diy-oil-change-bmw-e90-e91-e92-e93.html ; 5series.net https://5series.net/forums/diy-do-yourself-14/n52-oil-change-question-wheres-drain-plug-97653

## Claims to judge (answer every one)
Result is one of SUPPORTED | CONTRADICTED | UNSUPPORTED | UNVERIFIABLE. Give your evidence (a URL or a specific fact) for anything not SUPPORTED.

- C1 Panel 1: the undertray looks like a 2010 E90 328i undertray (large flat full-width plate with many screws).
- C2 Panel 1: the hatch is a rounded rectangle with a moulded pull-handle, centred on the plate.
- C3 Panel 1: the front bumper, grille and suspension visible look like an E90.
- C4 Panel 2: the plug is an external hex head with a copper-coloured washer.
- C5 Panel 2: the washer is about twice as wide as the plug head, with a separate silver ring around it.
- C6 Panel 2: the plug points out of a near-vertical side face of the pan (orientation as drawn).
- C7 Panel 2: the oil pan shape, ribs and the neighbouring hex bolt heads match the oil pan of this car.
- C8 Panel 3: a 17 mm deep chrome socket on a ratchet fits the plug head as drawn, loosening counter-clockwise.
- C9 Panel 3: the ratchet is a 3/8 inch drive and the socket carries engraved markings.

## Reply format
ONE JSON object in a single ```json block, nothing else:

```json
{
  "reviewer": { "model": "<your model name>", "system": "<your product>" },
  "claims": [
    { "id": "C1", "result": "SUPPORTED|CONTRADICTED|UNSUPPORTED|UNVERIFIABLE", "evidence": "url or fact", "note": "short" }
  ],
  "overall": "PASS|REVISE|REJECT",
  "mostImportantProblems": ["short"]
}
```
