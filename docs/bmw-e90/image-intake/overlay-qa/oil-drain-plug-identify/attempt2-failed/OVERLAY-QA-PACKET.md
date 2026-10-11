# Independent overlay QA: oil-drain-plug-identify

You are the INDEPENDENT reviewer. The attached image (overlay-preview.png, sha256 0a204fd0bf81711426f230f13a0c09a7d5dc0fa83b0d8064f5c6ea6b0ea3ab85) is an instructional illustration for a 2010 BMW 328i (E90) DIY guide with an editable guidance overlay drawn on top: a dark banner at the top-left, and orange outline box(es). Judge ONLY the overlay: does each orange outline sit on, and tightly enclose, the component it is meant to point at? Do not judge the illustration style or mechanical accuracy.

Callouts (answer every one; PASS only if the orange box encloses that component and nothing else important, and does not cover it so much that it cannot be seen):
- "drain plug" (element drain-plug) -> expected component: The engine oil drain plug seen end-on: a short plain external hex head (17 mm size) with a flat copper-coloured crush washer under the head.
- "crush washer" (element crush-washer) -> expected component: A thin flat copper-coloured crush washer sitting between the plug head and the oil pan surface.

Also FAIL if the banner or any overlay text is cut off, illegible, or covers a callout target.

Reply with ONE JSON object in a single json code block and nothing else:
{
  "overlaySha256": "0a204fd0bf81711426f230f13a0c09a7d5dc0fa83b0d8064f5c6ea6b0ea3ab85",
  "results": [ {"callout": "drain plug", "result": "PASS|FAIL", "note": "short"}, {"callout": "crush washer", "result": "PASS|FAIL", "note": "short"} ]
}
