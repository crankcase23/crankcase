import { RepairGuide } from "@/types/vehicle";

// Guides for the 2018 Chevrolet Silverado 1500 (K2XX generation, 5.3L EcoTec3
// L83, 4WD). Kept in its own file rather than appended to src/data/repairs.ts,
// which is past 130 KB - see the vehicle build playbook.
//
// SCOPE NOTE: there is deliberately no PCV valve guide here. On the EcoTec3 the
// PCV function is cast into the valve cover and there is no removable valve, so
// servicing it means replacing and resealing the cover - the
// disassemble-and-reseal side of our scope line. The job is excluded for this
// engine family in src/lib/admin/coverage.ts so it does not read as a gap.

export const silveradoK2xxGuides: RepairGuide[] = [
  {
    id: "silverado-2018-oil-change",
    vehicleId: "2018-chevrolet-silverado-1500-5.3l",
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
    parts: [
      "8 qt dexos1 0W-20 full synthetic",
      "ACDelco PF63 spin-on oil filter (or equivalent)",
      "Drain plug washer if yours is the crush-washer type",
    ],
    safety: [
      "Never work under a vehicle held up by a jack alone - jack stands or ramps, every time.",
      "Hot oil will burn you. Warm the engine so the oil flows, then give it ten minutes before you pull the plug.",
      "Used oil is a hazardous waste. Most auto parts stores take it back free.",
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
        value: "Hand-tight plus three quarters of a turn after the gasket touches",
        notes: "No torque wrench. Wipe a film of fresh oil on the new gasket first or it will grab and tear.",
      },
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
        torque: [{ fastener: "Oil drain plug", value: "18 ft-lb (25 Nm)" }],
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
  },
  {
    id: "silverado-2018-tire-rotation",
    vehicleId: "2018-chevrolet-silverado-1500-5.3l",
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
    parts: ["Replacement lug nuts if any are swollen or rounded"],
    safety: [
      "Never get under or beside a wheel that is held up by the jack alone.",
      "Break the lug nuts loose while the wheel is still on the ground. A wheel spinning in the air is how knuckles get broken.",
      "Re-torque after 50 to 100 miles. Wheels settle, and a nut that felt right cold can be loose warm.",
    ],
    torqueSpecs: [
      {
        fastener: "Wheel lug nuts",
        value: "140 ft-lb (190 Nm)",
        notes:
          "Three sources agree, and the figure has held across every printed Silverado 1500 owner's manual. Star pattern, in two passes.",
      },
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
        torque: [{ fastener: "Wheel lug nuts", value: "140 ft-lb (190 Nm)" }],
      },
      {
        number: 7,
        title: "Set pressures and re-torque after a short drive",
        instructions:
          "Set all four to the pressure on the driver's door jamb label, not the number on the tire sidewall - the sidewall number is the tire's maximum, not the truck's spec. Drive 50 to 100 miles and re-torque.",
      },
    ],
  },
  {
    id: "silverado-2018-front-brake-pads",
    vehicleId: "2018-chevrolet-silverado-1500-5.3l",
    title: "Front Brake Pads & Rotors",
    jobType: "brake-pads-front",
    summary:
      "Front brake service on the K2XX Silverado, pads alone or pads and rotors together. Pick which job you are doing at the top of the steps and the procedure changes to match.",
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
    parts: [
      "Front brake pad set",
      "Brake cleaner",
      "High-temp brake/caliper grease",
      "New guide pin boots if the old ones are torn or hardened",
      "Front brake rotors, pair - only if replacing rotors",
    ],
    safety: [
      "Brake dust can contain harmful particulates - never blow it out with compressed air; use brake cleaner and a wet rag.",
      "Support the caliper with a hook or wire once removed - never let it hang by the brake hose.",
      "Pump the brake pedal to restore firm pedal feel before driving; test brakes at low speed before normal driving.",
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
        torque: [{ fastener: "Caliper bracket bolts to knuckle", value: "170 ft-lb (230 Nm)" }],
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
        torque: [{ fastener: "Caliper guide pin bolts", value: "74 ft-lb (100 Nm)" }],
      },
      {
        number: 12,
        title: "Wheels on, pedal firm, then bed the pads",
        instructions:
          "Mount the wheels, torque the lugs to 140 ft-lb (190 Nm) in a star pattern, and lower the truck. With the engine off, pump the pedal until it is firm - the first pump or two will go to the floor. Then bed the pads: from about 35 mph brake firmly but short of ABS down to 10 mph, release, repeat six to eight times with a short cruise between each.",
        torque: [{ fastener: "Wheel lug nuts", value: "140 ft-lb (190 Nm)" }],
        warning: "Do not move the truck until the pedal is firm, and do not sit on the brake at a stop while they are still hot from bedding - it prints pad material onto the rotor and gives you the pulsation you were trying to avoid.",
      },
    ],
  },
  {
    id: "silverado-2018-rear-brake-pads",
    vehicleId: "2018-chevrolet-silverado-1500-5.3l",
    title: "Rear Brake Pads & Rotors",
    jobType: "brake-pads-rear",
    summary:
      "Rear brake service on the K2XX Silverado. The piston pushes straight in - the parking brake is a separate drum inside the rotor hat, not a screw-in piston - and that same drum is what usually holds a stuck rotor on.",
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
    parts: [
      "Rear brake pad set",
      "Brake cleaner",
      "High-temp brake/caliper grease",
      "New guide pin boots if the old ones are torn or hardened",
      "Rear brake rotors, pair - only if replacing rotors",
    ],
    safety: [
      "Brake dust can contain harmful particulates - never blow it out with compressed air; use brake cleaner and a wet rag.",
      "Support the caliper with a hook or wire once removed - never let it hang by the brake hose.",
      "The parking brake shoes live inside the rotor hat. Leave the parking brake released for the whole job and cycle it several times before driving so it re-adjusts.",
      "Pump the brake pedal to restore firm pedal feel before driving; test brakes at low speed before normal driving.",
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
        torque: [{ fastener: "Caliper bracket bolts to knuckle", value: "148 ft-lb (200 Nm)" }],
        rotorsOnly: true,
      },
      {
        number: 11,
        title: "Grease the pins, fit the pads, torque the guide bolts",
        instructions:
          "Clean and re-grease each guide pin with high-temp brake grease, replace any bad boots, fit the new clips and pads, then set the caliper back and torque both pin bolts to 38 ft-lb (52 Nm). That is a low figure and easy to overshoot with a big wrench.",
        torque: [{ fastener: "Caliper guide pin bolts", value: "38 ft-lb (52 Nm)" }],
      },
      {
        number: 12,
        title: "Wheels on, pedal firm, parking brake re-adjusted, then bed in",
        instructions:
          "Torque the lugs to 140 ft-lb (190 Nm) in a star pattern and lower the truck. Pump the pedal with the engine off until it is firm. Then apply and release the parking brake eight to ten times - it self-adjusts, and this is what takes the slack back out after the rotors came off. Finally bed the pads: 35 mph down to 10 mph, firm but short of ABS, six to eight times with a cruise between each.",
        torque: [{ fastener: "Wheel lug nuts", value: "140 ft-lb (190 Nm)" }],
        warning: "Do not come to a full stop and hold the pedal while the brakes are hot from bedding - it prints pad material onto the rotor.",
      },
    ],
  },
  {
    id: "silverado-2018-battery",
    vehicleId: "2018-chevrolet-silverado-1500-5.3l",
    title: "Battery Replacement",
    jobType: "battery",
    summary:
      "Group 94R (H7) under the hood on the driver's side. The trap here is at the parts counter, not on the truck: half the retailers will also offer you a Group 48, which is the auxiliary battery for dual-battery trucks and will sit loose in this tray.",
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
    parts: [
      "Group 94R (H7) battery, 720 CCA minimum",
      "Battery terminal protectant spray or felt washers",
    ],
    safety: [
      "Batteries vent hydrogen. No smoking, no sparks, no open flame near one.",
      "Disconnect the NEGATIVE terminal first and reconnect it LAST. Touching a wrench between the positive post and any metal while the negative is still connected will weld the wrench.",
      "Battery acid will ruin clothing and injure eyes. Gloves and eye protection.",
      "A truck battery is heavier than it looks. Lift with your legs and keep it level.",
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
    steps: [
      {
        number: 1,
        title: "Confirm the group size before you buy",
        instructions:
          "This truck takes a Group 94R, also called H7, 720 CCA from the factory. Several big retailers list a Group 48 (H6) as an alternate fit - that is the auxiliary battery for trucks built with the dual-battery option, not the primary. A 48 is physically shorter than a 94R and will move around in this tray no matter how you clamp it. If the counter hands you a 48, hand it back.",
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
        torque: [{ fastener: "Battery hold-down clamp bolt", value: "13 ft-lb (18 Nm)" }],
      },
      {
        number: 7,
        title: "Reconnect positive first, negative last",
        instructions:
          "Positive clamp on and snug to about 11 ft-lb (15 Nm), then negative. You may get a small spark as the negative touches - that is the truck's electronics drawing their first current and is normal. Spray both terminals with protectant.",
        torque: [{ fastener: "Battery terminal clamp nuts", value: "11 ft-lb (15 Nm)" }],
        warning: "Negative goes on LAST. Reversing the order puts a live positive on the truck while you are still working on it.",
      },
      {
        number: 8,
        title: "Start it and check what it forgot",
        instructions:
          "Start the truck. Reset the clock and radio presets. Expect a slightly odd idle or shift feel for the first few drives while the adaptives relearn - that settles on its own and is not a fault.",
      },
    ],
  },
  {
    id: "silverado-2018-engine-air-filter",
    vehicleId: "2018-chevrolet-silverado-1500-5.3l",
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
    parts: ["Engine air filter (panel type)"],
    safety: [
      "Engine off and cool enough to lean over.",
      "Do not run the engine with the airbox open. Anything that goes down the intake tube goes through the MAF sensor and into the engine.",
    ],
    torqueSpecs: [],
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
  },
  {
    id: "silverado-2018-cabin-air-filter",
    vehicleId: "2018-chevrolet-silverado-1500-5.3l",
    title: "Cabin Air Filter Replacement",
    jobType: "cabin-air-filter",
    summary:
      "Behind the glove box, no tools, about ten minutes. Worth knowing: the older GM trucks that shipped with no cabin filter at all were the 2007-2013 generation - yours has one.",
    difficulty: "Easy",
    estTime: "10-15 min",
    tier: "free",
    noFasteners: true,
    tools: [{ name: "Flashlight" }],
    parts: ["Cabin air filter (GM 23281440 or equivalent)"],
    safety: [
      "A filthy cabin filter is full of mold spores and road dust. Bag it rather than shaking it out inside the truck.",
    ],
    torqueSpecs: [],
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
  },
  {
    id: "silverado-2018-wiper-blades",
    vehicleId: "2018-chevrolet-silverado-1500-5.3l",
    title: "Wiper Blade Replacement",
    jobType: "wiper-blades",
    summary:
      "Five minutes, no tools. The only real risk is a spring-loaded wiper arm snapping down onto bare glass, which cracks windshields.",
    difficulty: "Easy",
    estTime: "10 min",
    tier: "free",
    noFasteners: true,
    tools: [{ name: "Towel or folded rag", note: "Padding under the arm in case it snaps down" }],
    parts: ["Front wiper blade pair - check length for your build, driver and passenger sides differ"],
    safety: [
      "Lay a towel on the windshield before you lift the arms. A wiper arm with no blade on it will crack glass if it snaps back.",
    ],
    torqueSpecs: [],
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
  },
  {
    id: "silverado-2018-coolant",
    vehicleId: "2018-chevrolet-silverado-1500-5.3l",
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
    parts: [
      "2 gallons of DEX-COOL 50/50 premix, or 1 gallon of concentrate plus distilled water",
      "Distilled water - never tap water",
    ],
    safety: [
      "Never open a cooling system that is hot. The coolant is above its boiling point under pressure and will flash to steam the moment you release the cap. Cold engine only.",
      "Coolant is sweet-tasting and lethal to pets and wildlife. Catch every drop, clean up spills immediately, and take the old fluid to a recycler.",
      "Keep hands clear of the fans. On this truck they can spin up after the key is off.",
    ],
    torqueSpecs: [
      {
        fastener: "Radiator drain petcock",
        value: "Hand-tight only",
        notes:
          "It is a plastic fitting. Snug it by hand and stop - putting a wrench on it and cracking the neck turns a fluid change into a radiator replacement.",
      },
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
        torque: [{ fastener: "Radiator drain petcock", value: "Hand-tight only" }],
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
  },
  {
    id: "silverado-2018-driveline-fluid",
    vehicleId: "2018-chevrolet-silverado-1500-5.3l",
    title: "Differential & Transfer Case Fluid",
    jobType: "driveline-fluid",
    summary:
      "Three fills on a 4WD: front diff, transfer case, rear axle. The rear is the awkward one - it has no drain plug, so the cover has to come off. The front and the transfer case both have proper drain and fill plugs.",
    difficulty: "Moderate",
    estTime: "2-3 hrs for all three",
    tier: "premium",
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
    parts: [
      "Rear axle: 75W-85 synthetic axle lubricant (GM 19300457), quantity per your axle size",
      "Front differential: 1.5 qt of 75W-90 synthetic GL-5",
      "Transfer case: 1.6 qt of DEXRON-VI ATF",
      "Rear axle cover gasket or RTV sealant",
      "Shop towels - gear oil gets everywhere",
    ],
    safety: [
      "Level the truck on four jack stands. A fill-to-the-plug level taken on a tilted truck is wrong in a way you will not notice until something whines.",
      "Gear oil smells foul and stains permanently. Gloves, and old clothes.",
      "Crack the FILL plug loose before you drain anything. If the fill plug is seized and the fluid is already out, the truck is stuck on stands until you win that fight.",
    ],
    torqueSpecs: [
      {
        fastener: "Rear axle cover bolts",
        value: "20 ft-lb (27 Nm)",
        notes: "Star pattern. Community figure citing service data rather than a scanned manual page - treat as a reference.",
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
    steps: [
      {
        number: 1,
        title: "Level the truck and identify your rear axle",
        instructions:
          "Get all four corners on stands so the truck sits level. While you are under there, count the bolts on the rear differential cover: ten bolts is the 8.6-inch axle and takes about 4.2 pints, twelve bolts is the 9.5-inch and takes 5.5 pints. A 5.3L LT is most likely the 8.6. Buy fluid after you have counted, not before.",
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
        torque: [{ fastener: "Transfer case drain and fill plugs", value: "13 ft-lb (18 Nm)" }],
      },
      {
        number: 4,
        title: "Front differential: drain, refill with 75W-90",
        instructions:
          "The front axle does have a drain plug. Drain it, refit the plug at 24 ft-lb (33 Nm), then pump in 75W-90 synthetic until it reaches the bottom edge of the fill hole and starts to seep back out. That is about 1.5 qt. Fit the fill plug at the same torque.",
        torque: [{ fastener: "Front differential drain and fill plugs", value: "24 ft-lb (33 Nm)" }],
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
        torque: [{ fastener: "Rear axle cover bolts", value: "20 ft-lb (27 Nm)" }],
      },
      {
        number: 9,
        title: "Fill the rear axle - and skip the friction modifier",
        instructions:
          "Pump 75W-85 synthetic in through the fill hole until it sits level with the bottom edge of the hole. If your truck has the G80 locker, do NOT add limited-slip friction modifier. The G80 is a locker that happens to use clutches rather than a clutch-type limited slip, and GM bulletin PIP4054D says an additive makes its clutch pack slip and miss engagement. This is the opposite of the usual rule and it is the mistake most people make on this axle.",
        torque: [{ fastener: "Rear axle fill plug", value: "24 ft-lb (33 Nm)" }],
        warning: "Friction modifier in a G80 axle causes the exact problem you would be trying to prevent.",
      },
      {
        number: 10,
        title: "Drive it, then check for leaks",
        instructions:
          "Lower the truck and drive it gently for ten minutes to warm everything through. Park it, wait an hour, and look underneath with a flashlight at the axle cover, both diff plugs and the transfer case plugs. Check again the following morning - a slow weep only shows itself overnight.",
      },
    ],
  },
];
