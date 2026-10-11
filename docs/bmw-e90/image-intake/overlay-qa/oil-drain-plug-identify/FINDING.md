# oil-drain-plug-identify: overlay QA failed 3 times (image content QA passed)

Image: fit PASS, independent review 4/4 PASS (1 cosmetic), admitted and normalized. Overlay QA: FAIL x3 (rectangles; tight rectangle + left-arc washer box; rectangle + annulus). Reviewer's reasons across rounds: the washer box either crosses the hex head or "does not isolate the thin washer"; the plug box "includes the washer".

Root cause is the contract, not the box coordinates: the hero's own description includes "a copper crush washer under the head" and the washer is a separate required callout, and the washer is mostly hidden behind the head in an end-on view. Two required callouts on nested/concentric parts cannot both pass a "tightly encloses the component and nothing else important" test.

Not fixed by me because it needs a locked-contract change (new run): choose ONE of
 (a) hero = the hex head only (drop the washer from the hero description), washer stays a separate callout;
 (b) one combined callout "plug and washer" (washer becomes part of the hero, not a separate required callout);
 (c) owner accepts a weaker overlay rule for nested parts.
Recommendation: (a). Run stays at NORMALIZED with the three failed attempts archived here. Nothing is certified.

Factory state after the third failure: phase NEEDS_ANDY (verdict ESCALATE). That is the factory's own limit, so this needs the owner's call (a/b/c above) before any further overlay attempt.
