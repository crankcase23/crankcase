import { RepairGuide } from "@/types/vehicle";

// ---------------------------------------------------------------------------
// GM T1XX 1500 - shared procedures for the 2019+ Silverado 1500 and Sierra 1500
//
// This file is the reference implementation of the fitment pattern, and it
// exists because the two trucks are the same truck. Same T1XX platform, same
// 5.3L L84, same 8L80, same 4WD hardware. Before this, every one of these four
// jobs was written out twice, and the two copies had already started to drift:
// the oil-change summaries no longer matched, for no reason anyone intended.
//
// What is shared and what is not:
//
//   SHARED      the procedure. Steps, tools, safety, warnings, sequencing.
//               Written once, against the key that actually governs the job -
//               engine for the oil change, platform for the other three.
//
//   NOT SHARED  every number. Torque, capacity, part numbers and part
//               descriptions live in figures, keyed by vehicle id, and are
//               verified per truck. A step names its fastener and leaves the
//               value empty; the resolver in repairs.ts fills it in from that
//               vehicle's own figures, and withholds the entire guide if it
//               cannot. There is deliberately no fallback to "the other one".
//
// Adding a third T1XX truck - a Tahoe, a Yukon, a Suburban, an Escalade - does
// not mean writing these four guides again. It means tagging the vehicle with
// the same keys in vehicles.ts, then adding one figures entry per guide once
// the numbers for it have actually been checked. The procedure comes free. The
// numbers never do.
//
// See claude/vehicle-build-playbook-2026-09-19.md.
// WHAT CHANGED FROM K2XX, AND WHAT IS DELIBERATELY MISSING HERE
//
// The 2019 truck is not the 2018 truck with a new body. Three procedures are
// genuinely different jobs, and keying alone will never catch that - fitment
// stops a K2XX guide reaching a T1XX truck, but only because somebody checked:
//
//   REAR BRAKES   the drum-in-hat park brake and its foot pedal are gone. The
//                 T1XX 1500 has an ELECTRIC parking brake with a motorised
//                 actuator on the rear caliper. It needs Service Mode before
//                 the pads come out, a new actuator lever seal on reassembly,
//                 and a park brake calibration plus a pad-life monitor reset
//                 afterwards. Tell a reader to C-clamp that piston the way the
//                 2018 guide does and the job goes wrong immediately.
//   BELT          there is NO TENSIONER. Two stretch-fit belts and a fixed
//                 idler. Nothing to relieve, nothing to torque, and a
//                 conventional belt physically will not fit.
//   DIFFS         the front differential lost its drain plug. Cover off or
//                 suction only, and the cover gasket is single-use.
//
// And the front caliper bracket bolt went from a plain 170 ft-lb on K2XX to a
// TORQUE-ANGLE spec on T1XX - on a bolt GM recalled in 2020 for being
// improperly heat treated. Carrying the old number forward would badly
// over-torque it.
//
// NOT BUILT YET, on purpose:
//   front-brake-pads, rear-brake-pads  caliper guide pin torques could not be
//     sourced for 2019+ from anything that clearly covers this generation. The
//     trade press writing for technicians declines to print them and points at
//     VIN-specific service data. A half-sourced brake guide is the wrong one to
//     be optimistic about, so these stay unwritten until the figures exist.
//   driveline-fluid   no plug torques sourced for T1XX.
//   serpentine-belt   needs a scope decision: the stretch belt requires a
//     dedicated install tool and cannot be reused.
//
// Blacklisted while researching this truck: go-parts.com publishes a confident
// T1XX brake page whose figures are a generic GM passenger-car spec pasted onto
// a truck. It survived two searches before a cross-check caught it.
//
// See claude/guide-fitment-rules-2026-09-19.md.
// ---------------------------------------------------------------------------

export const gmT1xxGuides: RepairGuide[] = [
{
id: "gm-t1xx-oil-change",
title: "Engine Oil & Filter Change",
jobType: "oil-change",
summary: "Drain-and-refill oil service for the 5.3L EcoTec3 V8, with its spin-on oil filter.",
difficulty: "Easy",
tier: "free",
estTime: "45-60 min",
tools: [
{ name: "Oil filter wrench", note: "Strap or cap-style for the spin-on filter" },
{ name: "Socket set + ratchet", note: "For drain plug and under-shield fasteners" },
{ name: "Torque wrench", note: "Range covering 15-25 ft-lb" },
{ name: "Large drain pan", note: "10+ qt capacity" },
{ name: "Funnel with extension", note: "Truck ride height makes reach longer" },
{ name: "Jack + 2 jack stands or drive-up ramps" },
{ name: "Nitrile gloves + safety glasses" },
],

safety: [
"Let a hot engine cool for 10-15 min before draining — hot oil causes burns.",
"Use jack stands rated for the truck's weight; never work under a vehicle held only by a jack.",
"Used oil and filters are hazardous waste — take them to a recycling/auto parts drop-off, never pour down a drain.",
],

steps: [
{
number: 1,
title: "Warm the engine briefly, then park and secure",
instructions:
"Run the engine for 2-3 minutes so the oil flows more easily, then shut it off. Park on level ground, set the parking brake, and chock the wheels.",
image: "/steps/generic-park-secure.svg",
},
{
number: 2,
title: "Raise the vehicle and remove the under-engine shield",
instructions:
"Support the truck on jack stands at the frame's rated lift points. Remove the plastic under-engine shield if equipped — it's held by a mix of push-pin fasteners and bolts along its edge.",
image: "/steps/generic-raise-vehicle.svg",
warning: "Confirm the vehicle is stable on the stands before reaching underneath.",
},
{
number: 3,
title: "Drain the old oil",
instructions:
"Position the large drain pan under the oil pan's drain plug. Loosen the plug with a socket, then finish removing it by hand and let the oil fully drain — it holds 8 quarts, so give it time.",
image: "/steps/oil-drain.svg",
},
{
number: 4,
title: "Remove the old filter",
instructions:
"Locate the spin-on filter on the side of the engine block. Use the filter wrench to break it loose, then unscrew it by hand — have the drain pan positioned underneath, it will spill some oil.",
image: "/steps/oil-filter-spinon-remove.svg",
},
{
number: 5,
title: "Install the new filter and drain plug",
instructions:
"Wipe the mounting surface clean, lightly oil the new filter's gasket, and spin it on by hand until snug plus the additional turn specified on the filter. Reinstall the drain plug with a new gasket and torque it to spec.",
image: "/steps/oil-filter-install.svg",
torque: [{ fastener: "Oil pan drain plug", value: "" }],
},
{
number: 6,
title: "Reinstall the under-shield and lower the vehicle",
instructions: "Reattach the under-engine shield fasteners (if removed) and carefully lower the truck back to the ground.",
image: "/steps/generic-lower-vehicle.svg",
},
{
number: 7,
title: "Refill and check",
instructions:
"Remove the oil fill cap on the valve cover and add oil in stages, checking the dipstick as you approach 8 qt. Start the engine, let it run ~30 seconds, shut it off, and check under the truck for leaks at the drain plug and filter cap.",
image: "/steps/oil-fill-check.svg",
},
{
number: 8,
title: "Final level check and oil-life reset",
instructions:
"Wait a few minutes for oil to settle, recheck the dipstick, and top off if needed. Reset the oil-life system via the dash Driver Information Center menu. Dispose of the old oil and filter at a recycling center.",
image: "/steps/generic-cleanup.svg",
},
],
fitment: { on: "engine", key: "gm-ecotec3-l84" },
figures: {
"2020-chevrolet-silverado-1500-5.3l": {
id: "silverado-1500-oil-change",
verified: true,
parts: [
"8.0 qt (7.6 L) dexos1 0W-20 full-synthetic engine oil",
"ACDelco (or equivalent) spin-on oil filter",
"Drain plug gasket (replace if not self-sealing)",
],
torqueSpecs: [
{
fastener: "Oil pan drain plug",
value: "18 ft-lb (25 Nm)",
notes: "Use new crush washer.",
provenance: { source: "open-labor-project", confidence: "high" },
},
{
fastener: "Spin-on oil filter",
value: "1 full turn past gasket contact (roughly 10 Nm)",
notes:
"Oil the new gasket, hand-spin the filter until the gasket touches, then one full turn more. That IS the spec - GM bulletin 22-NA-009 (Sept 2022) replaced the older three-quarter-turn instruction, and a spin-on filter is not a torque-wrench fastener. Do NOT use the 22 ft-lb (30 Nm) figure that circulates for this filter: it is roughly three times GM's own number and will crush the gasket. The 41 ft-lb figure some torque tables carry is the filter ADAPTER fitting, a different part entirely.",
provenance: { source: "curated" },
},
],
},
"2020-gmc-sierra-1500-5.3l": {
id: "sierra-1500-oil-change",
verified: true,
parts: [
"8.0 qt (7.6 L) dexos1 0W-20 full-synthetic engine oil",
"ACDelco (or equivalent) spin-on oil filter",
"Drain plug gasket (replace if not self-sealing)",
],
torqueSpecs: [
{
fastener: "Oil pan drain plug",
value: "18 ft-lb (25 Nm)",
provenance: { source: "curated" },
notes: "Same 5.3L EcoTec3 (L84) engine as the Chevrolet Silverado 1500, and GM uses the identical drain plug fastener and torque across both trucks, so this figure is carried over from the Silverado by hand. It has never been pulled from Open Labor Project under the Sierra's own make/model, so it is recorded as a hand-cited figure rather than a sourced one. Use new crush washer.",
},
{
fastener: "Spin-on oil filter",
value: "1 full turn past gasket contact (roughly 10 Nm)",
notes:
"Oil the new gasket, hand-spin the filter until the gasket touches, then one full turn more. That IS the spec - GM bulletin 22-NA-009 (Sept 2022) replaced the older three-quarter-turn instruction, and a spin-on filter is not a torque-wrench fastener. Do NOT use the 22 ft-lb (30 Nm) figure that circulates for this filter: it is roughly three times GM's own number and will crush the gasket. The 41 ft-lb figure some torque tables carry is the filter ADAPTER fitting, a different part entirely.",
provenance: { source: "curated" },},
],
},
},
},
{
id: "gm-t1xx-tire-rotation",
title: "Tire Rotation",
jobType: "tire-rotation",
summary:
"Even out tire wear on the {{vehicle}} by moving all four tires through a rearward cross pattern, with a tread and brake inspection while the wheels are off.",
difficulty: "Easy",
tier: "premium",
estTime: "45-60 min",
tools: [
{ name: "Lug wrench or breaker bar", note: "Long handle makes breaking 140 ft-lb (190 Nm) loose far easier" },
{ name: "Socket to fit the lug nuts", note: "Use a proper impact/deep socket — an ill-fitting one rounds the nut" },
{ name: "Torque wrench", note: "Must cover 140 ft-lb (190 Nm)" },
{ name: "Floor jack" },
{ name: "4 jack stands", note: "All four wheels come off at once on a cross rotation" },
{ name: "Wheel chocks" },
{ name: "Tire pressure gauge" },
{ name: "Tread depth gauge or a quarter", note: "A quarter works: if the tread does not reach Washington's hairline, you are near 4/32\" and shopping for tires" },
],

safety: [
"Never get under a vehicle supported only by a jack. Use stands rated for the vehicle's weight, on level concrete.",
"Break the lug nuts loose while the tires are still on the ground. Trying to crack them with the wheel in the air spins the wheel and can pull the vehicle off the stands.",
"Do not use an impact gun for final tightening. Impact guns routinely overshoot 140 ft-lb (190 Nm) by a wide margin, which warps rotors and stretches studs.",
"Re-torque all lug nuts after 50-100 miles. Nuts commonly settle and lose clamp load after a wheel has been off.",
],

steps: [
{
number: 1,
title: "Confirm your tires can actually be cross-rotated",
instructions:
"Before anything else, check the sidewalls. If they show a rotation-direction arrow, the tires are directional and must stay on the same side of the vehicle — front-to-back only, never crossed. If the front and rear tires are different sizes (a staggered setup), they cannot be rotated front-to-back at all. Base 265/60R18 tires on this vehicle are normally neither, but aftermarket tires change that, so look.",
image: "/steps/tire-rotation-rwd.svg",
warning: "Crossing a directional tire to the other side of the vehicle puts the tread pattern backwards, which hurts wet braking and hydroplaning resistance.",
},
{
number: 2,
title: "Check and record cold tire pressures",
instructions:
"Check all four pressures before you move the vehicle, while the tires are cold, and write them down. Front and rear specs often differ, so you need the starting numbers to set them correctly once the tires have swapped axles. The door-jamb placard has the correct cold pressures.",
image: "/steps/generic-park-secure.svg",
},
{
number: 3,
title: "Park, secure, and break the lug nuts loose",
instructions:
"Park on level ground, put it in park, set the parking brake, and chock the wheels. With all four tires still on the ground, break each lug nut loose about a half turn using the breaker bar. Do not remove them yet.",
image: "/steps/generic-park-secure.svg",
},
{
number: 4,
title: "Raise the vehicle and support all four corners",
instructions:
"Lift the vehicle at the frame rails behind the front wheels and the rear axle tube and set it down on four jack stands so every wheel is off the ground. Push firmly on a corner before you trust it — the vehicle should not rock or shift on the stands.",
image: "/steps/generic-raise-vehicle.svg",
warning: "A cross rotation needs all four wheels off at once. Do not try to do it one corner at a time with a single stand.",
},
{
number: 5,
title: "Remove the wheels and inspect while they are off",
instructions:
"Take the lug nuts the rest of the way off and pull each wheel. Set them down flat. This is the best look at the brakes you will get all year — check pad thickness through the caliper and glance at the rotor faces for deep grooves or a lip at the outer edge. Measure tread depth on each tire and note anything uneven: wear on both outer edges means chronic underinflation, wear down the middle means overinflation, and wear on one edge only points at alignment.",
image: "/steps/tire-inspect.svg",
},
{
number: 6,
title: "Move each wheel to its new position",
instructions:
"This vehicle is 4WD, so use the rearward cross pattern: the two rear tires come straight forward to the same side of the front axle, and the two front tires cross over to the opposite rear corner. Put simply, on a rear- or four-wheel-drive vehicle the rear tires carry the drive wear while the fronts wear from steering and braking, so this pattern swaps those two wear patterns across the axles. Clean any rust or scale off the hub face before a wheel goes back on — debris trapped behind the wheel is a common cause of a wheel that will not seat flat and a vibration that shows up a week later.",
image: "/steps/tire-rotation-rwd.svg",
},
{
number: 7,
title: "Hand-thread, snug, and lower the vehicle",
instructions:
"Start every lug nut by hand — if a nut does not spin on freely with your fingers, stop and check the thread rather than forcing it with a wrench. Snug them in a star pattern just enough to pull the wheel flat against the hub, then lower the vehicle until the tires are carrying its weight.",
image: "/steps/generic-lower-vehicle.svg",
warning: "Cross-threading a lug stud is the single most common way this job goes wrong, and it turns a free service into a hub replacement.",
},
{
number: 8,
title: "Final torque, set pressures, reset TPMS",
instructions:
"With the vehicle's weight on the tires, torque every lug nut to 140 ft-lb (190 Nm) in a star pattern, working up to it in two or three passes. Set the tire pressures to the door-jamb placard values for their new positions. For TPMS: direct TPMS with position learn — if the DIC shows pressures on the wrong corners, run the relearn procedure from the vehicle settings menu. Then put a reminder on your phone to re-torque the lug nuts in 50-100 miles.",
image: "/steps/wheel-torque.svg",
torque: [{ fastener: "Wheel lug nuts", value: "" }],
},
],
fitment: { on: "platform", key: "gm-t1xx-1500" },
figures: {
"2020-chevrolet-silverado-1500-5.3l": {
id: "silverado-1500-tire-rotation",
verified: true,
parts: [
"None — this is a no-parts service",
"Optional: replacement valve caps",
"Optional: anti-seize is NOT recommended on lug studs — it changes the effective clamp load at a given torque",
],
torqueSpecs: [
{
fastener: "Wheel lug nuts",
value: "140 ft-lb (190 Nm)",
provenance: { source: "open-labor-project", confidence: "high" },
notes: "Tighten in a star/criss-cross pattern in two or three passes, not one shot per nut. Final torque with the wheels on the ground.",
},
],
},
"2020-gmc-sierra-1500-5.3l": {
id: "sierra-1500-tire-rotation",
verified: true,
parts: [
"None — this is a no-parts service",
"Optional: replacement valve caps",
"Optional: anti-seize is NOT recommended on lug studs — it changes the effective clamp load at a given torque",
],
torqueSpecs: [
{
fastener: "Wheel lug nuts",
value: "140 ft-lb (190 Nm)",
provenance: { source: "open-labor-project", confidence: "high" },
notes: "Tighten in a star/criss-cross pattern in two or three passes, not one shot per nut. Final torque with the wheels on the ground.",
},
],
},
},
},
{
id: "gm-t1xx-wiper-blades",
title: "Wiper Blade Replacement",
jobType: "wiper-blades",
summary:
"Swap the front wiper blades on the {{vehicle}}. No tools, no fasteners, and the fastest job in the catalog -- but the sizes are specific and easy to get wrong at the parts counter.",
difficulty: "Easy",
tier: "premium",
estTime: "15-20 min",
noFasteners: true,
tools: [
{ name: "No tools required", note: "Blades release by hand" },
{ name: "Folded towel", note: "Lay it on the glass in case an arm snaps back" },
],

safety: [
"A wiper arm under spring tension will snap back hard enough to crack a windshield. Never let go of a raised arm, and lay a folded towel on the glass while you work.",
"Do not drive with the arms bare against the glass. Bare metal on glass scratches it permanently in a single wipe.",
"Never run the wipers on a dry windshield to test them. Wet the glass first.",
],

steps: [
{
number: 1,
title: "Confirm the sizes before you buy",
instructions:
"This vehicle takes a 22 inch driver-side blade and a 22 inch passenger-side blade. This vehicle has no rear wiper. Write the sizes down -- in-store lookup kiosks and online size charts are frequently wrong about body-style variants.",
image: "/steps/generic-park-secure.svg",
},
{
number: 2,
title: "Lift the arms into the service position",
instructions:
"Park with the wipers in their resting position, then lift each arm away from the glass until it locks upright. Lay your folded towel over the windshield underneath them before you go any further.",
image: "/steps/wiper-arm-lift.svg",
warning: "Keep a hand on the arm the whole time. A spring-loaded arm falling onto bare glass can crack a windshield.",
},
{
number: 3,
title: "Look at how the old blade attaches",
instructions:
"Before removing anything, look at the joint between arm and blade. Most are a hook (J-hook) style, some are a push-button or pin style. Knowing which you have before the old one is off makes fitting the new one obvious instead of a guessing game in the cold.",
image: "/steps/wiper-blade-release.svg",
},
{
number: 4,
title: "Release and remove the old blade",
instructions:
"Press the release tab or squeeze the locking clip where the blade meets the arm, then slide the blade down along the arm to unhook it. It should come free with light pressure -- if you are fighting it, the tab is not fully depressed.",
image: "/steps/wiper-blade-release.svg",
},
{
number: 5,
title: "Fit the new blade until it clicks",
instructions:
"Line the new blade up the same way the old one sat and slide it onto the arm until you hear and feel a positive click. Then tug the blade gently away from the arm. If it moves, it is not latched -- reseat it. A blade that comes off at highway speed takes the paint with it.",
image: "/steps/wiper-blade-release.svg",
warning: "Do not skip the tug test. A blade that feels seated but is not latched is the single most common failure on this job.",
},
{
number: 6,
title: "Lower the arms and test properly",
instructions:
"Lower each arm gently onto the glass -- do not let it snap down. Remove the towel, wet the windshield with washer fluid, then run the wipers through a full cycle. Listen for chatter or skipping and look for streaks, which usually mean the blade is not sitting flat on the glass.",
image: "/steps/generic-cleanup.svg",
},
],
fitment: { on: "platform", key: "gm-t1xx-1500" },
figures: {
"2020-chevrolet-silverado-1500-5.3l": {
id: "silverado-1500-wiper-blades",
verified: true,
parts: [
"Driver side wiper blade, 22 inch",
"Passenger side wiper blade, 22 inch",
"Optional: washer fluid, since you are already there",
],
torqueSpecs: [],
},
"2020-gmc-sierra-1500-5.3l": {
id: "sierra-1500-wiper-blades",
verified: true,
parts: [
"Driver side wiper blade, 22 inch",
"Passenger side wiper blade, 22 inch",
"Optional: washer fluid, since you are already there",
],
torqueSpecs: [],
},
},
},
{
id: "gm-t1xx-cabin-filter",
title: "Cabin Air Filter Replacement",
jobType: "cabin-air-filter",
summary:
"Replace the cabin air filter on the {{vehicle}}. It is the filter for the air you actually breathe, it is almost always overdue, and a clogged one is the usual reason the fan feels weak.",
difficulty: "Easy",
tier: "premium",
estTime: "15-20 min",
noFasteners: true,
tools: [
{ name: "No tools required", note: "The damper clip and glove box both release by hand" },
{ name: "Small flashlight" },
],

safety: [
"An old cabin filter can hold mould, pollen and rodent debris. Wear gloves, avoid shaking it out inside the car, and bag it before it goes in the bin.",
"Work with the ignition off. There is wiring behind the glove box on every one of these vehicles.",
"Do not force a trim panel. Plastic clips on a dash get brittle with age and heat -- if something will not move, a fastener is still holding it.",
],

steps: [
{
number: 1,
title: "Know what you are looking at",
instructions:
"The cabin filter cleans the air coming through the vents, not anything the engine breathes. Most manufacturers want it yearly or around every 15,000 miles, and almost nobody does it that often. If your fan seems weaker than it used to or the car smells musty when the A/C starts, this is usually why.",
image: "/steps/cabin-filter-access.svg",
},
{
number: 2,
title: "Empty the glove box and clear your workspace",
instructions:
"Take everything out of the glove box -- it will be upside down shortly. Push the passenger seat back as far as it goes and get a light in there. This job is entirely about being able to see what you are doing.",
image: "/steps/generic-park-secure.svg",
},
{
number: 3,
title: "Get to the filter housing",
instructions:
"Unhook the damper arm on the left side of the glove box by pinching its clip, then squeeze both sides of the box inward to clear the stops and swing it fully down. No tools needed. The filter sits in the HVAC housing behind it.",
image: "/steps/cabin-filter-access.svg",
},
{
number: 4,
title: "Note the airflow direction, then pull the old filter",
instructions:
"The airflow arrow on this truck points DOWN. Worth confirming against your own old filter as you pull it -- published answers for the previous-generation body disagree, and the filter itself is the authority. Slide the old filter out slowly and keep it flat -- they collect a surprising amount of leaf litter and grit that will dump into the footwell if you tip it.",
image: "/steps/filter-airflow.svg",
warning: "A cabin filter fitted backwards still passes air, so nothing will seem wrong -- it just filters and seals poorly. Get the direction right the first time.",
},
{
number: 5,
title: "Clean the housing and fit the new filter",
instructions:
"Wipe out any debris sitting in the empty housing before the new filter goes in, otherwise it lands on the fresh filter immediately. Slide the new one in with its arrow matching the direction you noted, making sure it seats flat and square rather than bowing in the middle.",
image: "/steps/filter-airflow.svg",
},
{
number: 6,
title: "Reassemble and confirm the fan",
instructions:
"Refit the cover and put everything back in reverse order, making sure any electrical connector you disturbed clicks home. Start the car and run the fan up to full on fresh air. It should be noticeably stronger than before, and there should be no new rattle or whistle from behind the dash.",
image: "/steps/generic-cleanup.svg",
},
],
fitment: { on: "platform", key: "gm-t1xx-1500" },
figures: {
"2020-chevrolet-silverado-1500-5.3l": {
id: "silverado-1500-cabin-filter",
verified: true,
parts: [
"Cabin air filter for the 2019+ Silverado 1500",
"Optional: a few spare trim clips, in case an old one breaks",
],
torqueSpecs: [],
},
"2020-gmc-sierra-1500-5.3l": {
id: "sierra-1500-cabin-filter",
verified: true,
parts: [
"Cabin air filter for the 2019+ Sierra 1500",
"Optional: a few spare trim clips, in case an old one breaks",
],
torqueSpecs: [],
},
},
},
{
id: "gm-t1xx-battery",
title: "Battery Replacement",
jobType: "battery",
summary:
"Straightforward swap on the {{vehicle}} with two things nobody tells you: the positive terminal carries a power distribution block with its own little harness, and the truck runs a battery management system that needs resetting afterwards or the charging system keeps aiming at the old battery.",
difficulty: "Easy",
tier: "premium",
estTime: "30-45 min",
tools: [
{ name: "13 mm socket + ratchet", note: "Hold-down bolt at the base of the tray" },
{ name: "10 mm socket or small wrench", note: "Terminal clamp nuts" },
{ name: "Battery terminal brush", note: "Optional but the corrosion is always worse than it looks" },
{ name: "Nitrile gloves + safety glasses" },
],
safety: [
"NEGATIVE cable off first, back on LAST. Touch a wrench between the positive post and any bit of body metal with the negative still connected and you get an arc flash and a ruined wrench.",
"Batteries vent hydrogen. No smoking, no sparks, nothing that arcs over an open battery.",
"It is heavier than it looks - roughly 40 lb. Lift with the strap or your back will remember it.",
],
steps: [
{
number: 1,
title: "Park, shut it off, and let it sit",
instructions:
"Hood up, ignition fully off, key fob out of the cabin and at least a few feet away so the truck does not wake itself up mid-job. Battery is under the hood on the driver's side.",
},
{
number: 2,
title: "Disconnect the negative first",
instructions:
"10 mm nut on the negative clamp. Spread the clamp and lift it off the post, then tuck the cable well out of the way so it cannot spring back onto the terminal while you work.",
warning: "Negative first, always. This is the step that stops a dropped wrench from becoming a dead short.",
},
{
number: 3,
title: "Deal with the positive terminal properly",
instructions:
"The positive on this truck is not just a clamp - there is a power distribution block sitting on it with a separate small wiring harness clipped in. Unclip that harness first, then loosen the 10 mm terminal nut and lift the whole assembly off as a unit. Do not yank it by the harness.",
},
{
number: 4,
title: "Remove the hold-down and lift it out",
instructions:
"Single hold-down bolt at the base of the battery, 13 mm. Back it out, pull the clamp, then lift the battery straight up using the strap. Keep it level.",
torque: [{ fastener: "Battery hold-down clamp bolt", value: "" }],
},
{
number: 5,
title: "Clean the tray and the clamps",
instructions:
"Wire-brush both cable clamps until they are bright, and wipe out anything powdery in the tray. A clamp that only touches the post in two places will read as a bad battery six months from now.",
},
{
number: 6,
title: "Fit the new one, positive first",
instructions:
"Set it in the same orientation, fit the hold-down and snug it, then the positive assembly with its harness clipped back in, then the negative LAST. Snug each terminal nut until the clamp will not twist on the post by hand - no further.",
torque: [{ fastener: "Battery hold-down clamp bolt", value: "" }],
warning: "Overtightening a terminal clamp cracks the post. It should be tight enough not to rotate, and that is all.",
},
{
number: 7,
title: "Reset the battery management system",
instructions:
"This truck tracks battery state of health and will keep charging to the old battery's profile if you skip this. A dealer or a capable scan tool does it properly. Without one, the accepted field procedure is to leave it idling for about three minutes with accessories off, then drive it 20 to 30 minutes. Expect the clock and radio presets to need redoing either way.",
},
],
fitment: { on: "platform", key: "gm-t1xx-1500" },
figures: {
"2020-chevrolet-silverado-1500-5.3l": {
id: "silverado-1500-battery",
verified: true,
parts: [
"Group 48 (H6 / LN3) battery, 730 CCA to match OE",
"Optional: felt terminal washers",
"Optional: terminal protectant spray",
],
torqueSpecs: [
{
fastener: "Battery hold-down clamp bolt",
value: "Snug only - GM does not publish a figure for this fastener",
notes: "13 mm head. No public source gives a torque for it and the trade tables that do are copying each other, so this is deliberately not a number. Snug it until the battery cannot rock in the tray and stop - the bolt threads into a light tray feature and will strip long before the battery needs more clamp.",
provenance: { source: "curated" },
},
{
fastener: "Battery terminal clamp nuts",
value: "Snug until the clamp will not rotate on the post",
notes: "Same reasoning. A cracked post is a new battery; a slightly loose clamp is a five-second fix.",
provenance: { source: "curated" },
},
],
},
"2020-gmc-sierra-1500-5.3l": {
id: "sierra-1500-battery",
verified: true,
parts: [
"Group 48 (H6 / LN3) battery, 730 CCA to match OE",
"Optional: felt terminal washers",
"Optional: terminal protectant spray",
],
torqueSpecs: [
{
fastener: "Battery hold-down clamp bolt",
value: "Snug only - GM does not publish a figure for this fastener",
notes: "13 mm head. No public source gives a torque for it and the trade tables that do are copying each other, so this is deliberately not a number. Snug it until the battery cannot rock in the tray and stop - the bolt threads into a light tray feature and will strip long before the battery needs more clamp.",
provenance: { source: "curated" },
},
{
fastener: "Battery terminal clamp nuts",
value: "Snug until the clamp will not rotate on the post",
notes: "Same reasoning. A cracked post is a new battery; a slightly loose clamp is a five-second fix.",
provenance: { source: "curated" },
},
],
},
},
},
{
id: "gm-t1xx-engine-air-filter",
title: "Engine Air Filter Replacement",
jobType: "engine-air-filter",
summary:
"Ten minutes, no tools, no fasteners on the {{vehicle}}. The only way to get this wrong is at the parts counter - the 2014 to 2018 filter looks similar, is widely listed for this truck, and does not fit.",
difficulty: "Easy",
tier: "premium",
estTime: "10-15 min",
noFasteners: true,
tools: [
{ name: "No tools required", note: "The airbox lid is held by clips" },
{ name: "Shop vacuum", note: "Optional, for the debris that always sits in the bottom of the box" },
{ name: "Flashlight" },
],
safety: [
"Engine off. Nothing here is hot or sharp, but a running engine with the airbox open will inhale whatever you drop.",
"Do not start the engine with the lid off or the filter out, even briefly.",
],
steps: [
{
number: 1,
title: "Find the airbox",
instructions:
"Large black plastic box on the passenger side of the engine bay with a big duct running from it to the throttle body. The lid is held by spring clips around its edge - count them before you start so you know how many to re-latch.",
},
{
number: 2,
title: "Release the clips and lift the lid",
instructions:
"Flip each clip outward by hand. The lid stays tethered by the intake duct, so lift it up and tilt it aside rather than trying to pull it free. No need to disconnect the duct.",
warning: "If a clip will not move, do not lever it with a screwdriver. They are plastic and they snap. Push the lid down slightly to take tension off the clip first.",
},
{
number: 3,
title: "Note which way the old one sits, then lift it out",
instructions:
"Look at the filter before you touch it - there is usually an arrow or a printed orientation mark, and the sealing lip only faces one way. Take a photo if you are unsure. Then lift it straight up and out.",
},
{
number: 4,
title: "Clean out the box",
instructions:
"Vacuum or wipe the bottom of the housing. Leaves, grit and the occasional acorn collect down there, and anything you leave behind goes straight into the intake the moment you close the lid.",
},
{
number: 5,
title: "Fit the new filter",
instructions:
"Drop it in the same orientation as the old one and press the sealing lip down all the way round until it sits flat. Run a finger along the edge - a lip that is proud anywhere means unfiltered air is getting past it.",
},
{
number: 6,
title: "Close it up and re-latch every clip",
instructions:
"Seat the lid, then snap every clip you counted in step 1. A single unlatched clip is a whistle at cruise and a slow leak of dirty air into the engine.",
},
],
fitment: { on: "engine", key: "gm-ecotec3-l84" },
figures: {
"2020-chevrolet-silverado-1500-5.3l": {
id: "silverado-1500-engine-air-filter",
verified: true,
parts: [
"Engine air filter for the 2019-plus T1XX 1500 with the 5.3L V8 - confirm the fitment against your VIN before ordering, see the note below",
],
torqueSpecs: [
{
fastener: "None removed in this job",
value: "No fastener is loosened or retightened",
notes: "The airbox lid is clip-retained. If you are reaching for a socket on this job, you are on the wrong panel.",
provenance: { source: "curated" },
},
],
},
"2020-gmc-sierra-1500-5.3l": {
id: "sierra-1500-engine-air-filter",
verified: true,
parts: [
"Engine air filter for the 2019-plus T1XX 1500 with the 5.3L V8 - confirm the fitment against your VIN before ordering, see the note below",
],
torqueSpecs: [
{
fastener: "None removed in this job",
value: "No fastener is loosened or retightened",
notes: "The airbox lid is clip-retained. If you are reaching for a socket on this job, you are on the wrong panel.",
provenance: { source: "curated" },
},
],
},
},
},
{
id: "gm-t1xx-coolant",
title: "Coolant Drain and Fill",
jobType: "coolant",
summary:
"A radiator drain and fill on the {{vehicle}}. Worth being clear up front: this is a partial change, not a flush. The block keeps a large share of the system no matter how long you let it drip.",
difficulty: "Moderate",
tier: "premium",
estTime: "60-90 min",
tools: [
{ name: "Large drain pan", note: "8 qt minimum, and coolant spreads further than you expect" },
{ name: "Funnel with a long neck" },
{ name: "Pliers", note: "For hose clamps only - NOT for the petcock, see step 3" },
{ name: "Jack + 2 jack stands or ramps", note: "Optional, but reaching the petcock is far easier with the front up" },
{ name: "Nitrile gloves + safety glasses" },
],
safety: [
"COLD ENGINE ONLY. A warm cooling system is pressurised, and opening it sprays scalding coolant. If the upper hose is firm to squeeze, it is not cold enough.",
"Ethylene glycol is sweet, and it is lethal to dogs and cats. Catch every drop, and clean any spill on the driveway immediately.",
"Never open the pressure cap as the first move. Take the pressure off at the reservoir cap slowly, cloth over the top.",
],
steps: [
{
number: 1,
title: "Confirm it is cold, then open the reservoir",
instructions:
"Squeeze the upper radiator hose. If it has any pressure or warmth in it, wait. With it genuinely cold, put a cloth over the reservoir cap and turn it slowly to vent, then remove it. Opening the top first is what lets the system drain instead of glugging.",
},
{
number: 2,
title: "Get the pan underneath and find the petcock",
instructions:
"The drain is at the bottom corner of the radiator. It drains at an angle, not straight down, so set the pan wider than feels necessary and expect to move it once.",
},
{
number: 3,
title: "Open the petcock by hand",
instructions:
"Turn it by hand, a quarter turn at a time, until coolant runs. It only needs to be cracked, not removed.",
warning: "Do not put pliers on the petcock. It is plastic, it is old, and it snaps off flush - which turns a 90 minute job into pulling the radiator. If it will not move by hand, stop and soak it, do not reach for a tool.",
},
{
number: 4,
title: "Let it drain out, then close it",
instructions:
"Give it a good ten minutes past the last steady drip. Then close the petcock hand-tight - the same rule as opening it. Snug is sealed; force is a broken fitting.",
torque: [{ fastener: "Radiator drain petcock", value: "" }],
},
{
number: 5,
title: "Refill slowly with the right stuff",
instructions:
"50/50 DEX-COOL premix, poured slowly through the reservoir. Going fast just traps air you will spend the next step chasing. Stop when it reaches the cold fill mark - do not try to put in the system's total capacity, because most of it never came out.",
warning: "DEX-COOL only, and do not mix it with green conventional coolant. The two together gel and block the small passages in the heater core.",
},
{
number: 6,
title: "Burp the air out",
instructions:
"Cap loosely, start it, and run the heater on full hot with the fan low. Let it come up to temperature and watch the level drop as the thermostat opens and air works its way up. Top up as it falls. Squeezing the upper hose a few times helps move trapped air along.",
},
{
number: 7,
title: "Check it cold the next morning",
instructions:
"Let it cool completely, then check the level again and top to the cold mark. Air almost always settles out overnight and leaves it low on the first check. Look under the truck for drips while you are there.",
},
],
fitment: { on: "engine", key: "gm-ecotec3-l84" },
figures: {
"2020-chevrolet-silverado-1500-5.3l": {
id: "silverado-1500-coolant",
verified: true,
parts: [
"About 2 gallons of 50/50 DEX-COOL premix - buy to what a drain recovers, not to the system total",
"Distilled water if you are mixing from concentrate",
"Shop towels",
],
torqueSpecs: [
{
fastener: "Radiator drain petcock",
value: "Hand-tight only",
notes: "Plastic. There is no torque figure because a tool should never touch it.",
provenance: { source: "curated" },
},
],
},
"2020-gmc-sierra-1500-5.3l": {
id: "sierra-1500-coolant",
verified: true,
parts: [
"About 2 gallons of 50/50 DEX-COOL premix - buy to what a drain recovers, not to the system total",
"Distilled water if you are mixing from concentrate",
"Shop towels",
],
torqueSpecs: [
{
fastener: "Radiator drain petcock",
value: "Hand-tight only",
notes: "Plastic. There is no torque figure because a tool should never touch it.",
provenance: { source: "curated" },
},
],
},
},
},
{
id: "gm-t1xx-fluid-checks",
title: "Under-Hood Fluid Checks",
jobType: "fluid-checks",
summary:
"The ten minute walk round the engine bay of the {{vehicle}}. Two of the fluids a shop might offer to service on this truck do not exist on it, and knowing that is worth more than the check itself.",
difficulty: "Easy",
tier: "free",
estTime: "10-15 min",
noFasteners: true,
tools: [
{ name: "Clean rag or paper towel" },
{ name: "Flashlight" },
{ name: "Nitrile gloves", note: "Optional, but used oil is not something to get on your hands" },
],
safety: [
"Park level. A slope will lie to you about every level in the engine bay.",
"Cold or barely warm engine for the coolant check. Never open a hot cooling system.",
"Keep sleeves and rags away from the belt and fans - the cooling fan can spin up with the engine off.",
],
steps: [
{
number: 1,
title: "Engine oil",
instructions:
"Level ground, engine off several minutes so the oil has drained back. Pull the dipstick, wipe it, push it fully home, pull it again and read it. You want it between the marks, nearer the top than the bottom. Look at the colour on the rag too - dark is normal, gritty or milky is not.",
},
{
number: 2,
title: "Coolant",
instructions:
"Check the reservoir against its cold fill mark with the engine cold. Read the level through the plastic - there is no reason to open the cap for a check. Orange is correct on this truck. If it looks rusty or muddy, that is a problem to chase, not to top up.",
warning: "Do not open the reservoir cap on a warm engine just to look. The check does not need it and the burn is real.",
},
{
number: 3,
title: "Brake fluid",
instructions:
"Small reservoir at the back of the bay on the driver's side. Read it through the body against the min and max marks. A slow drop over months usually means the pads are wearing, not that the system is leaking - the fluid moves into the calipers as the pistons come out. A fast drop means stop driving it and find the leak.",
warning: "If you do top it up, use the DOT rating moulded into the reservoir cap itself. Published sources disagree on whether this truck is DOT 3 or DOT 4, and the cap on your truck outranks all of them.",
},
{
number: 4,
title: "Windshield washer",
instructions:
"Fill it. That is the whole check. Use a proper all-season washer fluid rather than water - water freezes in the lines and splits the pump.",
},
{
number: 5,
title: "Power steering - there is none to check",
instructions:
"This truck has electric power steering. There is no pump, no reservoir, no fluid and nothing to flush. If a shop offers you a power steering flush on it, they are selling a service that does not exist on this vehicle.",
},
{
number: 6,
title: "Transmission - there is no dipstick",
instructions:
"The eight-speed has no transmission dipstick. Level is set at a check plug with the fluid inside a narrow temperature window, which is not a driveway check. What you can do is look underneath for red drips and pay attention to how it shifts.",
warning: "The transmission and the transfer case take different fluids on this truck and they are not interchangeable. This is a reason to leave both to a proper service rather than topping anything up on a guess.",
},
{
number: 7,
title: "Look at the ground",
instructions:
"Last thing: look at where the truck has been parked. Clear water in summer is air conditioning condensate and is fine. Anything coloured, oily or sweet-smelling is worth tracing back to a fluid before it becomes a real job.",
},
],
fitment: { on: "engine", key: "gm-ecotec3-l84" },
figures: {
"2020-chevrolet-silverado-1500-5.3l": {
id: "silverado-1500-fluid-checks",
verified: true,
parts: [
"Nothing required for the check itself",
"Top-up quantities only if something is low: dexos1 0W-20, 50/50 DEX-COOL premix, all-season washer fluid",
"Brake fluid ONLY in the DOT rating moulded on your reservoir cap",
],
torqueSpecs: [
{
fastener: "None removed in this job",
value: "No fastener is loosened or retightened",
notes: "Every check here is visual or by dipstick. Nothing is unbolted.",
provenance: { source: "curated" },
},
],
},
"2020-gmc-sierra-1500-5.3l": {
id: "sierra-1500-fluid-checks",
verified: true,
parts: [
"Nothing required for the check itself",
"Top-up quantities only if something is low: dexos1 0W-20, 50/50 DEX-COOL premix, all-season washer fluid",
"Brake fluid ONLY in the DOT rating moulded on your reservoir cap",
],
torqueSpecs: [
{
fastener: "None removed in this job",
value: "No fastener is loosened or retightened",
notes: "Every check here is visual or by dipstick. Nothing is unbolted.",
provenance: { source: "curated" },
},
],
},
},
},
{
id: "gm-t1xx-fuse-bulb",
title: "Fuse and Bulb Replacement",
jobType: "fuse-bulb",
summary:
"Three fuse boxes on the {{vehicle}}, one of which people genuinely cannot get open, and one rule worth more than the rest of this guide: a fuse that blows twice is not a fuse problem.",
difficulty: "Easy",
tier: "free",
estTime: "15-30 min",
noFasteners: true,
tools: [
{ name: "Fuse puller", note: "Usually clipped inside the underhood fuse box lid" },
{ name: "Test light or multimeter", note: "Optional, but it settles the question in seconds" },
{ name: "Flashlight" },
{ name: "Clean gloves or a rag", note: "For handling bulbs - skin oil shortens halogen bulb life" },
],
safety: [
"Never fit a fuse of higher amperage than the one that blew. The fuse protects the wiring, and a bigger one just moves the failure to somewhere behind the dash that you cannot replace in a driveway.",
"Ignition off before pulling fuses.",
"For anything under the hood, treat the battery's positive distribution block as live at all times.",
],
steps: [
{
number: 1,
title: "Work out which box you need",
instructions:
"There are three. The engine compartment block handles the big stuff - engine, lighting, cooling. The LEFT instrument panel block, on the driver's side edge of the dash, and the RIGHT block on the passenger side edge cover the body and interior. Most cabin circuits live in the right block.",
},
{
number: 2,
title: "Open the right-hand block without breaking it",
instructions:
"This is the one people give up on. It does not pull straight out. Push the tab at the TOP of the block downward first, then pull the top of the block outward toward you. Trying to lever it straight out just flexes the trim.",
warning: "Both instrument panel blocks are reached with the door open, at the edge of the dash where the trim panel caps it. If you are prying at the trim itself, you are in the wrong place.",
},
{
number: 3,
title: "Read the diagram, not the internet",
instructions:
"The layout is printed on the inside of each lid and it is the one that matches YOUR truck's options. A diagram found online for a different trim or a different year will have you pulling the wrong fuse.",
},
{
number: 4,
title: "Pull the suspect fuse and look through it",
instructions:
"Use the puller, straight out. Hold it to the light: a blown fuse has a visible break or a scorched smear inside the plastic. If you cannot tell, a test light across the two test points on top of the fuse while the circuit is live is definitive.",
},
{
number: 5,
title: "Replace with the identical amperage",
instructions:
"Same colour, same number, pushed fully home until it seats. Keep the old one in your pocket until the circuit works, so you know exactly what you took out.",
},
{
number: 6,
title: "If it blows again, stop replacing it",
instructions:
"A fuse that blows a second time is doing its job and telling you something downstream is shorted. The next fuse will blow too, and the one after that. That is an electrical fault to trace, not a consumable to keep feeding.",
},
{
number: 7,
title: "Bulbs",
instructions:
"Handle any halogen bulb through a clean rag - the oil from your fingers creates a hot spot on the glass and shortens its life dramatically. Fit the bulb type the fixture calls for, which you confirm from the owner's manual or by reading the base of the old bulb. Do not buy off a listing that spans several model years of this truck: the front lighting changed within the generation and the wrong bulb either will not seat or will not aim.",
},
],
fitment: { on: "platform", key: "gm-t1xx-1500" },
figures: {
"2020-chevrolet-silverado-1500-5.3l": {
id: "silverado-1500-fuse-bulb",
verified: true,
parts: [
"Assorted blade fuses matching the amperage you are replacing",
"Replacement bulb of the correct type for the fixture - read it off the old bulb or the manual",
],
torqueSpecs: [
{
fastener: "None removed in this job",
value: "No fastener is loosened or retightened",
notes: "Fuses pull by hand or with the puller; the panels are clip-retained.",
provenance: { source: "curated" },
},
],
},
"2020-gmc-sierra-1500-5.3l": {
id: "sierra-1500-fuse-bulb",
verified: true,
parts: [
"Assorted blade fuses matching the amperage you are replacing",
"Replacement bulb of the correct type for the fixture - read it off the old bulb or the manual",
],
torqueSpecs: [
{
fastener: "None removed in this job",
value: "No fastener is loosened or retightened",
notes: "Fuses pull by hand or with the puller; the panels are clip-retained.",
provenance: { source: "curated" },
},
],
},
},
},
{
id: "gm-t1xx-key-fob-battery",
title: "Key Fob Battery Replacement",
jobType: "key-fob-battery",
summary:
"Five minutes and one coin cell on the {{vehicle}}. The only trap is buying the battery before you have opened the fob and looked.",
difficulty: "Easy",
tier: "premium",
estTime: "5-10 min",
noFasteners: true,
tools: [
{ name: "No tools required", note: "A coin or the emergency key blade opens it" },
{ name: "Clean cloth", note: "Lay the fob on it so nothing skitters across the floor" },
],
safety: [
"Coin cells are a serious swallowing hazard for small children and pets. Put the old one straight into a bin they cannot reach, not on the kitchen counter.",
"Do not pry at the seam with a screwdriver. It marks the case and cracks the clip.",
],
steps: [
{
number: 1,
title: "Get the emergency key out first",
instructions:
"Slide the release on the fob and pull the metal emergency key blade free. On this fob the blade is also the tool you use to open the case, so it comes out before anything else.",
},
{
number: 2,
title: "Open the case at the seam",
instructions:
"Insert the key blade, or a coin, into the slot at the seam and twist gently. It should separate with a click. Work round the seam rather than forcing it at one point.",
warning: "Gentle. The two halves are held by small plastic clips and a cracked fob housing is a much more expensive problem than a flat battery.",
},
{
number: 3,
title: "Look at the old battery before you buy one",
instructions:
"Note which way up it sits - which face is showing - and read the number printed on it. It should be a CR2032. Confirm it rather than trusting a listing: the number is right there, and it takes two seconds.",
},
{
number: 4,
title: "Swap it",
instructions:
"Lift the old cell out and press the new one in the same way up, handling it by the edges. Fingerprints across the flat faces add resistance and shorten the life of the cell.",
},
{
number: 5,
title: "Close it and test everything",
instructions:
"Press the halves together until the clips click all the way round, slide the emergency key blade back in, then test every button - lock, unlock, remote start, tailgate. If the range is still poor with a fresh cell, the problem was never the battery.",
},
],
fitment: { on: "platform", key: "gm-t1xx-1500" },
figures: {
"2020-chevrolet-silverado-1500-5.3l": {
id: "silverado-1500-key-fob-battery",
verified: true,
parts: [
"One CR2032 3V lithium coin cell - confirm against the old cell before buying",
],
torqueSpecs: [
{
fastener: "None removed in this job",
value: "No fastener is loosened or retightened",
notes: "The fob case is clip-retained and opens with the emergency key blade.",
provenance: { source: "curated" },
},
],
},
"2020-gmc-sierra-1500-5.3l": {
id: "sierra-1500-key-fob-battery",
verified: true,
parts: [
"One CR2032 3V lithium coin cell - confirm against the old cell before buying",
],
torqueSpecs: [
{
fastener: "None removed in this job",
value: "No fastener is loosened or retightened",
notes: "The fob case is clip-retained and opens with the emergency key blade.",
provenance: { source: "curated" },
},
],
},
},
},
];
