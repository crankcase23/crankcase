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
];
