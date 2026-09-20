import { RepairGuide } from "@/types/vehicle";

// ---------------------------------------------------------------------------
// 2021 Toyota Tacoma TRD Off-Road 4x4 (N300, 3.5L 2GR-FKS) - depth pass, 2026-09-20
//
// Sourcing: the N300 factory service manual is transcribed at ttguide.net, and
// lemon-manuals.la carries 2021-specific Toyota content with build-date
// applicability brackets. The ttguide transcription is the 2015-2018 printing;
// the 2020 refresh changed infotainment, hood scoop, wheels and seating but not
// the brakes, axles, transfer case or engine. Where a figure rests on that one
// printing alone, the guide's note says so.
//
// TWO THINGS THE RESEARCH CAUGHT THAT WOULD HAVE SHIPPED WRONG:
//
//   1. The front caliper is a FIXED 4-PISTON unit. It has no guide pins and no
//      separate bracket, and a pads-only job removes NO BOLTS AT ALL. Every
//      generic "undo the two caliper bolts and swing it open" brake guide is
//      simply describing a different truck.
//   2. The rear brakes are DRUMS, not discs. Confirmed from the FSM's drum
//      chapter and from Toyota's own parts catalog listing rear brake drum
//      42431-04061 as a 2021 Tacoma part. Discs did not arrive until the 2024
//      N400.
//
// FOUR JOBS DELIBERATELY NOT WRITTEN:
//
//   Rear brakes    NEEDS A SCOPE DECISION. The approved coverage scope covers
//                  "brake pad replacement (front and rear)". This truck has rear
//                  SHOES, and the wheel cylinder torque is single-sourced at
//                  84 in-lb - a figure where a units mistake destroys the part.
//                  Drum shoe replacement is a different job from a pad swap and
//                  has not been ruled in or out. Not guessing either way.
//   Fuse and bulb  BLOCKED. Toyota built post-refresh trucks with BOTH halogen
//                  and sealed-LED headlights and no trim mapping could be
//                  sourced; the FSM names only "No. 1 / No. 2 headlight bulb"
//                  with no trade number. Fuse box locations were too vague to
//                  publish.
//   Key fob        BLOCKED - not researched this pass.
//   Spark plugs    Already removed from the catalog product-wide.
// ---------------------------------------------------------------------------

export const toyotaTacomaGuides: RepairGuide[] = [
  {
    id: "tacoma-tire-rotation",
    vehicleId: "2021-toyota-tacoma-3.5l",
    title: "Tire Rotation",
    jobType: "tire-rotation",
    summary: "83 ft-lb, confirmed three ways. Body-on-frame truck, so the jack points are the crossmember and the diff - not a pinch weld.",
    difficulty: "Easy",
    tier: "premium",
    estTime: "45-60 min",
    tools: [
      { name: "Torque wrench", note: "Must cover 83 ft-lb" },
      { name: "21 mm socket + breaker bar", note: "Commonly reported size - check yours before you buy one" },
      { name: "Jack + 4 jack stands", note: "Rated for a 5,600 lb GVWR truck" },
      { name: "Wheel chocks" },
      { name: "Tire pressure gauge" },
    ],
    safety: [
      "Never work under a vehicle supported only by a jack. The FSM calls for rigid racks.",
      "Never jack up a heavily loaded truck - unload the bed first.",
      "When setting the truck on stands, keep clear of the resin components under the body - they are not load-bearing.",
      "Chock the wheels staying on the ground.",
    ],
    torqueSpecs: [
      {
        fastener: "Wheel (lug) nuts",
        value: "83 ft-lb (113 Nm)",
        notes: "Toyota factory figure, also printed as 1152 kgf-cm. Corroborated at three separate FSM pages and by an independent 2021-specific tire fitment record. Note 113 Nm and 83 ft-lb are the same number - do not set 113 on a ft-lb wrench.",
      },
    ],
    steps: [
      {
        number: 1,
        title: "Set cold pressures first",
        instructions: "Correct all four tires to the door placard while cold. On this truck the placard calls for the same pressure front and rear, which matters for the TPMS question in step 7.",
        image: "/steps/generic-park-secure.svg",
      },
      {
        number: 2,
        title: "Break the nuts loose on the ground",
        instructions: "Loosen each lug nut about a quarter turn while the tire still has weight on it. A wheel in the air just spins.",
        image: "/steps/generic-raise-vehicle.svg",
        warning: "Loosen only - do not remove a nut with the wheel loaded.",
      },
      {
        number: 3,
        title: "Lift at the truck points, not the car points",
        instructions: "This is a body-on-frame truck and the lift points are different from a crossover. The FSM gives the front jack position as the centre of the crossmember and the rear as the centre of the rear differential. Lift there, then transfer the weight onto rigid stands under the frame before anything else.",
        image: "/steps/generic-raise-vehicle.svg",
        warning: "Do not put a jack under a resin or plastic component, and do not leave the truck on the jack. If your owner's manual shows different support points than what you are looking at, follow the manual.",
      },
      {
        number: 4,
        title: "Rotate the tires",
        instructions: "For a 4WD truck with four matching non-directional tires, use the rearward cross: rears move straight forward, fronts cross to the opposite rear corners. Directional tires (arrow on the sidewall) can only swap front-to-back on the same side.",
        image: "/steps/tire-rotation-rwd.svg",
        warning: "Leave the spare out of the rotation unless you have confirmed it matches your road wheels. The factory spare is not monitored by the TPMS, and rotating an unmatched or unsensored wheel into service causes problems this guide has not verified a fix for.",
      },
      {
        number: 5,
        title: "Inspect while the wheels are off",
        instructions: "Check tread depth and wear pattern on each tire. On a truck that sees dirt, also look at the inner sidewalls and the backs of the tires for cuts and sidewall damage you cannot see with the wheels on.",
        image: "/steps/tire-inspect.svg",
      },
      {
        number: 6,
        title: "Torque to 83 ft-lb in a star pattern",
        instructions: "Hand-thread every nut first. Snug in a star pattern, lower until the tires just touch, then torque to 83 ft-lb in two or three passes in the same pattern.",
        image: "/steps/wheel-torque.svg",
        torque: [{ fastener: "Wheel (lug) nuts", value: "83 ft-lb (113 Nm)" }],
      },
      {
        number: 7,
        title: "TPMS - check whether yours even needs it",
        instructions: "Trucks equipped with a tire pressure warning reset switch initialize by pressing and holding that switch for three seconds or more until the warning light blinks three times. Two caveats worth knowing: not every truck has the switch, and we could not source its location for a 2021 from anything year-correct - check your owner's manual. Because this truck's placard pressures are the same front and rear, a straight rotation generally does not change what the system is watching for.",
        image: "/steps/generic-cleanup.svg",
        warning: "Toyota revised this procedure at the 2020 refresh, so a pre-2020 Tacoma write-up may not describe your truck. Use the owner's manual for your model year.",
      },
      {
        number: 8,
        title: "Re-torque after a short drive",
        instructions: "Drive 25-50 miles and re-check all 24 nuts at 83 ft-lb.",
        image: "/steps/generic-cleanup.svg",
      },
    ],
  },
  {
    id: "tacoma-brake-pads-front",
    vehicleId: "2021-toyota-tacoma-3.5l",
    title: "Front Brake Pads",
    jobType: "brake-pads-front",
    summary: "Fixed four-piston caliper - the pads slide out the top and a pads-only job removes no bolts at all. If a guide tells you to undo the caliper bolts and swing it open, it is describing a different truck.",
    difficulty: "Moderate",
    tier: "premium",
    estTime: "1.5-2 hr",
    tools: [
      { name: "Torque wrench", note: "Must cover 83 ft-lb, and 91 ft-lb if you are doing rotors" },
      { name: "17 mm socket + breaker bar", note: "ONLY needed if you are replacing rotors - the caliper-to-knuckle bolts are tight" },
      { name: "21 mm socket", note: "Lug nuts" },
      { name: "Jack + 2 jack stands" },
      { name: "Two flat pry bars or large screwdrivers", note: "For easing the four pistons back evenly" },
      { name: "Punch or drift", note: "For the pad retaining pins" },
      { name: "High-temp synthetic brake grease" },
      { name: "Turkey baster or syringe", note: "For pulling fluid out of the reservoir - see step 3" },
      { name: "Nitrile gloves + safety glasses" },
    ],
    parts: [
      "Front brake pad set",
      "Pad spreader / anti-rattle spring clip - inspect and reuse, or replace if distorted",
    ],
    safety: [
      "Brakes are the one system where a mistake is not recoverable at speed. If what you are looking at does not match these steps, stop.",
      "Never work under a vehicle supported only by a jack.",
      "This caliper has FOUR opposed pistons. Pushing one in shoves the others out. Work them back evenly or you will cock a piston in its bore.",
      "Brake fluid rises fast when you push four pistons back. Watch the reservoir the whole time.",
      "Brake dust is not something to blow around or breathe. Damp rag only.",
      "Pump the pedal firm before the truck moves.",
    ],
    torqueSpecs: [
      {
        fastener: "Disc brake cylinder (caliper-to-knuckle) bolts, 2 per side",
        value: "91 ft-lb (123 Nm)",
        notes: "Toyota factory figure, 1254 kgf-cm. Only needed for a rotor job - a pads-only change never removes these. Confirmed against an independent 2016-2021 Tacoma guide.",
      },
      {
        fastener: "Wheel (lug) nuts",
        value: "83 ft-lb (113 Nm)",
        notes: "Toyota factory figure, 1152 kgf-cm.",
      },
      {
        fastener: "Brake tube union nut at the caliper",
        value: "11 ft-lb (15 Nm)",
        notes: "Only relevant if a line is opened, which this guide does not do. Single-sourced to the FSM.",
      },
    ],
    steps: [
      {
        number: 1,
        title: "Know what you are working on",
        instructions: "This truck has a fixed four-piston caliper. The caliper body bolts straight to the steering knuckle and does not move. There are no slide pins and there is no separate carrier bracket. For a pads-only job the caliper stays exactly where it is and the pads come out through the top after you drive out two retaining pins. This is faster and easier than a floating caliper - but only if you know that is what you are looking at.",
        image: "/steps/brake-inspect.svg",
      },
      {
        number: 2,
        title: "Loosen, lift, support",
        instructions: "Break the lug nuts loose on the ground. Lift at the front crossmember, support the frame on rigid stands, and remove the front wheels.",
        image: "/steps/generic-raise-vehicle.svg",
      },
      {
        number: 3,
        title: "Pull fluid OUT of the reservoir before you start",
        instructions: "Four pistons pushing back at once displaces a lot of fluid. Before touching the pads, draw the reservoir down to roughly the MIN line with a clean syringe or turkey baster and set that fluid aside to discard. This is more important on a four-piston caliper than on any floating one.",
        image: "/steps/brake-inspect.svg",
        warning: "Brake fluid strips paint. An overflow onto the inner fender is a repair, not a wipe-up.",
      },
      {
        number: 4,
        title: "Note the hardware before anything moves",
        instructions: "Look before you disturb it. There is a pad spreader (anti-rattle) spring clip sitting between the pads, and the wear indicator - the squeal tab - is on one specific pad and one specific edge. On the reference truck it was on the bottom of the inner pad, but orientation can differ. Photograph it.",
        image: "/steps/brake-inspect.svg",
      },
      {
        number: 5,
        title: "Drive out the retaining pins and lift the pads out",
        instructions: "Tap the two pad retaining pins out with a punch and lift the spring clip free. The pads now slide straight up and out of the caliper. No bolts have been touched.",
        image: "/steps/brake-caliper-remove.svg",
        warning: "These are pad PINS, not guide pins. Do not go looking for slide pins to grease - this caliper has none.",
      },
      {
        number: 6,
        title: "Ease all four pistons back together",
        instructions: "Working with a pry bar or wide flat blade against the old pad, push each piston back a little at a time and go round them, rather than driving one fully home. Keep checking the reservoir. If a piston starts to tip in its bore, back off and even it out.",
        image: "/steps/brake-piston-compress.svg",
        warning: "A single C-clamp on one piston is exactly how these get cocked. Spread the load.",
      },
      {
        number: 7,
        title: "Clean, grease the pins, fit the new pads",
        instructions: "Wipe the pad contact areas in the caliper clean. Put a light film of high-temp synthetic brake grease on the pad retaining pins - that is where the grease goes on this design. Slide the new pads in with the wear indicator in the same position the old one occupied, refit the spring clip, and drive the pins home.",
        image: "/steps/brake-lubricate.svg",
        warning: "No grease on the friction face of the pad and none on the rotor.",
      },
      {
        number: 8,
        title: "Only if you are doing rotors",
        instructions: "The rotor sits behind the caliper, so the caliper has to come off for a rotor change. That is the two 17 mm caliper-to-knuckle bolts on the back side - they are tight, so use a breaker bar. Support the caliper on a bungee from the suspension, never on its hose. On reassembly torque both bolts to 91 ft-lb. If you are only doing pads, skip this entirely.",
        image: "/steps/brake-install.svg",
        torque: [{ fastener: "Disc brake cylinder (caliper-to-knuckle) bolts, 2 per side", value: "91 ft-lb (123 Nm)" }],
      },
      {
        number: 9,
        title: "Pump the pedal BEFORE the wheels go on",
        instructions: "With the wheels off, press the brake pedal repeatedly until it comes up firm. On a four-piston caliper this takes more presses than you expect. Then top the reservoir back to MAX with fresh DOT 3.",
        image: "/steps/brake-install.svg",
        warning: "A truck moved before the pedal is firm has no brakes on the first press.",
      },
      {
        number: 10,
        title: "Wheels on and torque",
        instructions: "Fit the wheels, snug in a star pattern, lower the truck, then torque to 83 ft-lb in two or three passes.",
        image: "/steps/wheel-torque.svg",
        torque: [{ fastener: "Wheel (lug) nuts", value: "83 ft-lb (113 Nm)" }],
      },
      {
        number: 11,
        title: "Bed the pads in",
        instructions: "Somewhere quiet with nothing behind you: six to eight firm stops from 35 mph down to 10 mph without coming to a full stop, with a short cruise between each to let the brakes cool. Then drive gently for a few miles. Expect a smell. Do not hold the pedal at a light while they are still hot.",
        image: "/steps/generic-cleanup.svg",
      },
    ],
  },
  {
    id: "tacoma-driveline-fluid",
    vehicleId: "2021-toyota-tacoma-3.5l",
    title: "Differentials & Transfer Case Fluid",
    jobType: "driveline-fluid",
    summary: "Three units, all with real drain and fill plugs, and three different torques. Settles the 48-or-29 argument the Tacoma forums have been having for years: 48 is the front DRAIN, 29 is the front FILL, and they are different plugs.",
    difficulty: "Moderate",
    tier: "premium",
    estTime: "2-2.5 hr",
    tools: [
      { name: "Torque wrench", note: "Must cover 27 to 48 ft-lb" },
      { name: "24 mm socket", note: "Rear differential plugs - they take a hex head, not a bit" },
      { name: "10 mm hex (Allen) bit socket", note: "Front differential plugs" },
      { name: "Fluid transfer pump", note: "All three fill holes are side-entry - you cannot pour into them" },
      { name: "Drain pan", note: "5+ qt, low profile" },
      { name: "Jack + 4 jack stands", note: "The truck must be LEVEL" },
      { name: "Nitrile gloves + safety glasses" },
    ],
    parts: [
      "Toyota Genuine Differential Gear Oil LT SAE 75W-85, API GL-5 - about 6 quarts covers front and rear",
      "Toyota Genuine Transfer Gear Oil LF SAE 75W - 1.0 L (1.1 qt)",
    ],
    safety: [
      "The truck must be level and on four rigid stands. A fill-to-the-hole level is meaningless on a tilted truck.",
      "Gear oil smells foul and does not come out of clothing.",
      "Warm fluid drains better but burns - gloves.",
      "Never work under a vehicle supported only by a jack.",
    ],
    torqueSpecs: [
      {
        fastener: "Rear differential drain plug",
        value: "36 ft-lb (49 Nm)",
        notes: "Confirmed by two independent sources. The FSM page reached documents the filler plug at this figure; the drain plug value is third-party-confirmed.",
      },
      {
        fastener: "Rear differential filler plug",
        value: "36 ft-lb (49 Nm)",
        notes: "Toyota factory figure, 49 Nm, confirmed against an independent Tacoma-specific guide.",
      },
      {
        fastener: "Front differential filler plug",
        value: "29 ft-lb (39 Nm)",
        notes: "Toyota factory figure, 39 Nm. Confirmed against an independent source. NOTE this is a DIFFERENT figure from the front drain plug - see below.",
      },
      {
        fastener: "Front differential drain plug",
        value: "48 ft-lb (65 Nm)",
        notes: "Confirmed by two independent DIY sources but NOT verified against the FSM page we could reach, which documents only the fill plug. There is a well-known owner dispute over this exact number - see step 5.",
      },
      {
        fastener: "Transfer case drain plug",
        value: "27 ft-lb (37 Nm)",
        notes: "Toyota factory figure, 377 kgf-cm. Confirmed against an independent quick-reference.",
      },
      {
        fastener: "Transfer case filler plug",
        value: "27 ft-lb (37 Nm)",
        notes: "Same figure as the drain plug on this unit.",
      },
    ],
    steps: [
      {
        number: 1,
        title: "Crack every FILL plug loose before you drain anything",
        instructions: "Three units, three fill plugs, and you break all of them loose first. If one is seized you want to find out while it is still full and still drivable. Snug them back down and then start draining.",
        image: "/steps/generic-raise-vehicle.svg",
        warning: "A drained axle with a seized fill plug is a tow truck.",
      },
      {
        number: 2,
        title: "Get level on four stands",
        instructions: "All three units set their level at the bottom of the fill hole. Lift front and rear evenly, support the frame on four rigid stands, and confirm the truck is stable and sitting level before you crawl under.",
        image: "/steps/generic-raise-vehicle.svg",
      },
      {
        number: 3,
        title: "Rear differential - 24 mm hex head",
        instructions: "The rear plugs are hex-headed, so a 24 mm socket goes straight onto them. Drain, clean and refit the drain plug at 36 ft-lb, then pump 75W-85 GL-5 in until it trickles back out of the fill hole. Torque the fill plug to 36 ft-lb.",
        image: "/steps/oil-drain.svg",
        torque: [
          { fastener: "Rear differential drain plug", value: "36 ft-lb (49 Nm)" },
          { fastener: "Rear differential filler plug", value: "36 ft-lb (49 Nm)" },
        ],
        warning: "Do not chase a capacity number on the rear axle. The FSM lists two sub-variants of this axle with different capacities and there is no reliable way to tell which you have from outside. Fill to the hole and you are correct either way.",
      },
      {
        number: 4,
        title: "Your rear locker does NOT need friction modifier",
        instructions: "This comes up constantly and the answer is no. The TRD Off-Road's rear locker is an electronically-actuated locking differential, not a clutch-type limited-slip, so there are no friction plates for an additive to act on. Toyota's differential oil page lists a single oil specification across every rear axle variant it tabulates, including the locking axle, and calls for no additive anywhere. Straight 75W-85 GL-5 is the answer.",
        image: "/steps/generic-cleanup.svg",
      },
      {
        number: 5,
        title: "Front differential - and the 48-or-29 argument",
        instructions: "The front plugs take a 10 mm hex bit. Here is the thing people argue about: the drain and the fill plug on the front diff are NOT the same torque and they are not the same size. Drain is 48 ft-lb, fill is 29 ft-lb. Drain it, refit the drain plug at 48 ft-lb, pump in 75W-85 GL-5 until it trickles out - roughly 1.5 L - and torque the fill plug to 29 ft-lb.",
        image: "/steps/oil-drain.svg",
        torque: [
          { fastener: "Front differential drain plug", value: "48 ft-lb (65 Nm)" },
          { fastener: "Front differential filler plug", value: "29 ft-lb (39 Nm)" },
        ],
        warning: "Being straight with you: the 48 ft-lb front drain figure comes from two independent DIY sources that agree, but we could not confirm it against the factory manual page itself, which documents only the fill plug. Also note 48 ft-lb is about 65 Nm - do not set 48 on a Nm wrench.",
      },
      {
        number: 6,
        title: "Transfer case - different fluid, do not mix them up",
        instructions: "The transfer case takes Toyota Genuine Transfer Gear Oil LF SAE 75W - a different product from the 75W-85 differential oil, so buy both. Capacity is 1.0 L (1.1 qt). Drain, refit the drain plug at 27 ft-lb, fill until it trickles out, and torque the fill plug to 27 ft-lb.",
        image: "/steps/oil-drain.svg",
        torque: [
          { fastener: "Transfer case drain plug", value: "27 ft-lb (37 Nm)" },
          { fastener: "Transfer case filler plug", value: "27 ft-lb (37 Nm)" },
        ],
      },
      {
        number: 7,
        title: "Drive it, then look underneath",
        instructions: "Lower the truck, drive a few miles to warm everything and move the fluid around, then park and check all six plugs for weeping. Old gear oil goes to a recycling centre with your used motor oil.",
        image: "/steps/generic-cleanup.svg",
      },
    ],
  },
  {
    id: "tacoma-coolant",
    vehicleId: "2021-toyota-tacoma-3.5l",
    title: "Coolant Drain & Fill",
    jobType: "coolant",
    summary: "There are TWO drain points on this engine, not one. Open only the radiator and you leave several quarts sitting in the block - then wonder why the refill does not add up.",
    difficulty: "Moderate",
    tier: "premium",
    estTime: "2-2.5 hr",
    tools: [
      { name: "Drain pan", note: "12+ qt - this system holds over 11" },
      { name: "Clear hose, 9 mm inside diameter", note: "Fits the radiator drain spigot and keeps the job clean" },
      { name: "Socket set + ratchet", note: "Engine under cover" },
      { name: "Torque wrench", note: "For the block drain plug and the under cover" },
      { name: "Funnel" },
      { name: "Jack + 2 jack stands" },
      { name: "Nitrile gloves + safety glasses" },
    ],
    parts: [
      "Toyota Super Long Life Coolant (pink, SLLC), pre-diluted 50/50 - buy 12 qt to be safe",
    ],
    safety: [
      "NEVER open the radiator cap or either drain on a hot engine. Pressurized coolant above boiling point comes out as a scalding jet.",
      "Let it go completely cold, not just warm.",
      "Ethylene glycol tastes sweet and kills pets and children. Catch every drop and clean spills immediately.",
      "Never work under a vehicle supported only by a jack.",
      "The radiator drain cock is plastic. Hand tight only, no wrench, no pliers.",
    ],
    torqueSpecs: [
      {
        fastener: "Radiator drain cock",
        value: "Hand tight only - Toyota publishes no torque figure",
        notes: "Deliberately no number. It is plastic and a wrench on it will break it.",
      },
      {
        fastener: "Cylinder block drain cock plug",
        value: "9 ft-lb (13 Nm)",
        notes: "Toyota factory figure. Single-sourced to the FSM transcription.",
      },
      {
        fastener: "Engine under cover bolts",
        value: "22 ft-lb (30 Nm)",
        notes: "Toyota factory figure. Single-sourced to the FSM transcription.",
      },
    ],
    steps: [
      {
        number: 1,
        title: "Completely cold, no exceptions",
        instructions: "If the engine has run in the last several hours, wait. This is the entire safety story for this job.",
        image: "/steps/generic-park-secure.svg",
        warning: "If you cannot rest your hand comfortably on the upper radiator hose, it is not cool enough.",
      },
      {
        number: 2,
        title: "Work out which capacity applies to your truck",
        instructions: "An automatic with the engine oil cooler holds about 10.5 L (11.1 US qt). Without the oil cooler it is about 9.9 L (10.5 qt). A TRD Off-Road with the tow package very likely has the cooler, but confirm on your own truck rather than assuming - it changes how much coolant you buy.",
        image: "/steps/generic-cleanup.svg",
      },
      {
        number: 3,
        title: "Raise the front and remove the engine under cover",
        instructions: "Lift at the front crossmember and support the frame on stands. Remove the engine under cover - you need access to both drains and you will torque its bolts back to 22 ft-lb at the end.",
        image: "/steps/generic-raise-vehicle.svg",
      },
      {
        number: 4,
        title: "Drain the radiator through a hose",
        instructions: "Push a length of 9 mm inside-diameter clear hose onto the radiator drain cock spigot and run it into the pan. Open the drain cock by hand, then remove the radiator cap so it can flow freely. Let it run dry.",
        image: "/steps/oil-drain.svg",
      },
      {
        number: 5,
        title: "Now the one everybody misses - the BLOCK drain",
        instructions: "There is a second drain: a cylinder block drain cock plug on the engine itself. Open it and let the block empty into the pan as well. This is the difference between a real coolant change and swapping out about two thirds of it. When it stops, refit the block plug and torque it to 9 ft-lb.",
        image: "/steps/oil-drain.svg",
        torque: [{ fastener: "Cylinder block drain cock plug", value: "9 ft-lb (13 Nm)" }],
        warning: "If your refill quantity comes up well short of the capacity above, you did not get the block drained.",
      },
      {
        number: 6,
        title: "Close up and refill slowly",
        instructions: "Pull the hose and close the radiator drain cock by hand until it seats - no tools. Refill the radiator slowly with pre-diluted pink Toyota SLLC. Pouring fast traps air you then have to chase out. Fill the radiator to the neck and the reserve tank to its FULL line.",
        image: "/steps/oil-fill-check.svg",
      },
      {
        number: 7,
        title: "Bleed it at 2000-2500 rpm and squeeze the hoses",
        instructions: "Start the engine with the radiator cap off and warm it until the thermostat opens - the upper hose will suddenly get hot and you will see coolant moving. Hold 2000-2500 rpm and squeeze the No. 1 and No. 2 radiator hoses firmly by hand several times to push trapped air up and out. Top the radiator back up each time the level drops.",
        image: "/steps/generic-cleanup.svg",
        warning: "An air pocket left in a V6 cooling system will overheat the engine quickly and without much warning. Do not rush this step.",
      },
      {
        number: 8,
        title: "Cool, cap, recheck",
        instructions: "Shut it down, let it cool completely, and top the reserve tank to between FULL and LOW. Fit the radiator cap. Refit the engine under cover and torque its bolts to 22 ft-lb. Check the level again over the next couple of drives - a small drop as the last air works out is normal, a continuing drop is a leak.",
        image: "/steps/oil-fill-check.svg",
        torque: [{ fastener: "Engine under cover bolts", value: "22 ft-lb (30 Nm)" }],
      },
      {
        number: 9,
        title: "Dispose of it properly",
        instructions: "Old coolant goes to a recycling centre or a parts store that takes it. Never down a drain, never on the ground.",
        image: "/steps/generic-cleanup.svg",
      },
    ],
  },
  {
    id: "tacoma-serpentine-belt",
    vehicleId: "2021-toyota-tacoma-3.5l",
    title: "Serpentine Belt Replacement",
    jobType: "serpentine-belt",
    summary: "Conventional tensioner, locked open with a 6 mm pin. And one detail that snaps parts on this engine: the tensioner pulley bolt is LEFT-HAND THREAD.",
    difficulty: "Moderate",
    tier: "premium",
    estTime: "1-1.5 hr",
    tools: [
      { name: "6 mm bar or pin", note: "Locks the tensioner in the released position - a drill bit shank works" },
      { name: "Ratchet + sockets" },
      { name: "Phone camera", note: "Photograph the routing before anything comes off - eight contact points" },
      { name: "Nitrile gloves" },
    ],
    parts: [
      "Serpentine belt - Toyota 90916-A2037",
    ],
    safety: [
      "Engine off, cool, keys out.",
      "A tensioner is a loaded spring. Keep fingers out of the pulley path.",
      "Do not get oil or grease on the tensioner.",
    ],
    steps: [
      {
        number: 1,
        title: "Photograph the routing - it is an eight-point path",
        instructions: "This belt wraps the power steering vane pump, the water pump, two idler pulleys, the alternator, the A/C compressor, the crank pulley and the tensioner. That is a lot to remember. Take clear photos from two angles before anything moves.",
        image: "/steps/generic-park-secure.svg",
        warning: "A misrouted belt can drive the water pump the wrong way. Do not work from memory.",
      },
      {
        number: 2,
        title: "Rotate the tensioner counterclockwise and pin it",
        instructions: "Rotate the tensioner counterclockwise to release tension. As it comes round, its service hole lines up - slide a 6 mm bar or pin through to lock it open. Now it holds itself and both your hands are free.",
        image: "/steps/generic-cleanup.svg",
        warning: "Do not try to hold the tensioner back with one hand while wrestling the belt with the other.",
      },
      {
        number: 3,
        title: "If you touch the tensioner pulley bolt, read this first",
        instructions: "The tensioner pulley bolt on this engine is LEFT-HAND THREAD. It loosens clockwise and tightens counterclockwise. Leaning on it the normal way tightens it further and is the number one way people snap something on this job. You do not need to remove it for a belt change - but if you are replacing the pulley, now you know.",
        image: "/steps/generic-cleanup.svg",
        warning: "LEFT-HAND THREAD. If it is not moving the way you expect, stop and think before applying more force.",
      },
      {
        number: 4,
        title: "Slip the belt off and check the pulleys",
        instructions: "With the tensioner pinned the belt comes off easily. Before the new one goes on, spin every pulley by hand - smooth and silent, no wobble, no grinding. A dying idler or tensioner bearing will eat a new belt, and this is the only easy moment to find it.",
        image: "/steps/generic-cleanup.svg",
      },
      {
        number: 5,
        title: "Route the new belt, tensioner last",
        instructions: "Working from your photos, route the belt around all seven other points first, checking that every rib sits down in its groove. Bring it over the tensioner pulley last.",
        image: "/steps/generic-cleanup.svg",
        warning: "A belt riding one rib off the edge looks nearly right and will shred in minutes. Check every pulley by eye and by finger.",
      },
      {
        number: 6,
        title: "Release the tensioner and verify",
        instructions: "Rotate the tensioner counterclockwise again to take the load off the pin, withdraw the pin, and let it come back gently onto the belt. Walk every pulley one more time confirming full engagement, then start the engine and listen. A correct belt is silent. Squeal means shut it off and look again.",
        image: "/steps/generic-cleanup.svg",
      },
    ],
  },
  {
    id: "tacoma-pcv-valve",
    vehicleId: "2021-toyota-tacoma-3.5l",
    title: "PCV Valve Replacement",
    jobType: "pcv-valve",
    summary: "Good news on this engine: the PCV valve comes out with the intake manifold still bolted on. That is not true of every modern V6 - it is why this job exists here and not on some other vehicles in the catalog.",
    difficulty: "Moderate",
    tier: "premium",
    estTime: "45-60 min",
    tools: [
      { name: "Ratchet + sockets", note: "For the V-bank cover, surge tank stay and engine cover" },
      { name: "Inch-pound torque wrench", note: "Read the torque note - the valve itself is 44 IN-lb, not ft-lb" },
      { name: "Pliers", note: "A valve that has never been out may need persuading by its ears" },
      { name: "Nitrile gloves" },
    ],
    parts: [
      "PCV valve (ventilation valve sub-assembly) for the 2GR-FKS",
      "O-ring if not supplied with the valve",
    ],
    safety: [
      "Engine off and cool.",
      "Do not inhale through a PCV valve to test it. It has had petroleum vapour through it for its whole life.",
      "Keep track of every fastener you remove - there are four separate items to get out of the way before you reach the valve.",
    ],
    torqueSpecs: [
      {
        fastener: "PCV (ventilation valve sub-assembly)",
        value: "44 in-lb (5.0 Nm)",
        notes: "INCH-pounds. Toyota factory figure. That is about 3.7 ft-lb - barely more than firm finger pressure. Single-sourced to the FSM transcription.",
      },
      {
        fastener: "No. 1 engine cover sub-assembly",
        value: "7 ft-lb (10 Nm)",
        notes: "Toyota factory figure. Single-sourced to the FSM transcription.",
      },
    ],
    steps: [
      {
        number: 1,
        title: "Why this job is worth doing",
        instructions: "The PCV valve is a cheap one-way valve that lets crankcase pressure vent into the intake. When it sticks you get oil consumption, sludge, sometimes a rough idle or a seal pushed out by pressure with nowhere to go. It is one of the highest-payoff cheap parts on an engine.",
        image: "/steps/generic-cleanup.svg",
      },
      {
        number: 2,
        title: "Work down to it in order",
        instructions: "The valve sits on the left-hand cylinder head cover. Toyota's order of removal is: V-bank cover, then the No. 2 surge tank stay, then disconnect the heater hose, then disconnect the PCV hose, then the No. 1 engine cover. The intake manifold stays exactly where it is - you are not taking it off.",
        image: "/steps/generic-cleanup.svg",
      },
      {
        number: 3,
        title: "Twist the old valve out",
        instructions: "With the engine cover off, the valve is accessible. A valve that has never been removed can be stubborn - grip its ears with pliers and twist rather than levering on the housing.",
        image: "/steps/generic-cleanup.svg",
        warning: "Do not lever against the cylinder head cover. Twist the valve, not the cover.",
      },
      {
        number: 4,
        title: "Check the old one so you know whether it was the problem",
        instructions: "Blow gently through the cylinder-head side - air should pass easily. Blow through the intake-manifold side - air should pass with difficulty. If it fails either way, it needed replacing. Do not put your mouth on it.",
        image: "/steps/generic-cleanup.svg",
      },
      {
        number: 5,
        title: "Fit the new valve - and read the units",
        instructions: "Put a light coat of clean engine oil on the new O-ring, thread the valve in by hand, and torque it to 44 INCH-pounds. Toyota's figure is 5.0 Nm, which is roughly 3.7 foot-pounds. If you do not have an inch-pound wrench, snug it by hand and stop - do not reach for a ft-lb wrench and set 44.",
        image: "/steps/generic-cleanup.svg",
        torque: [{ fastener: "PCV (ventilation valve sub-assembly)", value: "44 in-lb (5.0 Nm)" }],
        warning: "44 INCH-pounds. Setting 44 ft-lb here shears the valve off the cover and turns a cheap part into a big job.",
      },
      {
        number: 6,
        title: "Reassemble in reverse and check for leaks",
        instructions: "Refit the No. 1 engine cover at 7 ft-lb, reconnect the PCV hose and the heater hose, refit the surge tank stay and the V-bank cover. Start the engine and listen for a vacuum whistle, which would mean a hose is not seated.",
        image: "/steps/generic-cleanup.svg",
        torque: [{ fastener: "No. 1 engine cover sub-assembly", value: "7 ft-lb (10 Nm)" }],
      },
    ],
  },
  {
    id: "tacoma-o2-sensor",
    vehicleId: "2021-toyota-tacoma-3.5l",
    title: "Oxygen / Air-Fuel Ratio Sensor",
    jobType: "o2-sensor",
    summary: "V6, so there are two upstream sensors - one per bank, and the banks are not where people assume. Includes the crowfoot torque correction that quietly over-tightens these.",
    difficulty: "Moderate",
    tier: "premium",
    estTime: "1-1.5 hr",
    tools: [
      { name: "Oxygen sensor socket or Toyota SST 09224-00011", note: "Slotted, to clear the pigtail" },
      { name: "Torque wrench", note: "Must cover 32 ft-lb - and read step 5 about which number to set" },
      { name: "Penetrating oil" },
      { name: "Jack + 2 jack stands" },
      { name: "OBD-II scanner", note: "To identify which sensor is flagged and to clear the code" },
      { name: "Nitrile gloves + safety glasses" },
    ],
    parts: [
      "Air-fuel ratio sensor for the flagged position",
    ],
    safety: [
      "Exhaust parts stay hot for a long time. Give it at least an hour.",
      "Never work under a vehicle supported only by a jack.",
      "A dropped sensor is scrap. The element inside is fragile and the damage does not show.",
    ],
    torqueSpecs: [
      {
        fastener: "Air-fuel ratio sensor (standard socket)",
        value: "32 ft-lb (44 Nm)",
        notes: "Toyota factory figure, 449 kgf-cm. Single-sourced to the FSM transcription.",
      },
      {
        fastener: "Air-fuel ratio sensor (using the slotted SST / crowfoot)",
        value: "28 ft-lb (38 Nm)",
        notes: "Same fastener, corrected for the tool extending the lever arm on a standard torque wrench. Not a different bolt.",
      },
    ],
    steps: [
      {
        number: 1,
        title: "Scan first, then buy",
        instructions: "Find out which sensor is actually flagged before ordering anything. On this V6 the upstream air-fuel ratio sensors are Bank 1 Sensor 1 in the RIGHT-HAND exhaust manifold and Bank 2 Sensor 1 in the LEFT-HAND manifold. Guessing which bank is which and ordering the wrong one is the usual wasted trip.",
        image: "/steps/generic-cleanup.svg",
        warning: "Being straight with you: we could source the upstream sensor positions and torque from the factory manual, but not the downstream sensor locations or torque. If your code points downstream, this guide does not cover it and you should not assume the same figures apply.",
      },
      {
        number: 2,
        title: "Get access",
        instructions: "Let the exhaust cool fully, then raise the front and support the frame on stands.",
        image: "/steps/generic-raise-vehicle.svg",
      },
      {
        number: 3,
        title: "Soak it, and free the harness first",
        instructions: "Penetrating oil on the sensor base, then wait fifteen minutes. Release the sensor's connector and every retaining clamp along its harness BEFORE you unscrew anything, so the wiring is not being twisted as the sensor turns.",
        image: "/steps/generic-cleanup.svg",
        warning: "Unscrewing a sensor with the harness still clipped down twists the wires apart inside the insulation. Free the wiring first, and re-clip it exactly as it was afterwards.",
      },
      {
        number: 4,
        title: "Back the old sensor out",
        instructions: "Fit the slotted socket with the pigtail through the slot and unscrew it. If it will not move, re-soak and wait rather than leaning harder - stripping an exhaust manifold thread turns an hour into a machine shop visit.",
        image: "/steps/generic-cleanup.svg",
      },
      {
        number: 5,
        title: "Torque it to the right number for your tool",
        instructions: "Thread the new sensor in by hand for several turns first. With a normal socket on the torque wrench, set 32 ft-lb. With the slotted SST or a crowfoot adapter, set 28 ft-lb instead - the offset tool lengthens the lever, so the same handle reading puts more torque on the sensor. Set 32 on a crowfoot and you are over-tightening it.",
        image: "/steps/generic-cleanup.svg",
        torque: [{ fastener: "Air-fuel ratio sensor (standard socket)", value: "32 ft-lb (44 Nm)" }],
        warning: "Most new sensors come with anti-seize already applied. Do not add more, and keep every trace off the sensor tip.",
      },
      {
        number: 6,
        title: "Reconnect, clear, verify",
        instructions: "Reconnect and re-clip the harness, lower the truck, clear the code, and drive a normal mixed cycle. Re-scan: the code should stay gone and the sensor's live data should be switching rather than sitting flat.",
        image: "/steps/generic-cleanup.svg",
      },
    ],
  },
  {
    id: "tacoma-engine-air-filter",
    vehicleId: "2021-toyota-tacoma-3.5l",
    title: "Engine Air Filter",
    jobType: "engine-air-filter",
    summary: "Two latches, no tools, ten minutes. The only way to get it wrong is to put it in upside down - pleats down, mesh up.",
    difficulty: "Easy",
    tier: "premium",
    estTime: "10-15 min",
    tools: [
      { name: "Your hands", note: "No tools - two metal latches" },
      { name: "Shop vacuum or rag", note: "Optional, for the lower housing" },
    ],
    parts: [
      "Engine air filter - Toyota 17801-0P100. Cross-references: K&N 33-5017, Wix WA10085, Fram CA11895, EcoGard XA10242.",
    ],
    safety: [
      "Engine off and cool.",
      "Do not run the engine with the airbox open.",
    ],
    steps: [
      {
        number: 1,
        title: "Release the two latches",
        instructions: "The airbox is on the left side of the engine bay. Two silver metal latches sit at the front and rear corners of its left side. Flip both down and lift the cover.",
        image: "/steps/airbox-open.svg",
      },
      {
        number: 2,
        title: "Lift the old filter out and clean the housing",
        instructions: "Pull the old filter straight up. Vacuum or wipe out any leaves, grit and bugs from the lower housing while it is open - on a truck that sees dirt roads there is usually a surprising amount.",
        image: "/steps/filter-airflow.svg",
      },
      {
        number: 3,
        title: "Orientation - pleats down, mesh up",
        instructions: "The new filter goes in with the pleats facing DOWN and the metal mesh screen facing UP toward you. That is the whole trick.",
        image: "/steps/filter-airflow.svg",
      },
      {
        number: 4,
        title: "Check the gasket before you close it",
        instructions: "Press the filter down all the way round and look at the edges: no part of the rubber sealing gasket should be visible above the housing lip. If you can see gasket, it is not seated, and unfiltered air will take the easy route past it.",
        image: "/steps/filter-airflow.svg",
        warning: "An unseated air filter on a truck that sees dust is worse than a dirty one.",
      },
      {
        number: 5,
        title: "Close and latch",
        instructions: "Lower the cover, make sure it sits flush with no gap, and snap both latches down.",
        image: "/steps/airbox-open.svg",
      },
    ],
  },
  {
    id: "tacoma-cabin-air-filter",
    vehicleId: "2021-toyota-tacoma-3.5l",
    title: "Cabin Air Filter",
    jobType: "cabin-air-filter",
    summary: "On this truck the glove box stays put - you pop a trim panel behind it instead of dropping the whole box, which is what most generic Toyota guides tell you to do.",
    difficulty: "Easy",
    tier: "premium",
    estTime: "15-20 min",
    tools: [
      { name: "Your hands", note: "No tools" },
      { name: "Phone camera", note: "Photograph the old filter's arrow before it comes out" },
    ],
    parts: [
      "Cabin air filter - Toyota 88508-01010. Note: some retail listings give 88508-04010 for the same application. Order by VIN rather than by year.",
    ],
    safety: [
      "Empty the glove box first so nothing ends up in the footwell.",
    ],
    steps: [
      {
        number: 1,
        title: "Empty the glove box - but leave it attached",
        instructions: "Take everything out. Unlike most Toyotas, you do not need to drop the glove box out of its stops on this truck. It stays where it is.",
        image: "/steps/cabin-filter-access.svg",
      },
      {
        number: 2,
        title: "Pop the trim cover behind the glove box",
        instructions: "At the rear of the glove box opening there is a rectangular black trim cover. Pull up on its top edge to dislodge the four tabs holding it, and set it aside.",
        image: "/steps/cabin-filter-access.svg",
        warning: "Some guides covering 2015-2023 describe dropping the glove box instead. That is the older generation's procedure - on a 2016-2021 truck the trim cover comes off and the box stays.",
      },
      {
        number: 3,
        title: "Release the filter cover and slide the filter out",
        instructions: "Behind the trim cover is the filter housing cover, held by two clips. Release both, pull the cover off, and slide the old filter out.",
        image: "/steps/cabin-filter-access.svg",
      },
      {
        number: 4,
        title: "Get the direction right",
        instructions: "Install with the AIR FLOW arrow pointing DOWN toward the floor mat. Some filters are marked THIS SIDE UP instead of with a flow arrow - in that case the UP faces up, toward the windshield. If your old filter is marked, match it; that is the most reliable answer of all.",
        image: "/steps/filter-airflow.svg",
        warning: "A backwards filter still fits and still blows air. You just do not get the service life you paid for.",
      },
      {
        number: 5,
        title: "Reassemble and test",
        instructions: "Refit the filter cover until both clips click, press the trim cover back until all four tabs seat, and run the fan on high for a few seconds to confirm normal airflow.",
        image: "/steps/cabin-filter-access.svg",
      },
    ],
  },
  {
    id: "tacoma-wiper-blades",
    vehicleId: "2021-toyota-tacoma-3.5l",
    title: "Wiper Blades",
    jobType: "wiper-blades",
    summary: "22 inch driver, 20 inch passenger, no rear wiper. Two sizes, so do not buy a matched pair.",
    difficulty: "Easy",
    tier: "premium",
    estTime: "10 min",
    tools: [
      { name: "Your hands", note: "No tools" },
      { name: "Folded towel", note: "On the glass, in case an arm snaps back" },
    ],
    parts: [
      "Driver blade - 22 in",
      "Passenger blade - 20 in",
    ],
    safety: [
      "A bare wiper arm snapping back will crack a windshield. Towel down before the blade comes off.",
      "Do not let an arm go while the blade is off.",
    ],
    steps: [
      {
        number: 1,
        title: "Buy 22 and 20, not a pair",
        instructions: "Driver side is 22 inches, passenger side is 20. Two independent fitment databases agree. There is no rear wiper on this truck.",
        image: "/steps/wiper-arm-lift.svg",
        warning: "We could not confirm the arm connector type from any 2021-specific source. Most likely a J-hook, but check your old blade before you buy, or buy a blade that ships with multiple adapters.",
      },
      {
        number: 2,
        title: "Lift the arms and protect the glass",
        instructions: "Pull each arm away from the windshield until it locks upright, and lay a folded towel on the glass beneath it.",
        image: "/steps/wiper-arm-lift.svg",
      },
      {
        number: 3,
        title: "Swap the blades",
        instructions: "Press the release tab on the underside of the connector and slide the blade off along the arm. Fit the new one by sliding it on the same path until it clicks, then tug gently to confirm it is captured.",
        image: "/steps/wiper-blade-release.svg",
      },
      {
        number: 4,
        title: "Lower gently and test wet",
        instructions: "Lower both arms onto the glass - do not let them snap down. Wet the windshield with washer fluid before running the wipers; dry wiping tears a new blade's edge immediately. Run all speeds and watch for chatter or a missed strip.",
        image: "/steps/generic-cleanup.svg",
      },
    ],
  },
  {
    id: "tacoma-battery",
    vehicleId: "2021-toyota-tacoma-3.5l",
    title: "Battery Replacement & Terminal Cleaning",
    jobType: "battery",
    summary: "Group 24F, confirmed against Toyota's own OE part number. Toyota publishes no torque figure for the hold-down or terminals on this truck, so this guide says snug rather than inventing one.",
    difficulty: "Easy",
    tier: "premium",
    estTime: "30-45 min",
    tools: [
      { name: "10 mm socket + ratchet", note: "Terminal nuts" },
      { name: "12 mm socket + extension", note: "Hold-down - commonly reported size, check yours" },
      { name: "Battery terminal brush or wire brush" },
      { name: "Nitrile gloves + safety glasses" },
      { name: "Memory saver", note: "Optional - keeps presets and relearned values alive" },
    ],
    parts: [
      "Battery, BCI Group 24F",
      "Terminal protectant spray or dielectric grease",
      "Baking soda and water - only if there is corrosion",
    ],
    safety: [
      "A car battery will dump hundreds of amps into a dropped wrench. Rings and watches off before you start.",
      "NEGATIVE off FIRST, on LAST. Get that backwards and a tool touching bodywork while the positive is live becomes a dead short.",
      "Batteries vent hydrogen. No sparks, no flames, no smoking.",
      "Acid burns skin and destroys clothing. Gloves and eye protection.",
      "It is heavier than it looks. Lift straight, keep it level, set it somewhere it cannot tip.",
    ],
    torqueSpecs: [
      {
        fastener: "Battery hold-down clamp",
        value: "Snug only - Toyota publishes no figure for this fastener",
        notes: "Deliberately no number. The N300 service manual does not appear to carry a battery service section at all, and we would rather say that than invent a torque. Tighten until the battery cannot move by hand and stop.",
      },
      {
        fastener: "Battery terminal clamp nuts",
        value: "Snug only - Toyota publishes no figure for this fastener",
        notes: "Same reasoning. On every vehicle where Toyota does publish one it is in INCH-pounds and very low - the RAV4's is 44 in-lb, about 3.7 ft-lb. Treat this as finger-tight plus a nudge, never a foot-pound reading.",
      },
    ],
    steps: [
      {
        number: 1,
        title: "Buy Group 24F",
        instructions: "This truck takes a BCI Group 24F. Toyota's own TrueStart OE battery for a 2021 Tacoma is part number 00544-24F60-575, and retailer fitment for this year agrees on 24F. Some listings suggest a Group 35 physically fits the tray - that is a single unverified source and not what the truck was built with.",
        image: "/steps/generic-cleanup.svg",
        warning: "On cranking amps the sources disagree: the OE TrueStart part number encodes 575 CCA, while a retailer page states roughly 530 CCA as a minimum. Those are different claims, not two sources for one number. Buy at or above the OE figure and you are safe.",
      },
      {
        number: 2,
        title: "Everything off, hood up",
        instructions: "Park level, ignition fully off, all accessories off. The battery is in the engine bay.",
        image: "/steps/generic-park-secure.svg",
      },
      {
        number: 3,
        title: "Negative first",
        instructions: "Loosen the 10 mm nut on the NEGATIVE terminal, lift the clamp off, and tuck it aside where it cannot spring back onto the post. Only then touch the positive.",
        image: "/steps/generic-cleanup.svg",
        warning: "With the negative still connected, a socket bridging the positive post and any metal is a dead short. This is the step that burns hands.",
      },
      {
        number: 4,
        title: "Positive, then the hold-down",
        instructions: "Remove the positive terminal nut and lift that clamp clear. Then undo the hold-down clamp - an extension helps reach it. Keep the clamp and its bolt together.",
        image: "/steps/generic-cleanup.svg",
      },
      {
        number: 5,
        title: "Out, and clean everything",
        instructions: "Lift the battery straight out, keeping it level. Neutralize any white or blue crust on the tray with baking soda and water, then dry it. Clean the inside of both cable clamps with a terminal brush until they are bright metal. A clean clamp on a clean post is most of what people think they are buying when they buy a battery.",
        image: "/steps/generic-cleanup.svg",
      },
      {
        number: 6,
        title: "New battery in, hold-down snug",
        instructions: "Set the new battery in with the posts oriented as the old one was. Fit the hold-down and tighten until the battery will not shift at all when you push it sideways - then stop. A loose battery shakes itself apart on a truck that sees washboard.",
        image: "/steps/generic-cleanup.svg",
      },
      {
        number: 7,
        title: "Positive first on the way back",
        instructions: "Connect POSITIVE first, NEGATIVE last. Tighten each terminal nut until the clamp will not twist on the post by hand, and stop there. These are low-torque fasteners on soft lead - over-tightening crushes the clamp or snaps the post.",
        image: "/steps/generic-cleanup.svg",
        warning: "Do not put a foot-pound torque wrench on a battery terminal. Wherever Toyota does publish a figure for this fastener it is in inch-pounds and tiny.",
      },
      {
        number: 8,
        title: "Protect, start, expect a few relearns",
        instructions: "Spray both terminals with protectant or smear dielectric grease on them - that is what keeps corrosion from coming back. Start the engine. Expect to reset the clock and radio presets, and expect the first few drives to feel slightly different while the idle and transmission relearn. That settles by itself.",
        image: "/steps/generic-cleanup.svg",
      },
      {
        number: 9,
        title: "Recycle the old one",
        instructions: "Every parts store takes them, and most charge a core deposit you get back on return. Never in a bin.",
        image: "/steps/generic-cleanup.svg",
      },
    ],
  },
  {
    id: "tacoma-fluid-checks",
    vehicleId: "2021-toyota-tacoma-3.5l",
    title: "Fluid Checks & Top-Offs",
    jobType: "fluid-checks",
    summary: "Fifteen minutes under the hood. Note this truck DOES have power steering fluid - it uses a hydraulic vane pump, unlike most of the newer vehicles in this catalog.",
    difficulty: "Easy",
    tier: "premium",
    estTime: "15-20 min",
    tools: [
      { name: "Clean rag" },
      { name: "Funnel" },
      { name: "Nitrile gloves" },
    ],
    parts: [
      "Toyota Super Long Life Coolant (pink, SLLC), pre-diluted - only if needed",
      "DOT 3 brake fluid, sealed container - only if needed",
      "All-season washer fluid",
    ],
    safety: [
      "Engine off and cool. Never open the radiator cap on a hot engine.",
      "Brake fluid strips paint - wipe spills at once.",
      "Brake fluid absorbs moisture from air. Use a sealed container and close it immediately. An opened jug that has sat in the garage a year does not belong in a brake system.",
    ],
    steps: [
      {
        number: 1,
        title: "Level ground, cold engine",
        instructions: "Every reading below assumes both. A check on a slope or a hot engine tells you something untrue.",
        image: "/steps/generic-park-secure.svg",
      },
      {
        number: 2,
        title: "Engine oil",
        instructions: "Pull the dipstick, wipe, reinsert fully, pull again. Level between the marks. Look at the oil as well as the level - milky means coolant is getting in, and that is a stop-and-investigate finding rather than a top-off.",
        image: "/steps/oil-fill-check.svg",
      },
      {
        number: 3,
        title: "Coolant - reservoir only",
        instructions: "Read the overflow reservoir against its FULL and LOW marks. Do not open the radiator cap to check. Top with pre-diluted pink Toyota SLLC only - no green, no orange.",
        image: "/steps/generic-cleanup.svg",
        warning: "A level that keeps dropping is a leak, not a maintenance item.",
      },
      {
        number: 4,
        title: "Power steering - you actually have some",
        instructions: "This truck uses a hydraulic power steering system driven by a vane pump off the serpentine belt, so there is a real power steering reservoir to check. Many newer vehicles have gone to electric assist and have none at all - this one has not. Check the level against the marks on the reservoir with the engine off and cool.",
        image: "/steps/generic-cleanup.svg",
      },
      {
        number: 5,
        title: "Brake fluid",
        instructions: "Read through the side of the reservoir against MIN and MAX. The part people get backwards: a slowly falling level is usually NORMAL, because it drops as the pads wear and the pistons sit further out. Top it up and it will overflow when the pads are replaced and the pistons go back. Check pad thickness before adding anything.",
        image: "/steps/brake-inspect.svg",
        warning: "A level that falls fast, or falls with plenty of pad left, means a leak. Do not drive it.",
      },
      {
        number: 6,
        title: "Washer fluid",
        instructions: "Top with all-season fluid. Not water - it freezes, and it grows things over a summer.",
        image: "/steps/generic-cleanup.svg",
      },
      {
        number: 7,
        title: "While you are under there",
        instructions: "On a truck that sees dirt, take thirty seconds to look at the front and rear differential and the transfer case for wetness around the plugs and seals, and glance at the driveshaft boots. Catching a weeping seal early is worth more than any top-off on this list.",
        image: "/steps/generic-cleanup.svg",
      },
    ],
  },
];
