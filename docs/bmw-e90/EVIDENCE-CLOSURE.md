# BMW 328i (E90): Mechanical Evidence Closure

Date: 2026-10-11. Branch `claude/bmw-guide-build` (PR #38, not merged). Vehicle: 2010 BMW 328i sedan, VIN WBAPH7C58AA175760.
Status of all 16 guides: admin-only, **uncertified drafts**. Nothing here is a purchase, a publication or a deploy.

## 0. Bottom line

- Certified guides today: **0 of 16**. The software is done; the missing piece is BMW-issued repair data, which is not free and not reachable from here.
- The "27 VERIFY torque rows" was an inflated number. **7 of them were never torque figures** (a click-type cap, a tire pressure, a part this car lacks). That was a display defect and is fixed (labels now read "Not a torque value: …", with a regression test). **20 rows are real torque gaps**, and only about 9 of those matter for safety.
- Counts reconcile like this: 43 torque rows = 16 printed with a figure + 20 real VERIFY + 7 not-a-torque. Steps: 7 ledger CONFLICT entries (2 of them are also blocked steps), 3 MISSING entries (1 is the xDrive row, which is inapplicable, leaving **2 unsourced**), 3 blocked steps (fuses, xenon, idler pulley).
- Nothing was guessed. No number was added to any guide. The only guide change is the display fix.

## 1. Critical blockers by guide (safety-critical first)

Tiering: **P1** brakes / belt / cooling / electrical / support, where a wrong answer can hurt someone or strand the car. **P2** mechanical, wrong answer costs a part or a leak. **P3** trim and hand-tight items, low consequence.

### P1: safety-critical

| Guide | Item | State today | Why it is hard-blocked or flagged |
|---|---|---|---|
| 5 Rear brake pads | Rear caliper guide screw torque (hex 13 mm and socket-head variant) + "Refit the caliper and torque" step | 35 Nm hex from two Autodoc pages that share a publisher (counts as ONE source); 30 Nm socket-head from one data table; a 3 Nm figure elsewhere is almost certainly a typo | Brake hardware. Not independently confirmed, and the head type on this car is not known. Shown as VERIFY, no number printed. |
| 6 Serpentine belt | Idler pulley bolt torque (40 vs 80 Nm) + the whole "Replace the idler pulley" step | **BLOCKED.** Conflict. A Bentley Publishers erratum (121-20, N52/N52KP, 2015) proves the printed BMW-derived value was WRONG and corrected, but the corrected number is unreadable | Belt/pulley failure at speed. Only a BMW repair instruction or the Bentley corrected table settles it. |
| 6 Serpentine belt | Tensioner lock-pin: does this tensioner use one, and what diameter | One source says yes, another no | Wrong tool choice can damage the tensioner. Needs the part or a BMW document. |
| 6 Serpentine belt | Belt routing diagram and rotation direction | Not readable as text | Wrong routing is a classic way to throw a belt. Needs a BMW or ETK diagram. |
| 7 Battery | Battery terminal clamp nuts, hold-down screw, trunk bracket nuts | No confirmed figure. One 2006 325i table says 5 Nm for the battery/IBS connections; no second host | Electrical and battery retention. Recall 13V044 (positive battery cable) also applies to this model range; VIN applicability is unconfirmed. |
| 8 Coolant | Expansion tank vent (bleeder) screw; plastic radiator drain plugs | No torque found; "hand-tight only" from two same-forum sources | Leak under pressure → overheating. Low torque risk, but unverified. |
| 13 Tire rotation | **Jack-stand placement for the E90 sedan** (step "Support the car on stands", unsourced) | No source states the stand points. Guide tells the owner to stop and use a shop lift if unsure | Support/lifting safety. Needs BMW's lifting-point instruction. |
| 16 Oil change | Drain plug orientation on this car's automatic pan (step "Drain the sump") | Oil reported to exit straight down on one car and sideways on another | Hot oil. Guide tells the reader to shield their hand and angle the pan. |
| 2 Fuse & bulb | Engine-bay fuse boxes (E-box, front power distribution box) | **BLOCKED.** Web sources disagree on location and how it opens | Electrical. Not an owner step on this car per the owner's manual. |
| 2 Fuse & bulb | Xenon low-beam bulb | **BLOCKED.** BMW says xenon work is for a BMW center or qualified workshop | High voltage ballast. Probably not even fitted to this car (halogen LCI lamp); needs the build data. |
| 15 Differential | Rear differential plug torque | TIS table says 60 Nm for the O-ring plug type (that table lists E30–E86, not E90). 65 Nm applies only to a sealing-ring type | Which plug type this car has is not confirmed. Shown flagged. |

### P2 and P3

| Guide | Items | Notes |
|---|---|---|
| 4 Oxygen sensor | Bank 2 pre-cat shield screws; strut-brace / heat-shield fasteners | Access fasteners, no torque found. P2. |
| 6 Serpentine belt | Alternator pulley; fan-shroud / airbox / intake duct fasteners; "Clear access" step conflict (FCP vs Pelican fastener lists) | P2/P3. The access step is a fastener-count disagreement, not a safety fact. |
| 2 Fuse & bulb | Parking/halo bulb type (H8 per manual vs disputed) | Guide says match the old bulb. P3. |
| 9 Fluid checks | Transmission/differential step (ATF type conflict: Dexron VI vs ZF Lifeguard 6) | Guide already says do NOT top up and see a shop. Stays that way. P2. |
| 14 Wiper blades | Release-old-blade step conflict (BMW manual p.229 vs retail guides) | Cosmetic risk only. P3. |
| 1, 2, 5, 8, 9, 10, 12 | Trim / liner / cover / cap / reservoir-cap fasteners: "no spec, hand-tight, don't over-tighten" | P3. A BMW instruction would settle all of them in one pass. |

Deduplication notes: the caliper-guide-screw problem shows up as 2 torque rows + 1 step in guide 5 (one evidence item). The idler pulley is 1 torque row + 1 conflict step + 1 blocked step (one item). Fuses are 1 conflict step + 1 blocked step (one item). Net distinct evidence items: **11 P1 items plus 6 P2/P3 groups** (each group is one BMW lookup pass).

## 2. What can and cannot be closed

**Already sufficient (no further evidence needed):** wheel-bolt torque and the other printed torque figures (16 rows) that are VERIFIED or confirmed by 2+ independent hosts; the xDrive-only rows (already marked inapplicable, assuming RWD, see section 4); the 7 not-a-torque rows; the expansion-tank "click" cap (owner's manual).

**Can only be closed by BMW primary data (ISTA/AIR repair instructions or equivalent):**
- Caliper guide screw torque and head type (guide 5)
- Idler pulley bolt torque, tensioner lock-pin, belt routing (guide 6)
- Battery terminal / hold-down / bracket torques (guide 7)
- Rear differential plug type and torque for E90 (guide 15)
- Jack-stand lifting points (guide 13)
- Vent screw, drain plug, undertray and trim fasteners (guides 4, 6, 8, 10, 12 and the other P3 rows)
- Fuse box locations (guide 2), if you ever want that step unblocked

**Can be closed with free information plus the owner's car (no BMW subscription):**
- Which rear caliper guide-screw head type is fitted (look at the car)
- Which rear differential plug type is fitted (look at the car)
- Drive-train check (RWD vs xDrive) and engine code from the build data plate / VIN
- Xenon vs halogen headlights (look at the car)
- Drain-plug orientation on the sump (look under the car, with the car properly supported)
- Free VIN-specific recall check on nhtsa.gov/recalls (battery cable 13V044, VANOS bolts 14V176, PCV valve heater 17V683, HVAC wiring 17V676, airbags 20V017 and 24V513 are all listed for the model; whether each applies to this VIN is unconfirmed)

## 3. BMW technical information: what it is and whether it covers this

Sources: BMW Group TIS public PDFs (access, system requirements), plus a third-party price report. No account was created, nothing was paid for, and I did not circumvent bmwtechinfo.com's robots block.

- **Product:** BMW Group Technical Information System (TIS) is US/Canada-only, with separate BMW, MINI and Rolls-Royce accounts. It exposes ISTA (repair instructions stated for "E30 or higher", technical data, wiring) and AIR (repair manuals, wiring, parts, labor times, specifications). It also carries TSBs, operating fluids and training manuals.
- **Access periods:** 24 hours, 30 days, 1 year. Official pages list **no prices**. One 2023 third-party article (aa1car) reports roughly $30 / $300 / $2,500. That is unconfirmed and possibly stale.
- **Requirements:** Windows 10 Pro or Enterprise (64-bit), 32-bit Java, .NET 4.8, Chrome, no proxy. It will not run from this cloud container.
- **Does it cover the unresolved E90 items?** *Probable but unconfirmed.* ISTA repair instructions for an E90 normally carry torque values, lifting points, belt routing and fastener lists. None of the retrieved BMW pages explicitly names torque specs, and I cannot see inside the product without a session. The P1 items are all standard repair-instruction content, so I rate coverage as likely, not proven. A 24-hour session is the cheapest way to prove it.

## 4. Vehicle configuration cross-check

- VIN WBAPH7C58AA175760: the "PH7" pattern fits a 2010 328i sedan (RWD, N52). Earlier work found only decoder-level confirmation (NHTSA vPIC, RealOEM-style decoders) and a K/N engine naming difference that changes no step.
- **Not confirmed against BMW build data:** drivetrain (RWD vs xDrive), engine variant, transmission, headlight type, brake caliper/rear-axle options, differential type. The guides already carry "Before you start: check your car's build" steps for this reason.
- The authoritative source is the vehicle's BMW build/option data (the VIN decode inside ISTA or the car's data plate). Free substitute: physically checking the parts listed in section 2. The VIN decoders alone do not settle these.
- BMW USA's digital owner's manual is looked up by VIN but only for select model years; E90 availability is unconfirmed.

## 5. Free sources exhausted

NHTSA vPIC VIN decode; NHTSA recalls API for the 2010 328i; RealOEM and bimmer.work part catalogs; BMW owner's-manual copies and mirrors; BMW public TIS PDFs; Bentley Publishers update notes (confirm the idler erratum exists, number unreadable); FCP Euro and Pelican technical articles; Autodoc club pages; Bolidenforum data tables; 5series, bimmerpost, Pelican and z4 forums; retailer catalogs; YouTube (evidence-only, never certifies torque or safety).

What is left is paywalled (ISTA/AIR, Bentley manual content behind a login) or needs the physical car.

## 6. Recommended acquisition strategy (no purchase made, owner decision)

1. **Do the free work first (about an hour of owner time):** VIN-specific recall check; confirm RWD, headlight type, rear caliper bolt head, rear diff plug type, and sump plug orientation on the car.
2. **Then one 24-hour TIS/ISTA session**, bought by the owner on the owner's own account, run from a Windows 10 PC. Price unconfirmed (about $30 in a 2023 report). Escalate to 30 days only if the session shows the E90 content is complete and there are more fasteners than one day allows.
3. **Prepare the lookup list in advance** so the session is not wasted: the 11 P1 items above, then the P2/P3 fastener rows. Capture screenshots of each repair-instruction page with the VIN and page ID. I will pre-write a one-page checklist when the owner approves.
4. **Ingest rules:** values from ISTA become VERIFIED only with a screenshot/transcription of the instruction ID and page. They update the evidence ledger, regenerate the drafts, rerun the test suite, and still leave guide certification (mechanic review, owner sign-off) to the owner.
5. **Do not buy the 1-year plan** until a 24-hour session proves the content covers this car.

## 7. Certification readiness

| Guide | Ready to certify? | What stands in the way |
|---|---|---|
| 3 Key fob battery, 11 PCV (inspection only), 14 Wiper blades | Closest. No safety torque gaps | Mechanic review; build check for guide 3 (standard vs comfort key) |
| 10 Cabin filter, 12 Engine air filter, 9 Fluid checks | Close | P3 fastener rows; guide 9 stays "do not top up transmission" |
| 1 Front brakes, 16 Oil change, 13 Tire rotation, 15 Differential, 4 Oxygen sensor | Blocked on a few items | See P1 table (lifting points, drain-plug orientation, diff plug) |
| 5 Rear brakes, 7 Battery, 8 Coolant | Blocked on safety torque / retention | Caliper guide screws, battery clamps/hold-down, bleeder/drain plugs |
| 2 Fuse & bulb, 6 Serpentine belt | Not certifiable as-is | Two blocked steps in guide 2, one in guide 6 (idler) plus lock-pin and routing |

Hard truth: **no guide is certifiable today without BMW data, and none has had a mechanic review.** That second condition is independent of the BMW data.

## 8. ETA

| Piece | Time | Depends on |
|---|---|---|
| Known work (done or in reach): inventory, doc, display fix, tests, preflight, push, PR update | Done this session | Nothing |
| Owner free checks (section 6, step 1) | ~1 hour of the owner's time | The owner and the car |
| Prepare the TIS lookup checklist | ~1 to 2 hours | Owner approval to proceed |
| Ingest results (ledger update, regenerate, test, push) | ~half a day after the session | Source quality; see below |
| **Source-dependent:** whether ISTA actually covers every P1 item | Unknown until a session is run | BMW content; a 24-hour window may not fit all items |
| **Source-dependent:** items BMW data does not cover (fuse boxes, trim fasteners) | Possibly never | Stays blocked or flagged; that is an acceptable end state |
| Mechanic review before any certification | Owner-scheduled | A human mechanic |

Honest summary: closing the evidence is **about a day of my work once BMW data is in hand**, plus the owner's few hours. Whether that day ever starts depends on an owner purchase decision and on content I cannot see. I will not put a calendar date on the part that depends on BMW.

## 9. What changed in the repo for this mission

- `scripts/bmw/build-drafts.mjs`: `NOT_A_TORQUE` table (7 rows) with a stale-entry guard. No figure added or changed.
- `src/data/admin-test-guides/bmw-2010-328i-drafts.ts`: regenerated (12 lines, torque rows only).
- Tests: a regression asserting exactly the 7 reviewed rows are relabelled, labels never carry a number, and the real unknown torques (idler, caliper guide screws, battery terminals, rear differential plug) still show the VERIFY warning.
- `docs/bmw-e90/READINESS-MATRIX.md` regenerated with the receipt (now shows "+N not a torque" separately); this document added.
