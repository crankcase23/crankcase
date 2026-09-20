import { RepairGuide } from "@/types/vehicle";

// ---------------------------------------------------------------------------
// GM K2XX 1500 - shared procedures for the 2014-2018 full-size GM trucks
//
// Written originally for the 2018 Silverado 1500 5.3L, but written
// generation-wide rather than year-specific, which is why they re-key cleanly:
// the front brake guide already states that JD9 is the standard and
// effectively only 1500 brake package for 2014-2018, and the cabin filter
// guide already states that the trucks which shipped without one were the
// 2007-2013 generation.
//
// Three different keys are in use here, because a job inherits on whichever
// one actually governs it:
//
//   engine     gm-ecotec3-l83      oil, engine air filter, coolant,
//                                  serpentine belt, fluid checks, O2 sensor
//   platform   gm-k2xx-1500        tire rotation, front and rear brakes,
//                                  battery, cabin filter, wipers, fuse and
//                                  bulb, key fob
//   driveline  gm-k2xx-1500-4wd    differential and transfer case
//
// That split is the whole point. A 2014 Silverado with the 4.3L LV3 V6 gets
// every platform-keyed guide and none of the engine-keyed ones, automatically
// and without anyone having to remember why. A 2WD truck gets no driveline
// guide. Neither case needs a second copy of anything.
//
// What this unlocks: a 2014-2018 Sierra 1500, Tahoe, Suburban, Yukon or
// Escalade needs NO new procedures. Tag it with these keys in vehicles.ts,
// then add one figures entry per guide once that vehicle's numbers have
// actually been verified against two sources. The procedure comes free. The
// numbers never do - a guide with no figures entry for a vehicle renders
// nothing for it rather than falling back to this truck's figures.
//
// Watch item: the guides deliberately name no bulb part numbers. 2014-2015
// ran halogen (H11 low, 9005 high, 5202 fog) and the 2016 facelift moved the
// equipped trims to D3S HID. If bulb numbers are ever added to the fuse and
// bulb guide, it needs splitting with years: [2014, 2015] and [2016, 2018].
//
// HOW THE 2018 SIERRA FIGURES WERE SOURCED - read this before adding another.
//
// They were NOT copied across from the Silverado because the trucks look alike.
// Every figure was researched against Sierra-specific sources first and only
// then compared: the GMC Sierra 2014-2018 torque table for brakes, lug nuts and
// driveline plugs, two GM TechLink battery tables, and a Sierra-specific fluid
// lookup for the capacities. They came back identical to the Silverado, which
// is the expected answer for a badge twin - but it was the answer, not the
// assumption.
//
// That order mattered. The same pass caught a real error in the T1XX guides,
// which were printing 22 ft-lb for a spin-on oil filter against GM's own
// roughly 10 Nm, and it corrected the reason this file gives for rejecting a
// Group 48 battery. Copying figures across on the strength of a shared platform
// would have propagated both instead of finding them.
//
// So: no shortcut here, and please do not add one. A twin declaration was
// considered and rejected for exactly this reason - see the fitment doc.
//
// See claude/guide-fitment-rules-2026-09-19.md.
// ---------------------------------------------------------------------------

export const gmK2xxGuides: RepairGuide[] = [
{
    id: "gm-k2xx-oil-change",
    title: "Engine Oil & Filter Change",
    jobType: "oil-change",
    summary:
      "Eight quarts of 0W-20 and a spin-on filter on the 5.3L EcoTec3. The capacity is the thing people get wrong - this engine takes two quarts more than the Vortec 5.3 it replaced.",
    difficulty: "Easy",
    estTime: "45 min",
    tier: "free",
    tools: [
      { name: "15mm socket", note: "Drain plug" },
      { name: "Oil filter wrench", note: "Cap or band type - this is a spin-on canister, not a cartridge" },
      { name: "Torque wrench" },
      { name: "Drain pan", note: "10 qt or larger - 8 quarts comes out fast" },
      { name: "Funnel" },
      { name: "Jack + 2 jack stands or ramps" },
      { name: "Nitrile gloves + eye protection" },
    ],

    safety: [
      "Never work under a vehicle held up by a jack alone - jack stands or ramps, every time.",
      "Hot oil will burn you. Warm the engine so the oil flows, then give it ten minutes before you pull the plug.",
      "Used oil is a hazardous waste. Most auto parts stores take it back free.",
    ],

    steps: [
      {
        number: 1,
        title: "Warm the engine, then let it sit",
        instructions:
          "Run the truck for five minutes so the oil thins and carries more of the suspended crud out with it. Then shut it off and wait ten minutes - long enough that the oil drains back to the pan and cool enough that it will not scald you.",
      },
      {
        number: 2,
        title: "Raise and support the front",
        instructions:
          "Ramps are ideal here because you only need the nose up. If you are jacking, use the frame rails and put stands under them before anything goes under the truck.",
        warning: "Chock the rear wheels and set the parking brake before you lift.",
      },
      {
        number: 3,
        title: "Drain the oil",
        instructions:
          "The drain plug is a 15mm on the rear of the oil pan. Position the pan slightly behind where you think the stream will land - it shoots out at an angle at first and drops straight as it slows. Let it drain until it goes to a drip, which on eight quarts takes a solid ten minutes.",
      },
      {
        number: 4,
        title: "Swap the filter",
        instructions:
          "The filter is a spin-on canister on the driver's side of the block. Expect a cupful of oil out of it as it breaks loose. Check that the old gasket came off with the filter - if it stuck to the block and you spin a new filter on over it, the double gasket will blow out and dump your fresh oil on the road. Wipe the mounting face, oil the new gasket, spin it on by hand, then three quarters of a turn past contact.",
        warning: "Confirm the old rubber gasket came away with the old filter. A double-gasketed filter is the classic way to lose all your oil at speed.",
      },
      {
        number: 5,
        title: "Reinstall the drain plug",
        instructions:
          "Clean the plug and the pan boss. Fit a new washer if yours uses a crush washer. Start it by hand - always by hand, the aluminum pan strips easily - then torque to 18 ft-lb (25 Nm).",
        torque: [{ fastener: "Oil drain plug", value: "" }],
      },
      {
        number: 6,
        title: "Fill with eight quarts",
        instructions:
          "Lower the truck first so the dipstick reads true. Add 7.5 qt of dexos1 0W-20, run the engine for thirty seconds, shut it off, wait two minutes and check the stick. Top up to the middle of the hatched area. It should land right about 8.0 qt total.",
      },
      {
        number: 7,
        title: "Check for leaks and reset the oil life monitor",
        instructions:
          "Look at the filter and the drain plug with the engine running, then again after a short drive. Reset the Oil Life through the Driver Information Center: Vehicle Information, scroll to Remaining Oil Life, hold the set button until it reads 100%. If you skip the reset the truck keeps counting down from the old number and will nag you early.",
      },
    ],
  fitment: { on: "engine", key: "gm-ecotec3-l83" },
figures: {
"2018-chevrolet-silverado-1500-5.3l": {
id: "silverado-2018-oil-change",
verified: true,
    parts: [
      "8 qt dexos1 0W-20 full synthetic",
      "ACDelco PF63 spin-on oil filter (or equivalent)",
      "Drain plug washer if yours is the crush-washer type",
    ],
    torqueSpecs: [
      {
        fastener: "Oil drain plug",
        value: "18 ft-lb (25 Nm)",
        notes:
          "Two sources agree on 18 ft-lb across the 4.3, 5.3 and 6.2. This is a low figure into an aluminum pan - a stripped pan is a far bigger job than a weeping plug, so do not lean on it.",
      },
      {
        fastener: "Oil filter",
        value: "Hand-tight plus one full turn after the gasket touches",
        notes: "No torque wrench - the turn count IS the spec. GM bulletin 22-NA-009 (Sept 2022) revised this from three quarters of a turn to one full turn, to stop filters weeping at the gasket. Wipe a film of fresh oil on the new gasket first or it will grab and tear. Ignore any table giving this filter a 22 ft-lb or 41 ft-lb figure: the first is roughly three times GM number, the second is the filter adapter fitting, not the filter.",
      },
    ],
},
"2018-gmc-sierra-1500-5.3l": {
id: "sierra-2018-oil-change",
verified: true,
    parts: [
      "8 qt dexos1 0W-20 full synthetic",
      "ACDelco PF63 spin-on oil filter (or equivalent)",
      "Drain plug washer if yours is the crush-washer type",
    ],
    torqueSpecs: [
      {
        fastener: "Oil drain plug",
        value: "18 ft-lb (25 Nm)",
        notes:
          "Two sources agree on 18 ft-lb across the 4.3, 5.3 and 6.2. This is a low figure into an aluminum pan - a stripped pan is a far bigger job than a weeping plug, so do not lean on it.",
      },
      {
        fastener: "Oil filter",
        value: "Hand-tight plus one full turn after the gasket touches",
        notes: "No torque wrench - the turn count IS the spec. GM bulletin 22-NA-009 (Sept 2022) revised this from three quarters of a turn to one full turn, to stop filters weeping at the gasket. Wipe a film of fresh oil on the new gasket first or it will grab and tear. Ignore any table giving this filter a 22 ft-lb or 41 ft-lb figure: the first is roughly three times GM number, the second is the filter adapter fitting, not the filter.",
      },
    ],
},
},
},
{
    id: "gm-k2xx-tire-rotation",
    title: "Tire Rotation",
    jobType: "tire-rotation",
    summary:
      "Straightforward job with one platform-specific trap: the factory two-piece lug nuts on these trucks swell with rust and stop fitting a 22mm socket. Check that before the truck is in the air.",
    difficulty: "Easy",
    estTime: "45 min",
    tier: "free",
    tools: [
      { name: "22mm socket", note: "Deep, six-point. Check that it still fits your nuts before you start" },
      { name: "Breaker bar or impact gun" },
      { name: "Torque wrench", note: "Must reach 140 ft-lb" },
      { name: "Jack + 4 jack stands", note: "Or a jack and stands two corners at a time" },
      { name: "Wheel chocks" },
      { name: "Tire pressure gauge" },
    ],

    safety: [
      "Never get under or beside a wheel that is held up by the jack alone.",
      "Break the lug nuts loose while the wheel is still on the ground. A wheel spinning in the air is how knuckles get broken.",
      "Re-torque after 50 to 100 miles. Wheels settle, and a nut that felt right cold can be loose warm.",
    ],

    steps: [
      {
        number: 1,
        title: "Check your socket fits before you lift anything",
        instructions:
          "The factory lug nuts on these trucks are two-piece: a steel core with a stainless cap crimped over it. Moisture gets between the two, the core rusts and swells, and the cap grows until a 22mm socket will not seat. Try the socket on every nut with the truck on the ground. If one is tight, you have found the problem now rather than on the side of a road.",
        warning: "Do not hammer a 7/8 inch or 23mm socket onto a swollen nut. You will round it, and then it comes off with a cutting wheel.",
      },
      {
        number: 2,
        title: "Note the current positions",
        instructions:
          "Chalk or tape each tire with where it came from. For a 4WD truck with matching tires front and rear, rotate rearward on the same side and cross the fronts: left front to right rear, right front to left rear, rears straight forward. If your tires are directional, keep each one on its own side and just swap front to back.",
      },
      {
        number: 3,
        title: "Break the nuts loose, then lift",
        instructions:
          "Crack each nut about a quarter turn with the wheel on the ground. Then jack at the frame rail and put a stand under it before the wheel comes off. Chock whichever wheels are staying down.",
      },
      {
        number: 4,
        title: "Swap the wheels and look while they are off",
        instructions:
          "With the wheel off, spend thirty seconds on what you can now see: pad thickness through the caliper, any fluid weeping at the caliper, torn CV boots on the front, and uneven wear across the tread. Uneven wear front to back is normal; uneven wear across one tire is an alignment or pressure problem the rotation will not fix.",
      },
      {
        number: 5,
        title: "Hand-start every nut",
        instructions:
          "Every nut goes on by hand until it is snug against the wheel. Starting one with an impact is how you cross-thread a stud, and a stud replacement on a truck means pressing it out of the hub.",
      },
      {
        number: 6,
        title: "Torque to 140 ft-lb in a star pattern",
        instructions:
          "Lower the wheel until the tire just touches and torque in a star pattern to 140 ft-lb (190 Nm). Go around twice - the first pass seats the wheel, the second catches the nuts that relaxed when their neighbours pulled the wheel flat.",
        torque: [{ fastener: "Wheel lug nuts", value: "" }],
      },
      {
        number: 7,
        title: "Set pressures and re-torque after a short drive",
        instructions:
          "Set all four to the pressure on the driver's door jamb label, not the number on the tire sidewall - the sidewall number is the tire's maximum, not the truck's spec. Drive 50 to 100 miles and re-torque.",
      },
    ],
  fitment: { on: "platform", key: "gm-k2xx-1500" },
figures: {
"2018-chevrolet-silverado-1500-5.3l": {
id: "silverado-2018-tire-rotation",
verified: true,
    parts: ["Replacement lug nuts if any are swollen or rounded"],
    torqueSpecs: [
      {
        fastener: "Wheel lug nuts",
        value: "140 ft-lb (190 Nm)",
        notes:
          "Three sources agree, and the figure has held across every printed K2XX 1500 owner's manual. Star pattern, in two passes.",
      },
    ],
},
"2018-gmc-sierra-1500-5.3l": {
id: "sierra-2018-tire-rotation",
verified: true,
    parts: ["Replacement lug nuts if any are swollen or rounded"],
    torqueSpecs: [
      {
        fastener: "Wheel lug nuts",
        value: "140 ft-lb (190 Nm)",
        notes:
          "Three sources agree, and the figure has held across every printed K2XX 1500 owner's manual. Star pattern, in two passes.",
      },
    ],
},
},
},
{
    id: "gm-k2xx-front-brake-pads",
    title: "Front Brake Pads & Rotors",
    jobType: "brake-pads-front",
    summary:
      "Front brake service on the K2XX truck, pads alone or pads and rotors together. Pick which job you are doing at the top of the steps and the procedure changes to match.",
    hasRotorOption: true,
    difficulty: "Moderate",
    estTime: "1-1.5 hrs pads only, 2-2.5 hrs with rotors (both sides)",
    tier: "premium",
    tools: [
      { name: "22mm socket + breaker bar", note: "Lug nuts" },
      { name: "Socket set", note: "For the caliper guide pin bolts" },
      { name: "C-clamp or caliper piston tool" },
      { name: "Torque wrench", note: "One that covers 74 ft-lb and one that reaches 170 - a single wrench rarely reads well across that range" },
      { name: "Breaker bar", note: "Rotors only - the bracket bolts are 170 ft-lb and will not come loose with a ratchet" },
      { name: "Dead blow or brass hammer", note: "Rotors only" },
      { name: "Wire brush", note: "Rotors only - the hub face is what decides whether you get a pulsation" },
      { name: "Jack + 2 jack stands" },
      { name: "Brake cleaner spray" },
      { name: "High-temp brake grease" },
      { name: "Nitrile gloves + eye protection" },
    ],

    safety: [
      "Brake dust can contain harmful particulates - never blow it out with compressed air; use brake cleaner and a wet rag.",
      "Support the caliper with a hook or wire once removed - never let it hang by the brake hose.",
      "Pump the brake pedal to restore firm pedal feel before driving; test brakes at low speed before normal driving.",
    ],

    steps: [
      {
        number: 1,
        title: "Break the lug nuts loose and raise the front",
        instructions:
          "Loosen but do not remove the lug nuts with the truck on the ground. Raise the front, set it on jack stands at the frame rails, chock the rears, and pull both front wheels. Brakes are replaced in axle pairs.",
      },
      {
        number: 2,
        title: "Look at it before you take it apart",
        instructions:
          "Photograph how the pads and anti-rattle clips sit and which side the wear indicator is on. Check the rotor face for deep scoring and the caliper for fluid weeping around the piston boot. A weeping caliper turns this into a different job and is much better caught now.",
      },
      {
        number: 3,
        title: "Remove the guide pin bolts and lift the caliper off",
        instructions:
          "Two bolts run through the caliper into the bracket, usually behind rubber boots. Remove both and work the caliper off. Hang it from the coil spring or an upper control arm with a wire hook or bungee.",
        warning: "Never let the caliper hang by the brake hose. The hose is not structural and the damage is not always visible.",
      },
      {
        number: 4,
        title: "Compress the piston",
        instructions:
          "Lay the old outer pad against the piston as a pressure plate and drive the piston in with a C-clamp. Check the brake fluid reservoir first - if it is near full, siphon a little out so it does not overflow as the fluid backs up.",
        warning: "Check the reservoir level before you start compressing. Pushing a piston back into a full system pushes fluid out of the top.",
      },
      {
        number: 5,
        title: "Pull the pads and clean the bracket ledges",
        instructions:
          "Lift the pads out and pop the stainless anti-rattle clips off. Wire-brush the ledges down to clean metal and wipe with brake cleaner. Rust scale under a clip is the most common cause of a pad that will not release and a wheel that runs hot.",
      },
      {
        number: 6,
        title: "Remove the caliper bracket bolts",
        instructions:
          "Two bolts hold the bracket to the knuckle at 170 ft-lb, which makes them the tightest fasteners in this job by a wide margin. Use a breaker bar, keep the socket square, and expect them to crack loose suddenly.",
        rotorsOnly: true,
      },
      {
        number: 7,
        title: "Get the rotor off",
        instructions:
          "Remove the retaining screw if yours has one, then pull the rotor. If it is rust-bonded to the hub, work penetrant into the hub face and tap alternately around the hat with a dead blow. Some rotors have two threaded holes in the hat - a bolt in each, turned evenly, walks the rotor off without violence.",
        rotorsOnly: true,
        warning: "Never strike the friction surface with a steel hammer.",
      },
      {
        number: 8,
        title: "Clean the hub face",
        instructions:
          "Wire-brush the hub mounting face back to bare metal and wipe it with brake cleaner. This is the step people skip and it is the one that decides whether you get a pulsation. A rust flake a few thousandths thick under a new rotor produces exactly the pedal shudder the new parts were supposed to fix.",
        rotorsOnly: true,
      },
      {
        number: 9,
        title: "Fit the new rotor and refit the bracket",
        instructions:
          "Scrub the shipping oil off both faces of the new rotor with brake cleaner until the rag comes away clean. Set it on the hub, hold it with a lug nut, then start both bracket bolts by hand and torque to 170 ft-lb (230 Nm).",
        torque: [{ fastener: "Caliper bracket (adapter) bolts to knuckle", value: "" }],
        rotorsOnly: true,
      },
      {
        number: 10,
        title: "Grease the pins and fit the new pads",
        instructions:
          "Pull each guide pin, wipe it, and re-grease with high-temp brake grease - a thin even film, not a packed boot. Replace any torn or hardened boot. Fit the new clips, then the pads, wear indicator in the same position you photographed. Keep grease off the friction surfaces.",
      },
      {
        number: 11,
        title: "Set the caliper back and torque the guide pins",
        instructions:
          "Lower the caliper over the new pads and start both pin bolts by hand. Torque to 74 ft-lb (100 Nm).",
        torque: [{ fastener: "Caliper guide/slide pin bolts (front)", value: "" }],
      },
      {
        number: 12,
        title: "Wheels on, pedal firm, then bed the pads",
        instructions:
          "Mount the wheels, torque the lugs to 140 ft-lb (190 Nm) in a star pattern, and lower the truck. With the engine off, pump the pedal until it is firm - the first pump or two will go to the floor. Then bed the pads: from about 35 mph brake firmly but short of ABS down to 10 mph, release, repeat six to eight times with a short cruise between each.",
        torque: [{ fastener: "Wheel lug nuts", value: "" }],
        warning: "Do not move the truck until the pedal is firm, and do not sit on the brake at a stop while they are still hot from bedding - it prints pad material onto the rotor and gives you the pulsation you were trying to avoid.",
      },
    ],
  fitment: { on: "platform", key: "gm-k2xx-1500" },
figures: {
"2018-chevrolet-silverado-1500-5.3l": {
id: "silverado-2018-front-brake-pads",
verified: true,
    parts: [
      "Front brake pad set",
      "Brake cleaner",
      "High-temp brake/caliper grease",
      "New guide pin boots if the old ones are torn or hardened",
      "Front brake rotors, pair - only if replacing rotors",
    ],
    torqueSpecs: [
      {
        fastener: "Caliper guide/slide pin bolts (front)",
        value: "74 ft-lb (100 Nm)",
        notes:
          "JD9 brake code, which is the standard and effectively only 1500 brake package for 2014-2018. Two independent sources agree. This is much higher than the rear - do not carry the rear figure forward.",
      },
      {
        fastener: "Caliper bracket (adapter) bolts to knuckle",
        value: "170 ft-lb (230 Nm)",
        notes:
          "Rotors only. JD9 code. Beware the J95/J96 heavy-brake column in the same tables - it lists 221 ft-lb, roughly 50 percent over spec for a 1500 and a real over-torque.",
      },
      { fastener: "Wheel lug nuts", value: "140 ft-lb (190 Nm)" },
    ],
},
"2018-gmc-sierra-1500-5.3l": {
id: "sierra-2018-front-brake-pads",
verified: true,
    parts: [
      "Front brake pad set",
      "Brake cleaner",
      "High-temp brake/caliper grease",
      "New guide pin boots if the old ones are torn or hardened",
      "Front brake rotors, pair - only if replacing rotors",
    ],
    torqueSpecs: [
      {
        fastener: "Caliper guide/slide pin bolts (front)",
        value: "74 ft-lb (100 Nm)",
        notes:
          "JD9 brake code, which is the standard and effectively only 1500 brake package for 2014-2018. Two independent sources agree. This is much higher than the rear - do not carry the rear figure forward.",
      },
      {
        fastener: "Caliper bracket (adapter) bolts to knuckle",
        value: "170 ft-lb (230 Nm)",
        notes:
          "Rotors only. JD9 code. Beware the J95/J96 heavy-brake column in the same tables - it lists 221 ft-lb, roughly 50 percent over spec for a 1500 and a real over-torque.",
      },
      { fastener: "Wheel lug nuts", value: "140 ft-lb (190 Nm)" },
    ],
},
},
},
{
    id: "gm-k2xx-rear-brake-pads",
    title: "Rear Brake Pads & Rotors",
    jobType: "brake-pads-rear",
    summary:
      "Rear brake service on the K2XX truck. The piston pushes straight in - the parking brake is a separate drum inside the rotor hat, not a screw-in piston - and that same drum is what usually holds a stuck rotor on.",
    hasRotorOption: true,
    difficulty: "Moderate",
    estTime: "1-1.5 hrs pads only, 2-2.5 hrs with rotors (both sides)",
    tier: "premium",
    tools: [
      { name: "22mm socket + breaker bar", note: "Lug nuts" },
      { name: "Socket set", note: "Caliper guide pin bolts" },
      { name: "C-clamp or caliper piston tool" },
      { name: "Torque wrench", note: "One that reads accurately at 38 ft-lb and one that reaches 148" },
      { name: "Breaker bar", note: "Rotors only - the bracket bolts are 148 ft-lb" },
      { name: "Brake spoon or flat screwdriver", note: "Rotors only - for backing off the parking brake star adjuster" },
      { name: "Dead blow or brass hammer", note: "Rotors only, and only after the parking brake is ruled out" },
      { name: "Wire brush" },
      { name: "Jack + 2 jack stands" },
      { name: "Brake cleaner spray" },
      { name: "High-temp brake grease" },
      { name: "Nitrile gloves + eye protection" },
    ],

    safety: [
      "Brake dust can contain harmful particulates - never blow it out with compressed air; use brake cleaner and a wet rag.",
      "Support the caliper with a hook or wire once removed - never let it hang by the brake hose.",
      "The parking brake shoes live inside the rotor hat. Leave the parking brake released for the whole job and cycle it several times before driving so it re-adjusts.",
      "Pump the brake pedal to restore firm pedal feel before driving; test brakes at low speed before normal driving.",
    ],

    steps: [
      {
        number: 1,
        title: "Release the parking brake and leave it off",
        instructions:
          "Do this first. The parking brake on this truck is a small drum brake built into the hat of the rear rotor - it is not part of the caliper. If the shoes are applied the rotor will not come off, and people spend twenty minutes beating on a rotor that is being held from the inside. Release it fully and chock the front wheels, since you have just given up the parking brake.",
        warning: "With the parking brake off, the front wheels are all that is holding the truck. Chock them before lifting.",
      },
      {
        number: 2,
        title: "Break the lug nuts loose and raise the rear",
        instructions:
          "Loosen but do not remove the lug nuts on the ground. Raise the rear, support it on jack stands, and remove both wheels. Do both sides.",
      },
      {
        number: 3,
        title: "Look at it before you take it apart",
        instructions:
          "Photograph the pad and clip layout and note which side the wear indicator is on. Check for fluid weeping at the piston boot. Rears do more of the parking duty and less of the stopping, so they often look better than the fronts at the same mileage - but they rust worse for exactly that reason.",
      },
      {
        number: 4,
        title: "Remove the guide pin bolts and lift the caliper off",
        instructions:
          "Both pin bolts out, then work the caliper off the bracket and hang it from the frame or a spring with a wire hook.",
        warning: "Never let the caliper hang by the brake hose.",
      },
      {
        number: 5,
        title: "Compress the piston straight in",
        instructions:
          "Use the old outer pad as a pressure plate and drive the piston in with a C-clamp. Push it STRAIGHT - do not twist it. This caliper has a plain hydraulic piston because the parking brake is a separate drum-in-hat system, so there is no screw-in mechanism and a rewind tool is not needed. Half the rear brake advice online is written for cars with an integrated parking brake piston and will have you fighting a piston that does not turn. Crack the bleeder while you compress so you push old fluid out rather than back up into the ABS module.",
        warning: "Check the reservoir level before compressing, or open the bleeder and catch what comes out.",
      },
      {
        number: 6,
        title: "Pull the pads and clean the bracket ledges",
        instructions:
          "Pads out, clips off, ledges wire-brushed to clean metal and wiped with brake cleaner.",
      },
      {
        number: 7,
        title: "Remove the caliper bracket bolts",
        instructions:
          "Two bolts at 148 ft-lb hold the bracket to the knuckle. Breaker bar, socket square, do not round them.",
        rotorsOnly: true,
      },
      {
        number: 8,
        title: "Get the rotor off - and know what is holding it",
        instructions:
          "Remove the retaining screw if fitted, then pull the rotor. If it will not move, do not reach for a hammer yet: on this truck the usual culprit is the parking brake shoes inside the hat, especially if the parking brake has sat unused and rusted. Find the rubber access plug - on the rotor face or behind the backing plate - and back the star adjuster off with a brake spoon. Only once the shoes are backed off should you work rust at the hub face.",
        rotorsOnly: true,
        warning: "Never pry against the parking brake backing plate. It bends easily and then drags forever.",
      },
      {
        number: 9,
        title: "Clean the hub face and fit the new rotor",
        instructions:
          "Wire-brush the hub mounting face to bare metal and wipe with brake cleaner - this is what prevents a pulsation. Scrub the shipping oil off both faces of the new rotor until the rag comes away clean, then set it on the hub and hold it with a lug nut.",
        rotorsOnly: true,
      },
      {
        number: 10,
        title: "Reinstall the caliper bracket",
        instructions:
          "Start both bracket bolts by hand, then torque to 148 ft-lb (200 Nm). Clean and re-apply medium-strength thread locker if the originals came out with residue on them.",
        torque: [{ fastener: "Caliper bracket (adapter) bolts to knuckle", value: "" }],
        rotorsOnly: true,
      },
      {
        number: 11,
        title: "Grease the pins, fit the pads, torque the guide bolts",
        instructions:
          "Clean and re-grease each guide pin with high-temp brake grease, replace any bad boots, fit the new clips and pads, then set the caliper back and torque both pin bolts to 38 ft-lb (52 Nm). That is a low figure and easy to overshoot with a big wrench.",
        torque: [{ fastener: "Caliper guide/slide pin bolts (rear)", value: "" }],
      },
      {
        number: 12,
        title: "Wheels on, pedal firm, parking brake re-adjusted, then bed in",
        instructions:
          "Torque the lugs to 140 ft-lb (190 Nm) in a star pattern and lower the truck. Pump the pedal with the engine off until it is firm. Then apply and release the parking brake eight to ten times - it self-adjusts, and this is what takes the slack back out after the rotors came off. Finally bed the pads: 35 mph down to 10 mph, firm but short of ABS, six to eight times with a cruise between each.",
        torque: [{ fastener: "Wheel lug nuts", value: "" }],
        warning: "Do not come to a full stop and hold the pedal while the brakes are hot from bedding - it prints pad material onto the rotor.",
      },
    ],
  fitment: { on: "platform", key: "gm-k2xx-1500" },
figures: {
"2018-chevrolet-silverado-1500-5.3l": {
id: "silverado-2018-rear-brake-pads",
verified: true,
    parts: [
      "Rear brake pad set",
      "Brake cleaner",
      "High-temp brake/caliper grease",
      "New guide pin boots if the old ones are torn or hardened",
      "Rear brake rotors, pair - only if replacing rotors",
    ],
    torqueSpecs: [
      {
        fastener: "Caliper guide/slide pin bolts (rear)",
        value: "38 ft-lb (52 Nm)",
        notes:
          "JD9 brake code. Two independent sources agree. About half the front figure - the two are not interchangeable.",
      },
      {
        fastener: "Caliper bracket (adapter) bolts to knuckle",
        value: "148 ft-lb (200 Nm)",
        notes:
          "Rotors only. JD9 code, corroborated three ways. Ignore the J95/J96 column in the same tables - those are heavy-brake figures and far too high for a 1500.",
      },
      { fastener: "Wheel lug nuts", value: "140 ft-lb (190 Nm)" },
    ],
},
"2018-gmc-sierra-1500-5.3l": {
id: "sierra-2018-rear-brake-pads",
verified: true,
    parts: [
      "Rear brake pad set",
      "Brake cleaner",
      "High-temp brake/caliper grease",
      "New guide pin boots if the old ones are torn or hardened",
      "Rear brake rotors, pair - only if replacing rotors",
    ],
    torqueSpecs: [
      {
        fastener: "Caliper guide/slide pin bolts (rear)",
        value: "38 ft-lb (52 Nm)",
        notes:
          "JD9 brake code. Two independent sources agree. About half the front figure - the two are not interchangeable.",
      },
      {
        fastener: "Caliper bracket (adapter) bolts to knuckle",
        value: "148 ft-lb (200 Nm)",
        notes:
          "Rotors only. JD9 code, corroborated three ways. Ignore the J95/J96 column in the same tables - those are heavy-brake figures and far too high for a 1500.",
      },
      { fastener: "Wheel lug nuts", value: "140 ft-lb (190 Nm)" },
    ],
},
},
},
{
    id: "gm-k2xx-battery",
    title: "Battery Replacement",
    jobType: "battery",
    summary:
      "Group 94R (H7) under the hood on the driver's side. The trap here is at the parts counter, not on the truck: half the retailers will also offer you a Group 48, which is the row for the 4.3L V6 and the diesel, not your V8, and will sit loose in this tray.",
    difficulty: "Easy",
    estTime: "30 min",
    tier: "free",
    tools: [
      { name: "10mm socket", note: "Terminals and hold-down clamp" },
      { name: "Socket extension", note: "The hold-down bolt sits low at the base of the tray" },
      { name: "Battery terminal brush or wire brush" },
      { name: "Torque wrench", note: "Optional but useful - these are low, easily over-tightened fasteners" },
      { name: "Nitrile gloves + eye protection" },
      { name: "Memory saver", note: "Optional - an OBD-port saver keeps radio presets and relearned settings" },
    ],

    safety: [
      "Batteries vent hydrogen. No smoking, no sparks, no open flame near one.",
      "Disconnect the NEGATIVE terminal first and reconnect it LAST. Touching a wrench between the positive post and any metal while the negative is still connected will weld the wrench.",
      "Battery acid will ruin clothing and injure eyes. Gloves and eye protection.",
      "A truck battery is heavier than it looks. Lift with your legs and keep it level.",
    ],

    steps: [
      {
        number: 1,
        title: "Confirm the group size before you buy",
        instructions:
          "This truck takes a Group 94R, also called H7, 800 CCA from the factory. Several big retailers list a Group 48 (H6) as an alternate fit. Two GM TechLink battery tables put the V8 gas trucks (RPO L83/L86) in the 94R row and the 4.3L V6 and diesel in the 48 row - so a 48 is the right battery for a different truck, not a second battery for yours. On the dual-battery trucks GM notes the auxiliary battery is simply another 94R. A 48 is physically shorter than a 94R and will move around in this tray no matter how you clamp it. If the counter hands you a 48, hand it back.",
      },
      {
        number: 2,
        title: "Save your settings if you care about them",
        instructions:
          "Losing power clears radio presets and makes the truck relearn its idle and transmission adaptives over the next few drives. An OBD-port memory saver avoids all of it. Skipping it is not harmful, just mildly annoying for a week.",
      },
      {
        number: 3,
        title: "Disconnect negative first",
        instructions:
          "Engine off, key out. Loosen the 10mm nut on the negative (black, marked minus) clamp, twist the clamp off the post and tuck it aside where it cannot spring back onto the post. Then do the positive (red, marked plus) the same way.",
        warning: "Negative first, always. With the negative off, the rest of the truck is isolated and a slipped wrench on the positive post does nothing.",
      },
      {
        number: 4,
        title: "Remove the hold-down and lift the battery out",
        instructions:
          "The hold-down clamp sits at the base of the battery and its bolt usually needs a 10mm on an extension. Take the clamp off, then lift the battery straight up and out, keeping it level. Watch the surrounding harness and the brake lines on the way past.",
      },
      {
        number: 5,
        title: "Clean the tray and the cable clamps",
        instructions:
          "Brush the inside of both cable clamps until they are bright metal. A clamp that looks fine but is corroded on its inner face is the most common cause of a truck that still cranks slowly on a brand new battery. Wipe any acid residue out of the tray and check the tray itself is not rotted through.",
      },
      {
        number: 6,
        title: "Fit the new battery and clamp it down",
        instructions:
          "Set the new battery in with the posts on the same side as the old one, refit the hold-down and snug it to about 13 ft-lb (18 Nm). Grab the battery and push - if it rocks, the clamp is not doing its job or the battery is the wrong size.",
        torque: [{ fastener: "Battery hold-down clamp bolt", value: "" }],
      },
      {
        number: 7,
        title: "Reconnect positive first, negative last",
        instructions:
          "Positive clamp on and snug to about 11 ft-lb (15 Nm), then negative. You may get a small spark as the negative touches - that is the truck's electronics drawing their first current and is normal. Spray both terminals with protectant.",
        torque: [{ fastener: "Battery terminal clamp nuts", value: "" }],
        warning: "Negative goes on LAST. Reversing the order puts a live positive on the truck while you are still working on it.",
      },
      {
        number: 8,
        title: "Start it and check what it forgot",
        instructions:
          "Start the truck. Reset the clock and radio presets. Expect a slightly odd idle or shift feel for the first few drives while the adaptives relearn - that settles on its own and is not a fault.",
      },
    ],
  fitment: { on: "platform", key: "gm-k2xx-1500" },
figures: {
"2018-chevrolet-silverado-1500-5.3l": {
id: "silverado-2018-battery",
verified: true,
    parts: [
      "Group 94R (H7) battery, 800 CCA minimum",
      "Battery terminal protectant spray or felt washers",
    ],
    torqueSpecs: [
      {
        fastener: "Battery hold-down clamp bolt",
        value: "13 ft-lb (18 Nm)",
        notes: "Reference figure from a single published procedure. Snug is what matters - the clamp only has to stop the battery moving.",
      },
      {
        fastener: "Battery terminal clamp nuts",
        value: "11 ft-lb (15 Nm)",
        notes: "Reference figure. Lead is soft; over-tightening deforms the post and guarantees a bad connection later.",
      },
    ],
},
"2018-gmc-sierra-1500-5.3l": {
id: "sierra-2018-battery",
verified: true,
    parts: [
      "Group 94R (H7) battery, 800 CCA minimum",
      "Battery terminal protectant spray or felt washers",
    ],
    torqueSpecs: [
      {
        fastener: "Battery hold-down clamp bolt",
        value: "13 ft-lb (18 Nm)",
        notes: "Reference figure from a single published procedure. Snug is what matters - the clamp only has to stop the battery moving.",
      },
      {
        fastener: "Battery terminal clamp nuts",
        value: "11 ft-lb (15 Nm)",
        notes: "Reference figure. Lead is soft; over-tightening deforms the post and guarantees a bad connection later.",
      },
    ],
},
},
},
{
    id: "gm-k2xx-engine-air-filter",
    title: "Engine Air Filter Replacement",
    jobType: "engine-air-filter",
    summary:
      "A five-minute job that turns into a twenty-minute job because of one screw. The airbox lid takes four T25 Torx screws and a hard line runs directly over the lower front one, leaving about an inch of clearance.",
    difficulty: "Easy",
    estTime: "15-25 min",
    tier: "free",
    noFasteners: true,
    tools: [
      { name: "T25 Torx bit", note: "On a 1/4 inch drive with a ball universal and a long extension - this is the whole trick" },
      { name: "Flashlight" },
      { name: "Shop vac or rag", note: "For the debris that always sits in the bottom of the box" },
    ],

    safety: [
      "Engine off and cool enough to lean over.",
      "Do not run the engine with the airbox open. Anything that goes down the intake tube goes through the MAF sensor and into the engine.",
    ],

    steps: [
      {
        number: 1,
        title: "Find the four screws before you start turning anything",
        instructions:
          "The airbox is on the driver's side at the front of the engine bay. The lid is held by four T25 Torx screws, one at each corner - this is not a tool-less clip box. Locate all four with a flashlight first. The lower front one is the problem: a hard line runs straight over it with roughly an inch of clearance.",
      },
      {
        number: 2,
        title: "Get the awkward screw out without stripping it",
        instructions:
          "Use a 1/4 inch drive T25 with a ball universal joint and a ten-inch extension, coming in at an angle under the line. Keep hard downward pressure the whole time - T25 heads strip easily and a stripped screw in a plastic airbox lid is a genuinely irritating extraction. If you cannot get a clean bite, go to the next step instead of forcing it.",
        warning: "Do not cam the bit out of the head. Dealers strip these routinely and some just leave the screw out afterwards.",
      },
      {
        number: 3,
        title: "Alternative: pull the whole airbox and do it on the bench",
        instructions:
          "If the angle is beating you, unplug the MAF connector, loosen the clamp on the intake tube, and lift the entire airbox out. It comes free in about five minutes, and on the bench all four screws are straight-on and easy. This is often faster than fighting the one screw in place.",
      },
      {
        number: 4,
        title: "Swap the filter and clean the box",
        instructions:
          "Note which way the old filter sits, lift it out, and vacuum or wipe out the leaves and grit in the bottom of the housing. Anything left in there gets pulled against the new filter the first time you drive. Set the new filter in the same orientation and make sure its seal sits flat all the way round.",
      },
      {
        number: 5,
        title: "Close it up and check the seal",
        instructions:
          "Refit the lid and start all four screws by hand before tightening any of them - the lid has to pull down evenly or the seal gaps. Snug only; they thread into plastic. If you removed the airbox, reconnect the MAF plug and retighten the intake tube clamp, and double-check the plug is fully latched. An unplugged MAF will throw a check engine light and make the truck run badly.",
      },
    ],
  fitment: { on: "engine", key: "gm-ecotec3-l83" },
figures: {
"2018-chevrolet-silverado-1500-5.3l": {
id: "silverado-2018-engine-air-filter",
verified: true,
    parts: ["Engine air filter (panel type)"],
    torqueSpecs: [],
},
"2018-gmc-sierra-1500-5.3l": {
id: "sierra-2018-engine-air-filter",
verified: true,
    parts: ["Engine air filter (panel type)"],
    torqueSpecs: [],
},
},
},
{
    id: "gm-k2xx-cabin-air-filter",
    title: "Cabin Air Filter Replacement",
    jobType: "cabin-air-filter",
    summary:
      "Behind the glove box, no tools, about ten minutes. Worth knowing: the older GM trucks that shipped with no cabin filter at all were the 2007-2013 generation - yours has one.",
    difficulty: "Easy",
    estTime: "10-15 min",
    tier: "free",
    noFasteners: true,
    tools: [{ name: "Flashlight" }],

    safety: [
      "A filthy cabin filter is full of mold spores and road dust. Bag it rather than shaking it out inside the truck.",
    ],

    steps: [
      {
        number: 1,
        title: "Empty the glove box",
        instructions:
          "Take everything out. The box has to swing down past its normal stop and anything loose inside ends up in the footwell.",
      },
      {
        number: 2,
        title: "Release the stops and let the box drop",
        instructions:
          "Open the glove box fully, then squeeze the plastic stop tabs on each side near the hinges inward. The box will swing down well past its normal travel and expose the filter door in the HVAC case behind it. No tools, no screws.",
      },
      {
        number: 3,
        title: "Pull the old filter and note its direction",
        instructions:
          "There is an airflow arrow printed on the filter frame. Look at it before the filter is out - putting the new one in backwards does not stop it working but it does shed collected dirt into the blower instead of catching it. Slide the old one out flat; it will be dirtier than you expect.",
      },
      {
        number: 4,
        title: "Fit the new filter",
        instructions:
          "Slide the new filter in with the airflow arrow pointing the same way the old one did. Make sure it seats fully into its channel - a filter that is cocked lets unfiltered air past the edge and you get no benefit.",
      },
      {
        number: 5,
        title: "Close everything up and test the fan",
        instructions:
          "Close the filter door, lift the glove box back until the side tabs click past their stops, and run the blower through all its speeds. It should be at least as strong as before, usually noticeably stronger if the old filter was bad.",
      },
    ],
  fitment: { on: "platform", key: "gm-k2xx-1500" },
figures: {
"2018-chevrolet-silverado-1500-5.3l": {
id: "silverado-2018-cabin-air-filter",
verified: true,
    parts: ["Cabin air filter (GM 23281440 or equivalent)"],
    torqueSpecs: [],
},
"2018-gmc-sierra-1500-5.3l": {
id: "sierra-2018-cabin-air-filter",
verified: true,
    parts: ["Cabin air filter (GM 23281440 or equivalent)"],
    torqueSpecs: [],
},
},
},
{
    id: "gm-k2xx-wiper-blades",
    title: "Wiper Blade Replacement",
    jobType: "wiper-blades",
    summary:
      "Five minutes, no tools. The only real risk is a spring-loaded wiper arm snapping down onto bare glass, which cracks windshields.",
    difficulty: "Easy",
    estTime: "10 min",
    tier: "free",
    noFasteners: true,
    tools: [{ name: "Towel or folded rag", note: "Padding under the arm in case it snaps down" }],

    safety: [
      "Lay a towel on the windshield before you lift the arms. A wiper arm with no blade on it will crack glass if it snaps back.",
    ],

    steps: [
      {
        number: 1,
        title: "Check the sizes before you buy",
        instructions:
          "The driver and passenger blades are different lengths on this truck. Measure the old ones or look them up by your exact build rather than buying two of the same length.",
      },
      {
        number: 2,
        title: "Lift the arm and pad the glass",
        instructions:
          "Pull the wiper arm up until it locks in the raised position, then lay a folded towel on the windshield underneath it.",
        warning: "Never let a bare wiper arm snap down onto the glass. That is the one way this job gets expensive.",
      },
      {
        number: 3,
        title: "Release the old blade",
        instructions:
          "Find the release tab where the blade meets the arm's hook or pin. Press it and slide the blade down along the arm to unhook it. If it will not move, you have not fully depressed the tab - do not force it, they break.",
      },
      {
        number: 4,
        title: "Fit the new blade",
        instructions:
          "Slide the new blade onto the arm until the latch clicks. Tug it firmly - a blade that is not latched will come off at highway speed and the bare arm will score the glass.",
      },
      {
        number: 5,
        title: "Lower the arms and test with washer fluid",
        instructions:
          "Lower both arms gently onto the glass, remove the towel, then run the wipers with washer fluid. Dry glass tears new rubber. Watch for streaking or chatter - chatter usually means the arm is slightly twisted rather than a bad blade.",
      },
    ],
  fitment: { on: "platform", key: "gm-k2xx-1500" },
figures: {
"2018-chevrolet-silverado-1500-5.3l": {
id: "silverado-2018-wiper-blades",
verified: true,
    parts: ["Front wiper blade pair - check length for your build, driver and passenger sides differ"],
    torqueSpecs: [],
},
"2018-gmc-sierra-1500-5.3l": {
id: "sierra-2018-wiper-blades",
verified: true,
    parts: ["Front wiper blade pair - check length for your build, driver and passenger sides differ"],
    torqueSpecs: [],
},
},
},
{
    id: "gm-k2xx-coolant",
    title: "Coolant Drain & Fill",
    jobType: "coolant",
    summary:
      "A drain-and-fill on the radiator, not a full system flush. The system holds 16.8 qt total but only about 8 qt comes out this way - the block keeps the rest, and that is the number people get wrong at the parts counter.",
    difficulty: "Moderate",
    estTime: "1-1.5 hrs",
    tier: "premium",
    tools: [
      { name: "Drain pan", note: "3 gallon or larger, wide" },
      { name: "Pliers or a small socket", note: "For the radiator drain petcock, only if it needs starting" },
      { name: "Funnel", note: "A spill-free funnel kit makes the burping step far easier" },
      { name: "Jack + 2 jack stands", note: "Optional but it makes the petcock reachable" },
      { name: "Nitrile gloves + eye protection" },
    ],

    safety: [
      "Never open a cooling system that is hot. The coolant is above its boiling point under pressure and will flash to steam the moment you release the cap. Cold engine only.",
      "Coolant is sweet-tasting and lethal to pets and wildlife. Catch every drop, clean up spills immediately, and take the old fluid to a recycler.",
      "Keep hands clear of the fans. On this truck they can spin up after the key is off.",
    ],

    steps: [
      {
        number: 1,
        title: "Start cold, and confirm it",
        instructions:
          "Park on level ground and leave the truck overnight if you can. Touch the upper radiator hose - if there is any warmth in it, walk away and come back later. This is the one step in the job that can actually hurt you.",
        warning: "Do not touch the surge tank cap on a warm engine.",
      },
      {
        number: 2,
        title: "Position the pan and open the petcock",
        instructions:
          "The drain petcock is at the bottom corner of the radiator. Put a wide pan underneath with plenty of margin - the first flow arcs outward before it runs down the frame. Open the petcock by hand; if it is stiff, use pliers to start it and then back off. Remove the surge tank cap to let it breathe and it will drain much faster.",
      },
      {
        number: 3,
        title: "Let it drain and measure what comes out",
        instructions:
          "Expect roughly 8 quarts. That is normal and correct for a radiator drain - the block and heater core hold the remainder, which is why the total system figure of 16.8 qt is not the amount you need to buy. Look at the old coolant while it drains: it should be orange and clear. Brown, rusty, or oily coolant is telling you about a different problem.",
      },
      {
        number: 4,
        title: "Close the petcock",
        instructions:
          "Close the petcock hand-tight. No tools. Wipe the area dry so you can spot a weep later.",
        torque: [{ fastener: "Radiator drain petcock", value: "" }],
      },
      {
        number: 5,
        title: "Refill with the right stuff",
        instructions:
          "Fill slowly through the surge tank with DEX-COOL 50/50 premix, or concentrate cut with distilled water. Never tap water - the minerals in it scale the inside of the system. Slow pouring matters: dumping it in traps air pockets that take much longer to work out than they took to create.",
        warning: "DEX-COOL is an OAT coolant. Mixing it with green IAT coolant gels the mixture and plugs the heater core and radiator. Do not top this system up with whatever is on the shelf.",
      },
      {
        number: 6,
        title: "Burp the air out",
        instructions:
          "With the cap off or a spill-free funnel fitted, start the engine and set the heater to maximum heat with the fan on low - that opens the heater core to flow. Let it idle until the thermostat opens and you see the level in the funnel drop and bubbles stop rising. Top up as it falls. Then shut it off, let it cool completely, and check the level again cold. It will need more.",
      },
      {
        number: 7,
        title: "Check the level cold over the next few days",
        instructions:
          "Check the surge tank cold each morning for the next two or three days and top up to the cold fill line. Air keeps working its way out of a truck cooling system for a while. A heater that blows cold at idle but warm at speed is the classic sign of air still trapped in the heater core.",
      },
    ],
  fitment: { on: "engine", key: "gm-ecotec3-l83" },
figures: {
"2018-chevrolet-silverado-1500-5.3l": {
id: "silverado-2018-coolant",
verified: true,
    parts: [
      "2 gallons of DEX-COOL 50/50 premix, or 1 gallon of concentrate plus distilled water",
      "Distilled water - never tap water",
    ],
    torqueSpecs: [
      {
        fastener: "Radiator drain petcock",
        value: "Hand-tight only",
        notes:
          "It is a plastic fitting. Snug it by hand and stop - putting a wrench on it and cracking the neck turns a fluid change into a radiator replacement.",
      },
    ],
},
"2018-gmc-sierra-1500-5.3l": {
id: "sierra-2018-coolant",
verified: true,
    parts: [
      "2 gallons of DEX-COOL 50/50 premix, or 1 gallon of concentrate plus distilled water",
      "Distilled water - never tap water",
    ],
    torqueSpecs: [
      {
        fastener: "Radiator drain petcock",
        value: "Hand-tight only",
        notes:
          "It is a plastic fitting. Snug it by hand and stop - putting a wrench on it and cracking the neck turns a fluid change into a radiator replacement.",
      },
    ],
},
},
},
{
    id: "gm-k2xx-driveline-fluid",
    title: "Differential & Transfer Case Fluid",
    jobType: "driveline-fluid",
    summary:
      "Three fills on a 4WD: front diff, transfer case, rear axle. The rear is the awkward one - it has no drain plug, so the cover has to come off. The front and the transfer case both have proper drain and fill plugs.",
    difficulty: "Moderate",
    estTime: "2-3 hrs for all three",
    tier: "premium",
    variants: [
      {
        id: "rear-axle",
        question: "Which rear axle is under your truck?",
        howToTell:
          "Count the bolts on the rear differential cover. Ten bolts is the 8.6-inch axle, twelve is the 9.5-inch. You can do this from beside the truck with a flashlight - it does not need to be in the air, and it decides how much gear oil you buy.",
        options: [
          { id: "axle-8-6", label: "10-bolt cover (8.6-inch)", hint: "Most 5.3L LT trucks" },
          { id: "axle-9-5", label: "12-bolt cover (9.5-inch)" },
        ],
      },
      {
        id: "rear-locker",
        question: "Does it have the G80 locking differential?",
        howToTell:
          "Look for RPO code G80 on the service parts sticker in the glovebox, or the label on the driver's B-pillar. If you cannot find the sticker, leave friction modifier out - no GM 1500 rear axle of this era wants it.",
        options: [
          { id: "g80-yes", label: "Yes, G80 locker" },
          { id: "g80-no", label: "No, or not sure" },
        ],
      },
    ],

    tools: [
      { name: "Socket set + ratchet", note: "Fill and drain plugs, and the rear cover bolts" },
      { name: "Torque wrench" },
      { name: "Fluid transfer pump", note: "You cannot pour into any of these - a hand pump or squeeze bottle with a hose is essential" },
      { name: "Drain pan" },
      { name: "Gasket scraper or plastic razor", note: "Rear axle only" },
      { name: "Brake cleaner", note: "Rear axle only - the sealing surfaces must be oil-free" },
      { name: "Jack + 4 jack stands", note: "The truck should be level, or the fill levels will be wrong" },
      { name: "Nitrile gloves + eye protection" },
    ],

    safety: [
      "Level the truck on four jack stands. A fill-to-the-plug level taken on a tilted truck is wrong in a way you will not notice until something whines.",
      "Gear oil smells foul and stains permanently. Gloves, and old clothes.",
      "Crack the FILL plug loose before you drain anything. If the fill plug is seized and the fluid is already out, the truck is stuck on stands until you win that fight.",
    ],

    steps: [
      {
        number: 1,
        title: "Level the truck",
        instructions:
          "Get all four corners on stands so the truck sits level. A fill-to-the-plug level taken on a tilted truck is wrong in a way you will not notice until something whines. If you have not answered the rear axle question at the top of this guide yet, count the cover bolts now and scroll back up - ten is the 8.6-inch, twelve is the 9.5-inch - so the parts list shows the right quantity.",
      },
      {
        number: 2,
        title: "Crack every fill plug loose first",
        instructions:
          "Before draining anything, break loose the rear axle fill plug, the front differential fill plug and the transfer case fill plug. If one of them is seized you want to discover that while the fluid is still in there and the truck can still be driven to a shop.",
        warning: "This is the single most important sequencing rule in this job.",
      },
      {
        number: 3,
        title: "Transfer case: drain, refill with ATF",
        instructions:
          "Drain plug out, let it empty, plug back in at 13 ft-lb (18 Nm). Pump in 1.6 qt of DEXRON-VI until it just weeps from the fill hole, then fit the fill plug at the same torque. Note the fluid: this case takes ATF, not gear oil, and not Auto-Trak II. Auto-Trak II is the blue fluid for the older New Process case and parts counters still hand it over for these trucks.",
        torque: [{ fastener: "Transfer case drain and fill plugs", value: "" }],
      },
      {
        number: 4,
        title: "Front differential: drain, refill with 75W-90",
        instructions:
          "The front axle does have a drain plug. Drain it, refit the plug at 24 ft-lb (33 Nm), then pump in 75W-90 synthetic until it reaches the bottom edge of the fill hole and starts to seep back out. That is about 1.5 qt. Fit the fill plug at the same torque.",
        torque: [{ fastener: "Front differential drain and fill plugs", value: "" }],
      },
      {
        number: 5,
        title: "Rear axle: take the cover off, because there is no drain plug",
        instructions:
          "There is no drain plug on this axle. Put a wide pan under it, remove all the cover bolts except two at the top, then break the cover seal and let it hinge down on those two bolts so the oil pours into the pan in a controlled way rather than all at once down your arm. Once it slows, take the last two bolts out and remove the cover.",
        warning: "Do not pry between the cover and the housing with a screwdriver. Gouging that sealing face guarantees a leak. Tap the cover with a dead blow to break the seal.",
      },
      {
        number: 6,
        title: "Look inside while you are in there",
        instructions:
          "A light film of grey on the magnet is normal wear. A pile of metal flakes, or chunks you can feel between your fingers, is not - stop and get it looked at rather than putting fresh oil over a failing ring and pinion. Clean the magnet, wipe the housing out with lint-free rags, and check the gear teeth for pitting or chipping.",
      },
      {
        number: 7,
        title: "Clean both sealing faces properly",
        instructions:
          "Scrape the old gasket or RTV off the cover and the housing with a plastic razor or a gasket scraper, then wipe both faces with brake cleaner until a clean rag stays clean. Any oil film left behind will stop new sealant from bonding, and a rear axle that weeps gear oil onto your driveway is a job you will be doing twice.",
      },
      {
        number: 8,
        title: "Seal and refit the cover",
        instructions:
          "Either fit a new gasket, or lay a continuous 3/16 inch bead of RTV around the cover inside the bolt holes with a loop around each hole. Fit the cover and snug the bolts by hand, then torque to 20 ft-lb (27 Nm) in a star pattern. If you used RTV, let it set up for the time on the tube before adding fluid.",
        torque: [{ fastener: "Rear axle cover bolts", value: "" }],
      },
      {
        number: 9,
        title: "Fill the rear axle - and skip the friction modifier",
        instructions:
          "Pump 75W-85 synthetic in through the fill hole until it sits level with the bottom edge of the hole. If your truck has the G80 locker, do NOT add limited-slip friction modifier. The G80 is a locker that happens to use clutches rather than a clutch-type limited slip, and GM bulletin PIP4054D says an additive makes its clutch pack slip and miss engagement. This is the opposite of the usual rule and it is the mistake most people make on this axle.",
        torque: [{ fastener: "Rear axle fill plug", value: "" }],
        warning: "Friction modifier in a G80 axle causes the exact problem you would be trying to prevent.",
      },
      {
        number: 10,
        title: "Drive it, then check for leaks",
        instructions:
          "Lower the truck and drive it gently for ten minutes to warm everything through. Park it, wait an hour, and look underneath with a flashlight at the axle cover, both diff plugs and the transfer case plugs. Check again the following morning - a slow weep only shows itself overnight.",
      },
    ],
  fitment: { on: "driveline", key: "gm-k2xx-1500-4wd" },
figures: {
"2018-chevrolet-silverado-1500-5.3l": {
id: "silverado-2018-driveline-fluid",
verified: true,
    parts: [
      "Front differential: 1.5 qt of 75W-90 synthetic GL-5",
      "Transfer case: 1.6 qt of DEXRON-VI ATF",
      "Rear axle cover gasket or RTV sealant",
      "Shop towels - gear oil gets everywhere",
    ],
    torqueSpecs: [
      {
        fastener: "Rear axle cover bolts",
        value: "20 ft-lb (27 Nm)",
        notes: "Star pattern. SOURCES CONFLICT and neither is a scanned manual page: a Sierra-specific torque table gives 15 ft-lb (20 Nm) followed by a further 20 degrees, while community service-data postings give a flat 20 ft-lb. Bolt-grade math on a 5/16-18 brackets both, so neither will hurt the axle - but treat this as a reference figure, not a spec. If you have a real FSM page, trust it over this.",
      },
      {
        fastener: "Rear axle fill plug",
        value: "24 ft-lb (33 Nm)",
        notes: "Reference figure from the same source as the cover bolts.",
      },
      {
        fastener: "Transfer case drain and fill plugs",
        value: "13 ft-lb (18 Nm)",
        notes:
          "This is the weakest number in the guide. One source specific to this generation says 13 ft-lb; an older-generation source says 15. Anything in that range is fine, and erring low is the safe direction into an aluminum case.",
      },
      {
        fastener: "Front differential drain and fill plugs",
        value: "24 ft-lb (33 Nm)",
        notes: "Reference figure.",
      },
    ],
    variantParts: [
      {
        text: "Rear axle: 4.2 pints (2.1 qt) of 75W-85 synthetic axle lubricant, GM 19300457",
        onlyFor: ["axle-8-6"],
      },
      {
        text: "Rear axle: 5.5 pints (2.75 qt) of 75W-85 synthetic axle lubricant, GM 19300457",
        onlyFor: ["axle-9-5"],
      },
      {
        text: "Do NOT buy limited-slip friction modifier - the G80 must not have it",
        onlyFor: ["g80-yes"],
      },
    ],
},
"2018-gmc-sierra-1500-5.3l": {
id: "sierra-2018-driveline-fluid",
verified: true,
    parts: [
      "Front differential: 1.5 qt of 75W-90 synthetic GL-5",
      "Transfer case: 1.6 qt of DEXRON-VI ATF",
      "Rear axle cover gasket or RTV sealant",
      "Shop towels - gear oil gets everywhere",
    ],
    torqueSpecs: [
      {
        fastener: "Rear axle cover bolts",
        value: "20 ft-lb (27 Nm)",
        notes: "Star pattern. SOURCES CONFLICT and neither is a scanned manual page: a Sierra-specific torque table gives 15 ft-lb (20 Nm) followed by a further 20 degrees, while community service-data postings give a flat 20 ft-lb. Bolt-grade math on a 5/16-18 brackets both, so neither will hurt the axle - but treat this as a reference figure, not a spec. If you have a real FSM page, trust it over this.",
      },
      {
        fastener: "Rear axle fill plug",
        value: "24 ft-lb (33 Nm)",
        notes: "Reference figure from the same source as the cover bolts.",
      },
      {
        fastener: "Transfer case drain and fill plugs",
        value: "13 ft-lb (18 Nm)",
        notes:
          "This is the weakest number in the guide. One source specific to this generation says 13 ft-lb; an older-generation source says 15. Anything in that range is fine, and erring low is the safe direction into an aluminum case.",
      },
      {
        fastener: "Front differential drain and fill plugs",
        value: "24 ft-lb (33 Nm)",
        notes: "Reference figure.",
      },
    ],
    variantParts: [
      {
        text: "Rear axle: 4.2 pints (2.1 qt) of 75W-85 synthetic axle lubricant, GM 19300457",
        onlyFor: ["axle-8-6"],
      },
      {
        text: "Rear axle: 5.5 pints (2.75 qt) of 75W-85 synthetic axle lubricant, GM 19300457",
        onlyFor: ["axle-9-5"],
      },
      {
        text: "Do NOT buy limited-slip friction modifier - the G80 must not have it",
        onlyFor: ["g80-yes"],
      },
    ],
},
},
},
{
    id: "gm-k2xx-serpentine-belt",
    title: "Serpentine Belt Replacement",
    jobType: "serpentine-belt",
    summary:
      "One belt, one spring-loaded automatic tensioner, no adjustment to set. The part people get wrong is the routing, and the fix for that is under your hood already.",
    difficulty: "Moderate",
    estTime: "45-60 min",
    tier: "premium",
    tools: [
      { name: "15mm socket or wrench", note: "Fits the tensioner pulley bolt" },
      { name: "1/2 inch drive breaker bar or ratchet", note: "Alternative - the tensioner arm has a 1/2 inch square drive hole" },
      { name: "Phone camera", note: "Photograph the routing before anything moves. Do not skip this" },
      { name: "Flashlight" },
      { name: "Nitrile gloves" },
    ],

    safety: [
      "Engine off, key out. A belt job on a running engine costs fingers.",
      "The tensioner is under spring load. Keep your hand clear of the pulley and let it swing back under control rather than letting go of the bar.",
      "Let the engine cool. The belt runs right past the exhaust manifolds.",
    ],

    steps: [
      {
        number: 1,
        title: "Photograph the routing, twice",
        instructions:
          "Before you touch anything, take clear photos of how the belt wraps every pulley, from two angles. Accessory layout on these trucks varies with options, so a routing diagram you find online may not match your truck. The photos are the one source you know is correct.",
      },
      {
        number: 2,
        title: "Find the underhood decal too",
        instructions:
          "There is a belt routing decal under the hood or on the radiator support. Use it as your backup reference rather than a web diagram. If the decal and your photos disagree, trust the photos - the truck in front of you wins.",
      },
      {
        number: 3,
        title: "Inspect the old belt before you throw it out",
        instructions:
          "Look at what you are replacing: cracks across the ribs, chunks missing, glazed shiny faces, or a frayed edge. An edge frayed on one side means something is misaligned, and a new belt will do exactly the same thing. Spin each idler and the tensioner pulley by hand with the belt off - roughness or wobble means that pulley is next to fail and is worth doing now.",
      },
      {
        number: 4,
        title: "Release the tensioner and slip the belt off",
        instructions:
          "The tensioner sits upper left in the engine bay. Put a 15mm socket on its pulley bolt, or a 1/2 inch drive bar into the square hole in its arm, and rotate clockwise to swing the arm away and slacken the belt. Hold it there and slip the belt off the smoothest pulley you can reach - usually an idler - then let the tensioner swing back slowly.",
        warning: "Do not let the bar snap back. The spring is strong and the arm will take a knuckle with it.",
      },
      {
        number: 5,
        title: "Route the new belt, leaving the tensioner for last",
        instructions:
          "Thread the new belt over every pulley according to your photos, ribs seated in the grooves of the grooved pulleys and the flat back against the smooth idlers. Leave the tensioner or the centre idler as the last one to go on - that is the slack you need to finish the loop.",
      },
      {
        number: 6,
        title: "Check every pulley before you start it",
        instructions:
          "Release the tensioner back onto the belt, then walk around every pulley with a flashlight and confirm the belt is centred and fully seated in each groove. A belt that is one rib off looks almost right and will shred within a minute of running. This check is worth two full minutes.",
      },
      {
        number: 7,
        title: "Start it and listen",
        instructions:
          "Start the engine and listen for chirping or squealing while you watch the belt track. A brief chirp on the first start is normal as it seats. Anything that persists means it is misrouted, mis-seated, or a pulley is out of alignment. Shut it down and look again rather than driving off.",
      },
    ],
  fitment: { on: "engine", key: "gm-ecotec3-l83" },
figures: {
"2018-chevrolet-silverado-1500-5.3l": {
id: "silverado-2018-serpentine-belt",
verified: true,
    parts: ["Serpentine belt - match by your exact engine and accessory package"],
    torqueSpecs: [
      {
        fastener: "None removed in this job",
        value: "No fastener is loosened or retightened",
        notes:
          "The tensioner is only levered aside to slip the belt off and back on; nothing is unbolted. Replacing the tensioner itself is a different job with its own torque figures.",
      },
    ],
},
"2018-gmc-sierra-1500-5.3l": {
id: "sierra-2018-serpentine-belt",
verified: true,
    parts: ["Serpentine belt - match by your exact engine and accessory package"],
    torqueSpecs: [
      {
        fastener: "None removed in this job",
        value: "No fastener is loosened or retightened",
        notes:
          "The tensioner is only levered aside to slip the belt off and back on; nothing is unbolted. Replacing the tensioner itself is a different job with its own torque figures.",
      },
    ],
},
},
},
{
    id: "gm-k2xx-fluid-checks",
    title: "Fluid Checks & Top-Offs",
    jobType: "fluid-checks",
    summary:
      "The monthly walk-around. Two things about this truck make it different from what you may be used to: there is no transmission dipstick, and there is no power steering fluid at all.",
    difficulty: "Easy",
    estTime: "15 min",
    tier: "free",
    noFasteners: true,
    tools: [
      { name: "Clean rag or paper towel" },
      { name: "Flashlight" },
      { name: "Funnel" },
      { name: "Tire pressure gauge" },
    ],

    safety: [
      "Cold engine for the coolant check. Never open the surge tank warm.",
      "If the brake fluid is genuinely low, something is wrong - either the pads are worn down or you have a leak. Topping it up hides the symptom rather than fixing it.",
    ],

    steps: [
      {
        number: 1,
        title: "Engine oil - level and condition",
        instructions:
          "Park level, engine off five minutes. Pull the dipstick, wipe, reseat it fully, pull again. It should read in the middle of the hatched area. Look at the oil as well as the level: black is fine and normal, gritty or milky is not. Worth being attentive on this engine - the 5.3 with cylinder deactivation has a known appetite for oil between changes, so check it rather than assuming.",
      },
      {
        number: 2,
        title: "Coolant - cold, at the surge tank",
        instructions:
          "Read the level against the cold fill mark on the side of the translucent surge tank without opening anything. It should be orange and clear. If it is low, find out why before topping up - this system does not consume coolant in normal use, so a falling level means it is going somewhere.",
        warning: "Cold only. Never open the cap on a warm engine.",
      },
      {
        number: 3,
        title: "Transmission - there is no dipstick",
        instructions:
          "This truck has no transmission dipstick. Level is set from underneath at a check plug, with the engine running and the fluid inside a specific temperature window, which realistically needs a scan tool or the transmission temperature readout in the driver information centre. You cannot check this in the driveway the way you could on an older truck, and that is not a fault. What you can do is watch for symptoms: slipping, harsh or flaring shifts, or a burnt smell.",
      },
      {
        number: 4,
        title: "Power steering - this truck does not have any",
        instructions:
          "There is no power steering fluid to check. Assist on this generation comes from an electric motor mounted to the steering gear, with no hydraulic circuit, no reservoir and nothing to flush. If a shop offers you a power steering flush on this truck, they are selling you a service that does not exist on it.",
      },
      {
        number: 5,
        title: "Brake fluid - look, do not top up reflexively",
        instructions:
          "The reservoir is translucent; read it against the MIN and MAX marks without opening it. The level drops naturally as the pads wear, because the pistons sit further out. That is expected. A level genuinely below MIN means either the pads are near the end or there is a leak - both are things to find, not things to pour over.",
      },
      {
        number: 6,
        title: "Washer fluid and tire pressures",
        instructions:
          "Top the washer bottle with all-season fluid. Then check all four tires cold against the pressure on the driver's door jamb label, not the number moulded into the sidewall. The TPMS light only comes on when a tire is already well down, so it is not a substitute for a gauge once a month.",
      },
    ],
  fitment: { on: "engine", key: "gm-ecotec3-l83" },
figures: {
"2018-chevrolet-silverado-1500-5.3l": {
id: "silverado-2018-fluid-checks",
verified: true,
    parts: [
      "dexos1 0W-20 for topping up oil",
      "DEX-COOL 50/50 premix",
      "Washer fluid",
      "DOT 3 brake fluid, only if you actually need it",
    ],
    torqueSpecs: [],
},
"2018-gmc-sierra-1500-5.3l": {
id: "sierra-2018-fluid-checks",
verified: true,
    parts: [
      "dexos1 0W-20 for topping up oil",
      "DEX-COOL 50/50 premix",
      "Washer fluid",
      "DOT 3 brake fluid, only if you actually need it",
    ],
    torqueSpecs: [],
},
},
},
{
    id: "gm-k2xx-fuse-bulb",
    title: "Fuse & Bulb Replacement",
    jobType: "fuse-bulb",
    summary:
      "Two boxes, one under the hood and one in the cab, and a simple rule: a fuse that blows twice is not a fuse problem.",
    difficulty: "Easy",
    estTime: "15-30 min",
    tier: "free",
    noFasteners: true,
    tools: [
      { name: "Fuse puller", note: "Usually clipped inside the underhood fuse box lid" },
      { name: "Test light or multimeter", note: "Optional, but it settles the question in seconds" },
      { name: "Flashlight" },
      { name: "Clean gloves or a rag", note: "For handling bulbs - skin oil shortens halogen bulb life" },
    ],

    safety: [
      "Never fit a fuse of higher amperage than the one that blew. The fuse protects the wiring, and a bigger fuse just moves the failure from a 50 cent part to the harness.",
      "Key off before pulling fuses.",
      "Let a bulb cool before touching it, and handle halogen capsules with a rag or gloves.",
    ],

    steps: [
      {
        number: 1,
        title: "Find the right box and read the lid",
        instructions:
          "There are two: the underhood box on the driver's side, and an interior box in the cab. The map is printed on the inside of each lid, and it is specific to how your truck was built - use it rather than a generic chart from the internet.",
      },
      {
        number: 2,
        title: "Identify the blown fuse",
        instructions:
          "Pull the suspect fuse and hold it to the light. A blown one has a visibly broken or darkened metal strip. If you cannot tell by eye, a test light across the two test points on top of the fuse while it is still seated tells you immediately - light on both sides means good, light on one side only means blown.",
      },
      {
        number: 3,
        title: "Replace with the same amperage",
        instructions:
          "Match the number on top exactly: 10 for 10, 20 for 20. Push the new one fully home. If you do not have the right rating, drive on the dead circuit rather than fitting a bigger fuse.",
        warning: "Fitting a higher-rated fuse is how wiring harness fires start. There is never a good reason for it.",
      },
      {
        number: 4,
        title: "If it blows again, stop replacing it",
        instructions:
          "A fuse that blows once can be a fluke. A fuse that blows twice is telling you there is a short or a failing component on that circuit, and the third fuse will go the same way. That is the point to trace the circuit rather than keep feeding it fuses.",
      },
      {
        number: 5,
        title: "Bulbs: get at the back of the housing",
        instructions:
          "Most exterior bulbs come out from behind the housing - twist the socket a quarter turn counter-clockwise and it releases. Headlight access on this truck is easier than most; for the rear, the tail light assembly is held by a couple of fasteners reached from the bed opening. Work out the access before you start pulling on anything.",
      },
      {
        number: 6,
        title: "Handle the new bulb properly and test",
        instructions:
          "Do not touch the glass of a halogen capsule with bare fingers - the oil creates a hot spot and the bulb fails early. Use a rag or gloves. Seat the new bulb, twist the socket back in until it stops, then test the circuit before you put any trim back. Also check its partner on the other side: bulbs fitted at the factory tend to fail within a few months of each other.",
      },
    ],
  fitment: { on: "platform", key: "gm-k2xx-1500" },
figures: {
"2018-chevrolet-silverado-1500-5.3l": {
id: "silverado-2018-fuse-bulb",
verified: true,
    parts: [
      "Assorted blade fuses matching the amperage you are replacing",
      "Replacement bulb of the correct type for the fixture",
    ],
    torqueSpecs: [],
},
"2018-gmc-sierra-1500-5.3l": {
id: "sierra-2018-fuse-bulb",
verified: true,
    parts: [
      "Assorted blade fuses matching the amperage you are replacing",
      "Replacement bulb of the correct type for the fixture",
    ],
    torqueSpecs: [],
},
},
},
{
    id: "gm-k2xx-o2-sensor",
    title: "Oxygen Sensor Replacement",
    jobType: "o2-sensor",
    summary:
      "Four sensors on this V8 - two upstream, two downstream. The hard part is not the wrench work, it is being certain which one the code is blaming and that the sensor is the fault rather than the messenger.",
    difficulty: "Moderate",
    estTime: "1-2 hrs",
    tier: "premium",
    tools: [
      { name: "OBD-II scanner", note: "Required. Do not guess which sensor - the code names the bank and position" },
      { name: "Oxygen sensor socket", note: "A slotted 22mm socket that lets the harness pass through" },
      { name: "Ratchet + extensions" },
      { name: "Penetrating oil" },
      { name: "Torque wrench" },
      { name: "Jack + 2 jack stands" },
      { name: "Nitrile gloves + eye protection" },
    ],

    safety: [
      "Exhaust components stay hot far longer than you expect. Let the truck sit at least an hour, ideally overnight.",
      "Never work under a vehicle supported only by a jack.",
      "Disconnect the battery negative before unplugging the sensor connector.",
    ],

    steps: [
      {
        number: 1,
        title: "Read the code and work out which sensor it means",
        instructions:
          "Scan the truck and write the exact code down. Bank 1 is the driver's side on this engine, bank 2 the passenger side; sensor 1 is upstream of the catalytic converter, sensor 2 is downstream. So a P0137 on bank 1 sensor 2 is the driver's side downstream sensor and no other. Replacing the wrong sensor is the most common way money gets wasted on this job.",
      },
      {
        number: 2,
        title: "Be sure it is the sensor and not the messenger",
        instructions:
          "An oxygen sensor code often means the sensor is correctly reporting a real problem somewhere else - a vacuum leak, an exhaust leak ahead of the sensor, or a failing catalytic converter. Before buying parts, look at the live data: a healthy upstream sensor swings rapidly between roughly 0.1 and 0.9 volts, while a lazy or flat trace points at the sensor itself. A downstream sensor should be comparatively steady.",
        warning: "If the code came with a rough idle or a fuel trim problem, fix that first. A new sensor will report the same fault.",
      },
      {
        number: 3,
        title: "Let it cool, then raise and support the truck",
        instructions:
          "Give the exhaust an hour minimum. Raise the truck and get it on stands. Penetrating oil on the sensor threads now, so it has time to work while you set up.",
      },
      {
        number: 4,
        title: "Unplug the connector before you turn anything",
        instructions:
          "Trace the sensor wiring back to its connector and unclip it, releasing any harness retainers along the way. Unplug first, then unscrew - turning the sensor with the harness still connected twists and can break the wires, which is how a simple job becomes a splice.",
      },
      {
        number: 5,
        title: "Break the sensor loose",
        instructions:
          "Fit the slotted oxygen sensor socket with the harness through the slot and turn counter-clockwise. These seize into the bung, so expect real effort. Steady pressure, not shock loading - if it will not move, more penetrant and more time beats more force.",
        warning: "If the bung threads strip or the sensor shears, the job goes from an hour to an exhaust shop visit. Patience is genuinely cheaper here.",
      },
      {
        number: 6,
        title: "Fit the new sensor",
        instructions:
          "Most new sensors arrive with anti-seize already on the threads - if yours does, do not add more, and keep it off the sensor tip entirely. Start it by hand to be certain it is not cross-threaded, then torque to about 31 ft-lb (42 Nm). Confirm that figure against your service manual first; it is a reference value.",
        torque: [{ fastener: "Oxygen sensor", value: "" }],
      },
      {
        number: 7,
        title: "Reconnect, clear the code, confirm over several drives",
        instructions:
          "Plug the connector back in, secure the harness away from the exhaust so it cannot melt, and reconnect the battery. Clear the code and drive the truck. The light staying off through several drive cycles is the confirmation - if it comes back, the sensor was reporting a real fault rather than being one.",
      },
    ],
  fitment: { on: "engine", key: "gm-ecotec3-l83" },
figures: {
"2018-chevrolet-silverado-1500-5.3l": {
id: "silverado-2018-o2-sensor",
verified: true,
    parts: [
      "Oxygen sensor for the specific position the code names",
      "Anti-seize, only if the new sensor does not arrive with it pre-applied",
    ],
    torqueSpecs: [
      {
        fastener: "Oxygen sensor",
        value: "~31 ft-lb (42 Nm)",
        notes:
          "Curated reference value, not a figure we have traced to the factory manual for this truck. Confirm against your service manual before final tightening. Over-torquing into a hot exhaust bung is how the next person ends up drilling it out.",
      },
    ],
},
"2018-gmc-sierra-1500-5.3l": {
id: "sierra-2018-o2-sensor",
verified: true,
    parts: [
      "Oxygen sensor for the specific position the code names",
      "Anti-seize, only if the new sensor does not arrive with it pre-applied",
    ],
    torqueSpecs: [
      {
        fastener: "Oxygen sensor",
        value: "~31 ft-lb (42 Nm)",
        notes:
          "Curated reference value, not a figure we have traced to the factory manual for this truck. Confirm against your service manual before final tightening. Over-torquing into a hot exhaust bung is how the next person ends up drilling it out.",
      },
    ],
},
},
},
{
    id: "gm-k2xx-key-fob-battery",
    title: "Key Fob Battery Replacement",
    jobType: "key-fob-battery",
    summary:
      "Five minutes and a couple of dollars. Worth doing before you assume the fob has died - a weak fob battery is the most common cause of a truck that will not respond to remote start.",
    difficulty: "Easy",
    estTime: "5-10 min",
    tier: "free",
    noFasteners: true,
    tools: [
      { name: "Small flat screwdriver or a plastic trim tool", note: "Plastic is kinder to the case seam" },
      { name: "Clean cloth", note: "Skin oil on a coin cell shortens its life" },
    ],

    safety: [
      "Coin cells are a serious swallowing hazard for children and pets. Keep the old one out of reach and dispose of it properly rather than leaving it on a counter.",
    ],

    steps: [
      {
        number: 1,
        title: "Rule out the simple stuff first",
        instructions:
          "Before opening anything, try the spare fob. If the spare works normally, it is the battery or the fob itself. If neither fob works, the problem is on the truck's side and a new coin cell will not fix it.",
      },
      {
        number: 2,
        title: "Open the case at the seam",
        instructions:
          "Slide out the mechanical key blade first if your fob has one - on many GM fobs that exposes the release. Then find the seam around the edge of the case and work a plastic trim tool into it, twisting gently to walk the halves apart. Go around the edge rather than forcing one spot.",
        warning: "Do not pry at the buttons or the keyring loop. The clips are around the perimeter and forcing elsewhere cracks the housing.",
      },
      {
        number: 3,
        title: "Note which way the old cell sits",
        instructions:
          "Look at which side faces up - usually the positive side with the writing on it, but check yours rather than assuming. Take a photo if there is any doubt. Fitted upside down the fob simply does nothing, and you will think you bought a dead battery.",
      },
      {
        number: 4,
        title: "Swap the cell without touching its faces",
        instructions:
          "Lever the old cell out with a fingernail or the plastic tool. Handle the new one by its edges - skin oil on the flat faces builds resistance at the contacts and shortens its life. Press it in the same orientation until it seats under the retaining clip.",
      },
      {
        number: 5,
        title: "Close it up and test everything",
        instructions:
          "Press the halves together until the clips click all the way round, and refit the key blade. Then test every function from a normal distance: lock, unlock, tailgate, panic and remote start. Remote start is the one that goes first on a weak battery, so if that now works from across a parking lot, you have your answer.",
      },
    ],
  fitment: { on: "platform", key: "gm-k2xx-1500" },
figures: {
"2018-chevrolet-silverado-1500-5.3l": {
id: "silverado-2018-key-fob-battery",
verified: true,
    parts: ["CR2032 coin cell - check the old one, some fobs take a CR2025"],
    torqueSpecs: [],
},
"2018-gmc-sierra-1500-5.3l": {
id: "sierra-2018-key-fob-battery",
verified: true,
    parts: ["CR2032 coin cell - check the old one, some fobs take a CR2025"],
    torqueSpecs: [],
},
},
},
];
