# Independent overlay QA: oil-drain-hatch-locate

You are the INDEPENDENT reviewer. The attached image (overlay-preview.png, sha256 9ac1bf9834d2b8314e5d8090f90977343ba62c0a7c0a92040feef0c5f3c9a315) is an instructional illustration for a 2010 BMW 328i (E90) DIY guide with an editable guidance overlay drawn on top: a dark banner at the top-left, and orange outline box(es). Judge ONLY the overlay: does each orange outline sit on, and tightly enclose, the component it is meant to point at? Do not judge the illustration style or mechanical accuracy.

Callouts (answer every one; PASS only if the orange box encloses that component and nothing else important, and does not cover it so much that it cannot be seen):
- "access hatch" (element access-hatch) -> expected component: A small closed access hatch set into the lower undertray near the front-centre of the underside, drawn as a plain flat panel with a simple outline.

Also FAIL if the banner or any overlay text is cut off, illegible, or covers a callout target.

Reply with ONE JSON object in a single json code block and nothing else:
{
  "overlaySha256": "9ac1bf9834d2b8314e5d8090f90977343ba62c0a7c0a92040feef0c5f3c9a315",
  "results": [ {"callout": "access hatch", "result": "PASS|FAIL", "note": "short"} ]
}
