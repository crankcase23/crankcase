import { RepairGuide } from "@/types/vehicle";

// Step images are original schematic illustrations (public/steps/*.svg) —
// not photos from any manual — meant to show *what* to do, not stand in for
// a factory diagram. Torque values carry the same reference-figure caveat as
// src/data/vehicles.ts; ranges are used instead of a single number wherever
// sources commonly disagree, and the UI tells the user to confirm before
// final torque every time.

export const repairs: RepairGuide[] = [
// ---------------------------------------------------------------- JEEP
{
id: "jeep-grand-cherokee-oil-change",
vehicleId: "2014-jeep-grand-cherokee-3.6l",
title: "Engine Oil & Filter Change",
summary:
"Full drain-and-refill oil service for the 3.6L Pentastar V6, including the cartridge-style oil filter housing under the intake plenum.",
difficulty: "Easy",
tier: "free",
estTime: "45-60 min",
tools: [
{ name: "Oil filter housing wrench", note: "Cartridge cap, ~74mm hex/flute pattern" },
{ name: "Socket set + ratchet", note: "For drain plug and under-shield fasteners" },
{ name: "Torque wrench", note: "Range covering 15-30 ft-lb" },
{ name: "Drain pan", note: "6+ qt capacity" },
{ name: "Funnel" },
{ name: "Jack + 2 jack stands or drive-up ramps" },
{ name: "Nitrile gloves + safety glasses" },
],
parts: [
"5.7 qt (5.4 L) 0W-20 full-synthetic engine oil",
"Mopar (or equivalent) cartridge oil filter element + housing O-ring",
"Drain plug crush washer (replace if not self-sealing)",
],
safety: [
"Let a hot engine cool for 10-15 min before draining — hot oil causes burns.",
"Use jack stands rated for the vehicle's weight; never work under a vehicle held only by a jack.",
"Used oil and filters are hazardous waste — take them to a recycling/auto parts drop-off, never pour down a drain.",
],
torqueSpecs: [
{
fastener: "Oil pan drain plug",
value: "20 ft-lb (27 Nm)",
provenance: { source: "open-labor-project", confidence: "high" },
},
{
fastener: "Oil filter housing cap",
value: "18 ft-lb (24 Nm)",
notes: "Housing is plastic — do not overtighten, snug + spec torque only.",
},
],
steps: [
{
number: 1,
title: "Warm the engine briefly, then park and secure",
instructions:
"Run the engine for 2-3 minutes so the oil flows more easily, then shut it off. Park on level ground, set the parking brake, and chock the rear wheels.",
image: "/steps/generic-park-secure.svg",
},
{
number: 2,
title: "Raise the vehicle and remove the under-engine shield",
instructions:
"Jack up the front of the vehicle at the factory jack points and support it on jack stands. Remove the plastic under-engine shield — it's held by a mix of push-pin fasteners and bolts along its edge.",
image: "/steps/generic-raise-vehicle.svg",
warning: "Confirm the vehicle is stable on the stands before reaching underneath.",
},
{
number: 3,
title: "Drain the old oil",
instructions:
"Position the drain pan under the oil pan's drain plug (rear of the pan). Loosen the plug with a socket, then finish removing it by hand and let the oil fully drain.",
image: "/steps/oil-drain.svg",
},
{
number: 4,
title: "Remove and replace the oil filter cartridge",
instructions:
"The filter housing cap is on top of the engine, near the front, under a plastic cover. Unscrew the cap counterclockwise with the housing wrench, lift out the old filter element, and let residual oil drain from the housing before wiping it clean.",
image: "/steps/oil-filter-cartridge.svg",
torque: [{ fastener: "Oil filter housing cap", value: "18 ft-lb (24 Nm)" }],
},
{
number: 5,
title: "Install the new filter and reassemble",
instructions:
"Fit the new filter element into the cap, lightly oil the new O-ring, and thread the cap back in by hand before torquing it. Reinstall the drain plug with a new crush washer and torque it to spec.",
image: "/steps/oil-filter-install.svg",
torque: [
{ fastener: "Oil filter housing cap", value: "18 ft-lb (24 Nm)" },
{ fastener: "Oil pan drain plug", value: "20 ft-lb (27 Nm)" },
],
},
{
number: 6,
title: "Reinstall the under-shield and lower the vehicle",
instructions: "Reattach the under-engine shield fasteners and carefully lower the vehicle back to the ground.",
image: "/steps/generic-lower-vehicle.svg",
},
{
number: 7,
title: "Refill and check",
instructions:
"Remove the oil fill cap on the valve cover and add oil in stages, checking the dipstick as you approach 5.7 qt. Start the engine, let it run ~30 seconds, shut it off, and check under the vehicle for leaks at the drain plug and filter cap.",
image: "/steps/oil-fill-check.svg",
},
{
number: 8,
title: "Final level check and oil-life reset",
instructions:
"Wait a few minutes for oil to settle, recheck the dipstick, and top off if needed. Reset the oil-life monitor via the dashboard menu (Vehicle Info > Oil Life Reset). Dispose of the old oil and filter at a recycling center.",
image: "/steps/generic-cleanup.svg",
},
],
},
{
id: "jeep-grand-cherokee-front-brake-pads",
vehicleId: "2014-jeep-grand-cherokee-3.6l",
title: "Front Brake Pad Replacement",
summary: "Replacing front brake pads and inspecting rotors on the WK2 Grand Cherokee.",
difficulty: "Moderate",
tier: "premium",
estTime: "1-1.5 hrs (both sides)",
tools: [
{ name: "Lug wrench or impact gun" },
{ name: "Socket set", note: "For caliper slide/guide bolts" },
{ name: "C-clamp or dedicated caliper piston tool" },
{ name: "Torque wrench" },
{ name: "Jack + 2 jack stands" },
{ name: "Wire brush + brake cleaner spray" },
{ name: "High-temp brake grease (for slide pins)" },
{ name: "Nitrile gloves + eye protection" },
],
parts: [
"Front brake pad set (semi-metallic or ceramic)",
"Brake cleaner",
"High-temp brake/caliper grease",
"New slide pin boots if the old ones are torn or hardened",
],
safety: [
"Brake dust can contain harmful particulates — never blow it out with compressed air; use brake cleaner and a wet rag.",
"Support the caliper with a hook or wire once removed — never let it hang by the brake hose.",
"Pump the brake pedal to restore firm pedal feel before driving; test brakes at low speed before normal driving.",
],
torqueSpecs: [
{
fastener: "Caliper slide/guide bolts",
value: "18-25 ft-lb (24-34 Nm)",
notes: "Range varies by caliper bracket design — confirm the exact figure for this caliper before final torque.",
},
{ fastener: "Wheel lug nuts", value: "130 ft-lb (176 Nm)" },
],
steps: [
{
number: 1,
title: "Break the lug nuts loose and raise the vehicle",
instructions:
"With the vehicle still on the ground, loosen (don't remove) the front lug nuts. Jack up the front, support it on jack stands, then remove the lug nuts and wheels.",
image: "/steps/generic-raise-vehicle.svg",
},
{
number: 2,
title: "Inspect the pads and rotor",
instructions:
"Look through the caliper opening at the remaining pad thickness and check the rotor face for scoring, grooves, or an uneven lip on the outer edge — all signs it may be time to also resurface or replace the rotor.",
image: "/steps/brake-inspect.svg",
},
{
number: 3,
title: "Remove the caliper",
instructions:
"Remove the two caliper slide/guide bolts on the back of the caliper. Lift the caliper off the rotor and hang it securely from the suspension with a hook or wire — do not let it dangle by the brake hose.",
image: "/steps/brake-caliper-remove.svg",
},
{
number: 4,
title: "Remove old pads and compress the piston",
instructions:
"Pull the old pads and anti-rattle clips out of the caliper bracket. Open the brake fluid reservoir cap, then use a C-clamp or piston tool to slowly push the caliper piston back into its bore, watching that the reservoir doesn't overflow.",
image: "/steps/brake-piston-compress.svg",
},
{
number: 5,
title: "Clean and lubricate",
instructions:
"Wire-brush the caliper bracket's contact points and clean the slide pins. Apply a thin coat of high-temp brake grease to the slide pins and the pad's contact points on the bracket.",
image: "/steps/brake-lubricate.svg",
},
{
number: 6,
title: "Install new pads and reinstall the caliper",
instructions:
"Seat the new pads and anti-rattle hardware into the bracket, swing the caliper back down over the rotor, and reinstall the slide bolts.",
image: "/steps/brake-install.svg",
torque: [{ fastener: "Caliper slide/guide bolts", value: "18-25 ft-lb (24-34 Nm)" }],
},
{
number: 7,
title: "Reinstall the wheel and repeat on the other side",
instructions:
"Reinstall the wheel, snug the lug nuts, lower the vehicle, then torque the lug nuts in a star pattern. Repeat steps 1-6 on the opposite side.",
image: "/steps/wheel-torque.svg",
torque: [{ fastener: "Wheel lug nuts", value: "130 ft-lb (176 Nm)" }],
},
{
number: 8,
title: "Bed in the brakes",
instructions:
"Before normal driving, pump the brake pedal several times until firm and check the fluid level. Do a few moderate stops from low speed in an empty area to bed in the new pads per the pad manufacturer's instructions.",
image: "/steps/generic-cleanup.svg",
},
],
},

// ---------------------------------------------------------------- CIVIC
{
id: "civic-oil-change",
vehicleId: "2018-honda-civic-1.5t",
title: "Engine Oil & Filter Change",
summary: "Drain-and-refill oil service for the 1.5L turbo four, with a spin-on oil filter.",
difficulty: "Easy",
tier: "free",
estTime: "30-45 min",
tools: [
{ name: "17mm socket", note: "Drain plug" },
{ name: "Oil filter wrench", note: "Strap or cap-style for the spin-on filter" },
{ name: "Torque wrench" },
{ name: "Drain pan" },
{ name: "Funnel" },
{ name: "Jack + 2 jack stands or ramps" },
{ name: "Nitrile gloves + safety glasses" },
],
parts: [
"3.7 qt (3.5 L) 0W-20 full-synthetic engine oil",
"Honda (or equivalent) spin-on oil filter",
"Drain plug sealing washer (Honda recommends a new one each service)",
],
safety: [
"Let a hot engine cool 10-15 min before draining.",
"Never work under a vehicle supported only by a jack — use jack stands.",
"Recycle used oil and the filter at an auto parts store or recycling center.",
],
torqueSpecs: [
{
fastener: "Oil pan drain plug",
value: "29 ft-lb (39 Nm)",
provenance: { source: "open-labor-project", confidence: "high" },
},
{
fastener: "Spin-on oil filter",
value: "16 ft-lb (22 Nm)",
notes: "Reference torque if using a filter wrench — most techs simply hand-tighten plus 3/4 turn past gasket contact instead of using a torque wrench on a spin-on filter.",
provenance: { source: "open-labor-project", confidence: "high" },
},
],
steps: [
{
number: 1,
title: "Warm the engine briefly, then park and secure",
instructions: "Run the engine 2-3 minutes, shut it off, park on level ground, and chock the rear wheels.",
image: "/steps/generic-park-secure.svg",
},
{
number: 2,
title: "Raise the vehicle and remove the engine undercover",
instructions:
"Support the vehicle on jack stands and remove the plastic engine undercover (a row of bolts/clips along its edge).",
image: "/steps/generic-raise-vehicle.svg",
},
{
number: 3,
title: "Drain the oil",
instructions:
"Place the drain pan under the drain plug, loosen it with the 17mm socket, then remove it by hand and let the oil fully drain.",
image: "/steps/oil-drain.svg",
},
{
number: 4,
title: "Remove the old filter",
instructions:
"Locate the spin-on filter near the front of the engine block. Use the filter wrench to break it loose, then unscrew it by hand — have the drain pan positioned underneath, it will spill some oil.",
image: "/steps/oil-filter-spinon-remove.svg",
},
{
number: 5,
title: "Install the new filter and drain plug",
instructions:
"Wipe the mounting surface clean, lightly oil the new filter's gasket, and spin it on by hand until snug plus the additional turn specified on the filter. Reinstall the drain plug with a new sealing washer and torque it to spec.",
image: "/steps/oil-filter-install.svg",
torque: [{ fastener: "Oil pan drain plug", value: "29 ft-lb (39 Nm)" }],
},
{
number: 6,
title: "Reinstall the undercover and lower the vehicle",
instructions: "Reattach the undercover fasteners and lower the vehicle.",
image: "/steps/generic-lower-vehicle.svg",
},
{
number: 7,
title: "Refill and check for leaks",
instructions:
"Add oil through the valve cover fill cap in stages, checking the dipstick as you approach 3.7 qt. Start the engine briefly, shut it off, and check the drain plug and filter for leaks.",
image: "/steps/oil-fill-check.svg",
},
{
number: 8,
title: "Final check and Maintenance Minder reset",
instructions:
"Recheck the dipstick after a few minutes and top off if needed. Reset the Maintenance Minder via the dash button sequence, then recycle the old oil and filter.",
image: "/steps/generic-cleanup.svg",
},
],
},

// --------------------------------------------------------------- F-150
{
id: "f150-oil-change",
vehicleId: "2015-ford-f150-5.0l",
title: "Engine Oil & Filter Change",
summary: "Drain-and-refill oil service for the 5.0L Coyote V8, with its cartridge-style oil filter.",
difficulty: "Easy",
tier: "free",
estTime: "45-60 min",
tools: [
{ name: "Socket set + ratchet", note: "Drain plug and filter housing" },
{ name: "Oil filter housing wrench", note: "~36mm hex, cartridge cap" },
{ name: "Torque wrench" },
{ name: "Large drain pan", note: "10+ qt capacity" },
{ name: "Funnel with extension", note: "Truck ride height makes reach longer" },
{ name: "Jack + 2 jack stands" },
{ name: "Nitrile gloves + safety glasses" },
],
parts: [
"8.0 qt (7.6 L) 5W-20 synthetic-blend engine oil",
"Motorcraft (or equivalent) cartridge oil filter element + O-ring",
"Drain plug gasket",
],
safety: [
"Let a hot engine cool 10-15 min before draining.",
"Use jack stands rated for the truck's weight; the frame/pinch points differ from a car — use the manual's lift points.",
"Recycle used oil and the filter — don't pour it down a drain.",
],
torqueSpecs: [
{
fastener: "Oil pan drain plug",
value: "20 ft-lb (27 Nm)",
provenance: { source: "open-labor-project", confidence: "high" },
},
{
fastener: "Oil filter housing cap",
value: "~25 ft-lb (34 Nm)",
notes: "Housing is plastic — snug plus spec torque only, do not overtighten.",
},
],
steps: [
{
number: 1,
title: "Warm the engine briefly, then park and secure",
instructions: "Run the engine 2-3 minutes, shut it off, park on level ground, and chock the wheels.",
image: "/steps/generic-park-secure.svg",
},
{
number: 2,
title: "Raise the vehicle",
instructions:
"Support the truck on jack stands at the frame's rated lift points. The drain plug and filter housing are usually reachable without removing an undercover on this application, but check for one on your specific build.",
image: "/steps/generic-raise-vehicle.svg",
},
{
number: 3,
title: "Drain the oil",
instructions:
"Position the large drain pan under the drain plug, loosen it, then remove it by hand and let the oil fully drain — it holds 8 quarts, so give it time.",
image: "/steps/oil-drain.svg",
},
{
number: 4,
title: "Remove and replace the oil filter cartridge",
instructions:
"The filter housing cap is on the front of the engine. Unscrew it counterclockwise with the housing wrench, lift out the old element, and let the housing drain before wiping it clean.",
image: "/steps/oil-filter-cartridge.svg",
torque: [{ fastener: "Oil filter housing cap", value: "~25 ft-lb (34 Nm)" }],
},
{
number: 5,
title: "Install the new filter and drain plug",
instructions:
"Fit the new element into the cap, lightly oil the new O-ring, thread the cap in by hand, then torque it. Reinstall the drain plug with a new gasket and torque it.",
image: "/steps/oil-filter-install.svg",
torque: [
{ fastener: "Oil filter housing cap", value: "~25 ft-lb (34 Nm)" },
{ fastener: "Oil pan drain plug", value: "20 ft-lb (27 Nm)" },
],
},
{
number: 6,
title: "Lower the vehicle",
instructions: "Double-check both fasteners, then carefully lower the truck.",
image: "/steps/generic-lower-vehicle.svg",
},
{
number: 7,
title: "Refill and check for leaks",
instructions:
"Add oil through the valve cover fill cap in stages, checking the dipstick as you approach 8 qt. Start the engine briefly, shut it off, and check underneath for leaks.",
image: "/steps/oil-fill-check.svg",
},
{
number: 8,
title: "Final check and oil-life reset",
instructions:
"Recheck the dipstick after a few minutes and top off if needed. Reset the oil-life monitor via the dash menu, then recycle the old oil and filter.",
image: "/steps/generic-cleanup.svg",
},
],
},

// --------------------------------------------------------------- SILVERADO
{
id: "silverado-1500-oil-change",
vehicleId: "2020-chevrolet-silverado-1500-5.3l",
title: "Engine Oil & Filter Change",
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
parts: [
"8.0 qt (7.6 L) dexos1 0W-20 full-synthetic engine oil",
"ACDelco (or equivalent) spin-on oil filter",
"Drain plug gasket (replace if not self-sealing)",
],
safety: [
"Let a hot engine cool for 10-15 min before draining — hot oil causes burns.",
"Use jack stands rated for the truck's weight; never work under a vehicle held only by a jack.",
"Used oil and filters are hazardous waste — take them to a recycling/auto parts drop-off, never pour down a drain.",
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
value: "22 ft-lb (30 Nm)",
notes: "Reference torque if using a filter wrench — most techs simply hand-tighten plus 3/4 turn past gasket contact instead of using a torque wrench on a spin-on filter.",
provenance: { source: "open-labor-project", confidence: "high" },
},
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
torque: [{ fastener: "Oil pan drain plug", value: "18 ft-lb (25 Nm)" }],
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
},

// --------------------------------------------------------------- SIERRA
// Same GM T1XX full-size truck/SUV platform, same 5.3L EcoTec3 (L84) engine
// and 8L80 transmission as the Chevrolet Silverado 1500 above — see
// claude/content-scaling-strategy-2026-09-19.md. This guide is deliberately
// near-identical to the Silverado one; only the vehicleId/id and a couple of
// GMC-specific part-brand mentions change. Torque numbers are the Silverado's
// own real Open Labor Project data, carried over because it's genuinely the
// same fastener on the same engine — flagged in each note as not yet
// independently re-pulled from Open Labor Project under GMC/Sierra 1500's own
// make/model, which should still happen once quota allows to confirm rather
// than assume.
{
id: "sierra-1500-oil-change",
vehicleId: "2020-gmc-sierra-1500-5.3l",
title: "Engine Oil & Filter Change",
summary: "Drain-and-refill oil service for the 5.3L EcoTec3 V8, with its spin-on oil filter — the same GM engine and layout as the Chevrolet Silverado 1500.",
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
parts: [
"8.0 qt (7.6 L) dexos1 0W-20 full-synthetic engine oil",
"ACDelco (or equivalent) spin-on oil filter",
"Drain plug gasket (replace if not self-sealing)",
],
safety: [
"Let a hot engine cool for 10-15 min before draining — hot oil causes burns.",
"Use jack stands rated for the truck's weight; never work under a vehicle held only by a jack.",
"Used oil and filters are hazardous waste — take them to a recycling/auto parts drop-off, never pour down a drain.",
],
torqueSpecs: [
{
fastener: "Oil pan drain plug",
value: "18 ft-lb (25 Nm)",
notes: "Same 5.3L EcoTec3 (L84) engine as the Chevrolet Silverado 1500 — this figure is carried over from that vehicle's real Open Labor Project data (high confidence) since GM uses the identical fastener/torque spec across both trucks. Use new crush washer. Not yet independently pulled from Open Labor Project under the Sierra's own make/model.",
},
{
fastener: "Spin-on oil filter",
value: "22 ft-lb (30 Nm)",
notes: "Reference torque if using a filter wrench — most techs simply hand-tighten plus 3/4 turn past gasket contact instead of using a torque wrench on a spin-on filter. Same platform-twin sourcing note as the drain plug above.",
},
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
torque: [{ fastener: "Oil pan drain plug", value: "18 ft-lb (25 Nm)" }],
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
},

// --------------------------------------------------------------- ESCAPE
{
id: "ford-escape-oil-change",
vehicleId: "2021-ford-escape-1.5l",
title: "Engine Oil & Filter Change",
summary: "Drain-and-refill oil service for the 1.5L EcoBoost turbo three-cylinder, with its spin-on oil filter.",
difficulty: "Easy",
tier: "free",
estTime: "35-50 min",
tools: [
{ name: "Oil filter wrench", note: "Strap or cap-style for the spin-on filter" },
{ name: "Socket set + ratchet", note: "For drain plug and under-shield fasteners" },
{ name: "Torque wrench", note: "Range covering 10-25 ft-lb" },
{ name: "Drain pan", note: "6+ qt capacity" },
{ name: "Funnel" },
{ name: "Jack + 2 jack stands or drive-up ramps" },
{ name: "Nitrile gloves + safety glasses" },
],
parts: [
"5.7 qt (5.4 L) 0W-20 full-synthetic engine oil",
"Motorcraft FL-910-S (or equivalent) spin-on oil filter",
"Drain plug crush washer (replace each service)",
],
safety: [
"Let a hot engine cool for 10-15 min before draining — hot oil causes burns.",
"Use jack stands rated for the vehicle's weight; never work under a vehicle held only by a jack.",
"Used oil and filters are hazardous waste — take them to a recycling/auto parts drop-off, never pour down a drain.",
],
torqueSpecs: [
{
fastener: "Oil pan drain plug",
value: "15 ft-lb (20 Nm)",
notes: "Use new crush washer.",
provenance: { source: "open-labor-project", confidence: "high" },
},
{
fastener: "Spin-on oil filter",
value: "Hand-tighten per filter instructions (typically 3/4 turn past gasket contact)",
notes: "Don't use a torque wrench on a spin-on filter — follow the printed instructions on the filter itself.",
},
],
steps: [
{
number: 1,
title: "Warm the engine briefly, then park and secure",
instructions:
"Run the engine for 2-3 minutes so the oil flows more easily, then shut it off. Park on level ground, set the parking brake, and chock the rear wheels.",
image: "/steps/generic-park-secure.svg",
},
{
number: 2,
title: "Raise the vehicle and remove the under-engine shield",
instructions:
"Jack up the front of the vehicle at the factory jack points and support it on jack stands. Remove the plastic under-engine shield — it's held by a mix of push-pin fasteners and bolts along its edge.",
image: "/steps/generic-raise-vehicle.svg",
warning: "Confirm the vehicle is stable on the stands before reaching underneath.",
},
{
number: 3,
title: "Drain the old oil",
instructions:
"Position the drain pan under the oil pan's drain plug. Loosen the plug with a socket, then finish removing it by hand and let the oil fully drain.",
image: "/steps/oil-drain.svg",
},
{
number: 4,
title: "Remove the old filter",
instructions:
"Locate the spin-on filter near the front of the engine block. Use the filter wrench to break it loose, then unscrew it by hand — have the drain pan positioned underneath, it will spill some oil.",
image: "/steps/oil-filter-spinon-remove.svg",
},
{
number: 5,
title: "Install the new filter and drain plug",
instructions:
"Wipe the mounting surface clean, lightly oil the new filter's gasket, and spin it on by hand until snug plus the additional turn specified on the filter. Reinstall the drain plug with a new crush washer and torque it to spec.",
image: "/steps/oil-filter-install.svg",
torque: [{ fastener: "Oil pan drain plug", value: "15 ft-lb (20 Nm)" }],
},
{
number: 6,
title: "Reinstall the under-shield and lower the vehicle",
instructions: "Reattach the under-engine shield fasteners and carefully lower the vehicle back to the ground.",
image: "/steps/generic-lower-vehicle.svg",
},
{
number: 7,
title: "Refill and check",
instructions:
"Remove the oil fill cap on the valve cover and add oil in stages, checking the dipstick as you approach 5.7 qt. Start the engine, let it run ~30 seconds, shut it off, and check under the vehicle for leaks at the drain plug and filter cap.",
image: "/steps/oil-fill-check.svg",
},
{
number: 8,
title: "Final level check and oil-life reset",
instructions:
"Wait a few minutes for oil to settle, recheck the dipstick, and top off if needed. Reset the oil-change reminder via the dash Information menu (Oil Change Required > Reset). Dispose of the old oil and filter at a recycling center.",
image: "/steps/generic-cleanup.svg",
},
],
},
];

export function getRepairsForVehicle(vehicleId: string): RepairGuide[] {
return repairs.filter((r) => r.vehicleId === vehicleId);
}

export function getRepairById(id: string): RepairGuide | undefined {
return repairs.find((r) => r.id === id);
}
