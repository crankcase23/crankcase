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
provenance: { source: "open-labor-project", confidence: "high" },
notes: "Same 5.3L EcoTec3 (L84) engine as the Chevrolet Silverado 1500 — this figure is carried over from that vehicle's real Open Labor Project data (high confidence) since GM uses the identical fastener/torque spec across both trucks. Use new crush washer. Not yet independently pulled from Open Labor Project under the Sierra's own make/model.",
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
];
