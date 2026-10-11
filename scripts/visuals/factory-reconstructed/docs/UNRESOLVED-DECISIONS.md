**THIS GUIDE FACTORY IMPLEMENTATION IS RECONSTRUCTED FROM SURVIVING EVIDENCE. IT IS NOT THE LOST ORIGINAL IMPLEMENTATION.**

# Unresolved decisions & open questions

Nothing below was decided silently. "Default" = what the code does today. Owner column: who should decide.

| id | question | evidence | default in code | owner |
|---|---|---|---|---|
| **U-01** | Does a provenance-rejected generation consume a correction cycle? | arch §3: no cycle burned (same cycle) **vs** Brick C: consumes a cycle and goes to NEEDS_ANDY | **LOCKED by Andy in C-4: ARCHITECTURE_V1** — a provenance-rejected generation does NOT consume a correction cycle. BRICK_C_REPORT is a rejected non-canonical alternative (needs `allowNonCanonical`, can never be approved) | ~~Andy / Hermes~~ decided |
| U-02 | Substantive provenance failure (image inputs / tracing / compositing admitted)? arch only addresses "missing/invalid metadata" | arch silent | ARCHITECTURE_V1: fail closed to NEEDS_ANDY, no burn; override `substantiveProvenanceRejection` | Andy |
| U-03 | How many metadata resubmissions before escalating? | no doc | **LOCKED by Andy in C-4**: max 3; then NEEDS_ANDY. Labelled **NEW reconstructed behavior, not recovered original behavior** in policy.mjs, policy.json and the docs. Counting question open: see U-22 | decided (counting: Andy, U-22) |
| U-04 | Cap = initial + 3 corrections (4 generations)? | arch risk #6 asked Andy to confirm; never answered in surviving docs | 4 generations | Andy |
| U-05 | EVIDENCE_DEFICIENT: reset cycles (arch §3) or not (Brick A dev. 2)? Does the deficient generation count? | conflicting | no reset; deficient generation consumes a cycle (INF) | Andy |
| U-06 | Who declares an EP SUFFICIENT? | arch risk #4 | factory-code objective gate; `andy` also allowed | Andy |
| U-07 | WEBP | arch lists png\|webp; not reconstructed | PNG only; webp refused | Andy |
| U-08 | Contract `maxBytes` | value lost | 12 MiB (INF) | Andy |
| U-09 | Normalized bytes identical to source (hash collision) | resolver requires distinct hashes | refuse (HASH_COLLISION) | Andy |
| **U-10a** | Guide step 10 text names *retaining grommet* and *hose/resonator assembly*; Step 10 prompt says MUST NOT SHOW both | proving run | reported, not resolved | Andy (text vs picture) |
| **U-10b** | Callout targets differ: old manifest (IAT connector / throttle-body clamp / air-cleaner clamp / retaining grommet) vs shot-list slot (IAT connector / throttle-body clamp / air-box clamp / intake hose) vs prompt | proving run | reported, not resolved | Andy |
| U-11 | Stage order: the C-3 brief lists normalization before QA; arch/Brick docs normalize the ADMITTED generation after content QA | conflicting | arch order (QA judges the generator's file; normalization ops cannot change content) | Andy |
| U-12 | Spot-check of first 10 approvals (Brick C SPOT_CHECK_FIRST_N), INTEGRATED/REVOKED states, mark-integrated, revoke | docs only | NOT built; AA records `andyFinal: required` | Andy |
| U-13 | Controlled gate-id vocabulary | list lost | derived from CG-QA-v1.0 headings (INF) | Hermes |
| U-14 | Exact canonicalization / event-chain construction | lost | INF (documented in canon.mjs/eventlog.mjs) | — |
| U-15 | License/ownership of generated output | arch risk #1 | **DECIDED (Andy, C-5 lock #3)**: generated Crankcase assets are Redline Origin / Crankcase project assets, subject to the generation provider's applicable usage rights. Recorded as `assetClass` + `rightsBasis` + the provider's terms; `ownershipAsserted` stays false; no claim beyond provider-granted rights. (Not legal advice.) | decided |
| U-16 | Per-application criticality template | file lost | keyword rule (hardware never cosmetic) (INF) | Andy |
| U-17 | Original prompt-writer text | lost | prompt supplied by caller; fallback is a plain deterministic text | — |
| U-18 | original-artwork (SVG) path: purity gate, ledger==drawn elements, stamp-imitation attacks | Brick B (76 tests) | only the noSourcePixels record validator exists; SVG builder NOT reconstructed | Andy |
| U-19 | Historic hashes | encoder was sharp | reconstructed normalized bytes are NOT comparable to any historic hash | — |
| **U-20** | Who is the independent QA actor? | rubric: *ChatGPT independent QA*; arch actors enum has `claude-qa` only | **LOCKED by Andy in C-4**: claude-qa = INTERNAL QA; **hermes** (Hermes / ChatGPT) = independent final reviewer. New actor `hermes`. Claude (actor, model or system) can never be independent; only an independent PASS admits output | decided (strings: D-04) |
| U-21 | Overlay QA ownership (arch risk #9) | open | C-4: overlay review must be independent (hermes), as the recovered resolver requires an independent passing QA; minimal overlay stage | Andy |
| **U-22** | Counting of the metadata retry cap (NEW) | C-4 wording ambiguous | **DECIDED (Andy, C-5 lock #1), CANONICAL reconstructed behavior**: initial submission + up to 3 metadata/resubmission attempts; the 4th rejection escalates to NEEDS_ANDY. Not recovered original behavior | decided |
| U-23 | Independent reviewer identity | none | **DECIDED (Andy/Hermes, C-5 lock #2)**: canonical identity is Hermes / ChatGPT / GPT-5.6 Sol. Enforced as: actor hermes + GPT/ChatGPT model string + Hermes/ChatGPT/OpenAI system string + sha256 of the raw response; Claude-family strings refused. The factory cannot PROVE authorship; relabelling a Claude result "Hermes" fails these checks, a wholesale forgery of all of them would not — the raw-response hash exists so Andy can audit it against the real transcript | decided |
| **U-24** | Event-log tail truncation before approval | a hash chain cannot detect removal of trailing events | **OPEN (kept open by Andy, C-5 lock #4)**: a truncated, consistently re-chained, UNAPPROVED history verifies clean. Detected once an approval pins the head in the registry preview. No redesign attempted; a test (c5-locks #4) records the known gap | OPEN |
| **U-10 (superseded)** | U-10a/U-10b are now rows CF-01…CF-09 of docs/STEP10-CONFLICT-TABLE.md | C-4 | **C-5: ONE proposed canonical resolution per row** in docs/STEP10-CANONICAL-SPEC.md; awaiting Andy/Hermes acceptance | Andy / Hermes (accept) |
| **U-25** | Vehicle facts for Step 10 (VV-01…VV-08): grommet identity, assembly composition, air-box = air-cleaner housing, clamp style/side, connector location/release, guide sequence completeness, attached breather/snorkel, single-viewpoint adequacy | C-5 | isolated; nothing is drawn from them until reference evidence establishes them | Andy / reference evidence |
