# Independent overlay QA: oil-drain-plug-identify

You are the INDEPENDENT reviewer. The attached image (overlay-preview.png, sha256 aa42d7bb3009f46c188d323a2d24ab58cd34062dba217d9436aa213ab0514ca5) is an instructional illustration for a 2010 BMW 328i (E90) DIY guide with an editable guidance overlay drawn on top: a dark banner at the top-left, and orange outline box(es). Judge ONLY the overlay: does each orange outline sit on, and tightly enclose, the component it is meant to point at? Do not judge the illustration style or mechanical accuracy.

Callouts (answer every one; PASS only if the orange box encloses that component and nothing else important, and does not cover it so much that it cannot be seen):
- "drain plug" (element drain-plug) -> expected component: The engine oil drain plug seen end-on: a short plain external hex head (17 mm size) with a flat copper-coloured crush washer under the head.
- "crush washer" (element crush-washer) -> expected component: A thin flat copper-coloured crush washer sitting between the plug head and the oil pan surface.

Also FAIL if the banner or any overlay text is cut off, illegible, or covers a callout target.

Reply with ONE JSON object in a single json code block and nothing else:
{
  "overlaySha256": "aa42d7bb3009f46c188d323a2d24ab58cd34062dba217d9436aa213ab0514ca5",
  "results": [ {"callout": "drain plug", "result": "PASS|FAIL", "note": "short"}, {"callout": "crush washer", "result": "PASS|FAIL", "note": "short"} ]
}
