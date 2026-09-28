import {
  RepairGuide,
  RepairStep,
  TorqueSpec,
  Vehicle,
  GuideFitment,
  GuideFigures,
  JobTypeId,
  ResolvedGuide,
} from "@/types/vehicle";
import { vehicles } from "./vehicles";
import { jeepGrandCherokeeWk2Guides } from "./repairs-jeep-wk2";
import { gmK2xxGuides } from "./repairs-gm-k2xx";
import { gmT1xxGuides } from "./repairs-gm-t1xx";
import { toyotaRav4Guides } from "./repairs-toyota-rav4";
import { toyotaTacomaGuides } from "./repairs-toyota-tacoma";

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
jobType: "oil-change",
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
title: "Front Brake Pads & Rotors",
jobType: "brake-pads-front",
summary: "Front brake service on the WK2 Grand Cherokee, covering pads on their own or pads and rotors together. Pick which job you are doing at the top of the steps and the procedure changes to match.",
hasRotorOption: true,
difficulty: "Moderate",
tier: "premium",
estTime: "1-1.5 hrs pads only, 2-2.5 hrs with rotors (both sides)",
tools: [
{ name: "Lug wrench or impact gun" },
{ name: "Socket set", note: "For caliper slide/guide bolts" },
{ name: "C-clamp or dedicated caliper piston tool" },
{ name: "Torque wrench" },
{ name: "Breaker bar", note: "Rotors only - the caliper bracket bolts are the tightest fasteners in this job" },
{ name: "Dead blow or brass hammer", note: "Rotors only - for breaking a rust-bonded rotor free" },
{ name: "Wire brush", note: "Rotors only - cleaning the hub face is what prevents a pulsation" },
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
"Front brake rotors, pair - only if replacing rotors",
"Rotor retaining screw if the original is damaged on removal - only if replacing rotors",
],
safety: [
"Brake dust can contain harmful particulates — never blow it out with compressed air; use brake cleaner and a wet rag.",
"Support the caliper with a hook or wire once removed — never let it hang by the brake hose.",
"Pump the brake pedal to restore firm pedal feel before driving; test brakes at low speed before normal driving.",
],
torqueSpecs: [
{
fastener: "Caliper slide/guide bolts (front)",
value: "41 ft-lb (55 Nm)",
notes: "Factory figure from the WK2 service manual brake torque table (55 Nm). Independently confirmed by a technician quoting 41 ft-lb for the front guide pins on a 2015 Grand Cherokee Laredo 2WD. The front pins take roughly twice the rear - do not carry a rear figure forward.",
},
{
fastener: "Caliper bracket (adapter) bolts to knuckle",
value: "148 ft-lb (200 Nm)",
notes: "Rotors only. From the 2014-2016 service manual brake torque table, non-SRT. Corroborated two ways: the other three rows of that same table match figures sourced independently, and the fastener is an M14x1.5 grade 10.9 bolt whose published limit is about 154 ft-lb, which makes 148 a normal factory spec for it. Heads up for early trucks - the 2011 manual front suspension table lists 89 ft-lb for this bolt, so on a 2011-2013 WK2 confirm before torquing.",
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
title: "Remove the caliper bracket",
instructions: "The bracket the pads sit in has to come off before the rotor will clear the studs. It is held by two large bolts into the back of the steering knuckle, and they are usually very tight - this is what the breaker bar is for.",
rotorsOnly: true,
warning: "Keep supporting the caliper. Never let the caliper or the bracket hang on the flexible brake hose - the hose is not a structural part and tearing it turns this into a hydraulic repair and a bleed.",
},
{
number: 6,
title: "Free the old rotor",
instructions: "The rotor may lift straight off, or it may be held by a small retaining screw and bonded to the hub by rust. Remove the screw if one is fitted, then tap the rotor hat - the flat centre section, never the friction surface - with a dead blow or brass hammer until the bond breaks.",
rotorsOnly: true,
warning: "Rust bonds can be stubborn. Penetrating oil around the hub centre and patience beat force. Do not heat a rotor with a torch and do not hammer the friction surface of a rotor you might reuse.",
},
{
number: 7,
title: "Clean the hub face",
instructions: "Wire brush every trace of rust and scale off the hub face where the new rotor seats. This is the step people skip and it is the step that causes brake pulsation - even a thin ridge of rust under the rotor hat holds the new rotor out of true, and you will feel it through the pedal within a few hundred miles.",
rotorsOnly: true,
},
{
number: 8,
title: "Fit the new rotor and refit the bracket",
instructions: "New rotors ship with a protective oil coating. Clean both friction faces with brake cleaner and a lint-free rag before fitting. Seat the rotor flat against the hub, refit the retaining screw if there was one, then refit the caliper bracket and torque its bolts to 148 ft-lb (200 Nm).",
torque: [{ fastener: "Caliper bracket (adapter) bolts to knuckle", value: "148 ft-lb (200 Nm)" }],
rotorsOnly: true,
warning: "Two things here. Do not skip degreasing the new rotor - that coating bakes onto the pads and the brakes never feel right afterward. And these bracket bolts are the tightest fasteners in the job at 148 ft-lb - use a real torque wrench on them rather than guessing with the breaker bar you used to crack them loose.",
},
{
number: 9,
title: "Clean and lubricate",
instructions:
"Wire-brush the caliper bracket's contact points and clean the slide pins. Apply a thin coat of high-temp brake grease to the slide pins and the pad's contact points on the bracket.",
image: "/steps/brake-lubricate.svg",
},
{
number: 10,
title: "Install new pads and reinstall the caliper",
instructions:
"Seat the new pads and anti-rattle hardware into the bracket, swing the caliper back down over the rotor, and reinstall the slide bolts.",
image: "/steps/brake-install.svg",
torque: [{ fastener: "Caliper slide/guide bolts (front)", value: "41 ft-lb (55 Nm)" }],
},
{
number: 11,
title: "Reinstall the wheel and repeat on the other side",
instructions:
"Reinstall the wheel, snug the lug nuts, lower the vehicle, then torque the lug nuts in a star pattern. Repeat steps 1-6 on the opposite side.",
image: "/steps/wheel-torque.svg",
torque: [{ fastener: "Wheel lug nuts", value: "130 ft-lb (176 Nm)" }],
},
{
number: 12,
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
jobType: "oil-change",
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
value: "3/4 turn clockwise after the gasket contacts the seat — 12 Nm (9 ft-lb)",
notes: "Honda states this one as a turn, not a torque figure: spin the filter on until the gasket touches the mounting surface, then 3/4 turn further. The 12 Nm (9 ft-lb) is the cross-check if you do reach for a torque wrench. Source: Honda Vehicle Service Quick Reference Guide (2013 and later). Do not go past it -- over-tightening a spin-on filter rolls the gasket, and that shows up later as oil on the driveway.",
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
jobType: "oil-change",
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

// --------------------------------------------------------------- ESCAPE
{
id: "ford-escape-oil-change",
vehicleId: "2021-ford-escape-1.5l",
title: "Engine Oil & Filter Change",
jobType: "oil-change",
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
  {
    id: "ford-explorer-oil-change",
    vehicleId: "2021-ford-explorer-2.3l",
    title: "Engine Oil & Filter Change",
    jobType: "oil-change",
    summary: "Drain-and-refill oil service for the 2.3L EcoBoost turbo four, with its cartridge-style oil filter.",
    difficulty: "Easy",
    tier: "free",
    estTime: "45-60 min",
    tools: [
      { name: "Oil filter housing wrench", note: "Cartridge cap, same style used across Ford's EcoBoost lineup" },
      { name: "Socket set + ratchet", note: "For drain plug and under-shield fasteners" },
      { name: "Torque wrench", note: "Range covering 15-25 ft-lb" },
      { name: "Drain pan", note: "6+ qt capacity" },
      { name: "Funnel" },
      { name: "Jack + 2 jack stands or drive-up ramps" },
      { name: "Nitrile gloves + safety glasses" },
      ],
    parts: [
      "5.7 qt (5.4 L) 5W-30 full-synthetic engine oil",
      "Motorcraft (or equivalent) cartridge oil filter element + housing O-ring",
      "Drain plug crush washer (replace if not self-sealing)",
      ],
    safety: [
      "Let a hot engine cool for 10-15 min before draining -- hot oil causes burns.",
      "Use jack stands rated for the vehicle's weight; never work under a vehicle held only by a jack.",
      "Used oil and filters are hazardous waste -- take them to a recycling/auto parts drop-off, never pour down a drain.",
      ],
    torqueSpecs: [
      {
        fastener: "Oil pan drain plug",
        value: "20 ft-lb (27 Nm)",
        notes: "Use new crush washer. Curated reference figure -- not yet pulled from Open Labor Project for this vehicle.",
      },
      {
        fastener: "Oil filter housing cap",
        value: "18 ft-lb (24 Nm)",
        notes: "Housing is plastic -- do not overtighten, snug + spec torque only. Curated reference figure.",
      },
      ],
    steps: [
      {
        number: 1,
        title: "Warm the engine briefly, then park and secure",
        instructions: "Run the engine for 2-3 minutes so the oil flows more easily, then shut it off. Park on level ground, set the parking brake, and chock the wheels.",
        image: "/steps/generic-park-secure.svg",
      },
      {
        number: 2,
        title: "Raise the vehicle and remove the under-engine shield",
        instructions: "Support the vehicle on jack stands at the factory lift points. Remove the plastic under-engine shield if equipped -- it's held by a mix of push-pin fasteners and bolts along its edge.",
        image: "/steps/generic-raise-vehicle.svg",
        warning: "Confirm the vehicle is stable on the stands before reaching underneath.",
      },
      {
        number: 3,
        title: "Drain the old oil",
        instructions: "Position the drain pan under the oil pan's drain plug. Loosen the plug with a socket, then finish removing it by hand and let the oil fully drain.",
        image: "/steps/oil-drain.svg",
      },
      {
        number: 4,
        title: "Remove and replace the oil filter cartridge",
        instructions: "The filter housing cap is on top of the engine. Unscrew it counterclockwise with the housing wrench, lift out the old filter element, and let residual oil drain from the housing before wiping it clean.",
        image: "/steps/oil-filter-cartridge.svg",
        torque: [{ fastener: "Oil filter housing cap", value: "18 ft-lb (24 Nm)" }],
      },
      {
        number: 5,
        title: "Install the new filter and reassemble",
        instructions: "Fit the new filter element into the cap, lightly oil the new O-ring, and thread the cap back in by hand before torquing it. Reinstall the drain plug with a new crush washer and torque it to spec.",
        image: "/steps/oil-filter-install.svg",
        torque: [{ fastener: "Oil filter housing cap", value: "18 ft-lb (24 Nm)" }, { fastener: "Oil pan drain plug", value: "20 ft-lb (27 Nm)" }],
      },
      {
        number: 6,
        title: "Reinstall the under-shield and lower the vehicle",
        instructions: "Reattach the under-engine shield fasteners (if removed) and carefully lower the vehicle back to the ground.",
        image: "/steps/generic-lower-vehicle.svg",
      },
      {
        number: 7,
        title: "Refill and check",
        instructions: "Remove the oil fill cap on the valve cover and add oil in stages, checking the dipstick as you approach 5.7 qt. Start the engine, let it run ~30 seconds, shut it off, and check under the vehicle for leaks at the drain plug and filter cap.",
        image: "/steps/oil-fill-check.svg",
      },
      {
        number: 8,
        title: "Final level check and oil-life reset",
        instructions: "Wait a few minutes for oil to settle, recheck the dipstick, and top off if needed. Reset the oil-life monitor via the dash Information menu (Oil Change Required > Reset). Dispose of the old oil and filter at a recycling center.",
        image: "/steps/generic-cleanup.svg",
      },
      ],
  },
  {
    id: "ford-f250-superduty-oil-change",
    vehicleId: "2020-ford-f250-super-duty-6.7l",
    title: "Engine Oil & Filter Change",
    jobType: "oil-change",
    summary: "Drain-and-refill oil service for the 6.7L Power Stroke V8 turbo diesel, with its cartridge-style oil filter. Covers engine oil only -- fuel filters and DEF are separate services.",
    difficulty: "Moderate",
    tier: "free",
    estTime: "60-75 min",
    tools: [
      { name: "Oil filter housing wrench", note: "Cartridge cap, same family as other Ford diesel/EcoBoost filter housings" },
      { name: "Socket set + ratchet", note: "For drain plug and under-shield fasteners" },
      { name: "Torque wrench", note: "Range covering 15-40 ft-lb" },
      { name: "Large drain pan", note: "15+ qt capacity" },
      { name: "Funnel with extension", note: "Truck ride height makes reach longer" },
      { name: "Jack + 2 jack stands rated for the truck's weight, or drive-up ramps" },
      { name: "Nitrile gloves + safety glasses" },
    ],
    parts: [
      "13.0 qt (12.3 L) 10W-30 full-synthetic diesel engine oil",
      "Motorcraft (or equivalent) cartridge oil filter element + housing O-ring",
      "Drain plug gasket",
    ],
    safety: [
      "Let a hot engine cool 10-15 min before draining -- diesel oil runs hot, especially after towing.",
      "Use jack stands rated for the truck's weight; Super Duty frame lift points differ from a light-duty truck -- use the owner's manual's points.",
      "Recycle used oil and the filter -- don't pour it down a drain.",
      "Do not confuse the DEF fill neck with the diesel fuel or oil fill -- check the cap label before adding anything.",
    ],
    torqueSpecs: [
      {
        fastener: "Oil pan drain plug",
        value: "25 ft-lb (34 Nm)",
        notes: "Use new crush washer.",
        provenance: { source: "open-labor-project", confidence: "high" },
      },
      {
        fastener: "Oil filter housing cap",
        value: "18 ft-lb (25 Nm)",
        notes: "Housing is plastic -- do not overtighten, snug + spec torque only.",
        provenance: { source: "open-labor-project", confidence: "high" },
      },
    ],
    steps: [
      {
        number: 1,
        title: "Warm the engine briefly, then park and secure",
        instructions: "Run the engine for 2-3 minutes so the oil flows more easily, then shut it off. Park on level ground, set the parking brake, and chock the wheels.",
        image: "/steps/generic-park-secure.svg",
      },
      {
        number: 2,
        title: "Raise the vehicle and remove the under-engine shield",
        instructions: "Support the truck on jack stands at the frame's rated lift points -- Super Duty pinch points differ from a light-duty pickup, so use the owner's manual. Remove the under-engine shield if equipped.",
        image: "/steps/generic-raise-vehicle.svg",
        warning: "Confirm the truck is stable on the stands before reaching underneath -- this is a heavy vehicle even before towing gear is added.",
      },
      {
        number: 3,
        title: "Drain the old oil",
        instructions: "Position the large drain pan under the oil pan's drain plug, loosen it with a socket, then finish removing it by hand and let the oil fully drain -- it holds 13 quarts, so give it time.",
        image: "/steps/oil-drain.svg",
      },
      {
        number: 4,
        title: "Remove and replace the oil filter cartridge",
        instructions: "The filter housing cap is on the front of the engine. Unscrew it counterclockwise with the housing wrench, lift out the old filter element, and let the housing drain before wiping it clean.",
        image: "/steps/oil-filter-cartridge.svg",
        torque: [{ fastener: "Oil filter housing cap", value: "18 ft-lb (25 Nm)" }],
      },
      {
        number: 5,
        title: "Install the new filter and drain plug",
        instructions: "Fit the new element into the cap, lightly oil the new O-ring, thread the cap in by hand, then torque it. Reinstall the drain plug with a new gasket and torque it to spec.",
        image: "/steps/oil-filter-install.svg",
        torque: [{ fastener: "Oil filter housing cap", value: "18 ft-lb (25 Nm)" }, { fastener: "Oil pan drain plug", value: "25 ft-lb (34 Nm)" }],
      },
      {
        number: 6,
        title: "Reinstall the under-shield and lower the vehicle",
        instructions: "Reattach the under-engine shield fasteners (if removed) and carefully lower the truck.",
        image: "/steps/generic-lower-vehicle.svg",
      },
      {
        number: 7,
        title: "Refill and check for leaks",
        instructions: "Add oil through the valve cover fill cap in stages, checking the dipstick as you approach 13.0 qt -- it takes a while to settle between additions on a sump this size. Start the engine briefly, shut it off, and check underneath for leaks. Double-check you added oil to the oil fill, not DEF to the wrong tank.",
        image: "/steps/oil-fill-check.svg",
      },
      {
        number: 8,
        title: "Final check and oil-life reset",
        instructions: "Recheck the dipstick after a few minutes and top off if needed. Reset the oil-life monitor via the dash menu, then recycle the old oil and filter.",
        image: "/steps/generic-cleanup.svg",
      },
    ],
  },
  {
    id: "toyota-rav4-oil-change",
    vehicleId: "2021-toyota-rav4-2.5l",
    title: "Engine Oil & Filter Change",
    jobType: "oil-change",
    summary: "Drain-and-refill oil service for the 2.5L Dynamic Force I4, with its cartridge-style oil filter.",
    difficulty: "Easy",
    tier: "free",
    estTime: "40-55 min",
    tools: [
      { name: "Oil filter housing wrench", note: "Cartridge cap" },
      { name: "Socket set + ratchet", note: "For drain plug and under-shield fasteners" },
      { name: "Torque wrench", note: "Range covering 15-25 ft-lb" },
      { name: "Drain pan", note: "6+ qt capacity" },
      { name: "Funnel" },
      { name: "Jack + 2 jack stands or drive-up ramps" },
      { name: "Nitrile gloves + safety glasses" },
    ],
    parts: [
      "4.6 qt (4.4 L) 0W-16 full-synthetic engine oil",
      "Toyota (or equivalent) cartridge oil filter element + housing O-ring",
      "Drain plug gasket",
    ],
    safety: [
      "Let a hot engine cool for 10-15 min before draining -- hot oil causes burns.",
      "Use jack stands rated for the vehicle's weight; never work under a vehicle held only by a jack.",
      "Used oil and filters are hazardous waste -- take them to a recycling/auto parts drop-off, never pour down a drain.",
    ],
    torqueSpecs: [
      {
        fastener: "Oil pan drain plug",
        value: "30 ft-lb (40 Nm)",
        notes: "Use new crush washer.",
        provenance: { source: "open-labor-project", confidence: "high" },
      },
      {
        fastener: "Oil filter housing cap",
        value: "18 ft-lb (25 Nm)",
        notes: "Housing is plastic -- do not overtighten, snug + spec torque only. For cartridge-type filters.",
        provenance: { source: "open-labor-project", confidence: "high" },
      },
    ],
    steps: [
      {
        number: 1,
        title: "Warm the engine briefly, then park and secure",
        instructions: "Run the engine for 2-3 minutes so the oil flows more easily, then shut it off. Park on level ground, set the parking brake, and chock the wheels.",
        image: "/steps/generic-park-secure.svg",
      },
      {
        number: 2,
        title: "Raise the vehicle and remove the under-engine shield",
        instructions: "Support the vehicle on jack stands at the factory lift points. Remove the plastic under-engine shield -- it's held by a mix of push-pin fasteners and bolts along its edge.",
        image: "/steps/generic-raise-vehicle.svg",
        warning: "Confirm the vehicle is stable on the stands before reaching underneath.",
      },
      {
        number: 3,
        title: "Drain the old oil",
        instructions: "Position the drain pan under the oil pan's drain plug. Loosen the plug with a socket, then finish removing it by hand and let the oil fully drain.",
        image: "/steps/oil-drain.svg",
      },
      {
        number: 4,
        title: "Remove and replace the oil filter cartridge",
        instructions: "The filter housing cap is on top of the engine. Unscrew it counterclockwise with the housing wrench, lift out the old filter element, and let residual oil drain from the housing before wiping it clean.",
        image: "/steps/oil-filter-cartridge.svg",
        torque: [{ fastener: "Oil filter housing cap", value: "18 ft-lb (25 Nm)" }],
      },
      {
        number: 5,
        title: "Install the new filter and reassemble",
        instructions: "Fit the new filter element into the cap, lightly oil the new O-ring, and thread the cap back in by hand before torquing it. Reinstall the drain plug with a new gasket and torque it to spec.",
        image: "/steps/oil-filter-install.svg",
        torque: [{ fastener: "Oil filter housing cap", value: "18 ft-lb (25 Nm)" }, { fastener: "Oil pan drain plug", value: "30 ft-lb (40 Nm)" }],
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
        instructions: "Remove the oil fill cap and add oil in stages, checking the dipstick as you approach 4.6 qt. Start the engine, let it run ~30 seconds, shut it off, and check under the vehicle for leaks.",
        image: "/steps/oil-fill-check.svg",
      },
      {
        number: 8,
        title: "Final level check and oil-life reset",
        instructions: "Wait a few minutes for oil to settle, recheck the dipstick, and top off if needed. Reset the maintenance reminder via the dash menu. Dispose of the old oil and filter at a recycling center.",
        image: "/steps/generic-cleanup.svg",
      },
    ],
  },
  {
    id: "honda-crv-oil-change",
    vehicleId: "2021-honda-crv-1.5l",
    title: "Engine Oil & Filter Change",
    jobType: "oil-change",
    summary: "Drain-and-refill oil service for the 1.5L turbo four, with a spin-on oil filter.",
    difficulty: "Easy",
    tier: "free",
    estTime: "30-45 min",
    tools: [
      { name: "Socket set + ratchet", note: "Drain plug" },
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
      "Drain plug sealing washer (replace each service)",
    ],
    safety: [
      "Let a hot engine cool 10-15 min before draining.",
      "Never work under a vehicle supported only by a jack -- use jack stands.",
      "Recycle used oil and the filter at an auto parts store or recycling center.",
    ],
    torqueSpecs: [
      {
        fastener: "Oil pan drain plug",
        value: "29 ft-lb (39 Nm)",
        notes: "Use new crush washer.",
        provenance: { source: "open-labor-project", confidence: "high" },
      },
      {
        fastener: "Spin-on oil filter",
        value: "16 ft-lb (22 Nm)",
        notes: "Hand tight plus 3/4 turn past gasket contact, per Open Labor Project. Follow the filter's own printed instructions if they differ.",
        provenance: { source: "open-labor-project", confidence: "high" },
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
        title: "Raise the vehicle and remove the engine undercover",
        instructions: "Support the vehicle on jack stands and remove the plastic engine undercover (a row of bolts/clips along its edge).",
        image: "/steps/generic-raise-vehicle.svg",
      },
      {
        number: 3,
        title: "Drain the oil",
        instructions: "Place the drain pan under the drain plug, loosen it, then remove it by hand and let the oil fully drain.",
        image: "/steps/oil-drain.svg",
      },
      {
        number: 4,
        title: "Remove the old filter",
        instructions: "Locate the spin-on filter near the front of the engine block. Use the filter wrench to break it loose, then unscrew it by hand -- have the drain pan positioned underneath, it will spill some oil.",
        image: "/steps/oil-filter-spinon-remove.svg",
      },
      {
        number: 5,
        title: "Install the new filter and drain plug",
        instructions: "Wipe the mounting surface clean, lightly oil the new filter's gasket, and spin it on by hand until snug plus the additional turn specified on the filter. Reinstall the drain plug with a new sealing washer and torque it to spec.",
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
        instructions: "Add oil through the valve cover fill cap in stages, checking the dipstick as you approach 3.7 qt. Start the engine briefly, shut it off, and check the drain plug and filter for leaks.",
        image: "/steps/oil-fill-check.svg",
      },
      {
        number: 8,
        title: "Final check and Maintenance Minder reset",
        instructions: "Recheck the dipstick after a few minutes and top off if needed. Reset the Maintenance Minder via the dash button sequence, then recycle the old oil and filter.",
        image: "/steps/generic-cleanup.svg",
      },
    ],
  },
  {
    id: "ram-1500-oil-change",
    vehicleId: "2021-ram-1500-5.7l",
    title: "Engine Oil & Filter Change",
    jobType: "oil-change",
    summary: "Drain-and-refill oil service for the 5.7L HEMI V8, with its cartridge-style oil filter.",
    difficulty: "Moderate",
    tier: "free",
    estTime: "45-60 min",
    tools: [
      { name: "Oil filter housing wrench", note: "Cartridge cap" },
      { name: "Socket set + ratchet", note: "For drain plug and under-shield fasteners" },
      { name: "Torque wrench", note: "Range covering 15-30 ft-lb" },
      { name: "Large drain pan", note: "8+ qt capacity" },
      { name: "Funnel with extension", note: "Truck ride height makes reach longer" },
      { name: "Jack + 2 jack stands rated for the truck's weight" },
      { name: "Nitrile gloves + safety glasses" },
    ],
    parts: [
      "6.0 qt (5.7 L) 0W-20 full-synthetic engine oil",
      "Mopar (or equivalent) cartridge oil filter element + housing O-ring",
      "Drain plug gasket",
    ],
    safety: [
      "Let a hot engine cool 10-15 min before draining.",
      "Use jack stands rated for the truck's weight; use the owner's manual's lift points.",
      "Recycle used oil and the filter -- don't pour it down a drain.",
    ],
    torqueSpecs: [
      {
        fastener: "Oil pan drain plug",
        value: "20 ft-lb (27 Nm)",
        notes: "Use new crush washer.",
        provenance: { source: "open-labor-project", confidence: "high" },
      },
      {
        fastener: "Oil filter housing cap",
        value: "18 ft-lb (25 Nm)",
        notes: "Housing is plastic -- do not overtighten, snug + spec torque only.",
        provenance: { source: "open-labor-project", confidence: "high" },
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
        instructions: "Support the truck on jack stands at the frame's rated lift points.",
        image: "/steps/generic-raise-vehicle.svg",
      },
      {
        number: 3,
        title: "Drain the oil",
        instructions: "Position the large drain pan under the drain plug, loosen it, then remove it by hand and let the oil fully drain.",
        image: "/steps/oil-drain.svg",
      },
      {
        number: 4,
        title: "Remove and replace the oil filter cartridge",
        instructions: "The filter housing cap is on the front of the engine. Unscrew it counterclockwise with the housing wrench, lift out the old element, and let the housing drain before wiping it clean.",
        image: "/steps/oil-filter-cartridge.svg",
        torque: [{ fastener: "Oil filter housing cap", value: "18 ft-lb (25 Nm)" }],
      },
      {
        number: 5,
        title: "Install the new filter and drain plug",
        instructions: "Fit the new element into the cap, lightly oil the new O-ring, thread the cap in by hand, then torque it. Reinstall the drain plug with a new gasket and torque it to spec.",
        image: "/steps/oil-filter-install.svg",
        torque: [{ fastener: "Oil filter housing cap", value: "18 ft-lb (25 Nm)" }, { fastener: "Oil pan drain plug", value: "20 ft-lb (27 Nm)" }],
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
        instructions: "Add oil through the valve cover fill cap in stages, checking the dipstick as you approach 6.0 qt. Start the engine briefly, shut it off, and check underneath for leaks.",
        image: "/steps/oil-fill-check.svg",
      },
      {
        number: 8,
        title: "Final check and oil-life reset",
        instructions: "Recheck the dipstick after a few minutes and top off if needed. Reset the oil-life monitor via the dash menu, then recycle the old oil and filter.",
        image: "/steps/generic-cleanup.svg",
      },
    ],
  },
  {
    id: "chevrolet-equinox-oil-change",
    vehicleId: "2021-chevrolet-equinox-1.5l",
    title: "Engine Oil & Filter Change",
    jobType: "oil-change",
    summary: "Drain-and-refill oil service for the 1.5L turbo four, with a spin-on oil filter.",
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
      "ACDelco (or equivalent) spin-on oil filter",
      "Drain plug crush washer (replace each service)",
    ],
    safety: [
      "Let a hot engine cool for 10-15 min before draining -- hot oil causes burns.",
      "Use jack stands rated for the vehicle's weight; never work under a vehicle held only by a jack.",
      "Used oil and filters are hazardous waste -- take them to a recycling/auto parts drop-off, never pour down a drain.",
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
        value: "Hand-tighten per filter instructions (typically 3/4 turn past gasket contact)",
        notes: "Don't use a torque wrench on a spin-on filter -- follow the printed instructions on the filter itself.",
      },
    ],
    steps: [
      {
        number: 1,
        title: "Warm the engine briefly, then park and secure",
        instructions: "Run the engine for 2-3 minutes so the oil flows more easily, then shut it off. Park on level ground, set the parking brake, and chock the rear wheels.",
        image: "/steps/generic-park-secure.svg",
      },
      {
        number: 2,
        title: "Raise the vehicle and remove the under-engine shield",
        instructions: "Jack up the front of the vehicle at the factory jack points and support it on jack stands. Remove the plastic under-engine shield if equipped.",
        image: "/steps/generic-raise-vehicle.svg",
        warning: "Confirm the vehicle is stable on the stands before reaching underneath.",
      },
      {
        number: 3,
        title: "Drain the old oil",
        instructions: "Position the drain pan under the oil pan's drain plug. Loosen the plug with a socket, then finish removing it by hand and let the oil fully drain.",
        image: "/steps/oil-drain.svg",
      },
      {
        number: 4,
        title: "Remove the old filter",
        instructions: "Locate the spin-on filter near the front of the engine block. Use the filter wrench to break it loose, then unscrew it by hand -- have the drain pan positioned underneath, it will spill some oil.",
        image: "/steps/oil-filter-spinon-remove.svg",
      },
      {
        number: 5,
        title: "Install the new filter and drain plug",
        instructions: "Wipe the mounting surface clean, lightly oil the new filter's gasket, and spin it on by hand until snug plus the additional turn specified on the filter. Reinstall the drain plug with a new crush washer and torque it to spec.",
        image: "/steps/oil-filter-install.svg",
        torque: [{ fastener: "Oil pan drain plug", value: "18 ft-lb (25 Nm)" }],
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
        instructions: "Remove the oil fill cap on the valve cover and add oil in stages, checking the dipstick as you approach 5.7 qt. Start the engine, let it run ~30 seconds, shut it off, and check under the vehicle for leaks.",
        image: "/steps/oil-fill-check.svg",
      },
      {
        number: 8,
        title: "Final level check and oil-life reset",
        instructions: "Wait a few minutes for oil to settle, recheck the dipstick, and top off if needed. Reset the oil-life system via the dash Information menu. Dispose of the old oil and filter at a recycling center.",
        image: "/steps/generic-cleanup.svg",
      },
    ],
  },
  {
    id: "toyota-camry-oil-change",
    vehicleId: "2021-toyota-camry-2.5l",
    title: "Engine Oil & Filter Change",
    jobType: "oil-change",
    summary: "Drain-and-refill oil service for the 2.5L Dynamic Force I4, with its cartridge-style oil filter.",
    difficulty: "Easy",
    tier: "free",
    estTime: "40-55 min",
    tools: [
      { name: "Oil filter housing wrench", note: "Cartridge cap, same family as the RAV4 in this file" },
      { name: "Socket set + ratchet", note: "For drain plug and under-shield fasteners" },
      { name: "Torque wrench", note: "Range covering 15-25 ft-lb" },
      { name: "Drain pan", note: "6+ qt capacity" },
      { name: "Funnel" },
      { name: "Jack + 2 jack stands or drive-up ramps" },
      { name: "Nitrile gloves + safety glasses" },
    ],
    parts: [
      "4.6 qt (4.4 L) 0W-16 full-synthetic engine oil",
      "Toyota (or equivalent) cartridge oil filter element + housing O-ring",
      "Drain plug gasket",
    ],
    safety: [
      "Let a hot engine cool for 10-15 min before draining -- hot oil causes burns.",
      "Use jack stands rated for the vehicle's weight; never work under a vehicle held only by a jack.",
      "Used oil and filters are hazardous waste -- take them to a recycling/auto parts drop-off, never pour down a drain.",
    ],
    torqueSpecs: [
      {
        fastener: "Oil pan drain plug",
        value: "30 ft-lb (40 Nm)",
        notes: "Use new crush washer.",
        provenance: { source: "open-labor-project", confidence: "high" },
      },
      {
        fastener: "Oil filter housing cap",
        value: "18 ft-lb (25 Nm)",
        notes: "Housing is plastic -- do not overtighten, snug + spec torque only.",
        provenance: { source: "open-labor-project", confidence: "high" },
      },
    ],
    steps: [
      {
        number: 1,
        title: "Warm the engine briefly, then park and secure",
        instructions: "Run the engine for 2-3 minutes so the oil flows more easily, then shut it off. Park on level ground, set the parking brake, and chock the wheels.",
        image: "/steps/generic-park-secure.svg",
      },
      {
        number: 2,
        title: "Raise the vehicle and remove the under-engine shield",
        instructions: "Support the vehicle on jack stands at the factory lift points. Remove the plastic under-engine shield -- it's held by a mix of push-pin fasteners and bolts along its edge.",
        image: "/steps/generic-raise-vehicle.svg",
        warning: "Confirm the vehicle is stable on the stands before reaching underneath.",
      },
      {
        number: 3,
        title: "Drain the old oil",
        instructions: "Position the drain pan under the oil pan's drain plug. Loosen the plug with a socket, then finish removing it by hand and let the oil fully drain.",
        image: "/steps/oil-drain.svg",
      },
      {
        number: 4,
        title: "Remove and replace the oil filter cartridge",
        instructions: "The filter housing cap is on top of the engine. Unscrew it counterclockwise with the housing wrench, lift out the old filter element, and let residual oil drain from the housing before wiping it clean.",
        image: "/steps/oil-filter-cartridge.svg",
        torque: [{ fastener: "Oil filter housing cap", value: "18 ft-lb (25 Nm)" }],
      },
      {
        number: 5,
        title: "Install the new filter and reassemble",
        instructions: "Fit the new filter element into the cap, lightly oil the new O-ring, and thread the cap back in by hand before torquing it. Reinstall the drain plug with a new gasket and torque it to spec.",
        image: "/steps/oil-filter-install.svg",
        torque: [{ fastener: "Oil filter housing cap", value: "18 ft-lb (25 Nm)" }, { fastener: "Oil pan drain plug", value: "30 ft-lb (40 Nm)" }],
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
        instructions: "Remove the oil fill cap and add oil in stages, checking the dipstick as you approach 4.6 qt. Start the engine, let it run ~30 seconds, shut it off, and check under the vehicle for leaks.",
        image: "/steps/oil-fill-check.svg",
      },
      {
        number: 8,
        title: "Final level check and oil-life reset",
        instructions: "Wait a few minutes for oil to settle, recheck the dipstick, and top off if needed. Reset the maintenance reminder via the dash menu. Dispose of the old oil and filter at a recycling center.",
        image: "/steps/generic-cleanup.svg",
      },
    ],
  },
  {
    id: "toyota-tacoma-oil-change",
    vehicleId: "2021-toyota-tacoma-3.5l",
    title: "Engine Oil & Filter Change",
    jobType: "oil-change",
    summary: "Drain-and-refill oil service for the 3.5L V6, with its cartridge-style oil filter.",
    difficulty: "Moderate",
    tier: "free",
    estTime: "45-60 min",
    tools: [
      { name: "Oil filter housing wrench", note: "Cartridge cap" },
      { name: "Socket set + ratchet", note: "For drain plug and under-shield fasteners" },
      { name: "Torque wrench", note: "Range covering 15-30 ft-lb" },
      { name: "Large drain pan", note: "8+ qt capacity" },
      { name: "Funnel with extension", note: "Truck ride height makes reach longer" },
      { name: "Jack + 2 jack stands or drive-up ramps" },
      { name: "Nitrile gloves + safety glasses" },
    ],
    parts: [
      "6.2 qt (5.9 L) 0W-20 full-synthetic engine oil",
      "Toyota (or equivalent) cartridge oil filter element + housing O-ring",
      "Drain plug gasket",
    ],
    safety: [
      "Let a hot engine cool 10-15 min before draining.",
      "Use jack stands rated for the truck's weight; the frame lift points differ from a car -- use the owner's manual.",
      "Recycle used oil and the filter -- don't pour it down a drain.",
    ],
    torqueSpecs: [
      {
        fastener: "Oil pan drain plug",
        value: "29 ft-lb (39 Nm)",
        notes: "Curated reference figure -- not yet pulled from Open Labor Project for this vehicle.",
      },
      {
        fastener: "Oil filter housing cap",
        value: "18 ft-lb (25 Nm)",
        notes: "Housing is plastic -- do not overtighten, snug + spec torque only. Curated reference figure.",
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
        instructions: "Support the truck on jack stands at the frame's rated lift points.",
        image: "/steps/generic-raise-vehicle.svg",
      },
      {
        number: 3,
        title: "Drain the oil",
        instructions: "Position the large drain pan under the drain plug, loosen it, then remove it by hand and let the oil fully drain.",
        image: "/steps/oil-drain.svg",
      },
      {
        number: 4,
        title: "Remove and replace the oil filter cartridge",
        instructions: "The filter housing cap is on the front of the engine. Unscrew it counterclockwise with the housing wrench, lift out the old element, and let the housing drain before wiping it clean.",
        image: "/steps/oil-filter-cartridge.svg",
        torque: [{ fastener: "Oil filter housing cap", value: "18 ft-lb (25 Nm)" }],
      },
      {
        number: 5,
        title: "Install the new filter and drain plug",
        instructions: "Fit the new element into the cap, lightly oil the new O-ring, thread the cap in by hand, then torque it. Reinstall the drain plug with a new gasket and torque it to spec.",
        image: "/steps/oil-filter-install.svg",
        torque: [{ fastener: "Oil filter housing cap", value: "18 ft-lb (25 Nm)" }, { fastener: "Oil pan drain plug", value: "29 ft-lb (39 Nm)" }],
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
        instructions: "Add oil through the valve cover fill cap in stages, checking the dipstick as you approach 6.2 qt. Start the engine briefly, shut it off, and check underneath for leaks.",
        image: "/steps/oil-fill-check.svg",
      },
      {
        number: 8,
        title: "Final check and oil-life reset",
        instructions: "Recheck the dipstick after a few minutes and top off if needed. Reset the maintenance reminder via the dash menu, then recycle the old oil and filter.",
        image: "/steps/generic-cleanup.svg",
      },
    ],
  },
  {
    id: "toyota-corolla-oil-change",
    vehicleId: "2021-toyota-corolla-2.0l",
    title: "Engine Oil & Filter Change",
    jobType: "oil-change",
    summary: "Drain-and-refill oil service for the 2.0L Dynamic Force I4, with its cartridge-style oil filter.",
    difficulty: "Easy",
    tier: "free",
    estTime: "35-50 min",
    tools: [
      { name: "Oil filter housing wrench", note: "Cartridge cap, same family as the RAV4/Camry in this file" },
      { name: "Socket set + ratchet", note: "For drain plug and under-shield fasteners" },
      { name: "Torque wrench", note: "Range covering 15-25 ft-lb" },
      { name: "Drain pan", note: "6+ qt capacity" },
      { name: "Funnel" },
      { name: "Jack + 2 jack stands or drive-up ramps" },
      { name: "Nitrile gloves + safety glasses" },
    ],
    parts: [
      "4.4 qt (4.2 L) 0W-16 full-synthetic engine oil",
      "Toyota (or equivalent) cartridge oil filter element + housing O-ring",
      "Drain plug gasket",
    ],
    safety: [
      "Let a hot engine cool for 10-15 min before draining -- hot oil causes burns.",
      "Use jack stands rated for the vehicle's weight; never work under a vehicle held only by a jack.",
      "Used oil and filters are hazardous waste -- take them to a recycling/auto parts drop-off, never pour down a drain.",
    ],
    torqueSpecs: [
      {
        fastener: "Oil pan drain plug",
        value: "22 ft-lb (30 Nm)",
        notes: "Curated reference figure -- not yet pulled from Open Labor Project for this vehicle.",
      },
      {
        fastener: "Oil filter housing cap",
        value: "18 ft-lb (25 Nm)",
        notes: "Housing is plastic -- do not overtighten, snug + spec torque only. Curated reference figure.",
      },
    ],
    steps: [
      {
        number: 1,
        title: "Warm the engine briefly, then park and secure",
        instructions: "Run the engine for 2-3 minutes so the oil flows more easily, then shut it off. Park on level ground, set the parking brake, and chock the wheels.",
        image: "/steps/generic-park-secure.svg",
      },
      {
        number: 2,
        title: "Raise the vehicle and remove the under-engine shield",
        instructions: "Support the vehicle on jack stands at the factory lift points. Remove the plastic under-engine shield -- it's held by a mix of push-pin fasteners and bolts along its edge.",
        image: "/steps/generic-raise-vehicle.svg",
        warning: "Confirm the vehicle is stable on the stands before reaching underneath.",
      },
      {
        number: 3,
        title: "Drain the old oil",
        instructions: "Position the drain pan under the oil pan's drain plug. Loosen the plug with a socket, then finish removing it by hand and let the oil fully drain.",
        image: "/steps/oil-drain.svg",
      },
      {
        number: 4,
        title: "Remove and replace the oil filter cartridge",
        instructions: "The filter housing cap is on top of the engine. Unscrew it counterclockwise with the housing wrench, lift out the old filter element, and let residual oil drain from the housing before wiping it clean.",
        image: "/steps/oil-filter-cartridge.svg",
        torque: [{ fastener: "Oil filter housing cap", value: "18 ft-lb (25 Nm)" }],
      },
      {
        number: 5,
        title: "Install the new filter and reassemble",
        instructions: "Fit the new filter element into the cap, lightly oil the new O-ring, and thread the cap back in by hand before torquing it. Reinstall the drain plug with a new gasket and torque it to spec.",
        image: "/steps/oil-filter-install.svg",
        torque: [{ fastener: "Oil filter housing cap", value: "18 ft-lb (25 Nm)" }, { fastener: "Oil pan drain plug", value: "22 ft-lb (30 Nm)" }],
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
        instructions: "Remove the oil fill cap and add oil in stages, checking the dipstick as you approach 4.4 qt. Start the engine, let it run ~30 seconds, shut it off, and check under the vehicle for leaks.",
        image: "/steps/oil-fill-check.svg",
      },
      {
        number: 8,
        title: "Final level check and oil-life reset",
        instructions: "Wait a few minutes for oil to settle, recheck the dipstick, and top off if needed. Reset the maintenance reminder via the dash menu. Dispose of the old oil and filter at a recycling center.",
        image: "/steps/generic-cleanup.svg",
      },
    ],
  },
  {
    id: "ford-bronco-oil-change",
    vehicleId: "2021-ford-bronco-2.3l",
    title: "Engine Oil & Filter Change",
    jobType: "oil-change",
    summary: "Drain-and-refill oil service for the 2.3L EcoBoost turbo four, with its cartridge-style oil filter.",
    difficulty: "Easy",
    tier: "free",
    estTime: "45-60 min",
    tools: [
      { name: "Oil filter housing wrench", note: "Cartridge cap, same style used across Ford's EcoBoost lineup" },
      { name: "Socket set + ratchet", note: "For drain plug and under-shield fasteners" },
      { name: "Torque wrench", note: "Range covering 15-25 ft-lb" },
      { name: "Drain pan", note: "6+ qt capacity" },
      { name: "Funnel" },
      { name: "Jack + 2 jack stands or drive-up ramps" },
      { name: "Nitrile gloves + safety glasses" },
    ],
    parts: [
      "5.7 qt (5.4 L) 5W-30 full-synthetic engine oil",
      "Motorcraft (or equivalent) cartridge oil filter element + housing O-ring",
      "Drain plug crush washer (replace if not self-sealing)",
    ],
    safety: [
      "Let a hot engine cool for 10-15 min before draining -- hot oil causes burns.",
      "Use jack stands rated for the vehicle's weight; never work under a vehicle held only by a jack.",
      "Used oil and filters are hazardous waste -- take them to a recycling/auto parts drop-off, never pour down a drain.",
    ],
    torqueSpecs: [
      {
        fastener: "Oil pan drain plug",
        value: "20 ft-lb (27 Nm)",
        notes: "Curated reference figure -- not yet pulled from Open Labor Project for this vehicle.",
      },
      {
        fastener: "Oil filter housing cap",
        value: "18 ft-lb (24 Nm)",
        notes: "Housing is plastic -- do not overtighten, snug + spec torque only. Curated reference figure.",
      },
    ],
    steps: [
      {
        number: 1,
        title: "Warm the engine briefly, then park and secure",
        instructions: "Run the engine for 2-3 minutes so the oil flows more easily, then shut it off. Park on level ground, set the parking brake, and chock the wheels.",
        image: "/steps/generic-park-secure.svg",
      },
      {
        number: 2,
        title: "Raise the vehicle and remove the under-engine shield",
        instructions: "Support the vehicle on jack stands at the factory lift points. Remove the plastic under-engine shield if equipped.",
        image: "/steps/generic-raise-vehicle.svg",
        warning: "Confirm the vehicle is stable on the stands before reaching underneath -- this is a heavy, high-riding vehicle.",
      },
      {
        number: 3,
        title: "Drain the old oil",
        instructions: "Position the drain pan under the oil pan's drain plug. Loosen the plug with a socket, then finish removing it by hand and let the oil fully drain.",
        image: "/steps/oil-drain.svg",
      },
      {
        number: 4,
        title: "Remove and replace the oil filter cartridge",
        instructions: "The filter housing cap is on top of the engine. Unscrew it counterclockwise with the housing wrench, lift out the old filter element, and let residual oil drain from the housing before wiping it clean.",
        image: "/steps/oil-filter-cartridge.svg",
        torque: [{ fastener: "Oil filter housing cap", value: "18 ft-lb (24 Nm)" }],
      },
      {
        number: 5,
        title: "Install the new filter and reassemble",
        instructions: "Fit the new filter element into the cap, lightly oil the new O-ring, and thread the cap back in by hand before torquing it. Reinstall the drain plug with a new crush washer and torque it to spec.",
        image: "/steps/oil-filter-install.svg",
        torque: [{ fastener: "Oil filter housing cap", value: "18 ft-lb (24 Nm)" }, { fastener: "Oil pan drain plug", value: "20 ft-lb (27 Nm)" }],
      },
      {
        number: 6,
        title: "Reinstall the under-shield and lower the vehicle",
        instructions: "Reattach the under-engine shield fasteners (if removed) and carefully lower the vehicle back to the ground.",
        image: "/steps/generic-lower-vehicle.svg",
      },
      {
        number: 7,
        title: "Refill and check",
        instructions: "Remove the oil fill cap and add oil in stages, checking the dipstick as you approach 5.7 qt. Start the engine, let it run ~30 seconds, shut it off, and check under the vehicle for leaks.",
        image: "/steps/oil-fill-check.svg",
      },
      {
        number: 8,
        title: "Final level check and oil-life reset",
        instructions: "Wait a few minutes for oil to settle, recheck the dipstick, and top off if needed. Reset the oil-life monitor via the dash Information menu. Dispose of the old oil and filter at a recycling center.",
        image: "/steps/generic-cleanup.svg",
      },
    ],
  },
  {
    id: "toyota-tundra-oil-change",
    vehicleId: "2021-toyota-tundra-5.7l",
    title: "Engine Oil & Filter Change",
    jobType: "oil-change",
    summary: "Drain-and-refill oil service for the 5.7L i-FORCE V8, with its under-engine cartridge filter housing.",
    difficulty: "Easy",
    tier: "free",
    estTime: "60-75 min",
    tools: [
      { name: "Toyota cartridge filter cap wrench (64mm, 14-flute)", note: "The correct cap wrench is the difference between a clean job and a stripped housing" },
      { name: "Toyota oil filter drain plug tool", note: "Small plastic tool that drains the housing before you open it -- worth the few dollars" },
      { name: "Socket set + ratchet", note: "For the drain plug and the skid plate fasteners" },
      { name: "Torque wrench", note: "Range covering 20-35 ft-lb" },
      { name: "Drain pan", note: "10+ qt capacity -- this engine holds 8.5 qt" },
      { name: "Funnel" },
      { name: "Jack + 2 jack stands or drive-up ramps" },
      { name: "Nitrile gloves + safety glasses" },
    ],
    parts: [
      "8.5 qt (8.0 L) 0W-20 full-synthetic engine oil",
      "Toyota (or equivalent) cartridge oil filter element + 2 housing O-rings",
      "Drain plug crush washer",
    ],
    safety: [
      "Let a hot engine cool for 10-15 min before draining -- hot oil causes burns.",
      "Use jack stands rated for the vehicle's weight; never work under a vehicle held only by a jack.",
      "Used oil and filters are hazardous waste -- take them to a recycling/auto parts drop-off, never pour down a drain.",
    ],
    torqueSpecs: [
      {
        fastener: "Oil pan drain plug",
        value: "30 ft-lb (40 Nm)",
        notes: "Use new crush washer.",
        provenance: { source: "open-labor-project", confidence: "high" },
      },
      {
        fastener: "Oil filter housing cap",
        value: "18 ft-lb (25 Nm)",
        notes: "For cartridge-type filters. The housing is plastic -- torque it, do not muscle it.",
        provenance: { source: "open-labor-project", confidence: "high" },
      },
      {
        fastener: "Oil filter housing drain plug",
        value: "10 ft-lb (13 Nm)",
        notes: "Curated reference figure. This is the small plug inside the cap, not the pan plug.",
      },
    ],
    steps: [
      {
        number: 1,
        title: "Warm the engine briefly, then park and secure",
        instructions: "Run the engine for 2-3 minutes so the oil flows more easily, then shut it off. Park on level ground, set the parking brake, and chock the wheels.",
        image: "/steps/generic-park-secure.svg",
      },
      {
        number: 2,
        title: "Raise the truck and open the skid plate access",
        instructions: "Support the truck on jack stands at the factory lift points. The filter housing is reached through a cutout in the front skid plate; on most SR5 trucks you can swing the access cover aside rather than dropping the whole plate.",
        image: "/steps/generic-raise-vehicle.svg",
        warning: "Confirm the truck is stable on the stands before reaching underneath -- this is a heavy, high-riding vehicle.",
      },
      {
        number: 3,
        title: "Drain the old oil",
        instructions: "Position the drain pan under the oil pan's drain plug. Loosen the plug with a socket, then finish removing it by hand and let the oil fully drain. Expect roughly 8.5 quarts.",
        image: "/steps/oil-drain.svg",
      },
      {
        number: 4,
        title: "Drain the filter housing before you open it",
        instructions: "Loosen the cap about a quarter turn to vent it, then fit the small filter drain plug tool into the port on the bottom of the housing and let it empty into the pan. Skipping this step is how this job earns its reputation for dumping oil down the frame rail.",
        image: "/steps/oil-filter-cartridge.svg",
      },
      {
        number: 5,
        title: "Remove the cap and replace the filter element",
        instructions: "Unscrew the cap counterclockwise with the cap wrench, lift out the old element, and wipe the housing clean. Replace both O-rings -- the large cap O-ring and the small one on the drain plug tool port -- and lightly oil them before reassembly.",
        image: "/steps/oil-filter-install.svg",
        torque: [{ fastener: "Oil filter housing cap", value: "18 ft-lb (25 Nm)" }],
      },
      {
        number: 6,
        title: "Reinstall the drain plug and close everything up",
        instructions: "Fit a new crush washer on the pan drain plug and torque it to spec. Reinstall the housing drain plug, close the skid plate access, and lower the truck.",
        image: "/steps/generic-lower-vehicle.svg",
        torque: [{ fastener: "Oil pan drain plug", value: "30 ft-lb (40 Nm)" }],
      },
      {
        number: 7,
        title: "Refill and check",
        instructions: "Remove the oil fill cap and add oil in stages, checking the dipstick as you approach 8.5 qt. Start the engine, let it run ~30 seconds, shut it off, and check underneath for leaks at the pan plug and the filter housing.",
        image: "/steps/oil-fill-check.svg",
      },
      {
        number: 8,
        title: "Final level check and maintenance reset",
        instructions: "Wait a few minutes for oil to settle, recheck the dipstick, and top off if needed. Reset the maintenance-required light from the dash trip menu. Dispose of the old oil and filter at a recycling drop-off.",
        image: "/steps/generic-cleanup.svg",
      },
    ],
  },
  {
    id: "nissan-rogue-oil-change",
    vehicleId: "2021-nissan-rogue-2.5l",
    title: "Engine Oil & Filter Change",
    jobType: "oil-change",
    summary: "Drain-and-refill oil service for the 2.5L PR25DD four-cylinder, with a conventional spin-on filter.",
    difficulty: "Easy",
    tier: "free",
    estTime: "40-50 min",
    tools: [
      { name: "Oil filter wrench", note: "Cap-style or strap-style to suit the spin-on filter" },
      { name: "Socket set + ratchet", note: "For the drain plug and the splash shield fasteners" },
      { name: "Torque wrench", note: "Range covering 15-30 ft-lb" },
      { name: "Drain pan", note: "6+ qt capacity" },
      { name: "Funnel" },
      { name: "Jack + 2 jack stands or drive-up ramps" },
      { name: "Nitrile gloves + safety glasses" },
    ],
    parts: [
      "5.1 qt (4.8 L) 0W-20 full-synthetic engine oil",
      "Spin-on oil filter (Nissan 15208-65F0C or equivalent)",
      "Drain plug crush washer",
    ],
    safety: [
      "Let a hot engine cool for 10-15 min before draining -- hot oil causes burns.",
      "Use jack stands rated for the vehicle's weight; never work under a vehicle held only by a jack.",
      "Used oil and filters are hazardous waste -- take them to a recycling/auto parts drop-off, never pour down a drain.",
    ],
    torqueSpecs: [
      {
        fastener: "Oil pan drain plug",
        value: "25 ft-lb (34 Nm)",
        notes: "Confirmed by Open Labor Project -- exact match to this file's existing curated figure.",
        provenance: { source: "open-labor-project", confidence: "high" },
      },
      {
        fastener: "Oil filter (spin-on)",
        value: "13 ft-lb (18 Nm)",
        notes: "Reference torque only. In practice most techs seat the gasket by hand and add three-quarters of a turn.",
      },
    ],
    steps: [
      {
        number: 1,
        title: "Warm the engine briefly, then park and secure",
        instructions: "Run the engine for 2-3 minutes so the oil flows more easily, then shut it off. Park on level ground, set the parking brake, and chock the wheels.",
        image: "/steps/generic-park-secure.svg",
      },
      {
        number: 2,
        title: "Raise the vehicle and remove the splash shield",
        instructions: "Support the vehicle on jack stands at the factory lift points. Remove the plastic under-engine splash shield -- it is held by a mix of bolts and push clips, so keep them separated.",
        image: "/steps/generic-raise-vehicle.svg",
        warning: "Confirm the vehicle is stable on the stands before reaching underneath.",
      },
      {
        number: 3,
        title: "Drain the old oil",
        instructions: "Position the drain pan under the oil pan's drain plug. Loosen the plug with a socket, then finish removing it by hand and let the oil fully drain.",
        image: "/steps/oil-drain.svg",
      },
      {
        number: 4,
        title: "Remove the spin-on filter",
        instructions: "The filter sits low on the front of the block. Slide the drain pan under it, back it off with the filter wrench, then spin it off by hand -- it will be full of oil, so keep it upright until it clears.",
        image: "/steps/oil-filter-spinon-remove.svg",
        warning: "Make sure the old filter's rubber gasket came off with it. A gasket left stuck to the block will double up against the new filter and blow oil out under pressure.",
      },
      {
        number: 5,
        title: "Install the new filter and drain plug",
        instructions: "Wipe the sealing surface clean, smear a film of fresh oil on the new filter's gasket, and thread it on by hand until the gasket contacts, then about three-quarters of a turn more. Fit a new crush washer on the drain plug and torque it to spec.",
        image: "/steps/oil-filter-install.svg",
        torque: [{ fastener: "Oil pan drain plug", value: "25 ft-lb (34 Nm)" }],
      },
      {
        number: 6,
        title: "Reinstall the splash shield and lower the vehicle",
        instructions: "Reattach the splash shield bolts and clips, then carefully lower the vehicle back to the ground.",
        image: "/steps/generic-lower-vehicle.svg",
      },
      {
        number: 7,
        title: "Refill and check",
        instructions: "Remove the oil fill cap and add oil in stages, checking the dipstick as you approach 5.1 qt. Start the engine, let it run ~30 seconds, shut it off, and check underneath for leaks at the plug and filter.",
        image: "/steps/oil-fill-check.svg",
      },
      {
        number: 8,
        title: "Final level check and cleanup",
        instructions: "Wait a few minutes for oil to settle, recheck the dipstick, and top off if needed. Reset the maintenance reminder from the vehicle information display. Dispose of the old oil and filter at a recycling drop-off.",
        image: "/steps/generic-cleanup.svg",
      },
    ],
  },
  {
    id: "hyundai-tucson-oil-change",
    vehicleId: "2021-hyundai-tucson-2.4l",
    title: "Engine Oil & Filter Change",
    jobType: "oil-change",
    summary: "Drain-and-refill oil service for the 2.4L Theta II GDI four-cylinder, with its top-accessed cartridge filter housing.",
    difficulty: "Easy",
    tier: "free",
    estTime: "45-60 min",
    tools: [
      { name: "Cartridge filter cap wrench", note: "Fits the plastic housing cap on the front of the engine" },
      { name: "Socket set + ratchet", note: "For the drain plug and the splash shield fasteners" },
      { name: "Torque wrench", note: "Range covering 15-30 ft-lb" },
      { name: "Drain pan", note: "6+ qt capacity" },
      { name: "Funnel" },
      { name: "Jack + 2 jack stands or drive-up ramps" },
      { name: "Nitrile gloves + safety glasses" },
    ],
    parts: [
      "4.8 qt (4.5 L) 5W-20 full-synthetic engine oil",
      "Hyundai (or equivalent) cartridge oil filter element + housing O-ring",
      "Drain plug crush washer",
    ],
    safety: [
      "Let a hot engine cool for 10-15 min before draining -- hot oil causes burns.",
      "Use jack stands rated for the vehicle's weight; never work under a vehicle held only by a jack.",
      "Used oil and filters are hazardous waste -- take them to a recycling/auto parts drop-off, never pour down a drain.",
    ],
    torqueSpecs: [
      {
        fastener: "Oil pan drain plug",
        value: "25 ft-lb (35 Nm)",
        notes: "Curated reference figure -- not yet pulled from Open Labor Project for this vehicle.",
      },
      {
        fastener: "Oil filter housing cap",
        value: "18 ft-lb (25 Nm)",
        notes: "Curated reference figure. The cap is plastic -- torque it to spec rather than leaning on it.",
      },
    ],
    steps: [
      {
        number: 1,
        title: "Warm the engine briefly, then park and secure",
        instructions: "Run the engine for 2-3 minutes so the oil flows more easily, then shut it off. Park on level ground, set the parking brake, and chock the wheels.",
        image: "/steps/generic-park-secure.svg",
      },
      {
        number: 2,
        title: "Raise the vehicle and remove the splash shield",
        instructions: "Support the vehicle on jack stands at the factory lift points. Remove the plastic under-engine splash shield to reach the drain plug.",
        image: "/steps/generic-raise-vehicle.svg",
        warning: "Confirm the vehicle is stable on the stands before reaching underneath.",
      },
      {
        number: 3,
        title: "Drain the old oil",
        instructions: "Position the drain pan under the oil pan's drain plug. Loosen the plug with a socket, then finish removing it by hand and let the oil fully drain.",
        image: "/steps/oil-drain.svg",
      },
      {
        number: 4,
        title: "Remove the filter cartridge",
        instructions: "The filter housing sits on the front of the engine and is reachable from above on most Tucson builds. Unscrew the cap counterclockwise with the cap wrench, lift out the old element, and let the housing drain before wiping it clean.",
        image: "/steps/oil-filter-cartridge.svg",
      },
      {
        number: 5,
        title: "Install the new element and reassemble",
        instructions: "Fit the new element into the cap, replace the cap O-ring and lightly oil it, and thread the cap back in by hand before torquing it. Fit a new crush washer on the drain plug and torque that to spec as well.",
        image: "/steps/oil-filter-install.svg",
        torque: [{ fastener: "Oil filter housing cap", value: "18 ft-lb (25 Nm)" }, { fastener: "Oil pan drain plug", value: "25 ft-lb (35 Nm)" }],
      },
      {
        number: 6,
        title: "Reinstall the splash shield and lower the vehicle",
        instructions: "Reattach the splash shield fasteners and carefully lower the vehicle back to the ground.",
        image: "/steps/generic-lower-vehicle.svg",
      },
      {
        number: 7,
        title: "Refill and check",
        instructions: "Remove the oil fill cap and add oil in stages, checking the dipstick as you approach 4.8 qt. Start the engine, let it run ~30 seconds, shut it off, and check underneath for leaks at the plug and the filter housing.",
        image: "/steps/oil-fill-check.svg",
      },
      {
        number: 8,
        title: "Final level check and reminder reset",
        instructions: "Wait a few minutes for oil to settle, recheck the dipstick, and top off if needed. Reset the service reminder from the instrument cluster menu. Dispose of the old oil and filter at a recycling drop-off.",
        image: "/steps/generic-cleanup.svg",
      },
    ],
  },
  {
    id: "toyota-grand-highlander-oil-change",
    vehicleId: "2024-toyota-grand-highlander-2.4t",
    title: "Engine Oil & Filter Change",
    jobType: "oil-change",
    summary: "Drain-and-refill oil service for the 2.4L T24A-FTS turbo four, with Toyota's under-engine cartridge filter housing.",
    difficulty: "Easy",
    tier: "free",
    estTime: "45-60 min",
    tools: [
      { name: "Toyota cartridge filter cap wrench (64mm, 14-flute)", note: "Same cap pattern used across most of Toyota's modern four-cylinder lineup" },
      { name: "Toyota oil filter drain plug tool", note: "Empties the housing before you open it and keeps oil off the subframe" },
      { name: "Socket set + ratchet", note: "For the drain plug and the under-engine cover fasteners" },
      { name: "Torque wrench", note: "Range covering 15-35 ft-lb" },
      { name: "Drain pan", note: "6+ qt capacity" },
      { name: "Funnel" },
      { name: "Jack + 2 jack stands or drive-up ramps" },
      { name: "Nitrile gloves + safety glasses" },
    ],
    parts: [
      "5.7 qt (5.4 L) 0W-20 full-synthetic engine oil",
      "Toyota (or equivalent) cartridge oil filter element + housing O-rings",
      "Drain plug crush washer",
    ],
    safety: [
      "Let a hot engine cool for 10-15 min before draining -- a turbocharged engine runs hotter than you expect and hot oil causes burns.",
      "Use jack stands rated for the vehicle's weight; never work under a vehicle held only by a jack.",
      "Used oil and filters are hazardous waste -- take them to a recycling/auto parts drop-off, never pour down a drain.",
    ],
    torqueSpecs: [
      {
        fastener: "Oil pan drain plug",
        value: "30 ft-lb (40 Nm)",
        notes: "Curated reference figure -- not yet pulled from Open Labor Project for this vehicle.",
      },
      {
        fastener: "Oil filter housing cap",
        value: "18 ft-lb (25 Nm)",
        notes: "Curated reference figure. Plastic housing -- torque it, do not muscle it.",
      },
    ],
    steps: [
      {
        number: 1,
        title: "Warm the engine briefly, then park and secure",
        instructions: "Run the engine for 2-3 minutes so the oil flows more easily, then shut it off. Park on level ground, set the parking brake, and chock the wheels.",
        image: "/steps/generic-park-secure.svg",
      },
      {
        number: 2,
        title: "Raise the vehicle and remove the under-engine cover",
        instructions: "Support the vehicle on jack stands at the factory lift points. Remove the plastic under-engine cover -- it uses a mix of bolts and push clips.",
        image: "/steps/generic-raise-vehicle.svg",
        warning: "Confirm the vehicle is stable on the stands before reaching underneath.",
      },
      {
        number: 3,
        title: "Drain the old oil",
        instructions: "Position the drain pan under the oil pan's drain plug. Loosen the plug with a socket, then finish removing it by hand and let the oil fully drain.",
        image: "/steps/oil-drain.svg",
      },
      {
        number: 4,
        title: "Drain the filter housing, then open it",
        instructions: "Vent the cap a quarter turn, fit the small filter drain tool into the housing port to empty it, then unscrew the cap with the cap wrench and lift out the old element.",
        image: "/steps/oil-filter-cartridge.svg",
      },
      {
        number: 5,
        title: "Install the new element and reassemble",
        instructions: "Replace the cap O-rings, lightly oil them, fit the new element into the cap, and thread it back in by hand before torquing. Fit a new crush washer on the drain plug and torque it to spec.",
        image: "/steps/oil-filter-install.svg",
        torque: [{ fastener: "Oil filter housing cap", value: "18 ft-lb (25 Nm)" }, { fastener: "Oil pan drain plug", value: "30 ft-lb (40 Nm)" }],
      },
      {
        number: 6,
        title: "Reinstall the cover and lower the vehicle",
        instructions: "Reattach the under-engine cover fasteners and carefully lower the vehicle back to the ground.",
        image: "/steps/generic-lower-vehicle.svg",
      },
      {
        number: 7,
        title: "Refill and check",
        instructions: "Remove the oil fill cap and add oil in stages, checking the dipstick as you approach 5.7 qt. Start the engine, let it run ~30 seconds, shut it off, and check underneath for leaks.",
        image: "/steps/oil-fill-check.svg",
      },
      {
        number: 8,
        title: "Final level check and maintenance reset",
        instructions: "Wait a few minutes for oil to settle, recheck the dipstick, and top off if needed. Reset the maintenance-required light from the dash menu. Dispose of the old oil and filter at a recycling drop-off.",
        image: "/steps/generic-cleanup.svg",
      },
    ],
  },
  {
    id: "subaru-crosstrek-oil-change",
    vehicleId: "2021-subaru-crosstrek-2.0l",
    title: "Engine Oil & Filter Change",
    jobType: "oil-change",
    summary: "Drain-and-refill oil service for the 2.0L FB20 boxer, whose spin-on filter sits on top of the engine instead of underneath it.",
    difficulty: "Easy",
    tier: "free",
    estTime: "30-45 min",
    tools: [
      { name: "Oil filter wrench", note: "Cap-style 65mm/14-flute suits the factory filter" },
      { name: "Socket set + ratchet", note: "For the drain plug and the underbody panel fasteners" },
      { name: "Torque wrench", note: "Range covering 10-35 ft-lb" },
      { name: "Drain pan", note: "6+ qt capacity" },
      { name: "Funnel" },
      { name: "Jack + 2 jack stands or drive-up ramps" },
      { name: "Nitrile gloves + safety glasses" },
    ],
    parts: [
      "4.4 qt (4.2 L) 0W-20 full-synthetic engine oil",
      "Spin-on oil filter (Subaru 15208AA15A or equivalent)",
      "Drain plug crush washer (Subaru uses a replaceable aluminum washer)",
    ],
    safety: [
      "Let a hot engine cool for 10-15 min before draining -- hot oil causes burns.",
      "Use jack stands rated for the vehicle's weight; never work under a vehicle held only by a jack.",
      "Used oil and filters are hazardous waste -- take them to a recycling/auto parts drop-off, never pour down a drain.",
    ],
    torqueSpecs: [
      {
        fastener: "Oil pan drain plug",
        value: "31 ft-lb (42 Nm)",
        notes: "CORRECTED from a curated 30 ft-lb (41 Nm) with a real Open Labor Project value. Replace the aluminum crush washer every change; Subaru pans are easy to weep from.",
        provenance: { source: "open-labor-project", confidence: "high" },
      },
      {
        fastener: "Oil filter (spin-on)",
        value: "10 ft-lb (14 Nm)",
        notes: "CORRECTED from a curated 12 ft-lb (16 Nm) with a real Open Labor Project value. In practice most techs seat the gasket by hand and add three-quarters of a turn.",
        provenance: { source: "open-labor-project", confidence: "high" },
      },
    ],
    steps: [
      {
        number: 1,
        title: "Warm the engine briefly, then park and secure",
        instructions: "Run the engine for 2-3 minutes so the oil flows more easily, then shut it off. Park on level ground, set the parking brake, and chock the wheels.",
        image: "/steps/generic-park-secure.svg",
      },
      {
        number: 2,
        title: "Change the filter first, from above",
        instructions: "Open the hood. The spin-on filter is mounted vertically on the front of the engine, right at the top -- no jack needed for this part. Lay a rag underneath to catch the dribble, back the filter off with the wrench, and spin it off by hand.",
        image: "/steps/oil-filter-spinon-remove.svg",
        warning: "Check that the old filter's rubber gasket came off with it. A gasket left behind will double up against the new filter and push oil out under pressure.",
      },
      {
        number: 3,
        title: "Install the new filter",
        instructions: "Wipe the mounting surface clean, smear fresh oil on the new filter's gasket, and thread it on by hand until the gasket contacts, then about three-quarters of a turn more.",
        image: "/steps/oil-filter-install.svg",
      },
      {
        number: 4,
        title: "Raise the vehicle and remove the underbody panel",
        instructions: "Support the vehicle on jack stands at the factory lift points. Remove the plastic underbody panel to reach the drain plug.",
        image: "/steps/generic-raise-vehicle.svg",
        warning: "Confirm the vehicle is stable on the stands before reaching underneath.",
      },
      {
        number: 5,
        title: "Drain the old oil",
        instructions: "Position the drain pan under the oil pan's drain plug. Loosen the plug with a socket, then finish removing it by hand and let the oil fully drain.",
        image: "/steps/oil-drain.svg",
      },
      {
        number: 6,
        title: "Reinstall the drain plug and lower the vehicle",
        instructions: "Fit a new aluminum crush washer, torque the drain plug to spec, reattach the underbody panel, and lower the vehicle.",
        image: "/steps/generic-lower-vehicle.svg",
        torque: [{ fastener: "Oil pan drain plug", value: "31 ft-lb (42 Nm)" }],
      },
      {
        number: 7,
        title: "Refill and check",
        instructions: "Remove the oil fill cap and add oil in stages, checking the dipstick as you approach 4.4 qt. Start the engine, let it run ~30 seconds, shut it off, and check for leaks at the plug and filter.",
        image: "/steps/oil-fill-check.svg",
      },
      {
        number: 8,
        title: "Final level check and cleanup",
        instructions: "Wait a few minutes for oil to settle, recheck the dipstick, and top off if needed. Dispose of the old oil and filter at a recycling drop-off.",
        image: "/steps/generic-cleanup.svg",
      },
    ],
  },
  {
    id: "chevrolet-trax-oil-change",
    vehicleId: "2021-chevrolet-trax-1.4t",
    title: "Engine Oil & Filter Change",
    jobType: "oil-change",
    summary: "Drain-and-refill oil service for the 1.4L LE2 turbo four, whose cartridge filter housing sits on top of the engine.",
    difficulty: "Easy",
    tier: "free",
    estTime: "40-50 min",
    tools: [
      { name: "Cartridge filter cap socket", note: "The housing cap on the 1.4T takes a large cap socket, not a strap wrench" },
      { name: "Socket set + ratchet", note: "For the drain plug and the splash shield fasteners" },
      { name: "Torque wrench", note: "Range covering 15-25 ft-lb" },
      { name: "Drain pan", note: "6+ qt capacity" },
      { name: "Funnel" },
      { name: "Jack + 2 jack stands or drive-up ramps" },
      { name: "Nitrile gloves + safety glasses" },
    ],
    parts: [
      "4.2 qt (4.0 L) 5W-30 full-synthetic engine oil meeting GM dexos1",
      "ACDelco (or equivalent) cartridge oil filter element + housing O-ring",
      "Drain plug crush washer",
    ],
    safety: [
      "Let a hot engine cool for 10-15 min before draining -- a turbocharged engine runs hot and hot oil causes burns.",
      "Use jack stands rated for the vehicle's weight; never work under a vehicle held only by a jack.",
      "Used oil and filters are hazardous waste -- take them to a recycling/auto parts drop-off, never pour down a drain.",
    ],
    torqueSpecs: [
      {
        fastener: "Oil pan drain plug",
        value: "18 ft-lb (25 Nm)",
        notes: "Confirmed by Open Labor Project -- exact match to this file's existing curated figure.",
        provenance: { source: "open-labor-project", confidence: "high" },
      },
      {
        fastener: "Oil filter housing cap",
        value: "18 ft-lb (25 Nm)",
        notes: "Confirmed by Open Labor Project -- exact match to this file's existing curated figure. The cap is plastic and sits above a hot turbo -- torque it to spec rather than leaning on it.",
        provenance: { source: "open-labor-project", confidence: "high" },
      },
    ],
    steps: [
      {
        number: 1,
        title: "Warm the engine briefly, then park and secure",
        instructions: "Run the engine for 2-3 minutes so the oil flows more easily, then shut it off. Park on level ground, set the parking brake, and chock the wheels.",
        image: "/steps/generic-park-secure.svg",
      },
      {
        number: 2,
        title: "Open the filter housing cap from above",
        instructions: "Open the hood and locate the black plastic filter housing on top of the engine. Loosen the cap a quarter turn first -- this lets the housing drain back into the pan before you remove the drain plug, so you are not doing it twice.",
        image: "/steps/oil-filter-cartridge.svg",
      },
      {
        number: 3,
        title: "Raise the vehicle and remove the splash shield",
        instructions: "Support the vehicle on jack stands at the factory lift points. Remove the plastic under-engine splash shield to reach the drain plug.",
        image: "/steps/generic-raise-vehicle.svg",
        warning: "Confirm the vehicle is stable on the stands before reaching underneath.",
      },
      {
        number: 4,
        title: "Drain the old oil",
        instructions: "Position the drain pan under the oil pan's drain plug. Loosen the plug with a socket, then finish removing it by hand and let the oil fully drain.",
        image: "/steps/oil-drain.svg",
      },
      {
        number: 5,
        title: "Replace the filter element and reassemble",
        instructions: "Back the housing cap the rest of the way out, pull the old element off the cap stem, fit the new one, replace and lightly oil the cap O-ring, and thread the cap back in by hand before torquing. Fit a new crush washer on the drain plug and torque that to spec.",
        image: "/steps/oil-filter-install.svg",
        torque: [{ fastener: "Oil filter housing cap", value: "18 ft-lb (25 Nm)" }, { fastener: "Oil pan drain plug", value: "18 ft-lb (25 Nm)" }],
      },
      {
        number: 6,
        title: "Reinstall the splash shield and lower the vehicle",
        instructions: "Reattach the splash shield fasteners and carefully lower the vehicle back to the ground.",
        image: "/steps/generic-lower-vehicle.svg",
      },
      {
        number: 7,
        title: "Refill and check",
        instructions: "Remove the oil fill cap and add oil in stages, checking the dipstick as you approach 4.2 qt. Start the engine, let it run ~30 seconds, shut it off, and check underneath for leaks.",
        image: "/steps/oil-fill-check.svg",
      },
      {
        number: 8,
        title: "Final level check and oil-life reset",
        instructions: "Wait a few minutes for oil to settle, recheck the dipstick, and top off if needed. Reset the oil-life monitor from the Driver Information Center. Dispose of the old oil and filter at a recycling drop-off.",
        image: "/steps/generic-cleanup.svg",
      },
    ],
  },
  {
    id: "kia-sportage-oil-change",
    vehicleId: "2021-kia-sportage-2.4l",
    title: "Engine Oil & Filter Change",
    jobType: "oil-change",
    summary: "Drain-and-refill oil service for the 2.4L Theta II GDI four-cylinder, with its top-accessed cartridge filter housing.",
    difficulty: "Easy",
    tier: "free",
    estTime: "45-60 min",
    tools: [
      { name: "Cartridge filter cap wrench", note: "Fits the plastic housing cap on the front of the engine" },
      { name: "Socket set + ratchet", note: "For the drain plug and the splash shield fasteners" },
      { name: "Torque wrench", note: "Range covering 15-30 ft-lb" },
      { name: "Drain pan", note: "6+ qt capacity" },
      { name: "Funnel" },
      { name: "Jack + 2 jack stands or drive-up ramps" },
      { name: "Nitrile gloves + safety glasses" },
    ],
    parts: [
      "4.8 qt (4.5 L) 5W-20 full-synthetic engine oil",
      "Kia (or equivalent) cartridge oil filter element + housing O-ring",
      "Drain plug crush washer",
    ],
    safety: [
      "Let a hot engine cool for 10-15 min before draining -- hot oil causes burns.",
      "Use jack stands rated for the vehicle's weight; never work under a vehicle held only by a jack.",
      "Used oil and filters are hazardous waste -- take them to a recycling/auto parts drop-off, never pour down a drain.",
    ],
    torqueSpecs: [
      {
        fastener: "Oil pan drain plug",
        value: "30 ft-lb (40 Nm)",
        notes: "CORRECTED from a curated 25 ft-lb (35 Nm) with a real Open Labor Project value, matched to this vehicle's actual 2.4L engine. The 2.0L Sportage variant returned a different filter-housing-cap value in the same pull -- not used here since this entry is the 2.4L.",
        provenance: { source: "open-labor-project", confidence: "high" },
      },
      {
        fastener: "Oil filter housing cap",
        value: "18 ft-lb (25 Nm)",
        notes: "Curated reference figure. The cap is plastic -- torque it to spec rather than leaning on it.",
      },
    ],
    steps: [
      {
        number: 1,
        title: "Warm the engine briefly, then park and secure",
        instructions: "Run the engine for 2-3 minutes so the oil flows more easily, then shut it off. Park on level ground, set the parking brake, and chock the wheels.",
        image: "/steps/generic-park-secure.svg",
      },
      {
        number: 2,
        title: "Raise the vehicle and remove the splash shield",
        instructions: "Support the vehicle on jack stands at the factory lift points. Remove the plastic under-engine splash shield to reach the drain plug.",
        image: "/steps/generic-raise-vehicle.svg",
        warning: "Confirm the vehicle is stable on the stands before reaching underneath.",
      },
      {
        number: 3,
        title: "Drain the old oil",
        instructions: "Position the drain pan under the oil pan's drain plug. Loosen the plug with a socket, then finish removing it by hand and let the oil fully drain.",
        image: "/steps/oil-drain.svg",
      },
      {
        number: 4,
        title: "Remove the filter cartridge",
        instructions: "The filter housing sits on the front of the engine and is reachable from above on most Sportage builds. Unscrew the cap counterclockwise with the cap wrench, lift out the old element, and let the housing drain before wiping it clean.",
        image: "/steps/oil-filter-cartridge.svg",
      },
      {
        number: 5,
        title: "Install the new element and reassemble",
        instructions: "Fit the new element into the cap, replace the cap O-ring and lightly oil it, and thread the cap back in by hand before torquing it. Fit a new crush washer on the drain plug and torque that to spec as well.",
        image: "/steps/oil-filter-install.svg",
        torque: [{ fastener: "Oil filter housing cap", value: "18 ft-lb (25 Nm)" }, { fastener: "Oil pan drain plug", value: "30 ft-lb (40 Nm)" }],
      },
      {
        number: 6,
        title: "Reinstall the splash shield and lower the vehicle",
        instructions: "Reattach the splash shield fasteners and carefully lower the vehicle back to the ground.",
        image: "/steps/generic-lower-vehicle.svg",
      },
      {
        number: 7,
        title: "Refill and check",
        instructions: "Remove the oil fill cap and add oil in stages, checking the dipstick as you approach 4.8 qt. Start the engine, let it run ~30 seconds, shut it off, and check underneath for leaks at the plug and the filter housing.",
        image: "/steps/oil-fill-check.svg",
      },
      {
        number: 8,
        title: "Final level check and reminder reset",
        instructions: "Wait a few minutes for oil to settle, recheck the dipstick, and top off if needed. Reset the service reminder from the instrument cluster menu. Dispose of the old oil and filter at a recycling drop-off.",
        image: "/steps/generic-cleanup.svg",
      },
    ],
  },
  {
    id: "toyota-corolla-cross-oil-change",
    vehicleId: "2022-toyota-corolla-cross-2.0l",
    title: "Engine Oil & Filter Change",
    jobType: "oil-change",
    summary: "Drain-and-refill oil service for the 2.0L Dynamic Force four, with Toyota's under-engine cartridge filter housing.",
    difficulty: "Easy",
    tier: "free",
    estTime: "40-55 min",
    tools: [
      { name: "Toyota cartridge filter cap wrench (64mm, 14-flute)", note: "Same cap pattern across most of Toyota's modern lineup" },
      { name: "Toyota oil filter drain plug tool", note: "Empties the housing before you open it and keeps oil off the subframe" },
      { name: "Socket set + ratchet", note: "For the drain plug and the under-engine cover fasteners" },
      { name: "Torque wrench", note: "Range covering 15-35 ft-lb" },
      { name: "Drain pan", note: "6+ qt capacity" },
      { name: "Funnel" },
      { name: "Jack + 2 jack stands or drive-up ramps" },
      { name: "Nitrile gloves + safety glasses" },
    ],
    parts: [
      "4.4 qt (4.2 L) 0W-16 full-synthetic engine oil",
      "Toyota (or equivalent) cartridge oil filter element + housing O-rings",
      "Drain plug crush washer",
    ],
    safety: [
      "Let a hot engine cool for 10-15 min before draining -- hot oil causes burns.",
      "Use jack stands rated for the vehicle's weight; never work under a vehicle held only by a jack.",
      "Used oil and filters are hazardous waste -- take them to a recycling/auto parts drop-off, never pour down a drain.",
    ],
    torqueSpecs: [
      {
        fastener: "Oil pan drain plug",
        value: "30 ft-lb (40 Nm)",
        notes: "Use new crush washer.",
        provenance: { source: "open-labor-project", confidence: "high" },
      },
      {
        fastener: "Oil filter housing cap",
        value: "18 ft-lb (25 Nm)",
        notes: "For cartridge-type filters. Plastic housing -- torque it, do not muscle it.",
        provenance: { source: "open-labor-project", confidence: "high" },
      },
    ],
    steps: [
      {
        number: 1,
        title: "Warm the engine briefly, then park and secure",
        instructions: "Run the engine for 2-3 minutes so the oil flows more easily, then shut it off. Park on level ground, set the parking brake, and chock the wheels.",
        image: "/steps/generic-park-secure.svg",
      },
      {
        number: 2,
        title: "Raise the vehicle and remove the under-engine cover",
        instructions: "Support the vehicle on jack stands at the factory lift points. Remove the plastic under-engine cover -- it uses a mix of bolts and push clips, so keep them separated.",
        image: "/steps/generic-raise-vehicle.svg",
        warning: "Confirm the vehicle is stable on the stands before reaching underneath.",
      },
      {
        number: 3,
        title: "Drain the old oil",
        instructions: "Position the drain pan under the oil pan's drain plug. Loosen the plug with a socket, then finish removing it by hand and let the oil fully drain. Expect roughly 4.4 qt.",
        image: "/steps/oil-drain.svg",
      },
      {
        number: 4,
        title: "Drain the filter housing before you open it",
        instructions: "Loosen the cap about a quarter turn to vent it, then fit the small filter drain tool into the port on the bottom of the housing and let it empty into the pan. Skipping this is how this job earns its reputation for dumping oil down the subframe.",
        image: "/steps/oil-filter-cartridge.svg",
      },
      {
        number: 5,
        title: "Replace the element and reassemble",
        instructions: "Unscrew the cap with the cap wrench, lift out the old element, and wipe the housing clean. Replace the cap O-rings, lightly oil them, fit the new element, and thread the cap back in by hand before torquing. Fit a new crush washer on the drain plug and torque it to spec.",
        image: "/steps/oil-filter-install.svg",
        torque: [{ fastener: "Oil filter housing cap", value: "18 ft-lb (25 Nm)" }, { fastener: "Oil pan drain plug", value: "30 ft-lb (40 Nm)" }],
      },
      {
        number: 6,
        title: "Reinstall the cover and lower the vehicle",
        instructions: "Reattach the under-engine cover fasteners and carefully lower the vehicle back to the ground.",
        image: "/steps/generic-lower-vehicle.svg",
      },
      {
        number: 7,
        title: "Refill and check",
        instructions: "Remove the oil fill cap and add oil in stages, checking the dipstick as you approach 4.4 qt. Start the engine, let it run ~30 seconds, shut it off, and check underneath for leaks at the pan plug and the filter housing.",
        image: "/steps/oil-fill-check.svg",
      },
      {
        number: 8,
        title: "Final level check and maintenance reset",
        instructions: "Wait a few minutes for oil to settle, recheck the dipstick, and top off if needed. Reset the maintenance-required light from the dash trip menu. Dispose of the old oil and filter at a recycling drop-off.",
        image: "/steps/generic-cleanup.svg",
      },
    ],
  },
  {
    id: "honda-accord-oil-change",
    vehicleId: "2021-honda-accord-1.5t",
    title: "Engine Oil & Filter Change",
    jobType: "oil-change",
    summary: "Drain-and-refill oil service for the 1.5L turbo four, with a conventional spin-on filter.",
    difficulty: "Easy",
    tier: "free",
    estTime: "35-45 min",
    tools: [
      { name: "Oil filter wrench", note: "Cap-style 64mm/14-flute fits the factory Honda filter" },
      { name: "Socket set + ratchet", note: "For the drain plug and the underbody panel fasteners" },
      { name: "Torque wrench", note: "Range covering 10-35 ft-lb" },
      { name: "Drain pan", note: "6+ qt capacity" },
      { name: "Funnel" },
      { name: "Jack + 2 jack stands or drive-up ramps" },
      { name: "Nitrile gloves + safety glasses" },
    ],
    parts: [
      "3.7 qt (3.5 L) 0W-20 full-synthetic engine oil",
      "Spin-on oil filter (Honda 15400-PLM-A02 or equivalent)",
      "Drain plug crush washer (Honda uses a replaceable aluminum washer)",
    ],
    safety: [
      "Let a hot engine cool for 10-15 min before draining -- hot oil causes burns.",
      "Use jack stands rated for the vehicle's weight; never work under a vehicle held only by a jack.",
      "Used oil and filters are hazardous waste -- take them to a recycling/auto parts drop-off, never pour down a drain.",
    ],
    torqueSpecs: [
      {
        fastener: "Oil pan drain plug",
        value: "29 ft-lb (39 Nm)",
        notes: "Use new crush washer. Replace the aluminum washer every change.",
        provenance: { source: "open-labor-project", confidence: "high" },
      },
      {
        fastener: "Oil filter (spin-on)",
        value: "13 ft-lb (18 Nm)",
        notes: "Reference torque only. In practice most techs seat the gasket by hand and add three-quarters of a turn.",
      },
    ],
    steps: [
      {
        number: 1,
        title: "Warm the engine briefly, then park and secure",
        instructions: "Run the engine for 2-3 minutes so the oil flows more easily, then shut it off. Park on level ground, set the parking brake, and chock the wheels.",
        image: "/steps/generic-park-secure.svg",
      },
      {
        number: 2,
        title: "Raise the vehicle and remove the underbody panel",
        instructions: "Support the vehicle on jack stands at the factory lift points. Remove the plastic under-engine panel -- it uses a mix of bolts and push clips, so keep them separated.",
        image: "/steps/generic-raise-vehicle.svg",
        warning: "Confirm the vehicle is stable on the stands before reaching underneath.",
      },
      {
        number: 3,
        title: "Drain the old oil",
        instructions: "Position the drain pan under the oil pan's drain plug. Loosen the plug with a socket, then finish removing it by hand and let the oil fully drain. Expect roughly 3.7 qt.",
        image: "/steps/oil-drain.svg",
      },
      {
        number: 4,
        title: "Remove the spin-on filter",
        instructions: "The filter sits on the front of the block, reachable from underneath. Slide the drain pan under it, back it off with the filter wrench, then spin it off by hand -- it will be full of oil, so keep it upright until it clears.",
        image: "/steps/oil-filter-spinon-remove.svg",
        warning: "Check that the old filter's rubber gasket came off with it. A gasket left stuck to the engine will double up against the new filter and push oil out under pressure.",
      },
      {
        number: 5,
        title: "Install the new filter and drain plug",
        instructions: "Wipe the sealing surface clean, smear a film of fresh oil on the new filter's gasket, and thread it on by hand until the gasket contacts, then about three-quarters of a turn more. Fit a new washer on the drain plug and torque it to spec.",
        image: "/steps/oil-filter-install.svg",
        torque: [{ fastener: "Oil pan drain plug", value: "29 ft-lb (39 Nm)" }],
      },
      {
        number: 6,
        title: "Reinstall the underbody panel and lower the vehicle",
        instructions: "Reattach the panel fasteners and carefully lower the vehicle back to the ground.",
        image: "/steps/generic-lower-vehicle.svg",
      },
      {
        number: 7,
        title: "Refill and check",
        instructions: "Remove the oil fill cap and add oil in stages, checking the dipstick as you approach 3.7 qt. Start the engine, let it run ~30 seconds, shut it off, and check underneath for leaks at the plug and filter.",
        image: "/steps/oil-fill-check.svg",
      },
      {
        number: 8,
        title: "Final level check and reminder reset",
        instructions: "Wait a few minutes for oil to settle, recheck the dipstick, and top off if needed. Reset the Maintenance Minder from the driver information interface. Dispose of the old oil and filter at a recycling drop-off.",
        image: "/steps/generic-cleanup.svg",
      },
    ],
  },
  {
    id: "subaru-forester-oil-change",
    vehicleId: "2021-subaru-forester-2.5l",
    title: "Engine Oil & Filter Change",
    jobType: "oil-change",
    summary: "Drain-and-refill oil service for the 2.5L FB25 boxer, whose spin-on filter sits on top of the engine instead of underneath it.",
    difficulty: "Easy",
    tier: "free",
    estTime: "30-45 min",
    tools: [
      { name: "Oil filter wrench", note: "Cap-style 65mm/14-flute suits the factory filter" },
      { name: "Socket set + ratchet", note: "For the drain plug and the underbody panel fasteners" },
      { name: "Torque wrench", note: "Range covering 10-35 ft-lb" },
      { name: "Drain pan", note: "6+ qt capacity" },
      { name: "Funnel" },
      { name: "Jack + 2 jack stands or drive-up ramps" },
      { name: "Nitrile gloves + safety glasses" },
    ],
    parts: [
      "5.1 qt (4.8 L) 0W-20 full-synthetic engine oil",
      "Spin-on oil filter (Subaru 15208AA15A or equivalent)",
      "Drain plug crush washer (Subaru uses a replaceable aluminum washer)",
    ],
    safety: [
      "Let a hot engine cool for 10-15 min before draining -- hot oil causes burns.",
      "Use jack stands rated for the vehicle's weight; never work under a vehicle held only by a jack.",
      "Used oil and filters are hazardous waste -- take them to a recycling/auto parts drop-off, never pour down a drain.",
    ],
    torqueSpecs: [
      {
        fastener: "Oil pan drain plug",
        value: "33 ft-lb (44.7 Nm)",
        notes: "Use new crush washer. Replace the aluminum crush washer every change; Subaru pans are easy to weep from.",
        provenance: { source: "open-labor-project", confidence: "oem_verified" },
      },
      {
        fastener: "Oil filter (spin-on)",
        value: "10 ft-lb (14 Nm)",
        notes: "Hand tight plus three-quarters of a turn.",
        provenance: { source: "open-labor-project", confidence: "high" },
      },
    ],
    steps: [
      {
        number: 1,
        title: "Warm the engine briefly, then park and secure",
        instructions: "Run the engine for 2-3 minutes so the oil flows more easily, then shut it off. Park on level ground, set the parking brake, and chock the wheels.",
        image: "/steps/generic-park-secure.svg",
      },
      {
        number: 2,
        title: "Change the filter first, from above",
        instructions: "Open the hood. The spin-on filter is mounted vertically on the front of the engine, right at the top -- no jack needed for this part. Lay a rag underneath to catch the dribble, back the filter off with the wrench, and spin it off by hand.",
        image: "/steps/oil-filter-spinon-remove.svg",
        warning: "Check that the old filter's rubber gasket came off with it. A gasket left behind will double up against the new filter and push oil out under pressure.",
      },
      {
        number: 3,
        title: "Install the new filter",
        instructions: "Wipe the mounting surface clean, smear fresh oil on the new filter's gasket, and thread it on by hand until the gasket contacts, then about three-quarters of a turn more.",
        image: "/steps/oil-filter-install.svg",
      },
      {
        number: 4,
        title: "Raise the vehicle and remove the underbody panel",
        instructions: "Support the vehicle on jack stands at the factory lift points. Remove the plastic underbody panel to reach the drain plug.",
        image: "/steps/generic-raise-vehicle.svg",
        warning: "Confirm the vehicle is stable on the stands before reaching underneath.",
      },
      {
        number: 5,
        title: "Drain the old oil",
        instructions: "Position the drain pan under the oil pan's drain plug. Loosen the plug with a socket, then finish removing it by hand and let the oil fully drain. Expect roughly 5.1 qt.",
        image: "/steps/oil-drain.svg",
      },
      {
        number: 6,
        title: "Reinstall the drain plug and lower the vehicle",
        instructions: "Fit a new aluminum crush washer, torque the drain plug to spec, reattach the underbody panel, and lower the vehicle.",
        image: "/steps/generic-lower-vehicle.svg",
        torque: [{ fastener: "Oil pan drain plug", value: "33 ft-lb (44.7 Nm)" }],
      },
      {
        number: 7,
        title: "Refill and check",
        instructions: "Remove the oil fill cap and add oil in stages, checking the dipstick as you approach 5.1 qt. Start the engine, let it run ~30 seconds, shut it off, and check for leaks at the plug and filter.",
        image: "/steps/oil-fill-check.svg",
      },
      {
        number: 8,
        title: "Final level check and cleanup",
        instructions: "Wait a few minutes for oil to settle, recheck the dipstick, and top off if needed. Dispose of the old oil and filter at a recycling drop-off.",
        image: "/steps/generic-cleanup.svg",
      },
    ],
  },
  {
    id: "toyota-sienna-oil-change",
    vehicleId: "2020-toyota-sienna-3.5l",
    title: "Engine Oil & Filter Change",
    jobType: "oil-change",
    summary: "Drain-and-refill oil service for the 3.5L 2GR-FKS V6, with Toyota's under-engine cartridge filter housing.",
    difficulty: "Easy",
    tier: "free",
    estTime: "45-60 min",
    tools: [
      { name: "Toyota cartridge filter cap wrench (64mm, 14-flute)", note: "Same cap pattern across most of Toyota's modern lineup" },
      { name: "Toyota oil filter drain plug tool", note: "Empties the housing before you open it and keeps oil off the subframe" },
      { name: "Socket set + ratchet", note: "For the drain plug and the under-engine cover fasteners" },
      { name: "Torque wrench", note: "Range covering 15-35 ft-lb" },
      { name: "Drain pan", note: "8+ qt capacity" },
      { name: "Funnel" },
      { name: "Jack + 2 jack stands or drive-up ramps" },
      { name: "Nitrile gloves + safety glasses" },
    ],
    parts: [
      "6.4 qt (6.1 L) 0W-20 full-synthetic engine oil",
      "Toyota (or equivalent) cartridge oil filter element + housing O-rings",
      "Drain plug crush washer",
    ],
    safety: [
      "Let a hot engine cool for 10-15 min before draining -- hot oil causes burns.",
      "Use jack stands rated for the vehicle's weight; never work under a vehicle held only by a jack.",
      "Used oil and filters are hazardous waste -- take them to a recycling/auto parts drop-off, never pour down a drain.",
    ],
    torqueSpecs: [
      {
        fastener: "Oil pan drain plug",
        value: "30 ft-lb (40 Nm)",
        notes: "Curated reference figure -- not yet pulled from Open Labor Project for this vehicle.",
      },
      {
        fastener: "Oil filter housing cap",
        value: "18 ft-lb (25 Nm)",
        notes: "Curated reference figure. Plastic housing -- torque it, do not muscle it.",
      },
    ],
    steps: [
      {
        number: 1,
        title: "Warm the engine briefly, then park and secure",
        instructions: "Run the engine for 2-3 minutes so the oil flows more easily, then shut it off. Park on level ground, set the parking brake, and chock the wheels.",
        image: "/steps/generic-park-secure.svg",
      },
      {
        number: 2,
        title: "Raise the vehicle and remove the under-engine cover",
        instructions: "Support the vehicle on jack stands at the factory lift points. Remove the plastic under-engine cover -- it uses a mix of bolts and push clips, so keep them separated.",
        image: "/steps/generic-raise-vehicle.svg",
        warning: "Confirm the vehicle is stable on the stands before reaching underneath.",
      },
      {
        number: 3,
        title: "Drain the old oil",
        instructions: "Position the drain pan under the oil pan's drain plug. Loosen the plug with a socket, then finish removing it by hand and let the oil fully drain. Expect roughly 6.4 qt.",
        image: "/steps/oil-drain.svg",
      },
      {
        number: 4,
        title: "Drain the filter housing before you open it",
        instructions: "Loosen the cap about a quarter turn to vent it, then fit the small filter drain tool into the port on the bottom of the housing and let it empty into the pan. Skipping this is how this job earns its reputation for dumping oil down the subframe.",
        image: "/steps/oil-filter-cartridge.svg",
      },
      {
        number: 5,
        title: "Replace the element and reassemble",
        instructions: "Unscrew the cap with the cap wrench, lift out the old element, and wipe the housing clean. Replace the cap O-rings, lightly oil them, fit the new element, and thread the cap back in by hand before torquing. Fit a new crush washer on the drain plug and torque it to spec.",
        image: "/steps/oil-filter-install.svg",
        torque: [{ fastener: "Oil filter housing cap", value: "18 ft-lb (25 Nm)" }, { fastener: "Oil pan drain plug", value: "30 ft-lb (40 Nm)" }],
      },
      {
        number: 6,
        title: "Reinstall the cover and lower the vehicle",
        instructions: "Reattach the under-engine cover fasteners and carefully lower the vehicle back to the ground.",
        image: "/steps/generic-lower-vehicle.svg",
      },
      {
        number: 7,
        title: "Refill and check",
        instructions: "Remove the oil fill cap and add oil in stages, checking the dipstick as you approach 6.4 qt. Start the engine, let it run ~30 seconds, shut it off, and check underneath for leaks at the pan plug and the filter housing.",
        image: "/steps/oil-fill-check.svg",
      },
      {
        number: 8,
        title: "Final level check and maintenance reset",
        instructions: "Wait a few minutes for oil to settle, recheck the dipstick, and top off if needed. Reset the maintenance-required light from the dash trip menu. Dispose of the old oil and filter at a recycling drop-off.",
        image: "/steps/generic-cleanup.svg",
      },
    ],
  },
  {
    id: "honda-hrv-oil-change",
    vehicleId: "2021-honda-hrv-1.8l",
    title: "Engine Oil & Filter Change",
    jobType: "oil-change",
    summary: "Drain-and-refill oil service for the 1.8L R18 four, with a conventional spin-on filter.",
    difficulty: "Easy",
    tier: "free",
    estTime: "35-45 min",
    tools: [
      { name: "Oil filter wrench", note: "Cap-style 65mm/14-flute fits the factory Honda filter" },
      { name: "Socket set + ratchet", note: "For the drain plug and the underbody panel fasteners" },
      { name: "Torque wrench", note: "Range covering 10-35 ft-lb" },
      { name: "Drain pan", note: "6+ qt capacity" },
      { name: "Funnel" },
      { name: "Jack + 2 jack stands or drive-up ramps" },
      { name: "Nitrile gloves + safety glasses" },
    ],
    parts: [
      "3.6 qt (3.4 L) 0W-20 full-synthetic engine oil",
      "Spin-on oil filter (Honda 15400-PLM-A02 or equivalent)",
      "Drain plug crush washer (Honda uses a replaceable aluminum washer)",
    ],
    safety: [
      "Let a hot engine cool for 10-15 min before draining -- hot oil causes burns.",
      "Use jack stands rated for the vehicle's weight; never work under a vehicle held only by a jack.",
      "Used oil and filters are hazardous waste -- take them to a recycling/auto parts drop-off, never pour down a drain.",
    ],
    torqueSpecs: [
      {
        fastener: "Oil pan drain plug",
        value: "29 ft-lb (39 Nm)",
        notes: "Use new crush washer. Replace the aluminum washer every change.",
        provenance: { source: "open-labor-project", confidence: "high" },
      },
      {
        fastener: "Oil filter (spin-on)",
        value: "16 ft-lb (22 Nm)",
        notes: "Hand tight plus three-quarters of a turn.",
        provenance: { source: "open-labor-project", confidence: "high" },
      },
    ],
    steps: [
      {
        number: 1,
        title: "Warm the engine briefly, then park and secure",
        instructions: "Run the engine for 2-3 minutes so the oil flows more easily, then shut it off. Park on level ground, set the parking brake, and chock the wheels.",
        image: "/steps/generic-park-secure.svg",
      },
      {
        number: 2,
        title: "Raise the vehicle and remove the underbody panel",
        instructions: "Support the vehicle on jack stands at the factory lift points. Remove the plastic under-engine panel -- it uses a mix of bolts and push clips, so keep them separated.",
        image: "/steps/generic-raise-vehicle.svg",
        warning: "Confirm the vehicle is stable on the stands before reaching underneath.",
      },
      {
        number: 3,
        title: "Drain the old oil",
        instructions: "Position the drain pan under the oil pan's drain plug. Loosen the plug with a socket, then finish removing it by hand and let the oil fully drain. Expect roughly 3.6 qt.",
        image: "/steps/oil-drain.svg",
      },
      {
        number: 4,
        title: "Remove the spin-on filter",
        instructions: "The filter sits on the front of the block, reachable from underneath. Slide the drain pan under it, back it off with the filter wrench, then spin it off by hand -- it will be full of oil, so keep it upright until it clears.",
        image: "/steps/oil-filter-spinon-remove.svg",
        warning: "Check that the old filter's rubber gasket came off with it. A gasket left stuck to the engine will double up against the new filter and push oil out under pressure.",
      },
      {
        number: 5,
        title: "Install the new filter and drain plug",
        instructions: "Wipe the sealing surface clean, smear a film of fresh oil on the new filter's gasket, and thread it on by hand until the gasket contacts, then about three-quarters of a turn more. Fit a new washer on the drain plug and torque it to spec.",
        image: "/steps/oil-filter-install.svg",
        torque: [{ fastener: "Oil pan drain plug", value: "29 ft-lb (39 Nm)" }],
      },
      {
        number: 6,
        title: "Reinstall the underbody panel and lower the vehicle",
        instructions: "Reattach the panel fasteners and carefully lower the vehicle back to the ground.",
        image: "/steps/generic-lower-vehicle.svg",
      },
      {
        number: 7,
        title: "Refill and check",
        instructions: "Remove the oil fill cap and add oil in stages, checking the dipstick as you approach 3.6 qt. Start the engine, let it run ~30 seconds, shut it off, and check underneath for leaks at the plug and filter.",
        image: "/steps/oil-fill-check.svg",
      },
      {
        number: 8,
        title: "Final level check and reminder reset",
        instructions: "Wait a few minutes for oil to settle, recheck the dipstick, and top off if needed. Reset the Maintenance Minder from the driver information interface. Dispose of the old oil and filter at a recycling drop-off.",
        image: "/steps/generic-cleanup.svg",
      },
    ],
  },
  {
    id: "subaru-outback-oil-change",
    vehicleId: "2021-subaru-outback-2.5l",
    title: "Engine Oil & Filter Change",
    jobType: "oil-change",
    summary: "Drain-and-refill oil service for the 2.5L FB25 boxer, whose spin-on filter sits on top of the engine instead of underneath it.",
    difficulty: "Easy",
    tier: "free",
    estTime: "30-45 min",
    tools: [
      { name: "Oil filter wrench", note: "Cap-style 65mm/14-flute suits the factory filter" },
      { name: "Socket set + ratchet", note: "For the drain plug and the underbody panel fasteners" },
      { name: "Torque wrench", note: "Range covering 10-35 ft-lb" },
      { name: "Drain pan", note: "6+ qt capacity" },
      { name: "Funnel" },
      { name: "Jack + 2 jack stands or drive-up ramps" },
      { name: "Nitrile gloves + safety glasses" },
    ],
    parts: [
      "5.1 qt (4.8 L) 0W-20 full-synthetic engine oil",
      "Spin-on oil filter (Subaru 15208AA15A or equivalent)",
      "Drain plug crush washer (Subaru uses a replaceable aluminum washer)",
    ],
    safety: [
      "Let a hot engine cool for 10-15 min before draining -- hot oil causes burns.",
      "Use jack stands rated for the vehicle's weight; never work under a vehicle held only by a jack.",
      "Used oil and filters are hazardous waste -- take them to a recycling/auto parts drop-off, never pour down a drain.",
    ],
    torqueSpecs: [
      {
        fastener: "Oil pan drain plug",
        value: "33 ft-lb (44.7 Nm)",
        notes: "Use new crush washer. Replace the aluminum crush washer every change; Subaru pans are easy to weep from.",
        provenance: { source: "open-labor-project", confidence: "oem_verified" },
      },
      {
        fastener: "Oil filter (spin-on)",
        value: "10 ft-lb (14 Nm)",
        notes: "Hand tight plus three-quarters of a turn.",
        provenance: { source: "open-labor-project", confidence: "high" },
      },
    ],
    steps: [
      {
        number: 1,
        title: "Warm the engine briefly, then park and secure",
        instructions: "Run the engine for 2-3 minutes so the oil flows more easily, then shut it off. Park on level ground, set the parking brake, and chock the wheels.",
        image: "/steps/generic-park-secure.svg",
      },
      {
        number: 2,
        title: "Change the filter first, from above",
        instructions: "Open the hood. The spin-on filter is mounted vertically on the front of the engine, right at the top -- no jack needed for this part. Lay a rag underneath to catch the dribble, back the filter off with the wrench, and spin it off by hand.",
        image: "/steps/oil-filter-spinon-remove.svg",
        warning: "Check that the old filter's rubber gasket came off with it. A gasket left behind will double up against the new filter and push oil out under pressure.",
      },
      {
        number: 3,
        title: "Install the new filter",
        instructions: "Wipe the mounting surface clean, smear fresh oil on the new filter's gasket, and thread it on by hand until the gasket contacts, then about three-quarters of a turn more.",
        image: "/steps/oil-filter-install.svg",
      },
      {
        number: 4,
        title: "Raise the vehicle and remove the underbody panel",
        instructions: "Support the vehicle on jack stands at the factory lift points. Remove the plastic underbody panel to reach the drain plug.",
        image: "/steps/generic-raise-vehicle.svg",
        warning: "Confirm the vehicle is stable on the stands before reaching underneath.",
      },
      {
        number: 5,
        title: "Drain the old oil",
        instructions: "Position the drain pan under the oil pan's drain plug. Loosen the plug with a socket, then finish removing it by hand and let the oil fully drain. Expect roughly 5.1 qt.",
        image: "/steps/oil-drain.svg",
      },
      {
        number: 6,
        title: "Reinstall the drain plug and lower the vehicle",
        instructions: "Fit a new aluminum crush washer, torque the drain plug to spec, reattach the underbody panel, and lower the vehicle.",
        image: "/steps/generic-lower-vehicle.svg",
        torque: [{ fastener: "Oil pan drain plug", value: "33 ft-lb (44.7 Nm)" }],
      },
      {
        number: 7,
        title: "Refill and check",
        instructions: "Remove the oil fill cap and add oil in stages, checking the dipstick as you approach 5.1 qt. Start the engine, let it run ~30 seconds, shut it off, and check for leaks at the plug and filter.",
        image: "/steps/oil-fill-check.svg",
      },
      {
        number: 8,
        title: "Final level check and cleanup",
        instructions: "Wait a few minutes for oil to settle, recheck the dipstick, and top off if needed. Dispose of the old oil and filter at a recycling drop-off.",
        image: "/steps/generic-cleanup.svg",
      },
    ],
  },
  {
    id: "nissan-altima-oil-change",
    vehicleId: "2021-nissan-altima-2.5l",
    title: "Engine Oil & Filter Change",
    jobType: "oil-change",
    summary: "Drain-and-refill oil service for the 2.5L PR25DD four-cylinder, with a conventional spin-on filter.",
    difficulty: "Easy",
    tier: "free",
    estTime: "40-50 min",
    tools: [
      { name: "Oil filter wrench", note: "Cap-style or strap-style to suit the spin-on filter" },
      { name: "Socket set + ratchet", note: "For the drain plug and the splash shield fasteners" },
      { name: "Torque wrench", note: "Range covering 10-35 ft-lb" },
      { name: "Drain pan", note: "6+ qt capacity" },
      { name: "Funnel" },
      { name: "Jack + 2 jack stands or drive-up ramps" },
      { name: "Nitrile gloves + safety glasses" },
    ],
    parts: [
      "5.1 qt (4.8 L) 0W-20 full-synthetic engine oil",
      "Spin-on oil filter (Nissan 15208-65F0C or equivalent)",
      "Drain plug crush washer",
    ],
    safety: [
      "Let a hot engine cool for 10-15 min before draining -- hot oil causes burns.",
      "Use jack stands rated for the vehicle's weight; never work under a vehicle held only by a jack.",
      "Used oil and filters are hazardous waste -- take them to a recycling/auto parts drop-off, never pour down a drain.",
    ],
    torqueSpecs: [
      {
        fastener: "Oil pan drain plug",
        value: "25 ft-lb (34 Nm)",
        notes: "Use new crush washer. Same PR25DD engine as the Rogue guide in this file.",
        provenance: { source: "open-labor-project", confidence: "high" },
      },
      {
        fastener: "Oil filter (spin-on)",
        value: "13 ft-lb (18 Nm)",
        notes: "Hand tight plus three-quarters of a turn.",
        provenance: { source: "open-labor-project", confidence: "high" },
      },
    ],
    steps: [
      {
        number: 1,
        title: "Warm the engine briefly, then park and secure",
        instructions: "Run the engine for 2-3 minutes so the oil flows more easily, then shut it off. Park on level ground, set the parking brake, and chock the wheels.",
        image: "/steps/generic-park-secure.svg",
      },
      {
        number: 2,
        title: "Raise the vehicle and remove the splash shield",
        instructions: "Support the vehicle on jack stands at the factory lift points. Remove the plastic under-engine splash shield -- it is held by a mix of bolts and push clips, so keep them separated.",
        image: "/steps/generic-raise-vehicle.svg",
        warning: "Confirm the vehicle is stable on the stands before reaching underneath.",
      },
      {
        number: 3,
        title: "Drain the old oil",
        instructions: "Position the drain pan under the oil pan's drain plug. Loosen the plug with a socket, then finish removing it by hand and let the oil fully drain. Expect roughly 5.1 qt.",
        image: "/steps/oil-drain.svg",
      },
      {
        number: 4,
        title: "Remove the spin-on filter",
        instructions: "The filter sits low on the front of the block. Slide the drain pan under it, back it off with the filter wrench, then spin it off by hand -- it will be full of oil, so keep it upright until it clears.",
        image: "/steps/oil-filter-spinon-remove.svg",
        warning: "Check that the old filter's rubber gasket came off with it. A gasket left stuck to the engine will double up against the new filter and push oil out under pressure.",
      },
      {
        number: 5,
        title: "Install the new filter and drain plug",
        instructions: "Wipe the sealing surface clean, smear a film of fresh oil on the new filter's gasket, and thread it on by hand until the gasket contacts, then about three-quarters of a turn more. Fit a new washer on the drain plug and torque it to spec.",
        image: "/steps/oil-filter-install.svg",
        torque: [{ fastener: "Oil pan drain plug", value: "25 ft-lb (34 Nm)" }],
      },
      {
        number: 6,
        title: "Reinstall the splash shield and lower the vehicle",
        instructions: "Reattach the splash shield bolts and clips, then carefully lower the vehicle back to the ground.",
        image: "/steps/generic-lower-vehicle.svg",
      },
      {
        number: 7,
        title: "Refill and check",
        instructions: "Remove the oil fill cap and add oil in stages, checking the dipstick as you approach 5.1 qt. Start the engine, let it run ~30 seconds, shut it off, and check underneath for leaks at the plug and filter.",
        image: "/steps/oil-fill-check.svg",
      },
      {
        number: 8,
        title: "Final level check and reminder reset",
        instructions: "Wait a few minutes for oil to settle, recheck the dipstick, and top off if needed. Reset the maintenance reminder from the vehicle information display. Dispose of the old oil and filter at a recycling drop-off.",
        image: "/steps/generic-cleanup.svg",
      },
    ],
  },
  {
    id: "nissan-sentra-oil-change",
    vehicleId: "2021-nissan-sentra-2.0l",
    title: "Engine Oil & Filter Change",
    jobType: "oil-change",
    summary: "Drain-and-refill oil service for the 2.0L MRA20DD four-cylinder, with a conventional spin-on filter.",
    difficulty: "Easy",
    tier: "free",
    estTime: "35-45 min",
    tools: [
      { name: "Oil filter wrench", note: "Cap-style or strap-style to suit the spin-on filter" },
      { name: "Socket set + ratchet", note: "For the drain plug and the splash shield fasteners" },
      { name: "Torque wrench", note: "Range covering 10-35 ft-lb" },
      { name: "Drain pan", note: "6+ qt capacity" },
      { name: "Funnel" },
      { name: "Jack + 2 jack stands or drive-up ramps" },
      { name: "Nitrile gloves + safety glasses" },
    ],
    parts: [
      "4.2 qt (4.0 L) 0W-20 full-synthetic engine oil",
      "Spin-on oil filter (Nissan 15208-65F0C or equivalent)",
      "Drain plug crush washer",
    ],
    safety: [
      "Let a hot engine cool for 10-15 min before draining -- hot oil causes burns.",
      "Use jack stands rated for the vehicle's weight; never work under a vehicle held only by a jack.",
      "Used oil and filters are hazardous waste -- take them to a recycling/auto parts drop-off, never pour down a drain.",
    ],
    torqueSpecs: [
      {
        fastener: "Oil pan drain plug",
        value: "25 ft-lb (34 Nm)",
        notes: "Use new crush washer. OLP lists the engine as \"2.0L I4 MR20DD\" -- same 2.0L four this catalog calls MRA20DD, just a shorter internal code.",
        provenance: { source: "open-labor-project", confidence: "high" },
      },
      {
        fastener: "Oil filter (spin-on)",
        value: "13 ft-lb (18 Nm)",
        notes: "Hand tight plus three-quarters of a turn.",
        provenance: { source: "open-labor-project", confidence: "high" },
      },
    ],
    steps: [
      {
        number: 1,
        title: "Warm the engine briefly, then park and secure",
        instructions: "Run the engine for 2-3 minutes so the oil flows more easily, then shut it off. Park on level ground, set the parking brake, and chock the wheels.",
        image: "/steps/generic-park-secure.svg",
      },
      {
        number: 2,
        title: "Raise the vehicle and remove the splash shield",
        instructions: "Support the vehicle on jack stands at the factory lift points. Remove the plastic under-engine splash shield -- it is held by a mix of bolts and push clips, so keep them separated.",
        image: "/steps/generic-raise-vehicle.svg",
        warning: "Confirm the vehicle is stable on the stands before reaching underneath.",
      },
      {
        number: 3,
        title: "Drain the old oil",
        instructions: "Position the drain pan under the oil pan's drain plug. Loosen the plug with a socket, then finish removing it by hand and let the oil fully drain. Expect roughly 4.2 qt.",
        image: "/steps/oil-drain.svg",
      },
      {
        number: 4,
        title: "Remove the spin-on filter",
        instructions: "The filter sits low on the front of the block. Slide the drain pan under it, back it off with the filter wrench, then spin it off by hand -- it will be full of oil, so keep it upright until it clears.",
        image: "/steps/oil-filter-spinon-remove.svg",
        warning: "Check that the old filter's rubber gasket came off with it. A gasket left stuck to the engine will double up against the new filter and push oil out under pressure.",
      },
      {
        number: 5,
        title: "Install the new filter and drain plug",
        instructions: "Wipe the sealing surface clean, smear a film of fresh oil on the new filter's gasket, and thread it on by hand until the gasket contacts, then about three-quarters of a turn more. Fit a new washer on the drain plug and torque it to spec.",
        image: "/steps/oil-filter-install.svg",
        torque: [{ fastener: "Oil pan drain plug", value: "25 ft-lb (34 Nm)" }],
      },
      {
        number: 6,
        title: "Reinstall the splash shield and lower the vehicle",
        instructions: "Reattach the splash shield bolts and clips, then carefully lower the vehicle back to the ground.",
        image: "/steps/generic-lower-vehicle.svg",
      },
      {
        number: 7,
        title: "Refill and check",
        instructions: "Remove the oil fill cap and add oil in stages, checking the dipstick as you approach 4.2 qt. Start the engine, let it run ~30 seconds, shut it off, and check underneath for leaks at the plug and filter.",
        image: "/steps/oil-fill-check.svg",
      },
      {
        number: 8,
        title: "Final level check and reminder reset",
        instructions: "Wait a few minutes for oil to settle, recheck the dipstick, and top off if needed. Reset the maintenance reminder from the vehicle information display. Dispose of the old oil and filter at a recycling drop-off.",
        image: "/steps/generic-cleanup.svg",
      },
    ],
  },
  {
    id: "toyota-highlander-oil-change",
    vehicleId: "2021-toyota-highlander-3.5l",
    title: "Engine Oil & Filter Change",
    jobType: "oil-change",
    summary: "Drain-and-refill oil service for the 3.5L 2GR-FKS V6, with Toyota's under-engine cartridge filter housing.",
    difficulty: "Easy",
    tier: "free",
    estTime: "45-60 min",
    tools: [
      { name: "Toyota cartridge filter cap wrench (64mm, 14-flute)", note: "Same cap pattern across most of Toyota's modern lineup" },
      { name: "Toyota oil filter drain plug tool", note: "Empties the housing before you open it and keeps oil off the subframe" },
      { name: "Socket set + ratchet", note: "For the drain plug and the under-engine cover fasteners" },
      { name: "Torque wrench", note: "Range covering 15-35 ft-lb" },
      { name: "Drain pan", note: "8+ qt capacity" },
      { name: "Funnel" },
      { name: "Jack + 2 jack stands or drive-up ramps" },
      { name: "Nitrile gloves + safety glasses" },
    ],
    parts: [
      "6.4 qt (6.1 L) 0W-20 full-synthetic engine oil",
      "Toyota (or equivalent) cartridge oil filter element + housing O-rings",
      "Drain plug crush washer",
    ],
    safety: [
      "Let a hot engine cool for 10-15 min before draining -- hot oil causes burns.",
      "Use jack stands rated for the vehicle's weight; never work under a vehicle held only by a jack.",
      "Used oil and filters are hazardous waste -- take them to a recycling/auto parts drop-off, never pour down a drain.",
    ],
    torqueSpecs: [
      {
        fastener: "Oil pan drain plug",
        value: "30 ft-lb (40 Nm)",
        notes: "Curated reference figure -- not yet pulled from Open Labor Project for this vehicle.",
      },
      {
        fastener: "Oil filter housing cap",
        value: "18 ft-lb (25 Nm)",
        notes: "Curated reference figure. Plastic housing -- torque it, do not muscle it.",
      },
    ],
    steps: [
      {
        number: 1,
        title: "Warm the engine briefly, then park and secure",
        instructions: "Run the engine for 2-3 minutes so the oil flows more easily, then shut it off. Park on level ground, set the parking brake, and chock the wheels.",
        image: "/steps/generic-park-secure.svg",
      },
      {
        number: 2,
        title: "Raise the vehicle and remove the under-engine cover",
        instructions: "Support the vehicle on jack stands at the factory lift points. Remove the plastic under-engine cover -- it uses a mix of bolts and push clips, so keep them separated.",
        image: "/steps/generic-raise-vehicle.svg",
        warning: "Confirm the vehicle is stable on the stands before reaching underneath.",
      },
      {
        number: 3,
        title: "Drain the old oil",
        instructions: "Position the drain pan under the oil pan's drain plug. Loosen the plug with a socket, then finish removing it by hand and let the oil fully drain. Expect roughly 6.4 qt.",
        image: "/steps/oil-drain.svg",
      },
      {
        number: 4,
        title: "Drain the filter housing before you open it",
        instructions: "Loosen the cap about a quarter turn to vent it, then fit the small filter drain tool into the port on the bottom of the housing and let it empty into the pan. Skipping this is how this job earns its reputation for dumping oil down the subframe.",
        image: "/steps/oil-filter-cartridge.svg",
      },
      {
        number: 5,
        title: "Replace the element and reassemble",
        instructions: "Unscrew the cap with the cap wrench, lift out the old element, and wipe the housing clean. Replace the cap O-rings, lightly oil them, fit the new element, and thread the cap back in by hand before torquing. Fit a new crush washer on the drain plug and torque it to spec.",
        image: "/steps/oil-filter-install.svg",
        torque: [{ fastener: "Oil filter housing cap", value: "18 ft-lb (25 Nm)" }, { fastener: "Oil pan drain plug", value: "30 ft-lb (40 Nm)" }],
      },
      {
        number: 6,
        title: "Reinstall the cover and lower the vehicle",
        instructions: "Reattach the under-engine cover fasteners and carefully lower the vehicle back to the ground.",
        image: "/steps/generic-lower-vehicle.svg",
      },
      {
        number: 7,
        title: "Refill and check",
        instructions: "Remove the oil fill cap and add oil in stages, checking the dipstick as you approach 6.4 qt. Start the engine, let it run ~30 seconds, shut it off, and check underneath for leaks at the pan plug and the filter housing.",
        image: "/steps/oil-fill-check.svg",
      },
      {
        number: 8,
        title: "Final level check and maintenance reset",
        instructions: "Wait a few minutes for oil to settle, recheck the dipstick, and top off if needed. Reset the maintenance-required light from the dash trip menu. Dispose of the old oil and filter at a recycling drop-off.",
        image: "/steps/generic-cleanup.svg",
      },
    ],
  },
  {
    id: "toyota-4runner-oil-change",
    vehicleId: "2021-toyota-4runner-4.0l",
    title: "Engine Oil & Filter Change",
    jobType: "oil-change",
    summary: "Drain-and-refill oil service for the 4.0L 1GR-FE V6, with its under-engine cartridge filter housing.",
    difficulty: "Easy",
    tier: "free",
    estTime: "50-65 min",
    tools: [
      { name: "Toyota cartridge filter cap wrench (64mm, 14-flute)", note: "Same cap pattern across most of Toyota's modern lineup" },
      { name: "Toyota oil filter drain plug tool", note: "Empties the housing before you open it and keeps oil off the subframe" },
      { name: "Socket set + ratchet", note: "For the drain plug and the under-engine cover fasteners" },
      { name: "Torque wrench", note: "Range covering 15-35 ft-lb" },
      { name: "Drain pan", note: "8+ qt capacity" },
      { name: "Funnel" },
      { name: "Jack + 2 jack stands or drive-up ramps" },
      { name: "Nitrile gloves + safety glasses" },
    ],
    parts: [
      "6.2 qt (5.9 L) 0W-20 full-synthetic engine oil",
      "Toyota (or equivalent) cartridge oil filter element + housing O-rings",
      "Drain plug crush washer",
    ],
    safety: [
      "Let a hot engine cool for 10-15 min before draining -- hot oil causes burns.",
      "Use jack stands rated for the vehicle's weight; never work under a vehicle held only by a jack.",
      "Used oil and filters are hazardous waste -- take them to a recycling/auto parts drop-off, never pour down a drain.",
    ],
    torqueSpecs: [
      {
        fastener: "Oil pan drain plug",
        value: "25 ft-lb (34 Nm)",
        notes: "Use new crush washer.",
        provenance: { source: "open-labor-project", confidence: "high" },
      },
      {
        fastener: "Oil filter housing cap",
        value: "18 ft-lb (25 Nm)",
        notes: "Plastic housing -- torque it, do not muscle it.",
        provenance: { source: "open-labor-project", confidence: "high" },
      },
    ],
    steps: [
      {
        number: 1,
        title: "Warm the engine briefly, then park and secure",
        instructions: "Run the engine for 2-3 minutes so the oil flows more easily, then shut it off. Park on level ground, set the parking brake, and chock the wheels.",
        image: "/steps/generic-park-secure.svg",
      },
      {
        number: 2,
        title: "Raise the vehicle and remove the under-engine cover",
        instructions: "Support the vehicle on jack stands at the factory lift points. Remove the plastic under-engine cover -- it uses a mix of bolts and push clips, so keep them separated.",
        image: "/steps/generic-raise-vehicle.svg",
        warning: "Confirm the vehicle is stable on the stands before reaching underneath.",
      },
      {
        number: 3,
        title: "Drain the old oil",
        instructions: "Position the drain pan under the oil pan's drain plug. Loosen the plug with a socket, then finish removing it by hand and let the oil fully drain. Expect roughly 6.2 qt.",
        image: "/steps/oil-drain.svg",
      },
      {
        number: 4,
        title: "Drain the filter housing before you open it",
        instructions: "Loosen the cap about a quarter turn to vent it, then fit the small filter drain tool into the port on the bottom of the housing and let it empty into the pan. Skipping this is how this job earns its reputation for dumping oil down the subframe.",
        image: "/steps/oil-filter-cartridge.svg",
      },
      {
        number: 5,
        title: "Replace the element and reassemble",
        instructions: "Unscrew the cap with the cap wrench, lift out the old element, and wipe the housing clean. Replace the cap O-rings, lightly oil them, fit the new element, and thread the cap back in by hand before torquing. Fit a new crush washer on the drain plug and torque it to spec.",
        image: "/steps/oil-filter-install.svg",
        torque: [{ fastener: "Oil filter housing cap", value: "18 ft-lb (25 Nm)" }, { fastener: "Oil pan drain plug", value: "25 ft-lb (34 Nm)" }],
      },
      {
        number: 6,
        title: "Reinstall the cover and lower the vehicle",
        instructions: "Reattach the under-engine cover fasteners and carefully lower the vehicle back to the ground.",
        image: "/steps/generic-lower-vehicle.svg",
      },
      {
        number: 7,
        title: "Refill and check",
        instructions: "Remove the oil fill cap and add oil in stages, checking the dipstick as you approach 6.2 qt. Start the engine, let it run ~30 seconds, shut it off, and check underneath for leaks at the pan plug and the filter housing.",
        image: "/steps/oil-fill-check.svg",
      },
      {
        number: 8,
        title: "Final level check and maintenance reset",
        instructions: "Wait a few minutes for oil to settle, recheck the dipstick, and top off if needed. Reset the maintenance-required light from the dash trip menu. Dispose of the old oil and filter at a recycling drop-off.",
        image: "/steps/generic-cleanup.svg",
      },
    ],
  },
  {
    id: "toyota-prius-oil-change",
    vehicleId: "2021-toyota-prius-1.8l",
    title: "Engine Oil & Filter Change",
    jobType: "oil-change",
    summary: "Drain-and-refill oil service for the 1.8L hybrid four. A hybrid takes a completely normal oil change -- the engine just does not run all the time.",
    difficulty: "Easy",
    tier: "free",
    estTime: "40-55 min",
    tools: [
      { name: "Toyota cartridge filter cap wrench (64mm, 14-flute)", note: "Same cap pattern across most of Toyota's modern lineup" },
      { name: "Toyota oil filter drain plug tool", note: "Empties the housing before you open it and keeps oil off the subframe" },
      { name: "Socket set + ratchet", note: "For the drain plug and the under-engine cover fasteners" },
      { name: "Torque wrench", note: "Range covering 15-35 ft-lb" },
      { name: "Drain pan", note: "6+ qt capacity" },
      { name: "Funnel" },
      { name: "Jack + 2 jack stands or drive-up ramps" },
      { name: "Nitrile gloves + safety glasses" },
    ],
    parts: [
      "4.4 qt (4.2 L) 0W-16 full-synthetic engine oil",
      "Toyota (or equivalent) cartridge oil filter element + housing O-rings",
      "Drain plug crush washer",
    ],
    safety: [
      "Press the power button OFF and confirm the READY light is out before working on the car. A hybrid that is silent may still be powered up, and the engine can start on its own at any moment to charge the traction battery.",
      "Do not cut, unclip or lean on anything with ORANGE cabling or connectors -- that is the high-voltage traction system. Nothing in this procedure requires touching it.",
      "Let a hot engine cool for 10-15 min before draining -- hot oil causes burns.",
      "Use jack stands rated for the vehicle's weight; never work under a vehicle held only by a jack.",
      "Used oil and filters are hazardous waste -- take them to a recycling/auto parts drop-off, never pour down a drain.",
    ],
    torqueSpecs: [
      {
        fastener: "Oil pan drain plug",
        value: "27 ft-lb (37 Nm)",
        notes: "Use new crush washer.",
        provenance: { source: "open-labor-project", confidence: "high" },
      },
      {
        fastener: "Oil filter housing cap",
        value: "18 ft-lb (25 Nm)",
        notes: "Plastic housing -- torque it, do not muscle it.",
        provenance: { source: "open-labor-project", confidence: "high" },
      },
    ],
    steps: [
      {
        number: 1,
        title: "Confirm the car is fully OFF, then park and secure",
        instructions: "This is the step that is different on a hybrid. Press the power button until the READY light is OUT, then confirm the dash is dark. Park on level ground, set the parking brake, and chock the wheels. There is no need to warm this engine up first -- it will usually already be warm from normal driving, and you do not want it deciding to start itself while you are under the car.",
        image: "/steps/generic-park-secure.svg",
        warning: "If the READY light is on, the engine can crank and start without warning even though nothing is running. Confirm it is off before going underneath.",
      },
      {
        number: 2,
        title: "Raise the vehicle and remove the under-engine cover",
        instructions: "Support the vehicle on jack stands at the factory lift points. Remove the plastic under-engine cover -- it uses a mix of bolts and push clips, so keep them separated.",
        image: "/steps/generic-raise-vehicle.svg",
        warning: "Confirm the vehicle is stable on the stands before reaching underneath.",
      },
      {
        number: 3,
        title: "Drain the old oil",
        instructions: "Position the drain pan under the oil pan's drain plug. Loosen the plug with a socket, then finish removing it by hand and let the oil fully drain. Expect roughly 4.4 qt.",
        image: "/steps/oil-drain.svg",
      },
      {
        number: 4,
        title: "Drain the filter housing before you open it",
        instructions: "Loosen the cap about a quarter turn to vent it, then fit the small filter drain tool into the port on the bottom of the housing and let it empty into the pan. Skipping this is how this job earns its reputation for dumping oil down the subframe.",
        image: "/steps/oil-filter-cartridge.svg",
      },
      {
        number: 5,
        title: "Replace the element and reassemble",
        instructions: "Unscrew the cap with the cap wrench, lift out the old element, and wipe the housing clean. Replace the cap O-rings, lightly oil them, fit the new element, and thread the cap back in by hand before torquing. Fit a new crush washer on the drain plug and torque it to spec.",
        image: "/steps/oil-filter-install.svg",
        torque: [{ fastener: "Oil filter housing cap", value: "18 ft-lb (25 Nm)" }, { fastener: "Oil pan drain plug", value: "27 ft-lb (37 Nm)" }],
      },
      {
        number: 6,
        title: "Reinstall the cover and lower the vehicle",
        instructions: "Reattach the under-engine cover fasteners and carefully lower the vehicle back to the ground.",
        image: "/steps/generic-lower-vehicle.svg",
      },
      {
        number: 7,
        title: "Refill and check",
        instructions: "Remove the oil fill cap and add oil in stages, checking the dipstick as you approach 4.4 qt. Start the engine, let it run ~30 seconds, shut it off, and check underneath for leaks at the pan plug and the filter housing.",
        image: "/steps/oil-fill-check.svg",
      },
      {
        number: 8,
        title: "Final level check and maintenance reset",
        instructions: "Wait a few minutes for oil to settle, recheck the dipstick, and top off if needed. Reset the maintenance-required light from the dash trip menu. Dispose of the old oil and filter at a recycling drop-off.",
        image: "/steps/generic-cleanup.svg",
      },
    ],
  },
  {
    id: "honda-pilot-oil-change",
    vehicleId: "2021-honda-pilot-3.5l",
    title: "Engine Oil & Filter Change",
    jobType: "oil-change",
    summary: "Drain-and-refill oil service for the 3.5L J35Y6 V6, with a conventional spin-on filter.",
    difficulty: "Easy",
    tier: "free",
    estTime: "40-55 min",
    tools: [
      { name: "Oil filter wrench", note: "Cap-style 64mm/14-flute fits the factory Honda filter" },
      { name: "Socket set + ratchet", note: "For the drain plug and the splash shield fasteners" },
      { name: "Torque wrench", note: "Range covering 10-35 ft-lb" },
      { name: "Drain pan", note: "6+ qt capacity" },
      { name: "Funnel" },
      { name: "Jack + 2 jack stands or drive-up ramps" },
      { name: "Nitrile gloves + safety glasses" },
    ],
    parts: [
      "4.5 qt (4.3 L) 0W-20 full-synthetic engine oil",
      "Spin-on oil filter (Honda 15400-PLM-A02 or equivalent)",
      "Drain plug crush washer (Honda uses a replaceable aluminum washer)",
    ],
    safety: [
      "Let a hot engine cool for 10-15 min before draining -- hot oil causes burns.",
      "Use jack stands rated for the vehicle's weight; never work under a vehicle held only by a jack.",
      "Used oil and filters are hazardous waste -- take them to a recycling/auto parts drop-off, never pour down a drain.",
    ],
    torqueSpecs: [
      {
        fastener: "Oil pan drain plug",
        value: "29 ft-lb (39 Nm)",
        notes: "Replace the aluminum washer every change.",
        provenance: { source: "open-labor-project", confidence: "high" },
      },
      {
        fastener: "Oil filter (spin-on)",
        value: "13 ft-lb (18 Nm)",
        notes: "Reference torque only. In practice most techs seat the gasket by hand and add three-quarters of a turn.",
      },
    ],
    steps: [
      {
        number: 1,
        title: "Warm the engine briefly, then park and secure",
        instructions: "Run the engine for 2-3 minutes so the oil flows more easily, then shut it off. Park on level ground, set the parking brake, and chock the wheels.",
        image: "/steps/generic-park-secure.svg",
      },
      {
        number: 2,
        title: "Raise the vehicle and remove the splash shield",
        instructions: "Support the vehicle on jack stands at the factory lift points. Remove the plastic under-engine splash shield -- it is held by a mix of bolts and push clips, so keep them separated.",
        image: "/steps/generic-raise-vehicle.svg",
        warning: "Confirm the vehicle is stable on the stands before reaching underneath.",
      },
      {
        number: 3,
        title: "Drain the old oil",
        instructions: "Position the drain pan under the oil pan's drain plug. Loosen the plug with a socket, then finish removing it by hand and let the oil fully drain. Expect roughly 4.5 qt.",
        image: "/steps/oil-drain.svg",
      },
      {
        number: 4,
        title: "Remove the spin-on filter",
        instructions: "The filter sits on the front of the engine behind the radiator support, reachable from underneath. Slide the drain pan under it, back it off with the filter wrench, then spin it off by hand -- it will be full of oil, so keep it upright until it clears.",
        image: "/steps/oil-filter-spinon-remove.svg",
        warning: "Check that the old filter's rubber gasket came off with it. A gasket left stuck to the engine will double up against the new filter and push oil out under pressure.",
      },
      {
        number: 5,
        title: "Install the new filter and drain plug",
        instructions: "Wipe the sealing surface clean, smear a film of fresh oil on the new filter's gasket, and thread it on by hand until the gasket contacts, then about three-quarters of a turn more. Fit a new washer on the drain plug and torque it to spec.",
        image: "/steps/oil-filter-install.svg",
        torque: [{ fastener: "Oil pan drain plug", value: "29 ft-lb (39 Nm)" }],
      },
      {
        number: 6,
        title: "Reinstall the splash shield and lower the vehicle",
        instructions: "Reattach the splash shield bolts and clips, then carefully lower the vehicle back to the ground.",
        image: "/steps/generic-lower-vehicle.svg",
      },
      {
        number: 7,
        title: "Refill and check",
        instructions: "Remove the oil fill cap and add oil in stages, checking the dipstick as you approach 4.5 qt. Start the engine, let it run ~30 seconds, shut it off, and check underneath for leaks at the plug and filter.",
        image: "/steps/oil-fill-check.svg",
      },
      {
        number: 8,
        title: "Final level check and reminder reset",
        instructions: "Wait a few minutes for oil to settle, recheck the dipstick, and top off if needed. Reset the Maintenance Minder from the driver information interface. Dispose of the old oil and filter at a recycling drop-off.",
        image: "/steps/generic-cleanup.svg",
      },
    ],
  },
  {
    id: "honda-odyssey-oil-change",
    vehicleId: "2021-honda-odyssey-3.5l",
    title: "Engine Oil & Filter Change",
    jobType: "oil-change",
    summary: "Drain-and-refill oil service for the 3.5L J35Y6 V6, with a conventional spin-on filter.",
    difficulty: "Easy",
    tier: "free",
    estTime: "40-55 min",
    tools: [
      { name: "Oil filter wrench", note: "Cap-style 64mm/14-flute fits the factory Honda filter" },
      { name: "Socket set + ratchet", note: "For the drain plug and the splash shield fasteners" },
      { name: "Torque wrench", note: "Range covering 10-35 ft-lb" },
      { name: "Drain pan", note: "6+ qt capacity" },
      { name: "Funnel" },
      { name: "Jack + 2 jack stands or drive-up ramps" },
      { name: "Nitrile gloves + safety glasses" },
    ],
    parts: [
      "4.5 qt (4.3 L) 0W-20 full-synthetic engine oil",
      "Spin-on oil filter (Honda 15400-PLM-A02 or equivalent)",
      "Drain plug crush washer (Honda uses a replaceable aluminum washer)",
    ],
    safety: [
      "Let a hot engine cool for 10-15 min before draining -- hot oil causes burns.",
      "Use jack stands rated for the vehicle's weight; never work under a vehicle held only by a jack.",
      "Used oil and filters are hazardous waste -- take them to a recycling/auto parts drop-off, never pour down a drain.",
    ],
    torqueSpecs: [
      {
        fastener: "Oil pan drain plug",
        value: "29 ft-lb (39 Nm)",
        notes: "Replace the aluminum washer every change.",
        provenance: { source: "open-labor-project", confidence: "high" },
      },
      {
        fastener: "Oil filter (spin-on)",
        value: "13 ft-lb (18 Nm)",
        notes: "Reference torque only. In practice most techs seat the gasket by hand and add three-quarters of a turn.",
      },
    ],
    steps: [
      {
        number: 1,
        title: "Warm the engine briefly, then park and secure",
        instructions: "Run the engine for 2-3 minutes so the oil flows more easily, then shut it off. Park on level ground, set the parking brake, and chock the wheels.",
        image: "/steps/generic-park-secure.svg",
      },
      {
        number: 2,
        title: "Raise the vehicle and remove the splash shield",
        instructions: "Support the vehicle on jack stands at the factory lift points. Remove the plastic under-engine splash shield -- it is held by a mix of bolts and push clips, so keep them separated.",
        image: "/steps/generic-raise-vehicle.svg",
        warning: "Confirm the vehicle is stable on the stands before reaching underneath.",
      },
      {
        number: 3,
        title: "Drain the old oil",
        instructions: "Position the drain pan under the oil pan's drain plug. Loosen the plug with a socket, then finish removing it by hand and let the oil fully drain. Expect roughly 4.5 qt.",
        image: "/steps/oil-drain.svg",
      },
      {
        number: 4,
        title: "Remove the spin-on filter",
        instructions: "The filter sits on the front of the engine behind the radiator support, reachable from underneath. Slide the drain pan under it, back it off with the filter wrench, then spin it off by hand -- it will be full of oil, so keep it upright until it clears.",
        image: "/steps/oil-filter-spinon-remove.svg",
        warning: "Check that the old filter's rubber gasket came off with it. A gasket left stuck to the engine will double up against the new filter and push oil out under pressure.",
      },
      {
        number: 5,
        title: "Install the new filter and drain plug",
        instructions: "Wipe the sealing surface clean, smear a film of fresh oil on the new filter's gasket, and thread it on by hand until the gasket contacts, then about three-quarters of a turn more. Fit a new washer on the drain plug and torque it to spec.",
        image: "/steps/oil-filter-install.svg",
        torque: [{ fastener: "Oil pan drain plug", value: "29 ft-lb (39 Nm)" }],
      },
      {
        number: 6,
        title: "Reinstall the splash shield and lower the vehicle",
        instructions: "Reattach the splash shield bolts and clips, then carefully lower the vehicle back to the ground.",
        image: "/steps/generic-lower-vehicle.svg",
      },
      {
        number: 7,
        title: "Refill and check",
        instructions: "Remove the oil fill cap and add oil in stages, checking the dipstick as you approach 4.5 qt. Start the engine, let it run ~30 seconds, shut it off, and check underneath for leaks at the plug and filter.",
        image: "/steps/oil-fill-check.svg",
      },
      {
        number: 8,
        title: "Final level check and reminder reset",
        instructions: "Wait a few minutes for oil to settle, recheck the dipstick, and top off if needed. Reset the Maintenance Minder from the driver information interface. Dispose of the old oil and filter at a recycling drop-off.",
        image: "/steps/generic-cleanup.svg",
      },
    ],
  },
  {
    id: "honda-fit-oil-change",
    vehicleId: "2019-honda-fit-1.5l",
    title: "Engine Oil & Filter Change",
    jobType: "oil-change",
    summary: "Drain-and-refill oil service for the 1.5L L15Z1 four, with a conventional spin-on filter. The smallest oil change in the catalog.",
    difficulty: "Easy",
    tier: "free",
    estTime: "30-40 min",
    tools: [
      { name: "Oil filter wrench", note: "Cap-style 65mm/14-flute fits the factory Honda filter" },
      { name: "Socket set + ratchet", note: "For the drain plug and the splash shield fasteners" },
      { name: "Torque wrench", note: "Range covering 10-35 ft-lb" },
      { name: "Drain pan", note: "4+ qt capacity is plenty here" },
      { name: "Funnel" },
      { name: "Jack + 2 jack stands or drive-up ramps" },
      { name: "Nitrile gloves + safety glasses" },
    ],
    parts: [
      "3.4 qt (3.2 L) 0W-20 full-synthetic engine oil",
      "Spin-on oil filter (Honda 15400-PLM-A02 or equivalent)",
      "Drain plug crush washer (Honda uses a replaceable aluminum washer)",
    ],
    safety: [
      "Let a hot engine cool for 10-15 min before draining -- hot oil causes burns.",
      "Use jack stands rated for the vehicle's weight; never work under a vehicle held only by a jack. This is a light car, which makes it easy to underestimate -- it still weighs more than you do.",
      "Used oil and filters are hazardous waste -- take them to a recycling/auto parts drop-off, never pour down a drain.",
    ],
    torqueSpecs: [
      {
        fastener: "Oil pan drain plug",
        value: "29 ft-lb (39 Nm)",
        notes: "Curated reference figure -- not yet pulled from Open Labor Project for this vehicle. Replace the aluminum washer every change; a small aluminum pan is easy to weep from and expensive to strip.",
      },
      {
        fastener: "Oil filter (spin-on)",
        value: "13 ft-lb (18 Nm)",
        notes: "Reference torque only. In practice most techs seat the gasket by hand and add three-quarters of a turn.",
      },
    ],
    steps: [
      {
        number: 1,
        title: "Warm the engine briefly, then park and secure",
        instructions: "Run the engine for 2-3 minutes so the oil flows more easily, then shut it off. Park on level ground, set the parking brake, and chock the wheels.",
        image: "/steps/generic-park-secure.svg",
      },
      {
        number: 2,
        title: "Raise the vehicle and remove the splash shield",
        instructions: "Support the vehicle on jack stands at the factory lift points. Remove the plastic under-engine splash shield -- it is held by a mix of bolts and push clips, so keep them separated.",
        image: "/steps/generic-raise-vehicle.svg",
        warning: "Confirm the vehicle is stable on the stands before reaching underneath.",
      },
      {
        number: 3,
        title: "Drain the old oil",
        instructions: "Position the drain pan under the oil pan's drain plug. Loosen the plug with a socket, then finish removing it by hand and let the oil fully drain. Expect roughly 3.4 qt -- noticeably less than most cars, so do not overfill on the way back.",
        image: "/steps/oil-drain.svg",
      },
      {
        number: 4,
        title: "Remove the spin-on filter",
        instructions: "The filter sits on the front of the block, reachable from underneath. Slide the drain pan under it, back it off with the filter wrench, then spin it off by hand -- it will be full of oil, so keep it upright until it clears.",
        image: "/steps/oil-filter-spinon-remove.svg",
        warning: "Check that the old filter's rubber gasket came off with it. A gasket left stuck to the engine will double up against the new filter and push oil out under pressure.",
      },
      {
        number: 5,
        title: "Install the new filter and drain plug",
        instructions: "Wipe the sealing surface clean, smear a film of fresh oil on the new filter's gasket, and thread it on by hand until the gasket contacts, then about three-quarters of a turn more. Fit a new aluminum washer on the drain plug and torque it to spec.",
        image: "/steps/oil-filter-install.svg",
        torque: [{ fastener: "Oil pan drain plug", value: "29 ft-lb (39 Nm)" }],
      },
      {
        number: 6,
        title: "Reinstall the splash shield and lower the vehicle",
        instructions: "Reattach the splash shield bolts and clips, then carefully lower the vehicle back to the ground.",
        image: "/steps/generic-lower-vehicle.svg",
      },
      {
        number: 7,
        title: "Refill and check",
        instructions: "Remove the oil fill cap and add oil in stages, checking the dipstick as you approach 3.4 qt. With a sump this small it is easy to overshoot -- add about 3 quarts, then creep up on the full mark. Start the engine, let it run ~30 seconds, shut it off, and check underneath for leaks.",
        image: "/steps/oil-fill-check.svg",
      },
      {
        number: 8,
        title: "Final level check and reminder reset",
        instructions: "Wait a few minutes for oil to settle, recheck the dipstick, and top off if needed. Reset the Maintenance Minder from the driver information interface. Dispose of the old oil and filter at a recycling drop-off.",
        image: "/steps/generic-cleanup.svg",
      },
    ],
  },
  {
    id: "jeep-wrangler-oil-change",
    vehicleId: "2021-jeep-wrangler-3.6l",
    title: "Engine Oil & Filter Change",
    jobType: "oil-change",
    summary: "Drain-and-refill oil service for the JL Wrangler's 3.6L Pentastar V6, whose cartridge filter housing sits on top of the engine.",
    difficulty: "Easy",
    tier: "free",
    estTime: "45-60 min",
    tools: [
      { name: "Cartridge filter cap wrench", note: "Fits the plastic housing cap on top of the Pentastar" },
      { name: "Socket set + ratchet", note: "For the drain plug and the underbody panel fasteners" },
      { name: "Torque wrench", note: "Range covering 15-30 ft-lb" },
      { name: "Drain pan", note: "8+ qt capacity" },
      { name: "Funnel" },
      { name: "Jack + 2 jack stands or drive-up ramps" },
      { name: "Nitrile gloves + safety glasses" },
    ],
    parts: [
      "5.0 qt (4.7 L) 0W-20 full-synthetic engine oil meeting Chrysler MS-6395",
      "Mopar (or equivalent) cartridge oil filter element + housing O-ring",
      "Drain plug crush washer",
    ],
    safety: [
      "Let a hot engine cool for 10-15 min before draining -- hot oil causes burns.",
      "Use jack stands rated for the vehicle's weight; never work under a vehicle held only by a jack.",
      "Used oil and filters are hazardous waste -- take them to a recycling/auto parts drop-off, never pour down a drain.",
    ],
    torqueSpecs: [
      {
        fastener: "Oil pan drain plug",
        value: "20 ft-lb (27 Nm)",
        notes: "Use new crush washer.",
        provenance: { source: "open-labor-project", confidence: "high" },
      },
      {
        fastener: "Oil filter housing cap",
        value: "18 ft-lb (25 Nm)",
        notes: "For cartridge-type filters. The cap is plastic -- torque it to spec rather than leaning on it.",
        provenance: { source: "open-labor-project", confidence: "high" },
      },
    ],
    steps: [
      {
        number: 1,
        title: "Warm the engine briefly, then park and secure",
        instructions: "Run the engine for 2-3 minutes so the oil flows more easily, then shut it off. Park on level ground, set the parking brake, and chock the wheels.",
        image: "/steps/generic-park-secure.svg",
      },
      {
        number: 2,
        title: "Vent the filter housing cap from above",
        instructions: "Open the hood and find the black plastic filter housing on top of the engine. Loosen the cap about a quarter turn first -- this drains the housing back into the pan so you are not fighting a full housing later. Leave it loose and go underneath.",
        image: "/steps/oil-filter-cartridge.svg",
      },
      {
        number: 3,
        title: "Raise the vehicle and remove the underbody panel",
        instructions: "Support the vehicle on jack stands at the factory lift points. Remove the plastic under-engine panel to reach the drain plug.",
        image: "/steps/generic-raise-vehicle.svg",
        warning: "Confirm the vehicle is stable on the stands before reaching underneath.",
      },
      {
        number: 4,
        title: "Drain the old oil",
        instructions: "Position the drain pan under the oil pan's drain plug. Loosen the plug with a socket, then finish removing it by hand and let the oil fully drain. Expect roughly 5.0 qt.",
        image: "/steps/oil-drain.svg",
      },
      {
        number: 5,
        title: "Replace the element and reassemble",
        instructions: "Back the housing cap the rest of the way out, pull the old element off the cap stem, fit the new one, replace and lightly oil the cap O-ring, and thread the cap back in by hand before torquing. Fit a new crush washer on the drain plug and torque that to spec.",
        image: "/steps/oil-filter-install.svg",
        torque: [{ fastener: "Oil filter housing cap", value: "18 ft-lb (25 Nm)" }, { fastener: "Oil pan drain plug", value: "20 ft-lb (27 Nm)" }],
      },
      {
        number: 6,
        title: "Reinstall the underbody panel and lower the vehicle",
        instructions: "Reattach the panel fasteners and carefully lower the vehicle back to the ground.",
        image: "/steps/generic-lower-vehicle.svg",
      },
      {
        number: 7,
        title: "Refill and check",
        instructions: "Remove the oil fill cap and add oil in stages, checking the dipstick as you approach 5.0 qt. Start the engine, let it run ~30 seconds, shut it off, and check underneath for leaks at the plug and the filter housing.",
        image: "/steps/oil-fill-check.svg",
      },
      {
        number: 8,
        title: "Final level check and reminder reset",
        instructions: "Wait a few minutes for oil to settle, recheck the dipstick, and top off if needed. Reset the oil-life indicator from the instrument cluster menu. Dispose of the old oil and filter at a recycling drop-off.",
        image: "/steps/generic-cleanup.svg",
      },
    ],
  },
  {
    id: "jeep-cherokee-oil-change",
    vehicleId: "2021-jeep-cherokee-3.2l",
    title: "Engine Oil & Filter Change",
    jobType: "oil-change",
    summary: "Drain-and-refill oil service for the 3.2L Pentastar V6, whose cartridge filter housing sits on top of the engine.",
    difficulty: "Easy",
    tier: "free",
    estTime: "45-60 min",
    tools: [
      { name: "Cartridge filter cap wrench", note: "Fits the plastic housing cap on top of the Pentastar" },
      { name: "Socket set + ratchet", note: "For the drain plug and the underbody panel fasteners" },
      { name: "Torque wrench", note: "Range covering 15-30 ft-lb" },
      { name: "Drain pan", note: "6+ qt capacity" },
      { name: "Funnel" },
      { name: "Jack + 2 jack stands or drive-up ramps" },
      { name: "Nitrile gloves + safety glasses" },
    ],
    parts: [
      "5.0 qt (4.7 L) 5W-30 full-synthetic engine oil meeting Chrysler MS-6395",
      "Mopar (or equivalent) cartridge oil filter element + housing O-ring",
      "Drain plug crush washer",
    ],
    safety: [
      "Let a hot engine cool for 10-15 min before draining -- hot oil causes burns.",
      "Use jack stands rated for the vehicle's weight; never work under a vehicle held only by a jack.",
      "Used oil and filters are hazardous waste -- take them to a recycling/auto parts drop-off, never pour down a drain.",
    ],
    torqueSpecs: [
      {
        fastener: "Oil pan drain plug",
        value: "20 ft-lb (27 Nm)",
        notes: "Use new crush washer.",
        provenance: { source: "open-labor-project", confidence: "high" },
      },
      {
        fastener: "Oil filter housing cap",
        value: "18 ft-lb (25 Nm)",
        notes: "For cartridge-type filters. The cap is plastic -- torque it to spec rather than leaning on it.",
        provenance: { source: "open-labor-project", confidence: "high" },
      },
    ],
    steps: [
      {
        number: 1,
        title: "Warm the engine briefly, then park and secure",
        instructions: "Run the engine for 2-3 minutes so the oil flows more easily, then shut it off. Park on level ground, set the parking brake, and chock the wheels.",
        image: "/steps/generic-park-secure.svg",
      },
      {
        number: 2,
        title: "Vent the filter housing cap from above",
        instructions: "Open the hood and find the black plastic filter housing on top of the engine. Loosen the cap about a quarter turn first -- this drains the housing back into the pan so you are not fighting a full housing later. Leave it loose and go underneath.",
        image: "/steps/oil-filter-cartridge.svg",
      },
      {
        number: 3,
        title: "Raise the vehicle and remove the underbody panel",
        instructions: "Support the vehicle on jack stands at the factory lift points. Remove the plastic under-engine panel to reach the drain plug.",
        image: "/steps/generic-raise-vehicle.svg",
        warning: "Confirm the vehicle is stable on the stands before reaching underneath.",
      },
      {
        number: 4,
        title: "Drain the old oil",
        instructions: "Position the drain pan under the oil pan's drain plug. Loosen the plug with a socket, then finish removing it by hand and let the oil fully drain. Expect roughly 5.0 qt.",
        image: "/steps/oil-drain.svg",
      },
      {
        number: 5,
        title: "Replace the element and reassemble",
        instructions: "Back the housing cap the rest of the way out, pull the old element off the cap stem, fit the new one, replace and lightly oil the cap O-ring, and thread the cap back in by hand before torquing. Fit a new crush washer on the drain plug and torque that to spec.",
        image: "/steps/oil-filter-install.svg",
        torque: [{ fastener: "Oil filter housing cap", value: "18 ft-lb (25 Nm)" }, { fastener: "Oil pan drain plug", value: "20 ft-lb (27 Nm)" }],
      },
      {
        number: 6,
        title: "Reinstall the underbody panel and lower the vehicle",
        instructions: "Reattach the panel fasteners and carefully lower the vehicle back to the ground.",
        image: "/steps/generic-lower-vehicle.svg",
      },
      {
        number: 7,
        title: "Refill and check",
        instructions: "Remove the oil fill cap and add oil in stages, checking the dipstick as you approach 5.0 qt. Start the engine, let it run ~30 seconds, shut it off, and check underneath for leaks at the plug and the filter housing.",
        image: "/steps/oil-fill-check.svg",
      },
      {
        number: 8,
        title: "Final level check and reminder reset",
        instructions: "Wait a few minutes for oil to settle, recheck the dipstick, and top off if needed. Reset the oil-life indicator from the instrument cluster menu. Dispose of the old oil and filter at a recycling drop-off.",
        image: "/steps/generic-cleanup.svg",
      },
    ],
  },
  {
    id: "jeep-compass-oil-change",
    vehicleId: "2021-jeep-compass-2.4l",
    title: "Engine Oil & Filter Change",
    jobType: "oil-change",
    summary: "Drain-and-refill oil service for the 2.4L Tigershark four, whose cartridge filter housing sits on top of the engine.",
    difficulty: "Easy",
    tier: "free",
    estTime: "40-55 min",
    tools: [
      { name: "Cartridge filter cap wrench", note: "Fits the plastic housing cap on top of the Tigershark" },
      { name: "Socket set + ratchet", note: "For the drain plug and the underbody panel fasteners" },
      { name: "Torque wrench", note: "Range covering 15-30 ft-lb" },
      { name: "Drain pan", note: "6+ qt capacity" },
      { name: "Funnel" },
      { name: "Jack + 2 jack stands or drive-up ramps" },
      { name: "Nitrile gloves + safety glasses" },
    ],
    parts: [
      "5.5 qt (5.2 L) 0W-20 full-synthetic engine oil meeting Chrysler MS-6395",
      "Mopar (or equivalent) cartridge oil filter element + housing O-ring",
      "Drain plug crush washer",
    ],
    safety: [
      "Let a hot engine cool for 10-15 min before draining -- hot oil causes burns.",
      "Use jack stands rated for the vehicle's weight; never work under a vehicle held only by a jack.",
      "Used oil and filters are hazardous waste -- take them to a recycling/auto parts drop-off, never pour down a drain.",
    ],
    torqueSpecs: [
      {
        fastener: "Oil pan drain plug",
        value: "20 ft-lb (27 Nm)",
        notes: "Use new crush washer.",
        provenance: { source: "open-labor-project", confidence: "high" },
      },
      {
        fastener: "Oil filter housing cap",
        value: "18 ft-lb (25 Nm)",
        notes: "For cartridge-type filters. The cap is plastic -- torque it to spec rather than leaning on it.",
        provenance: { source: "open-labor-project", confidence: "high" },
      },
    ],
    steps: [
      {
        number: 1,
        title: "Warm the engine briefly, then park and secure",
        instructions: "Run the engine for 2-3 minutes so the oil flows more easily, then shut it off. Park on level ground, set the parking brake, and chock the wheels.",
        image: "/steps/generic-park-secure.svg",
      },
      {
        number: 2,
        title: "Vent the filter housing cap from above",
        instructions: "Open the hood and find the black plastic filter housing on top of the engine. Loosen the cap about a quarter turn first -- this drains the housing back into the pan so you are not fighting a full housing later. Leave it loose and go underneath.",
        image: "/steps/oil-filter-cartridge.svg",
      },
      {
        number: 3,
        title: "Raise the vehicle and remove the underbody panel",
        instructions: "Support the vehicle on jack stands at the factory lift points. Remove the plastic under-engine panel to reach the drain plug.",
        image: "/steps/generic-raise-vehicle.svg",
        warning: "Confirm the vehicle is stable on the stands before reaching underneath.",
      },
      {
        number: 4,
        title: "Drain the old oil",
        instructions: "Position the drain pan under the oil pan's drain plug. Loosen the plug with a socket, then finish removing it by hand and let the oil fully drain. Expect roughly 5.5 qt.",
        image: "/steps/oil-drain.svg",
      },
      {
        number: 5,
        title: "Replace the element and reassemble",
        instructions: "Back the housing cap the rest of the way out, pull the old element off the cap stem, fit the new one, replace and lightly oil the cap O-ring, and thread the cap back in by hand before torquing. Fit a new crush washer on the drain plug and torque that to spec.",
        image: "/steps/oil-filter-install.svg",
        torque: [{ fastener: "Oil filter housing cap", value: "18 ft-lb (25 Nm)" }, { fastener: "Oil pan drain plug", value: "20 ft-lb (27 Nm)" }],
      },
      {
        number: 6,
        title: "Reinstall the underbody panel and lower the vehicle",
        instructions: "Reattach the panel fasteners and carefully lower the vehicle back to the ground.",
        image: "/steps/generic-lower-vehicle.svg",
      },
      {
        number: 7,
        title: "Refill and check",
        instructions: "Remove the oil fill cap and add oil in stages, checking the dipstick as you approach 5.5 qt. Start the engine, let it run ~30 seconds, shut it off, and check underneath for leaks at the plug and the filter housing.",
        image: "/steps/oil-fill-check.svg",
      },
      {
        number: 8,
        title: "Final level check and reminder reset",
        instructions: "Wait a few minutes for oil to settle, recheck the dipstick, and top off if needed. Reset the oil-life indicator from the instrument cluster menu. Dispose of the old oil and filter at a recycling drop-off.",
        image: "/steps/generic-cleanup.svg",
      },
    ],
  },
  {
    id: "jeep-renegade-oil-change",
    vehicleId: "2021-jeep-renegade-1.3t",
    title: "Engine Oil & Filter Change",
    jobType: "oil-change",
    summary: "Drain-and-refill oil service for the 1.3L GSE turbo four, whose cartridge filter housing sits on top of the engine.",
    difficulty: "Easy",
    tier: "free",
    estTime: "40-55 min",
    tools: [
      { name: "Cartridge filter cap wrench", note: "Fits the plastic housing cap on top of the engine" },
      { name: "Socket set + ratchet", note: "For the drain plug and the underbody panel fasteners" },
      { name: "Torque wrench", note: "Range covering 15-30 ft-lb" },
      { name: "Drain pan", note: "6+ qt capacity" },
      { name: "Funnel" },
      { name: "Jack + 2 jack stands or drive-up ramps" },
      { name: "Nitrile gloves + safety glasses" },
    ],
    parts: [
      "4.2 qt (4.0 L) 0W-20 full-synthetic engine oil meeting Chrysler MS-6395",
      "Mopar (or equivalent) cartridge oil filter element + housing O-ring",
      "Drain plug crush washer",
    ],
    safety: [
      "Let a hot engine cool for 10-15 min before draining -- hot oil causes burns.",
      "Use jack stands rated for the vehicle's weight; never work under a vehicle held only by a jack.",
      "Used oil and filters are hazardous waste -- take them to a recycling/auto parts drop-off, never pour down a drain.",
    ],
    torqueSpecs: [
      {
        fastener: "Oil pan drain plug",
        value: "20 ft-lb (27 Nm)",
        notes: "Curated reference figure -- not yet pulled from Open Labor Project for this vehicle.",
      },
      {
        fastener: "Oil filter housing cap",
        value: "18 ft-lb (25 Nm)",
        notes: "For cartridge-type filters. The cap is plastic -- torque it to spec rather than leaning on it. OLP lists this engine as \"1.3L I4 Turbo Flex\" -- read as the same GSE T4 turbo engine under a region-inclusive name (Jeep sells only one 1.3L turbo in the Renegade), not a mismatch, but noted explicitly per this catalog's own naming-mismatch discipline.",
        provenance: { source: "open-labor-project", confidence: "high" },
      },
    ],
    steps: [
      {
        number: 1,
        title: "Warm the engine briefly, then park and secure",
        instructions: "Run the engine for 2-3 minutes so the oil flows more easily, then shut it off. Park on level ground, set the parking brake, and chock the wheels.",
        image: "/steps/generic-park-secure.svg",
      },
      {
        number: 2,
        title: "Vent the filter housing cap from above",
        instructions: "Open the hood and find the black plastic filter housing on top of the engine. Loosen the cap about a quarter turn first -- this drains the housing back into the pan so you are not fighting a full housing later. Leave it loose and go underneath.",
        image: "/steps/oil-filter-cartridge.svg",
      },
      {
        number: 3,
        title: "Raise the vehicle and remove the underbody panel",
        instructions: "Support the vehicle on jack stands at the factory lift points. Remove the plastic under-engine panel to reach the drain plug.",
        image: "/steps/generic-raise-vehicle.svg",
        warning: "Confirm the vehicle is stable on the stands before reaching underneath.",
      },
      {
        number: 4,
        title: "Drain the old oil",
        instructions: "Position the drain pan under the oil pan's drain plug. Loosen the plug with a socket, then finish removing it by hand and let the oil fully drain. Expect roughly 4.2 qt.",
        image: "/steps/oil-drain.svg",
      },
      {
        number: 5,
        title: "Replace the element and reassemble",
        instructions: "Back the housing cap the rest of the way out, pull the old element off the cap stem, fit the new one, replace and lightly oil the cap O-ring, and thread the cap back in by hand before torquing. Fit a new crush washer on the drain plug and torque that to spec.",
        image: "/steps/oil-filter-install.svg",
        torque: [{ fastener: "Oil filter housing cap", value: "18 ft-lb (25 Nm)" }, { fastener: "Oil pan drain plug", value: "20 ft-lb (27 Nm)" }],
      },
      {
        number: 6,
        title: "Reinstall the underbody panel and lower the vehicle",
        instructions: "Reattach the panel fasteners and carefully lower the vehicle back to the ground.",
        image: "/steps/generic-lower-vehicle.svg",
      },
      {
        number: 7,
        title: "Refill and check",
        instructions: "Remove the oil fill cap and add oil in stages, checking the dipstick as you approach 4.2 qt. Start the engine, let it run ~30 seconds, shut it off, and check underneath for leaks at the plug and the filter housing.",
        image: "/steps/oil-fill-check.svg",
      },
      {
        number: 8,
        title: "Final level check and reminder reset",
        instructions: "Wait a few minutes for oil to settle, recheck the dipstick, and top off if needed. Reset the oil-life indicator from the instrument cluster menu. Dispose of the old oil and filter at a recycling drop-off.",
        image: "/steps/generic-cleanup.svg",
      },
    ],
  },
  {
    id: "chevrolet-malibu-oil-change",
    vehicleId: "2021-chevrolet-malibu-1.5t",
    title: "Engine Oil & Filter Change",
    jobType: "oil-change",
    summary: "Drain-and-refill oil service for the 1.5L LFV turbo four, whose cartridge filter housing sits on top of the engine.",
    difficulty: "Easy",
    tier: "free",
    estTime: "40-50 min",
    tools: [
      { name: "Cartridge filter cap wrench", note: "The housing cap takes a large cap socket, not a strap wrench" },
      { name: "Socket set + ratchet", note: "For the drain plug and the underbody panel fasteners" },
      { name: "Torque wrench", note: "Range covering 15-30 ft-lb" },
      { name: "Drain pan", note: "6+ qt capacity" },
      { name: "Funnel" },
      { name: "Jack + 2 jack stands or drive-up ramps" },
      { name: "Nitrile gloves + safety glasses" },
    ],
    parts: [
      "4.2 qt (4.0 L) 5W-30 full-synthetic engine oil meeting GM dexos1",
      "ACDelco (or equivalent) cartridge oil filter element + housing O-ring",
      "Drain plug crush washer",
    ],
    safety: [
      "Let a hot engine cool for 10-15 min before draining -- hot oil causes burns.",
      "Use jack stands rated for the vehicle's weight; never work under a vehicle held only by a jack.",
      "Used oil and filters are hazardous waste -- take them to a recycling/auto parts drop-off, never pour down a drain.",
    ],
    torqueSpecs: [
      {
        fastener: "Oil pan drain plug",
        value: "18 ft-lb (25 Nm)",
        notes: "Use new crush washer.",
        provenance: { source: "open-labor-project", confidence: "high" },
      },
      {
        fastener: "Oil filter housing cap",
        value: "18 ft-lb (25 Nm)",
        notes: "For cartridge-type filters. The cap is plastic -- torque it to spec rather than leaning on it.",
        provenance: { source: "open-labor-project", confidence: "high" },
      },
    ],
    steps: [
      {
        number: 1,
        title: "Warm the engine briefly, then park and secure",
        instructions: "Run the engine for 2-3 minutes so the oil flows more easily, then shut it off. Park on level ground, set the parking brake, and chock the wheels.",
        image: "/steps/generic-park-secure.svg",
      },
      {
        number: 2,
        title: "Vent the filter housing cap from above",
        instructions: "Open the hood and locate the black plastic filter housing on top of the engine. Loosen the cap a quarter turn first -- this lets the housing drain back into the pan before you pull the drain plug, so you are not doing it twice.",
        image: "/steps/oil-filter-cartridge.svg",
      },
      {
        number: 3,
        title: "Raise the vehicle and remove the underbody panel",
        instructions: "Support the vehicle on jack stands at the factory lift points. Remove the plastic under-engine panel to reach the drain plug.",
        image: "/steps/generic-raise-vehicle.svg",
        warning: "Confirm the vehicle is stable on the stands before reaching underneath.",
      },
      {
        number: 4,
        title: "Drain the old oil",
        instructions: "Position the drain pan under the oil pan's drain plug. Loosen the plug with a socket, then finish removing it by hand and let the oil fully drain. Expect roughly 4.2 qt.",
        image: "/steps/oil-drain.svg",
      },
      {
        number: 5,
        title: "Replace the element and reassemble",
        instructions: "Back the housing cap the rest of the way out, pull the old element off the cap stem, fit the new one, replace and lightly oil the cap O-ring, and thread the cap back in by hand before torquing. Fit a new crush washer on the drain plug and torque that to spec.",
        image: "/steps/oil-filter-install.svg",
        torque: [{ fastener: "Oil filter housing cap", value: "18 ft-lb (25 Nm)" }, { fastener: "Oil pan drain plug", value: "18 ft-lb (25 Nm)" }],
      },
      {
        number: 6,
        title: "Reinstall the underbody panel and lower the vehicle",
        instructions: "Reattach the panel fasteners and carefully lower the vehicle back to the ground.",
        image: "/steps/generic-lower-vehicle.svg",
      },
      {
        number: 7,
        title: "Refill and check",
        instructions: "Remove the oil fill cap and add oil in stages, checking the dipstick as you approach 4.2 qt. Start the engine, let it run ~30 seconds, shut it off, and check underneath for leaks at the plug and the filter housing.",
        image: "/steps/oil-fill-check.svg",
      },
      {
        number: 8,
        title: "Final level check and reminder reset",
        instructions: "Wait a few minutes for oil to settle, recheck the dipstick, and top off if needed. Reset the oil-life monitor from the Driver Information Center. Dispose of the old oil and filter at a recycling drop-off.",
        image: "/steps/generic-cleanup.svg",
      },
    ],
  },
  {
    id: "chevrolet-cruze-oil-change",
    vehicleId: "2019-chevrolet-cruze-1.4t",
    title: "Engine Oil & Filter Change",
    jobType: "oil-change",
    summary: "Drain-and-refill oil service for the 1.4L LE2 turbo four, whose cartridge filter housing sits on top of the engine.",
    difficulty: "Easy",
    tier: "free",
    estTime: "40-50 min",
    tools: [
      { name: "Cartridge filter cap socket", note: "The housing cap takes a large cap socket, not a strap wrench" },
      { name: "Socket set + ratchet", note: "For the drain plug and the splash shield fasteners" },
      { name: "Torque wrench", note: "Range covering 15-25 ft-lb" },
      { name: "Drain pan", note: "6+ qt capacity" },
      { name: "Funnel" },
      { name: "Jack + 2 jack stands or drive-up ramps" },
      { name: "Nitrile gloves + safety glasses" },
    ],
    parts: [
      "4.2 qt (4.0 L) 5W-30 full-synthetic engine oil meeting GM dexos1",
      "ACDelco (or equivalent) cartridge oil filter element + housing O-ring",
      "Drain plug crush washer",
    ],
    safety: [
      "Let a hot engine cool for 10-15 min before draining -- hot oil causes burns.",
      "Use jack stands rated for the vehicle's weight; never work under a vehicle held only by a jack.",
      "Used oil and filters are hazardous waste -- take them to a recycling/auto parts drop-off, never pour down a drain.",
    ],
    torqueSpecs: [
      {
        fastener: "Oil pan drain plug",
        value: "18 ft-lb (25 Nm)",
        notes: "Curated reference figure -- not yet pulled from Open Labor Project for this vehicle.",
      },
      {
        fastener: "Oil filter housing cap",
        value: "18 ft-lb (25 Nm)",
        notes: "Curated reference figure. The cap is plastic -- torque it to spec rather than leaning on it.",
      },
    ],
    steps: [
      {
        number: 1,
        title: "Warm the engine briefly, then park and secure",
        instructions: "Run the engine for 2-3 minutes so the oil flows more easily, then shut it off. Park on level ground, set the parking brake, and chock the wheels.",
        image: "/steps/generic-park-secure.svg",
      },
      {
        number: 2,
        title: "Vent the filter housing cap from above",
        instructions: "Open the hood and locate the black plastic filter housing on top of the engine. Loosen the cap a quarter turn first -- this lets the housing drain back into the pan before you pull the drain plug, so you are not doing it twice.",
        image: "/steps/oil-filter-cartridge.svg",
      },
      {
        number: 3,
        title: "Raise the vehicle and remove the splash shield",
        instructions: "Support the vehicle on jack stands at the factory lift points. Remove the plastic under-engine splash shield to reach the drain plug.",
        image: "/steps/generic-raise-vehicle.svg",
        warning: "Confirm the vehicle is stable on the stands before reaching underneath.",
      },
      {
        number: 4,
        title: "Drain the old oil",
        instructions: "Position the drain pan under the oil pan's drain plug. Loosen the plug with a socket, then finish removing it by hand and let the oil fully drain. Expect roughly 4.2 qt.",
        image: "/steps/oil-drain.svg",
      },
      {
        number: 5,
        title: "Replace the element and reassemble",
        instructions: "Back the housing cap the rest of the way out, pull the old element off the cap stem, fit the new one, replace and lightly oil the cap O-ring, and thread the cap back in by hand before torquing. Fit a new crush washer on the drain plug and torque that to spec.",
        image: "/steps/oil-filter-install.svg",
        torque: [{ fastener: "Oil filter housing cap", value: "18 ft-lb (25 Nm)" }, { fastener: "Oil pan drain plug", value: "18 ft-lb (25 Nm)" }],
      },
      {
        number: 6,
        title: "Reinstall the splash shield and lower the vehicle",
        instructions: "Reattach the splash shield fasteners and carefully lower the vehicle back to the ground.",
        image: "/steps/generic-lower-vehicle.svg",
      },
      {
        number: 7,
        title: "Refill and check",
        instructions: "Remove the oil fill cap and add oil in stages, checking the dipstick as you approach 4.2 qt. Start the engine, let it run ~30 seconds, shut it off, and check underneath for leaks.",
        image: "/steps/oil-fill-check.svg",
      },
      {
        number: 8,
        title: "Final level check and oil-life reset",
        instructions: "Wait a few minutes for oil to settle, recheck the dipstick, and top off if needed. Reset the oil-life monitor from the Driver Information Center. Dispose of the old oil and filter at a recycling drop-off.",
        image: "/steps/generic-cleanup.svg",
      },
    ],
  },
  {
    id: "chevrolet-impala-oil-change",
    vehicleId: "2019-chevrolet-impala-3.6l",
    title: "Engine Oil & Filter Change",
    jobType: "oil-change",
    summary: "Drain-and-refill oil service for the 3.6L LGX V6, whose cartridge filter housing sits on top of the engine.",
    difficulty: "Easy",
    tier: "free",
    estTime: "45-60 min",
    tools: [
      { name: "Cartridge filter cap socket", note: "The housing cap takes a large cap socket, not a strap wrench" },
      { name: "Socket set + ratchet", note: "For the drain plug and the splash shield fasteners" },
      { name: "Torque wrench", note: "Range covering 15-25 ft-lb" },
      { name: "Drain pan", note: "8+ qt capacity" },
      { name: "Funnel" },
      { name: "Jack + 2 jack stands or drive-up ramps" },
      { name: "Nitrile gloves + safety glasses" },
    ],
    parts: [
      "6.0 qt (5.7 L) 5W-30 full-synthetic engine oil meeting GM dexos1",
      "ACDelco (or equivalent) cartridge oil filter element + housing O-ring",
      "Drain plug crush washer",
    ],
    safety: [
      "Let a hot engine cool for 10-15 min before draining -- hot oil causes burns.",
      "Use jack stands rated for the vehicle's weight; never work under a vehicle held only by a jack.",
      "Used oil and filters are hazardous waste -- take them to a recycling/auto parts drop-off, never pour down a drain.",
    ],
    torqueSpecs: [
      {
        fastener: "Oil pan drain plug",
        value: "18 ft-lb (25 Nm)",
        notes: "Curated reference figure -- not yet pulled from Open Labor Project for this vehicle.",
      },
      {
        fastener: "Oil filter housing cap",
        value: "18 ft-lb (25 Nm)",
        notes: "Curated reference figure. The cap is plastic -- torque it to spec rather than leaning on it.",
      },
    ],
    steps: [
      {
        number: 1,
        title: "Warm the engine briefly, then park and secure",
        instructions: "Run the engine for 2-3 minutes so the oil flows more easily, then shut it off. Park on level ground, set the parking brake, and chock the wheels.",
        image: "/steps/generic-park-secure.svg",
      },
      {
        number: 2,
        title: "Vent the filter housing cap from above",
        instructions: "Open the hood and locate the black plastic filter housing on top of the engine. Loosen the cap a quarter turn first -- this lets the housing drain back into the pan before you pull the drain plug, so you are not doing it twice.",
        image: "/steps/oil-filter-cartridge.svg",
      },
      {
        number: 3,
        title: "Raise the vehicle and remove the splash shield",
        instructions: "Support the vehicle on jack stands at the factory lift points. Remove the plastic under-engine splash shield to reach the drain plug.",
        image: "/steps/generic-raise-vehicle.svg",
        warning: "Confirm the vehicle is stable on the stands before reaching underneath.",
      },
      {
        number: 4,
        title: "Drain the old oil",
        instructions: "Position the drain pan under the oil pan's drain plug. Loosen the plug with a socket, then finish removing it by hand and let the oil fully drain. Expect roughly 6.0 qt.",
        image: "/steps/oil-drain.svg",
      },
      {
        number: 5,
        title: "Replace the element and reassemble",
        instructions: "Back the housing cap the rest of the way out, pull the old element off the cap stem, fit the new one, replace and lightly oil the cap O-ring, and thread the cap back in by hand before torquing. Fit a new crush washer on the drain plug and torque that to spec.",
        image: "/steps/oil-filter-install.svg",
        torque: [{ fastener: "Oil filter housing cap", value: "18 ft-lb (25 Nm)" }, { fastener: "Oil pan drain plug", value: "18 ft-lb (25 Nm)" }],
      },
      {
        number: 6,
        title: "Reinstall the splash shield and lower the vehicle",
        instructions: "Reattach the splash shield fasteners and carefully lower the vehicle back to the ground.",
        image: "/steps/generic-lower-vehicle.svg",
      },
      {
        number: 7,
        title: "Refill and check",
        instructions: "Remove the oil fill cap and add oil in stages, checking the dipstick as you approach 6.0 qt. Start the engine, let it run ~30 seconds, shut it off, and check underneath for leaks.",
        image: "/steps/oil-fill-check.svg",
      },
      {
        number: 8,
        title: "Final level check and oil-life reset",
        instructions: "Wait a few minutes for oil to settle, recheck the dipstick, and top off if needed. Reset the oil-life monitor from the Driver Information Center. Dispose of the old oil and filter at a recycling drop-off.",
        image: "/steps/generic-cleanup.svg",
      },
    ],
  },
  {
    id: "chevrolet-camaro-oil-change",
    vehicleId: "2021-chevrolet-camaro-6.2l",
    title: "Engine Oil & Filter Change",
    jobType: "oil-change",
    summary: "Drain-and-refill oil service for the 6.2L LT1 V8. Ten quarts -- the largest oil capacity in the catalog. Wet-sump cars only; the dry-sump track package is a different job.",
    difficulty: "Easy",
    tier: "free",
    estTime: "50-65 min",
    tools: [
      { name: "Oil filter wrench", note: "Strap or cap-style for the spin-on filter" },
      { name: "Socket set + ratchet", note: "For the drain plug and the under-shield fasteners" },
      { name: "Torque wrench", note: "Range covering 15-25 ft-lb" },
      { name: "Large drain pan", note: "12+ qt capacity -- this engine holds 10 qt, which catches people out" },
      { name: "Funnel with extension", note: "Low car, tight engine bay -- an extension helps" },
      { name: "Jack + 2 jack stands or drive-up ramps" },
      { name: "Nitrile gloves + safety glasses" },
    ],
    parts: [
      "10.0 qt (9.5 L) 5W-30 full-synthetic engine oil meeting GM dexos1",
      "Spin-on oil filter (ACDelco PF48E or equivalent)",
      "Drain plug crush washer",
    ],
    safety: [
      "Let a hot engine cool for 10-15 min before draining -- hot oil causes burns.",
      "Use jack stands rated for the vehicle's weight; never work under a vehicle held only by a jack.",
      "Used oil and filters are hazardous waste -- take them to a recycling/auto parts drop-off, never pour down a drain.",
    ],
    torqueSpecs: [
      {
        fastener: "Oil pan drain plug",
        value: "18 ft-lb (25 Nm)",
        notes: "Curated reference figure -- not yet pulled from Open Labor Project for this vehicle.",
      },
      {
        fastener: "Oil filter (spin-on)",
        value: "22 ft-lb (30 Nm)",
        notes: "Reference torque only. In practice most techs seat the gasket by hand and add three-quarters of a turn.",
      },
    ],
    steps: [
      {
        number: 1,
        title: "Warm the engine briefly, then park and secure",
        instructions: "Run the engine for 2-3 minutes so the oil flows more easily, then shut it off. Park on level ground, set the parking brake, and chock the wheels.",
        image: "/steps/generic-park-secure.svg",
      },
      {
        number: 2,
        title: "Raise the vehicle and remove the under-engine shield",
        instructions: "This car sits low enough that ramps are usually easier than a jack. Support it on jack stands at the rated lift points, then remove the plastic under-engine shield.",
        image: "/steps/generic-raise-vehicle.svg",
        warning: "Confirm the car is stable before reaching underneath. Low ground clearance makes it tempting to skip the stands -- do not.",
      },
      {
        number: 3,
        title: "Drain the old oil",
        instructions: "Position the drain pan under the oil pan's drain plug. Loosen the plug with a socket, then finish removing it by hand and let the oil fully drain. Expect roughly 10.0 qt.",
        image: "/steps/oil-drain.svg",
      },
      {
        number: 4,
        title: "Remove the spin-on filter",
        instructions: "The filter is on the passenger side of the block, reachable from underneath. Slide the drain pan under it, back it off with the filter wrench, then spin it off by hand -- it will be full of oil, so keep it upright until it clears.",
        image: "/steps/oil-filter-spinon-remove.svg",
        warning: "Check that the old filter's rubber gasket came off with it. A gasket left stuck to the engine will double up against the new filter and push oil out under pressure.",
      },
      {
        number: 5,
        title: "Install the new filter and drain plug",
        instructions: "Wipe the sealing surface clean, smear a film of fresh oil on the new filter's gasket, and thread it on by hand until the gasket contacts, then about three-quarters of a turn more. Fit a new crush washer on the drain plug and torque it to spec.",
        image: "/steps/oil-filter-install.svg",
        torque: [{ fastener: "Oil pan drain plug", value: "18 ft-lb (25 Nm)" }],
      },
      {
        number: 6,
        title: "Reinstall the under-shield and lower the vehicle",
        instructions: "Reattach the under-engine shield fasteners (if removed) and carefully lower the vehicle back to the ground.",
        image: "/steps/generic-lower-vehicle.svg",
      },
      {
        number: 7,
        title: "Refill and check",
        instructions: "Remove the oil fill cap and add oil in stages, checking the dipstick as you approach 10.0 qt. Start the engine, let it run ~30 seconds, shut it off, and check underneath for leaks at the drain plug and filter.",
        image: "/steps/oil-fill-check.svg",
      },
      {
        number: 8,
        title: "Final level check and oil-life reset",
        instructions: "Wait a few minutes for oil to settle, recheck the dipstick, and top off if needed. Reset the oil-life monitor from the Driver Information Center. Dispose of the old oil and filter at a recycling drop-off.",
        image: "/steps/generic-cleanup.svg",
      },
    ],
  },
  {
    id: "chevrolet-colorado-oil-change",
    vehicleId: "2021-chevrolet-colorado-3.6l",
    title: "Engine Oil & Filter Change",
    jobType: "oil-change",
    summary: "Drain-and-refill oil service for the 3.6L LGZ V6, whose cartridge filter housing sits on top of the engine.",
    difficulty: "Easy",
    tier: "free",
    estTime: "45-60 min",
    tools: [
      { name: "Cartridge filter cap socket", note: "The housing cap takes a large cap socket, not a strap wrench" },
      { name: "Socket set + ratchet", note: "For the drain plug and the splash shield fasteners" },
      { name: "Torque wrench", note: "Range covering 15-25 ft-lb" },
      { name: "Drain pan", note: "8+ qt capacity" },
      { name: "Funnel" },
      { name: "Jack + 2 jack stands or drive-up ramps" },
      { name: "Nitrile gloves + safety glasses" },
    ],
    parts: [
      "6.0 qt (5.7 L) 0W-20 full-synthetic engine oil meeting GM dexos1",
      "ACDelco (or equivalent) cartridge oil filter element + housing O-ring",
      "Drain plug crush washer",
    ],
    safety: [
      "Let a hot engine cool for 10-15 min before draining -- hot oil causes burns.",
      "Use jack stands rated for the vehicle's weight; never work under a vehicle held only by a jack.",
      "Used oil and filters are hazardous waste -- take them to a recycling/auto parts drop-off, never pour down a drain.",
    ],
    torqueSpecs: [
      {
        fastener: "Oil pan drain plug",
        value: "18 ft-lb (25 Nm)",
        notes: "Curated reference figure -- not yet pulled from Open Labor Project for this vehicle.",
      },
      {
        fastener: "Oil filter housing cap",
        value: "18 ft-lb (25 Nm)",
        notes: "Curated reference figure. The cap is plastic -- torque it to spec rather than leaning on it.",
      },
    ],
    steps: [
      {
        number: 1,
        title: "Warm the engine briefly, then park and secure",
        instructions: "Run the engine for 2-3 minutes so the oil flows more easily, then shut it off. Park on level ground, set the parking brake, and chock the wheels.",
        image: "/steps/generic-park-secure.svg",
      },
      {
        number: 2,
        title: "Vent the filter housing cap from above",
        instructions: "Open the hood and locate the black plastic filter housing on top of the engine. Loosen the cap a quarter turn first -- this lets the housing drain back into the pan before you pull the drain plug, so you are not doing it twice.",
        image: "/steps/oil-filter-cartridge.svg",
      },
      {
        number: 3,
        title: "Raise the vehicle and remove the splash shield",
        instructions: "Support the vehicle on jack stands at the factory lift points. Remove the plastic under-engine splash shield to reach the drain plug.",
        image: "/steps/generic-raise-vehicle.svg",
        warning: "Confirm the vehicle is stable on the stands before reaching underneath.",
      },
      {
        number: 4,
        title: "Drain the old oil",
        instructions: "Position the drain pan under the oil pan's drain plug. Loosen the plug with a socket, then finish removing it by hand and let the oil fully drain. Expect roughly 6.0 qt.",
        image: "/steps/oil-drain.svg",
      },
      {
        number: 5,
        title: "Replace the element and reassemble",
        instructions: "Back the housing cap the rest of the way out, pull the old element off the cap stem, fit the new one, replace and lightly oil the cap O-ring, and thread the cap back in by hand before torquing. Fit a new crush washer on the drain plug and torque that to spec.",
        image: "/steps/oil-filter-install.svg",
        torque: [{ fastener: "Oil filter housing cap", value: "18 ft-lb (25 Nm)" }, { fastener: "Oil pan drain plug", value: "18 ft-lb (25 Nm)" }],
      },
      {
        number: 6,
        title: "Reinstall the splash shield and lower the vehicle",
        instructions: "Reattach the splash shield fasteners and carefully lower the vehicle back to the ground.",
        image: "/steps/generic-lower-vehicle.svg",
      },
      {
        number: 7,
        title: "Refill and check",
        instructions: "Remove the oil fill cap and add oil in stages, checking the dipstick as you approach 6.0 qt. Start the engine, let it run ~30 seconds, shut it off, and check underneath for leaks.",
        image: "/steps/oil-fill-check.svg",
      },
      {
        number: 8,
        title: "Final level check and oil-life reset",
        instructions: "Wait a few minutes for oil to settle, recheck the dipstick, and top off if needed. Reset the oil-life monitor from the Driver Information Center. Dispose of the old oil and filter at a recycling drop-off.",
        image: "/steps/generic-cleanup.svg",
      },
    ],
  },
  {
    id: "chevrolet-suburban-oil-change",
    vehicleId: "2021-chevrolet-suburban-5.3l",
    title: "Engine Oil & Filter Change",
    jobType: "oil-change",
    summary: "Drain-and-refill oil service for the 5.3L EcoTec3 L84 V8, with its spin-on oil filter.",
    difficulty: "Easy",
    tier: "free",
    estTime: "50-65 min",
    tools: [
      { name: "Oil filter wrench", note: "Strap or cap-style for the spin-on filter" },
      { name: "Socket set + ratchet", note: "For the drain plug and the under-shield fasteners" },
      { name: "Torque wrench", note: "Range covering 15-25 ft-lb" },
      { name: "Large drain pan", note: "10+ qt capacity -- this engine holds 8 qt" },
      { name: "Funnel with extension", note: "Full-size SUV ride height makes the reach longer" },
      { name: "Jack + 2 jack stands or drive-up ramps" },
      { name: "Nitrile gloves + safety glasses" },
    ],
    parts: [
      "8.0 qt (7.6 L) 0W-20 full-synthetic engine oil meeting GM dexos1",
      "Spin-on oil filter (ACDelco PF63 or equivalent)",
      "Drain plug crush washer",
    ],
    safety: [
      "Let a hot engine cool for 10-15 min before draining -- hot oil causes burns.",
      "Use jack stands rated for the vehicle's weight; never work under a vehicle held only by a jack.",
      "Used oil and filters are hazardous waste -- take them to a recycling/auto parts drop-off, never pour down a drain.",
    ],
    torqueSpecs: [
      {
        fastener: "Oil pan drain plug",
        value: "18 ft-lb (25 Nm)",
        notes: "Carried over from the Silverado 1500 entry, where this value came back from Open Labor Project as real, vehicle-specific, high-confidence data for the same L84 engine. Flagged as a twin carry-over rather than independently confirmed for this vehicle -- re-pull it under this make/model when quota allows.",
      },
      {
        fastener: "Oil filter (spin-on)",
        value: "22 ft-lb (30 Nm)",
        notes: "Carried over from the Silverado 1500's verified Open Labor Project value for the same L84 engine, and its SPIN-ON component label is what caught a real error in the original Silverado write-up. Reference torque only -- most techs seat the gasket by hand and add three-quarters of a turn. Flagged as a twin carry-over, not independently confirmed for this vehicle.",
      },
    ],
    steps: [
      {
        number: 1,
        title: "Warm the engine briefly, then park and secure",
        instructions: "Run the engine for 2-3 minutes so the oil flows more easily, then shut it off. Park on level ground, set the parking brake, and chock the wheels.",
        image: "/steps/generic-park-secure.svg",
      },
      {
        number: 2,
        title: "Raise the vehicle and remove the under-engine shield",
        instructions: "Support the vehicle on jack stands at the frame's rated lift points. Remove or swing aside the plastic under-engine shield if fitted.",
        image: "/steps/generic-raise-vehicle.svg",
        warning: "Confirm the vehicle is stable on the stands before reaching underneath -- this is a heavy, high-riding full-size SUV.",
      },
      {
        number: 3,
        title: "Drain the old oil",
        instructions: "Position the drain pan under the oil pan's drain plug. Loosen the plug with a socket, then finish removing it by hand and let the oil fully drain. Expect roughly 8.0 qt.",
        image: "/steps/oil-drain.svg",
      },
      {
        number: 4,
        title: "Remove the spin-on filter",
        instructions: "The filter is on the driver side of the engine, reachable from underneath. Slide the drain pan under it, back it off with the filter wrench, then spin it off by hand -- it will be full of oil, so keep it upright until it clears.",
        image: "/steps/oil-filter-spinon-remove.svg",
        warning: "Check that the old filter's rubber gasket came off with it. A gasket left stuck to the engine will double up against the new filter and push oil out under pressure.",
      },
      {
        number: 5,
        title: "Install the new filter and drain plug",
        instructions: "Wipe the sealing surface clean, smear a film of fresh oil on the new filter's gasket, and thread it on by hand until the gasket contacts, then about three-quarters of a turn more. Fit a new crush washer on the drain plug and torque it to spec.",
        image: "/steps/oil-filter-install.svg",
        torque: [{ fastener: "Oil pan drain plug", value: "18 ft-lb (25 Nm)" }],
      },
      {
        number: 6,
        title: "Reinstall the under-shield and lower the vehicle",
        instructions: "Reattach the under-engine shield fasteners (if removed) and carefully lower the vehicle back to the ground.",
        image: "/steps/generic-lower-vehicle.svg",
      },
      {
        number: 7,
        title: "Refill and check",
        instructions: "Remove the oil fill cap and add oil in stages, checking the dipstick as you approach 8.0 qt. Start the engine, let it run ~30 seconds, shut it off, and check underneath for leaks at the drain plug and filter.",
        image: "/steps/oil-fill-check.svg",
      },
      {
        number: 8,
        title: "Final level check and oil-life reset",
        instructions: "Wait a few minutes for oil to settle, recheck the dipstick, and top off if needed. Reset the oil-life monitor from the Driver Information Center. Dispose of the old oil and filter at a recycling drop-off.",
        image: "/steps/generic-cleanup.svg",
      },
    ],
  },
  {
    id: "chevrolet-tahoe-oil-change",
    vehicleId: "2021-chevrolet-tahoe-5.3l",
    title: "Engine Oil & Filter Change",
    jobType: "oil-change",
    summary: "Drain-and-refill oil service for the 5.3L EcoTec3 L84 V8, with its spin-on oil filter.",
    difficulty: "Easy",
    tier: "free",
    estTime: "50-65 min",
    tools: [
      { name: "Oil filter wrench", note: "Strap or cap-style for the spin-on filter" },
      { name: "Socket set + ratchet", note: "For the drain plug and the under-shield fasteners" },
      { name: "Torque wrench", note: "Range covering 15-25 ft-lb" },
      { name: "Large drain pan", note: "10+ qt capacity -- this engine holds 8 qt" },
      { name: "Funnel with extension", note: "Full-size SUV ride height makes the reach longer" },
      { name: "Jack + 2 jack stands or drive-up ramps" },
      { name: "Nitrile gloves + safety glasses" },
    ],
    parts: [
      "8.0 qt (7.6 L) 0W-20 full-synthetic engine oil meeting GM dexos1",
      "Spin-on oil filter (ACDelco PF63 or equivalent)",
      "Drain plug crush washer",
    ],
    safety: [
      "Let a hot engine cool for 10-15 min before draining -- hot oil causes burns.",
      "Use jack stands rated for the vehicle's weight; never work under a vehicle held only by a jack.",
      "Used oil and filters are hazardous waste -- take them to a recycling/auto parts drop-off, never pour down a drain.",
    ],
    torqueSpecs: [
      {
        fastener: "Oil pan drain plug",
        value: "18 ft-lb (25 Nm)",
        notes: "Carried over from the Silverado 1500 entry, where this value came back from Open Labor Project as real, vehicle-specific, high-confidence data for the same L84 engine. Flagged as a twin carry-over rather than independently confirmed for this vehicle -- re-pull it under this make/model when quota allows.",
      },
      {
        fastener: "Oil filter (spin-on)",
        value: "22 ft-lb (30 Nm)",
        notes: "Carried over from the Silverado 1500's verified Open Labor Project value for the same L84 engine, and its SPIN-ON component label is what caught a real error in the original Silverado write-up. Reference torque only -- most techs seat the gasket by hand and add three-quarters of a turn. Flagged as a twin carry-over, not independently confirmed for this vehicle.",
      },
    ],
    steps: [
      {
        number: 1,
        title: "Warm the engine briefly, then park and secure",
        instructions: "Run the engine for 2-3 minutes so the oil flows more easily, then shut it off. Park on level ground, set the parking brake, and chock the wheels.",
        image: "/steps/generic-park-secure.svg",
      },
      {
        number: 2,
        title: "Raise the vehicle and remove the under-engine shield",
        instructions: "Support the vehicle on jack stands at the frame's rated lift points. Remove or swing aside the plastic under-engine shield if fitted.",
        image: "/steps/generic-raise-vehicle.svg",
        warning: "Confirm the vehicle is stable on the stands before reaching underneath -- this is a heavy, high-riding full-size SUV.",
      },
      {
        number: 3,
        title: "Drain the old oil",
        instructions: "Position the drain pan under the oil pan's drain plug. Loosen the plug with a socket, then finish removing it by hand and let the oil fully drain. Expect roughly 8.0 qt.",
        image: "/steps/oil-drain.svg",
      },
      {
        number: 4,
        title: "Remove the spin-on filter",
        instructions: "The filter is on the driver side of the engine, reachable from underneath. Slide the drain pan under it, back it off with the filter wrench, then spin it off by hand -- it will be full of oil, so keep it upright until it clears.",
        image: "/steps/oil-filter-spinon-remove.svg",
        warning: "Check that the old filter's rubber gasket came off with it. A gasket left stuck to the engine will double up against the new filter and push oil out under pressure.",
      },
      {
        number: 5,
        title: "Install the new filter and drain plug",
        instructions: "Wipe the sealing surface clean, smear a film of fresh oil on the new filter's gasket, and thread it on by hand until the gasket contacts, then about three-quarters of a turn more. Fit a new crush washer on the drain plug and torque it to spec.",
        image: "/steps/oil-filter-install.svg",
        torque: [{ fastener: "Oil pan drain plug", value: "18 ft-lb (25 Nm)" }],
      },
      {
        number: 6,
        title: "Reinstall the under-shield and lower the vehicle",
        instructions: "Reattach the under-engine shield fasteners (if removed) and carefully lower the vehicle back to the ground.",
        image: "/steps/generic-lower-vehicle.svg",
      },
      {
        number: 7,
        title: "Refill and check",
        instructions: "Remove the oil fill cap and add oil in stages, checking the dipstick as you approach 8.0 qt. Start the engine, let it run ~30 seconds, shut it off, and check underneath for leaks at the drain plug and filter.",
        image: "/steps/oil-fill-check.svg",
      },
      {
        number: 8,
        title: "Final level check and oil-life reset",
        instructions: "Wait a few minutes for oil to settle, recheck the dipstick, and top off if needed. Reset the oil-life monitor from the Driver Information Center. Dispose of the old oil and filter at a recycling drop-off.",
        image: "/steps/generic-cleanup.svg",
      },
    ],
  },
  {
    id: "chevrolet-traverse-oil-change",
    vehicleId: "2021-chevrolet-traverse-3.6l",
    title: "Engine Oil & Filter Change",
    jobType: "oil-change",
    summary: "Drain-and-refill oil service for the 3.6L V6 (LFY), with its spin-on oil filter.",
    difficulty: "Easy",
    tier: "free",
    estTime: "40-55 min",
    tools: [
      { name: "Oil filter wrench", note: "Strap or cap-style for the spin-on filter" },
      { name: "Socket set + ratchet", note: "For the drain plug and the under-shield fasteners" },
      { name: "Torque wrench", note: "Range covering 10-25 ft-lb" },
      { name: "Drain pan", note: "6+ qt capacity" },
      { name: "Funnel" },
      { name: "Jack + 2 jack stands or drive-up ramps" },
      { name: "Nitrile gloves + safety glasses" },
    ],
    parts: [
      "5.7 qt (5.4 L) 0W-20 full-synthetic engine oil meeting GM dexos1",
      "Spin-on oil filter (ACDelco PF64 or equivalent)",
      "Drain plug crush washer (replace each service)",
    ],
    safety: [
      "Let a hot engine cool for 10-15 min before draining -- hot oil causes burns.",
      "Use jack stands rated for the vehicle's weight; never work under a vehicle held only by a jack.",
      "Used oil and filters are hazardous waste -- take them to a recycling/auto parts drop-off, never pour down a drain.",
    ],
    torqueSpecs: [
      {
        fastener: "Oil pan drain plug",
        value: "20 ft-lb (27 Nm)",
        notes: "Curated reference figure -- not yet pulled from Open Labor Project for this vehicle.",
      },
      {
        fastener: "Spin-on oil filter",
        value: "Hand-tighten per filter instructions (typically 3/4 turn past gasket contact)",
        notes: "Don't use a torque wrench on a spin-on filter -- follow the printed instructions on the filter itself.",
      },
    ],
    steps: [
      {
        number: 1,
        title: "Warm the engine briefly, then park and secure",
        instructions: "Run the engine for 2-3 minutes so the oil flows more easily, then shut it off. Park on level ground, set the parking brake, and chock the wheels.",
        image: "/steps/generic-park-secure.svg",
      },
      {
        number: 2,
        title: "Raise the vehicle and remove the under-engine shield",
        instructions: "Support the vehicle on jack stands at the factory lift points. Remove the plastic under-engine shield if fitted -- it's held by a mix of push-pin fasteners and bolts along its edge.",
        image: "/steps/generic-raise-vehicle.svg",
        warning: "Confirm the vehicle is stable on the stands before reaching underneath -- this is a heavy, three-row crossover.",
      },
      {
        number: 3,
        title: "Drain the old oil",
        instructions: "Position the drain pan under the oil pan's drain plug. Loosen the plug with a socket, then finish removing it by hand and let the oil fully drain.",
        image: "/steps/oil-drain.svg",
      },
      {
        number: 4,
        title: "Remove the old filter",
        instructions: "Locate the spin-on filter on the front of the engine block. Use the filter wrench to break it loose, then unscrew it by hand -- have the drain pan positioned underneath, it will spill some oil.",
        image: "/steps/oil-filter-spinon-remove.svg",
      },
      {
        number: 5,
        title: "Install the new filter and drain plug",
        instructions: "Wipe the mounting surface clean, lightly oil the new filter's gasket, and spin it on by hand until snug plus the additional turn specified on the filter. Reinstall the drain plug with a new crush washer and torque it to spec.",
        image: "/steps/oil-filter-install.svg",
        torque: [{ fastener: "Oil pan drain plug", value: "20 ft-lb (27 Nm)" }],
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
        instructions: "Remove the oil fill cap on the valve cover and add oil in stages, checking the dipstick as you approach 5.7 qt. Start the engine, let it run ~30 seconds, shut it off, and check under the vehicle for leaks at the drain plug and filter.",
        image: "/steps/oil-fill-check.svg",
      },
      {
        number: 8,
        title: "Final level check and oil-life reset",
        instructions: "Wait a few minutes for oil to settle, recheck the dipstick, and top off if needed. Reset the oil-life monitor via the dash Information menu. Dispose of the old oil and filter at a recycling center.",
        image: "/steps/generic-cleanup.svg",
      },
    ],
  },
// --------------------------------------------------------------- EDGE

  {
    id: "ford-edge-oil-change",
    vehicleId: "2019-ford-edge-2.0l",
    title: "Engine Oil & Filter Change",
    jobType: "oil-change",
    summary: "Drain-and-refill oil service for the 2.0L EcoBoost turbo four-cylinder, with its spin-on oil filter.",
    difficulty: "Easy",
    tier: "free",
    estTime: "35-50 min",
    tools: [
      { name: "Oil filter wrench", note: "Strap or cap-style for the spin-on filter" },
      { name: "Socket set + ratchet", note: "For the drain plug and the under-shield fasteners" },
      { name: "Torque wrench", note: "Range covering 10-25 ft-lb" },
      { name: "Drain pan", note: "6+ qt capacity" },
      { name: "Funnel" },
      { name: "Jack + 2 jack stands or drive-up ramps" },
      { name: "Nitrile gloves + safety glasses" },
    ],
    parts: [
      "5.7 qt (5.4 L) 5W-30 full-synthetic engine oil meeting Ford WSS-M2C946-B1",
      "Spin-on oil filter (Motorcraft FL-910-S or equivalent)",
      "Drain plug crush washer (replace each service)",
    ],
    safety: [
      "Let a hot engine cool for 10-15 min before draining -- hot oil causes burns.",
      "Use jack stands rated for the vehicle's weight; never work under a vehicle held only by a jack.",
      "Used oil and filters are hazardous waste -- take them to a recycling/auto parts drop-off, never pour down a drain.",
    ],
    torqueSpecs: [
      {
        fastener: "Oil pan drain plug",
        value: "20 ft-lb (27 Nm)",
        notes: "Curated reference figure -- not yet pulled from Open Labor Project for this vehicle.",
      },
      {
        fastener: "Spin-on oil filter",
        value: "Hand-tighten per filter instructions (typically 3/4 turn past gasket contact)",
        notes: "Don't use a torque wrench on a spin-on filter -- follow the printed instructions on the filter itself.",
      },
    ],
    steps: [
      {
        number: 1,
        title: "Warm the engine briefly, then park and secure",
        instructions: "Run the engine for 2-3 minutes so the oil flows more easily, then shut it off. Park on level ground, set the parking brake, and chock the wheels.",
        image: "/steps/generic-park-secure.svg",
      },
      {
        number: 2,
        title: "Raise the vehicle and remove the under-engine shield",
        instructions: "Support the vehicle on jack stands at the factory lift points. Remove the plastic under-engine shield if fitted -- it's held by a mix of push-pin fasteners and bolts along its edge.",
        image: "/steps/generic-raise-vehicle.svg",
        warning: "Confirm the vehicle is stable on the stands before reaching underneath.",
      },
      {
        number: 3,
        title: "Drain the old oil",
        instructions: "Position the drain pan under the oil pan's drain plug. Loosen the plug with a socket, then finish removing it by hand and let the oil fully drain.",
        image: "/steps/oil-drain.svg",
      },
      {
        number: 4,
        title: "Remove the old filter",
        instructions: "Locate the spin-on filter on the front of the engine block. Use the filter wrench to break it loose, then unscrew it by hand -- have the drain pan positioned underneath, it will spill some oil.",
        image: "/steps/oil-filter-spinon-remove.svg",
      },
      {
        number: 5,
        title: "Install the new filter and drain plug",
        instructions: "Wipe the mounting surface clean, lightly oil the new filter's gasket, and spin it on by hand until snug plus the additional turn specified on the filter. Reinstall the drain plug with a new crush washer and torque it to spec.",
        image: "/steps/oil-filter-install.svg",
        torque: [{ fastener: "Oil pan drain plug", value: "20 ft-lb (27 Nm)" }],
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
        instructions: "Remove the oil fill cap on the valve cover and add oil in stages, checking the dipstick as you approach 5.7 qt. Start the engine, let it run ~30 seconds, shut it off, and check under the vehicle for leaks at the drain plug and filter.",
        image: "/steps/oil-fill-check.svg",
      },
      {
        number: 8,
        title: "Final level check and oil-life reset",
        instructions: "Wait a few minutes for oil to settle, recheck the dipstick, and top off if needed. Reset the oil-life monitor via the dash Information menu. Dispose of the old oil and filter at a recycling center.",
        image: "/steps/generic-cleanup.svg",
      },
    ],
  },
  
// --------------------------------------------------------------- FUSION

  {
    id: "ford-fusion-oil-change",
    vehicleId: "2019-ford-fusion-2.5l",
    title: "Engine Oil & Filter Change",
    jobType: "oil-change",
    summary: "Drain-and-refill oil service for the 2.5L Duratec inline-four, with its cartridge-style oil filter.",
    difficulty: "Easy",
    tier: "free",
    estTime: "35-50 min",
    tools: [
      { name: "Oil filter housing wrench", note: "Cartridge cap, not a spin-on canister" },
      { name: "Socket set + ratchet", note: "For the drain plug and the under-shield fasteners" },
      { name: "Torque wrench", note: "Range covering 10-25 ft-lb" },
      { name: "Drain pan", note: "6+ qt capacity" },
      { name: "Funnel" },
      { name: "Jack + 2 jack stands or drive-up ramps" },
      { name: "Nitrile gloves + safety glasses" },
    ],
    parts: [
      "5.7 qt (5.4 L) 5W-20 full-synthetic-blend engine oil meeting Ford WSS-M2C946-B1 (Motorcraft or equivalent)",
      "Cartridge oil filter element + housing O-ring (Motorcraft FL-500-S or equivalent)",
      "Drain plug crush washer (replace each service)",
    ],
    safety: [
      "Let a hot engine cool for 10-15 min before draining -- hot oil causes burns.",
      "Use jack stands rated for the vehicle's weight; never work under a vehicle held only by a jack.",
      "Used oil and filters are hazardous waste -- take them to a recycling/auto parts drop-off, never pour down a drain.",
    ],
    torqueSpecs: [
      {
        fastener: "Oil pan drain plug",
        value: "20 ft-lb (27 Nm)",
        notes: "Curated reference figure -- not yet pulled from Open Labor Project for this vehicle.",
      },
      {
        fastener: "Oil filter housing cap",
        value: "18 ft-lb (25 Nm)",
        notes: "Curated reference figure -- not yet pulled from Open Labor Project for this vehicle. Housing is plastic -- do not overtighten, snug plus spec torque only.",
      },
    ],
    steps: [
      {
        number: 1,
        title: "Warm the engine briefly, then park and secure",
        instructions: "Run the engine for 2-3 minutes so the oil flows more easily, then shut it off. Park on level ground, set the parking brake, and chock the wheels.",
        image: "/steps/generic-park-secure.svg",
      },
      {
        number: 2,
        title: "Raise the vehicle and remove the under-engine shield",
        instructions: "Support the vehicle on jack stands at the factory lift points. Remove the plastic under-engine shield if fitted -- it's held by a mix of push-pin fasteners and bolts along its edge.",
        image: "/steps/generic-raise-vehicle.svg",
        warning: "Confirm the vehicle is stable on the stands before reaching underneath.",
      },
      {
        number: 3,
        title: "Drain the old oil",
        instructions: "Position the drain pan under the oil pan's drain plug. Loosen the plug with a socket, then finish removing it by hand and let the oil fully drain.",
        image: "/steps/oil-drain.svg",
      },
      {
        number: 4,
        title: "Remove and replace the oil filter cartridge",
        instructions: "The filter housing cap sits on top of the engine. Unscrew it counterclockwise with the housing wrench, lift out the old filter element, and let residual oil drain from the housing before wiping it clean.",
        image: "/steps/oil-filter-cartridge.svg",
        torque: [{ fastener: "Oil filter housing cap", value: "18 ft-lb (25 Nm)" }],
      },
      {
        number: 5,
        title: "Install the new filter and drain plug",
        instructions: "Fit the new filter element into the cap, lightly oil the new housing O-ring, and thread the cap back in by hand before torquing it to spec. Reinstall the drain plug with a new crush washer and torque it to spec.",
        image: "/steps/oil-filter-install.svg",
        torque: [{ fastener: "Oil pan drain plug", value: "20 ft-lb (27 Nm)" }],
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
        instructions: "Remove the oil fill cap on the valve cover and add oil in stages, checking the dipstick as you approach 5.7 qt. Start the engine, let it run ~30 seconds, shut it off, and check under the vehicle for leaks at the drain plug and filter housing.",
        image: "/steps/oil-fill-check.svg",
      },
      {
        number: 8,
        title: "Final level check and oil-life reset",
        instructions: "Wait a few minutes for oil to settle, recheck the dipstick, and top off if needed. Reset the oil-life monitor via the dash Information menu per your owner's manual. Dispose of the old oil and filter at a recycling center.",
        image: "/steps/generic-cleanup.svg",
      },
    ],
  },
  {
    id: "ford-focus-oil-change",
    vehicleId: "2016-ford-focus-2.0l",
    title: "Engine Oil & Filter Change",
    jobType: "oil-change",
    summary: "Drain-and-refill oil service for the 2.0L Duratec inline-four, with its spin-on oil filter.",
    difficulty: "Easy",
    tier: "free",
    estTime: "30-45 min",
    tools: [
      { name: "Filter wrench or strap wrench", note: "For the spin-on canister filter" },
      { name: "Socket set + ratchet", note: "For the drain plug and under-shield fasteners" },
      { name: "Torque wrench", note: "Range covering 10-25 ft-lb" },
      { name: "Drain pan", note: "6+ qt capacity" },
      { name: "Funnel" },
      { name: "Jack + 2 jack stands or drive-up ramps" },
      { name: "Nitrile gloves + safety glasses" },
    ],
    parts: [
      "5.5 qt (5.2 L) 5W-20 full synthetic engine oil meeting Ford WSS-M2C930-A (Motorcraft or equivalent)",
      "Spin-on oil filter (Motorcraft FL-910-S or equivalent)",
      "Drain plug crush washer (replace each service, if equipped)",
    ],
    safety: [
      "Let a hot engine cool for 10-15 min before draining -- hot oil causes burns.",
      "Use jack stands rated for the vehicle's weight; never work under a vehicle held only by a jack.",
      "Used oil and filters are hazardous waste -- take them to a recycling/auto parts drop-off, never pour down a drain.",
    ],
    torqueSpecs: [
      {
        fastener: "Oil pan drain plug",
        value: "20 ft-lb (27 Nm)",
        notes: "Curated reference figure -- not yet pulled from Open Labor Project for this vehicle.",
      },
    ],
    steps: [
      {
        number: 1,
        title: "Warm the engine briefly, then park and secure",
        instructions: "Run the engine for 2-3 minutes so the oil flows more easily, then shut it off. Park on level ground, set the parking brake, and chock the wheels.",
        image: "/steps/generic-park-secure.svg",
      },
      {
        number: 2,
        title: "Raise the vehicle and remove the under-engine shield",
        instructions: "Support the vehicle on jack stands at the factory lift points. Remove the plastic under-engine shield if fitted -- it's held by a mix of push-pin fasteners and bolts along its edge.",
        image: "/steps/generic-raise-vehicle.svg",
        warning: "Confirm the vehicle is stable on the stands before reaching underneath.",
      },
      {
        number: 3,
        title: "Drain the old oil",
        instructions: "Position the drain pan under the oil pan's drain plug. Loosen the plug with a socket, then finish removing it by hand and let the oil fully drain. Expect roughly 5.5 qt.",
        image: "/steps/oil-drain.svg",
      },
      {
        number: 4,
        title: "Remove the spin-on filter",
        instructions: "The filter is low on the engine block, reachable from underneath. Slide the drain pan under it, back it off with the filter wrench, then spin it the rest of the way off by hand and let it drain into the pan.",
        image: "/steps/oil-filter-spinon-remove.svg",
      },
      {
        number: 5,
        title: "Install the new filter and drain plug",
        instructions: "Wipe the sealing surface clean, smear a film of fresh oil on the new filter's gasket, and thread it on by hand until the gasket contacts, then about three-quarters of a turn more. Fit a new crush washer on the drain plug and torque it to spec.",
        image: "/steps/oil-filter-install.svg",
        torque: [{ fastener: "Oil pan drain plug", value: "20 ft-lb (27 Nm)" }],
      },
      {
        number: 6,
        title: "Reinstall the under-shield and lower the vehicle",
        instructions: "Reattach the under-engine shield fasteners (if removed) and carefully lower the vehicle back to the ground.",
        image: "/steps/generic-lower-vehicle.svg",
      },
      {
        number: 7,
        title: "Refill and check",
        instructions: "Remove the oil fill cap on the valve cover and add oil in stages, checking the dipstick as you approach 5.5 qt. Start the engine, let it run ~30 seconds, shut it off, and check under the vehicle for leaks at the drain plug and filter.",
        image: "/steps/oil-fill-check.svg",
      },
      {
        number: 8,
        title: "Final level check and oil-life reset",
        instructions: "Wait a few minutes for oil to settle, recheck the dipstick, and top off if needed. Reset the oil-life monitor via the dash Information menu per your owner's manual. Dispose of the old oil and filter at a recycling drop-off.",
        image: "/steps/generic-cleanup.svg",
      },
    ],
  },

  {
    id: "ford-mustang-oil-change",
    vehicleId: "2018-ford-mustang-5.0l",
    title: "Engine Oil & Filter Change",
    jobType: "oil-change",
    summary: "Drain-and-refill oil service for the 5.0L Coyote V8, with its spin-on oil filter.",
    difficulty: "Easy",
    tier: "free",
    estTime: "40-55 min",
    tools: [
      { name: "Oil filter wrench", note: "Strap or cap-style for the spin-on filter" },
      { name: "Socket set + ratchet", note: "For the drain plug and under-shield fasteners" },
      { name: "Torque wrench", note: "Range covering 15-25 ft-lb" },
      { name: "Large drain pan", note: "12+ qt capacity -- this engine holds 10 qt" },
      { name: "Funnel" },
      { name: "Jack + 2 jack stands or drive-up ramps" },
      { name: "Nitrile gloves + safety glasses" },
    ],
    parts: [
      "10.0 qt (9.5 L) 5W-30 full synthetic engine oil meeting Ford WSS-M2C946-B1 (Motorcraft or equivalent)",
      "Spin-on oil filter (Motorcraft FL-820-S or equivalent)",
      "Drain plug crush washer",
    ],
    safety: [
      "Let a hot engine cool for 10-15 min before draining -- hot oil causes burns.",
      "Use jack stands rated for the vehicle's weight; never work under a vehicle held only by a jack.",
      "Used oil and filters are hazardous waste -- take them to a recycling/auto parts drop-off, never pour down a drain.",
    ],
    torqueSpecs: [
      {
        fastener: "Oil pan drain plug",
        value: "20 ft-lb (27 Nm)",
        notes: "Curated reference figure -- not yet pulled from Open Labor Project for this vehicle.",
      },
      {
        fastener: "Oil filter (spin-on)",
        value: "22 ft-lb (30 Nm)",
        notes: "Reference torque only. In practice most techs seat the gasket by hand and add three-quarters of a turn.",
      },
    ],
    steps: [
      {
        number: 1,
        title: "Warm the engine briefly, then park and secure",
        instructions: "Run the engine for 2-3 minutes so the oil flows more easily, then shut it off. Park on level ground, set the parking brake, and chock the wheels.",
        image: "/steps/generic-park-secure.svg",
      },
      {
        number: 2,
        title: "Raise the vehicle and remove the under-engine shield",
        instructions: "This car sits low enough that ramps are usually easier than a jack. Support it on jack stands at the rated lift points, then remove the plastic under-engine shield.",
        image: "/steps/generic-raise-vehicle.svg",
        warning: "Confirm the car is stable before reaching underneath. Low ground clearance makes it tempting to skip the stands -- do not.",
      },
      {
        number: 3,
        title: "Drain the old oil",
        instructions: "Position the drain pan under the oil pan's drain plug. Loosen the plug with a socket, then finish removing it by hand and let the oil fully drain. Expect roughly 10.0 qt.",
        image: "/steps/oil-drain.svg",
      },
      {
        number: 4,
        title: "Remove the spin-on filter",
        instructions: "The filter is low on the driver side of the block, reachable from underneath. Slide the drain pan under it, back it off with the filter wrench, then spin it off by hand -- it will be full of oil, so keep it upright until it clears.",
        image: "/steps/oil-filter-spinon-remove.svg",
        warning: "Check that the old filter's rubber gasket came off with it. A gasket left stuck to the engine will double up against the new filter and push oil out under pressure.",
      },
      {
        number: 5,
        title: "Install the new filter and drain plug",
        instructions: "Wipe the sealing surface clean, smear a film of fresh oil on the new filter's gasket, and thread it on by hand until the gasket contacts, then about three-quarters of a turn more. Fit a new crush washer on the drain plug and torque it to spec.",
        image: "/steps/oil-filter-install.svg",
        torque: [{ fastener: "Oil pan drain plug", value: "20 ft-lb (27 Nm)" }],
      },
      {
        number: 6,
        title: "Reinstall the under-shield and lower the vehicle",
        instructions: "Reattach the under-engine shield fasteners (if removed) and carefully lower the vehicle back to the ground.",
        image: "/steps/generic-lower-vehicle.svg",
      },
      {
        number: 7,
        title: "Refill and check",
        instructions: "Remove the oil fill cap and add oil in stages, checking the dipstick as you approach 10.0 qt. Start the engine, let it run ~30 seconds, shut it off, and check underneath for leaks at the drain plug and filter.",
        image: "/steps/oil-fill-check.svg",
      },
      {
        number: 8,
        title: "Final level check and oil-life reset",
        instructions: "Wait a few minutes for oil to settle, recheck the dipstick, and top off if needed. Reset the oil-life monitor via the dash Information menu per your owner's manual. Dispose of the old oil and filter at a recycling drop-off.",
        image: "/steps/generic-cleanup.svg",
      },
    ],
  },
  {
    id: "ford-ranger-oil-change",
    vehicleId: "2021-ford-ranger-2.3l",
    title: "Engine Oil & Filter Change",
    jobType: "oil-change",
    summary: "Drain-and-refill oil service for the 2.3L EcoBoost turbo four, with its spin-on canister oil filter.",
    difficulty: "Easy",
    tier: "free",
    estTime: "30-45 min",
    tools: [
      { name: "Oil filter wrench", note: "Strap or cap-style for the spin-on filter (Motorcraft FL-910S)" },
      { name: "Socket set + ratchet", note: "For drain plug and under-shield fasteners" },
      { name: "Torque wrench", note: "Range covering 15-25 ft-lb" },
      { name: "Drain pan", note: "7+ qt capacity" },
      { name: "Funnel" },
      { name: "Jack + 2 jack stands or drive-up ramps" },
      { name: "Nitrile gloves + safety glasses" },
    ],
    parts: [
      "6.2 qt (5.9 L) 5W-30 full-synthetic engine oil",
      "Motorcraft FL-910S (or equivalent) spin-on oil filter",
      "Drain plug crush washer (replace if not self-sealing)",
    ],
    safety: [
      "Let a hot engine cool for 10-15 min before draining -- hot oil causes burns.",
      "Use jack stands rated for the vehicle's weight; never work under a vehicle held only by a jack.",
      "Used oil and filters are hazardous waste -- take them to a recycling/auto parts drop-off, never pour down a drain.",
    ],
    torqueSpecs: [
      {
        fastener: "Oil pan drain plug",
        value: "22 ft-lb (30 Nm)",
        notes: "Curated reference figure -- not yet pulled from Open Labor Project for this vehicle.",
      },
      {
        fastener: "Spin-on oil filter",
        value: "Hand-tighten per filter instructions (typically 3/4 turn past gasket contact)",
        notes: "Don't use a torque wrench on a spin-on filter -- follow the printed instructions on the filter itself.",
      },
    ],
    steps: [
      {
        number: 1,
        title: "Warm the engine briefly, then park and secure",
        instructions: "Run the engine for 2-3 minutes so the oil flows more easily, then shut it off. Park on level ground, set the parking brake, and chock the wheels.",
        image: "/steps/generic-park-secure.svg",
      },
      {
        number: 2,
        title: "Raise the vehicle and remove the under-engine shield",
        instructions: "Support the vehicle on jack stands at the factory frame lift points. Remove the plastic under-engine shield if equipped.",
        image: "/steps/generic-raise-vehicle.svg",
        warning: "Confirm the vehicle is stable on the stands before reaching underneath -- this is a heavy, high-riding vehicle.",
      },
      {
        number: 3,
        title: "Drain the old oil",
        instructions: "Position the drain pan under the oil pan's drain plug. Loosen the plug with a socket, then finish removing it by hand and let the oil fully drain.",
        image: "/steps/oil-drain.svg",
      },
      {
        number: 4,
        title: "Remove the old filter",
        instructions: "Locate the spin-on filter on the engine block. Use the filter wrench to break it loose, then unscrew it by hand -- have the drain pan positioned underneath, it will spill some oil.",
        image: "/steps/oil-filter-spinon-remove.svg",
      },
      {
        number: 5,
        title: "Install the new filter and drain plug",
        instructions: "Wipe the mounting surface clean, lightly oil the new filter's gasket, and spin it on by hand until snug plus the additional turn specified on the filter. Reinstall the drain plug with a new crush washer and torque it to spec.",
        image: "/steps/oil-filter-install.svg",
        torque: [{ fastener: "Oil pan drain plug", value: "22 ft-lb (30 Nm)" }],
      },
      {
        number: 6,
        title: "Reinstall the under-shield and lower the vehicle",
        instructions: "Reattach the under-engine shield fasteners (if removed) and carefully lower the vehicle back to the ground.",
        image: "/steps/generic-lower-vehicle.svg",
      },
      {
        number: 7,
        title: "Refill and check",
        instructions: "Remove the oil fill cap and add oil in stages, checking the dipstick as you approach 6.2 qt. Start the engine, let it run ~30 seconds, shut it off, and check under the vehicle for leaks at the drain plug and filter.",
        image: "/steps/oil-fill-check.svg",
      },
      {
        number: 8,
        title: "Final level check and oil-life reset",
        instructions: "Wait a few minutes for oil to settle, recheck the dipstick, and top off if needed. Reset the oil-change reminder via the dash Information menu. Dispose of the old oil and filter at a recycling center.",
        image: "/steps/generic-cleanup.svg",
      },
    ],
  },
  {
    id: "ford-expedition-oil-change",
    vehicleId: "2021-ford-expedition-3.5l",
    title: "Engine Oil & Filter Change",
    jobType: "oil-change",
    summary: "Drain-and-refill oil service for the 3.5L EcoBoost twin-turbo V6, with its cartridge-style oil filter.",
    difficulty: "Easy",
    tier: "free",
    estTime: "45-60 min",
    tools: [
      { name: "Oil filter housing wrench", note: "Cartridge cap, same style used across Ford's EcoBoost lineup (Motorcraft FL-500S housing)" },
      { name: "Socket set + ratchet", note: "For drain plug and under-shield fasteners" },
      { name: "Torque wrench", note: "Range covering 15-25 ft-lb" },
      { name: "Drain pan", note: "7+ qt capacity" },
      { name: "Funnel" },
      { name: "Jack + 2 jack stands or drive-up ramps" },
      { name: "Nitrile gloves + safety glasses" },
    ],
    parts: [
      "6.0 qt (5.7 L) 5W-30 full-synthetic engine oil",
      "Motorcraft FL-500S cartridge oil filter element + housing O-ring",
      "Drain plug crush washer (replace if not self-sealing)",
    ],
    safety: [
      "Let a hot engine cool for 10-15 min before draining -- hot oil causes burns.",
      "Use jack stands rated for the vehicle's weight; never work under a vehicle held only by a jack -- this is a heavy, full-size SUV.",
      "Used oil and filters are hazardous waste -- take them to a recycling/auto parts drop-off, never pour down a drain.",
    ],
    torqueSpecs: [
      {
        fastener: "Oil pan drain plug",
        value: "20 ft-lb (27 Nm)",
        notes: "Use new crush washer. Curated reference figure -- not yet pulled from Open Labor Project for this vehicle.",
      },
      {
        fastener: "Oil filter housing cap",
        value: "18 ft-lb (24 Nm)",
        notes: "Housing is plastic -- do not overtighten, snug + spec torque only. Curated reference figure.",
      },
    ],
    steps: [
      {
        number: 1,
        title: "Warm the engine briefly, then park and secure",
        instructions: "Run the engine for 2-3 minutes so the oil flows more easily, then shut it off. Park on level ground, set the parking brake, and chock the wheels.",
        image: "/steps/generic-park-secure.svg",
      },
      {
        number: 2,
        title: "Raise the vehicle and remove the under-engine shield",
        instructions: "Support the vehicle on jack stands at the factory lift points. Remove the plastic under-engine shield if equipped -- it's held by a mix of push-pin fasteners and bolts along its edge.",
        image: "/steps/generic-raise-vehicle.svg",
        warning: "Confirm the vehicle is stable on the stands before reaching underneath -- this is a heavy, full-size SUV.",
      },
      {
        number: 3,
        title: "Drain the old oil",
        instructions: "Position the drain pan under the oil pan's drain plug. Loosen the plug with a socket, then finish removing it by hand and let the oil fully drain.",
        image: "/steps/oil-drain.svg",
      },
      {
        number: 4,
        title: "Remove and replace the oil filter cartridge",
        instructions: "The filter housing cap is on top of the engine, between the turbochargers. Unscrew it counterclockwise with the housing wrench, lift out the old filter element, and let residual oil drain from the housing before wiping it clean.",
        image: "/steps/oil-filter-cartridge.svg",
        torque: [{ fastener: "Oil filter housing cap", value: "18 ft-lb (24 Nm)" }],
      },
      {
        number: 5,
        title: "Install the new filter and reassemble",
        instructions: "Fit the new filter element into the cap, lightly oil the new O-ring, and thread the cap back in by hand before torquing it. Reinstall the drain plug with a new crush washer and torque it to spec.",
        image: "/steps/oil-filter-install.svg",
        torque: [{ fastener: "Oil filter housing cap", value: "18 ft-lb (24 Nm)" }, { fastener: "Oil pan drain plug", value: "20 ft-lb (27 Nm)" }],
      },
      {
        number: 6,
        title: "Reinstall the under-shield and lower the vehicle",
        instructions: "Reattach the under-engine shield fasteners (if removed) and carefully lower the vehicle back to the ground.",
        image: "/steps/generic-lower-vehicle.svg",
      },
      {
        number: 7,
        title: "Refill and check",
        instructions: "Remove the oil fill cap on top of the engine and add oil in stages, checking the dipstick as you approach 6.0 qt. Start the engine, let it run ~30 seconds, shut it off, and check under the vehicle for leaks at the drain plug and filter cap.",
        image: "/steps/oil-fill-check.svg",
      },
      {
        number: 8,
        title: "Final level check and oil-life reset",
        instructions: "Wait a few minutes for oil to settle, recheck the dipstick, and top off if needed. Reset the oil-change reminder via the dash Information menu. Dispose of the old oil and filter at a recycling center.",
        image: "/steps/generic-cleanup.svg",
      },
    ],
  },

// ------------------------------------------------- TIRE ROTATION
// One universal template applied per vehicle. The only vehicle-specific
// inputs are drivetrain (which decides the cross pattern), lug nut torque,
// base tire size, jack points and the TPMS reset procedure. Lug torque is
// curated reference data carried over from each vehicle's specs list.
{
id: "jeep-grand-cherokee-tire-rotation",
vehicleId: "2014-jeep-grand-cherokee-3.6l",
title: "Tire Rotation",
jobType: "tire-rotation",
summary:
"Even out tire wear on the WK2 Grand Cherokee by moving all four tires through a rearward cross pattern, with a tread and brake inspection while the wheels are off.",
difficulty: "Easy",
tier: "premium",
estTime: "45-60 min",
tools: [
{ name: "Lug wrench or breaker bar", note: "Long handle makes breaking 130 ft-lb (176 Nm) loose far easier" },
{ name: "Socket to fit the lug nuts", note: "Use a proper impact/deep socket — an ill-fitting one rounds the nut" },
{ name: "Torque wrench", note: "Must cover 130 ft-lb (176 Nm)" },
{ name: "Floor jack" },
{ name: "4 jack stands", note: "All four wheels come off at once on a cross rotation" },
{ name: "Wheel chocks" },
{ name: "Tire pressure gauge" },
{ name: "Tread depth gauge or a quarter", note: "A quarter works: if the tread does not reach Washington's hairline, you are near 4/32\" and shopping for tires" },
],
parts: [
"None — this is a no-parts service",
"Optional: replacement valve caps",
"Optional: anti-seize is NOT recommended on lug studs — it changes the effective clamp load at a given torque",
],
safety: [
"Never get under a vehicle supported only by a jack. Use stands rated for the vehicle's weight, on level concrete.",
"Break the lug nuts loose while the tires are still on the ground. Trying to crack them with the wheel in the air spins the wheel and can pull the vehicle off the stands.",
"Do not use an impact gun for final tightening. Impact guns routinely overshoot 130 ft-lb (176 Nm) by a wide margin, which warps rotors and stretches studs.",
"Re-torque all lug nuts after 50-100 miles. Nuts commonly settle and lose clamp load after a wheel has been off.",
],
torqueSpecs: [
{
fastener: "Wheel lug nuts",
value: "130 ft-lb (176 Nm)",
notes: "Tighten in a star/criss-cross pattern in two or three passes, not one shot per nut. Final torque with the wheels on the ground.",
},
],
steps: [
{
number: 1,
title: "Confirm your tires can actually be cross-rotated",
instructions:
"Before anything else, check the sidewalls. If they show a rotation-direction arrow, the tires are directional and must stay on the same side of the vehicle — front-to-back only, never crossed. If the front and rear tires are different sizes (a staggered setup), they cannot be rotated front-to-back at all. Base 245/70R17 tires on this vehicle are normally neither, but aftermarket tires change that, so look.",
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
"Lift the vehicle at pinch-weld jack points behind the front wheels and ahead of the rear wheels and set it down on four jack stands so every wheel is off the ground. Push firmly on a corner before you trust it — the vehicle should not rock or shift on the stands.",
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
"This vehicle is RWD (2WD), so use the rearward cross pattern: the two rear tires come straight forward to the same side of the front axle, and the two front tires cross over to the opposite rear corner. Put simply, on a rear- or four-wheel-drive vehicle the rear tires carry the drive wear while the fronts wear from steering and braking, so this pattern swaps those two wear patterns across the axles. Clean any rust or scale off the hub face before a wheel goes back on — debris trapped behind the wheel is a common cause of a wheel that will not seat flat and a vibration that shows up a week later.",
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
"With the vehicle's weight on the tires, torque every lug nut to 130 ft-lb (176 Nm) in a star pattern, working up to it in two or three passes. Set the tire pressures to the door-jamb placard values for their new positions. For TPMS: Uptown/dash menu — the WK2 relearns automatically after a few minutes of driving above ~15 mph. Then put a reminder on your phone to re-torque the lug nuts in 50-100 miles.",
image: "/steps/wheel-torque.svg",
torque: [{ fastener: "Wheel lug nuts", value: "130 ft-lb (176 Nm)" }],
},
],
},
{
id: "civic-tire-rotation",
vehicleId: "2018-honda-civic-1.5t",
title: "Tire Rotation",
jobType: "tire-rotation",
summary:
"Even out tire wear on the 10th-gen Civic by moving all four tires through a forward cross pattern, with a tread and brake inspection while the wheels are off.",
difficulty: "Easy",
tier: "premium",
estTime: "45-60 min",
tools: [
{ name: "Lug wrench or breaker bar", note: "Long handle makes breaking 80 ft-lb (108 Nm) loose far easier" },
{ name: "Socket to fit the lug nuts", note: "Use a proper impact/deep socket — an ill-fitting one rounds the nut" },
{ name: "Torque wrench", note: "Must cover 80 ft-lb (108 Nm)" },
{ name: "Floor jack" },
{ name: "4 jack stands", note: "All four wheels come off at once on a cross rotation" },
{ name: "Wheel chocks" },
{ name: "Tire pressure gauge" },
{ name: "Tread depth gauge or a quarter", note: "A quarter works: if the tread does not reach Washington's hairline, you are near 4/32\" and shopping for tires" },
],
parts: [
"None — this is a no-parts service",
"Optional: replacement valve caps",
"Optional: anti-seize is NOT recommended on lug studs — it changes the effective clamp load at a given torque",
],
safety: [
"Never get under a vehicle supported only by a jack. Use stands rated for the vehicle's weight, on level concrete.",
"Break the lug nuts loose while the tires are still on the ground. Trying to crack them with the wheel in the air spins the wheel and can pull the vehicle off the stands.",
"Do not use an impact gun for final tightening. Impact guns routinely overshoot 80 ft-lb (108 Nm) by a wide margin, which warps rotors and stretches studs.",
"Re-torque all lug nuts after 50-100 miles. Nuts commonly settle and lose clamp load after a wheel has been off.",
],
torqueSpecs: [
{
fastener: "Wheel lug nuts",
value: "80 ft-lb (108 Nm)",
provenance: { source: "open-labor-project", confidence: "high" },
notes: "Tighten in a star/criss-cross pattern in two or three passes, not one shot per nut. Final torque with the wheels on the ground.",
},
],
steps: [
{
number: 1,
title: "Confirm your tires can actually be cross-rotated",
instructions:
"Before anything else, check the sidewalls. If they show a rotation-direction arrow, the tires are directional and must stay on the same side of the vehicle — front-to-back only, never crossed. If the front and rear tires are different sizes (a staggered setup), they cannot be rotated front-to-back at all. Base 215/55R16 tires on this vehicle are normally neither, but aftermarket tires change that, so look.",
image: "/steps/tire-rotation-fwd.svg",
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
"Lift the vehicle at the reinforced pinch-weld points marked by notches in the rocker panel and set it down on four jack stands so every wheel is off the ground. Push firmly on a corner before you trust it — the vehicle should not rock or shift on the stands.",
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
"This vehicle is FWD, so use the forward cross pattern: the two front tires come straight back to the same side of the rear axle, and the two rear tires cross over to the opposite front corner. Put simply, the front tires on a front-wheel-drive vehicle do the steering, most of the braking and all of the power delivery, so they wear fastest — this pattern gets them onto the rear axle to even out. Clean any rust or scale off the hub face before a wheel goes back on — debris trapped behind the wheel is a common cause of a wheel that will not seat flat and a vibration that shows up a week later.",
image: "/steps/tire-rotation-fwd.svg",
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
"With the vehicle's weight on the tires, torque every lug nut to 80 ft-lb (108 Nm) in a star pattern, working up to it in two or three passes. Set the tire pressures to the door-jamb placard values for their new positions. For TPMS: Honda's indirect TPMS must be calibrated manually: Settings > Vehicle > TPMS Calibration > Initialize. Then put a reminder on your phone to re-torque the lug nuts in 50-100 miles.",
image: "/steps/wheel-torque.svg",
torque: [{ fastener: "Wheel lug nuts", value: "80 ft-lb (108 Nm)" }],
},
],
},
{
id: "f150-tire-rotation",
vehicleId: "2015-ford-f150-5.0l",
title: "Tire Rotation",
jobType: "tire-rotation",
summary:
"Even out tire wear on the 13th-gen F-150 by moving all four tires through a rearward cross pattern, with a tread and brake inspection while the wheels are off.",
difficulty: "Easy",
tier: "premium",
estTime: "45-60 min",
tools: [
{ name: "Lug wrench or breaker bar", note: "Long handle makes breaking 150 ft-lb (203 Nm) loose far easier" },
{ name: "Socket to fit the lug nuts", note: "Use a proper impact/deep socket — an ill-fitting one rounds the nut" },
{ name: "Torque wrench", note: "Must cover 150 ft-lb (203 Nm)" },
{ name: "Floor jack" },
{ name: "4 jack stands", note: "All four wheels come off at once on a cross rotation" },
{ name: "Wheel chocks" },
{ name: "Tire pressure gauge" },
{ name: "Tread depth gauge or a quarter", note: "A quarter works: if the tread does not reach Washington's hairline, you are near 4/32\" and shopping for tires" },
],
parts: [
"None — this is a no-parts service",
"Optional: replacement valve caps",
"Optional: anti-seize is NOT recommended on lug studs — it changes the effective clamp load at a given torque",
],
safety: [
"Never get under a vehicle supported only by a jack. Use stands rated for the vehicle's weight, on level concrete.",
"Break the lug nuts loose while the tires are still on the ground. Trying to crack them with the wheel in the air spins the wheel and can pull the vehicle off the stands.",
"Do not use an impact gun for final tightening. Impact guns routinely overshoot 150 ft-lb (203 Nm) by a wide margin, which warps rotors and stretches studs.",
"Re-torque all lug nuts after 50-100 miles. Nuts commonly settle and lose clamp load after a wheel has been off.",
],
torqueSpecs: [
{
fastener: "Wheel lug nuts",
value: "150 ft-lb (203 Nm)",
provenance: { source: "open-labor-project", confidence: "high" },
notes: "Tighten in a star/criss-cross pattern in two or three passes, not one shot per nut. Final torque with the wheels on the ground.",
},
],
steps: [
{
number: 1,
title: "Confirm your tires can actually be cross-rotated",
instructions:
"Before anything else, check the sidewalls. If they show a rotation-direction arrow, the tires are directional and must stay on the same side of the vehicle — front-to-back only, never crossed. If the front and rear tires are different sizes (a staggered setup), they cannot be rotated front-to-back at all. Base 265/70R17 tires on this vehicle are normally neither, but aftermarket tires change that, so look.",
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
"With the vehicle's weight on the tires, torque every lug nut to 150 ft-lb (203 Nm) in a star pattern, working up to it in two or three passes. Set the tire pressures to the door-jamb placard values for their new positions. For TPMS: direct TPMS — sensors report their own position, so no reset is needed, but let the truck sit keyed-on for a minute to re-read. Then put a reminder on your phone to re-torque the lug nuts in 50-100 miles.",
image: "/steps/wheel-torque.svg",
torque: [{ fastener: "Wheel lug nuts", value: "150 ft-lb (203 Nm)" }],
},
],
},
{
id: "ford-escape-tire-rotation",
vehicleId: "2021-ford-escape-1.5l",
title: "Tire Rotation",
jobType: "tire-rotation",
summary:
"Even out tire wear on the 2020+ Escape by moving all four tires through a forward cross pattern, with a tread and brake inspection while the wheels are off.",
difficulty: "Easy",
tier: "premium",
estTime: "45-60 min",
tools: [
{ name: "Lug wrench or breaker bar", note: "Long handle makes breaking 100 ft-lb (136 Nm) loose far easier" },
{ name: "Socket to fit the lug nuts", note: "Use a proper impact/deep socket — an ill-fitting one rounds the nut" },
{ name: "Torque wrench", note: "Must cover 100 ft-lb (136 Nm)" },
{ name: "Floor jack" },
{ name: "4 jack stands", note: "All four wheels come off at once on a cross rotation" },
{ name: "Wheel chocks" },
{ name: "Tire pressure gauge" },
{ name: "Tread depth gauge or a quarter", note: "A quarter works: if the tread does not reach Washington's hairline, you are near 4/32\" and shopping for tires" },
],
parts: [
"None — this is a no-parts service",
"Optional: replacement valve caps",
"Optional: anti-seize is NOT recommended on lug studs — it changes the effective clamp load at a given torque",
],
safety: [
"Never get under a vehicle supported only by a jack. Use stands rated for the vehicle's weight, on level concrete.",
"Break the lug nuts loose while the tires are still on the ground. Trying to crack them with the wheel in the air spins the wheel and can pull the vehicle off the stands.",
"Do not use an impact gun for final tightening. Impact guns routinely overshoot 100 ft-lb (136 Nm) by a wide margin, which warps rotors and stretches studs.",
"Re-torque all lug nuts after 50-100 miles. Nuts commonly settle and lose clamp load after a wheel has been off.",
],
torqueSpecs: [
{
fastener: "Wheel lug nuts",
value: "100 ft-lb (136 Nm)",
provenance: { source: "open-labor-project", confidence: "high" },
notes: "Tighten in a star/criss-cross pattern in two or three passes, not one shot per nut. Final torque with the wheels on the ground.",
},
],
steps: [
{
number: 1,
title: "Confirm your tires can actually be cross-rotated",
instructions:
"Before anything else, check the sidewalls. If they show a rotation-direction arrow, the tires are directional and must stay on the same side of the vehicle — front-to-back only, never crossed. If the front and rear tires are different sizes (a staggered setup), they cannot be rotated front-to-back at all. Base 225/60R17 tires on this vehicle are normally neither, but aftermarket tires change that, so look.",
image: "/steps/tire-rotation-fwd.svg",
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
"Lift the vehicle at the reinforced pinch-weld points marked by triangular notches under the rocker panel and set it down on four jack stands so every wheel is off the ground. Push firmly on a corner before you trust it — the vehicle should not rock or shift on the stands.",
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
"This vehicle is FWD, so use the forward cross pattern: the two front tires come straight back to the same side of the rear axle, and the two rear tires cross over to the opposite front corner. Put simply, the front tires on a front-wheel-drive vehicle do the steering, most of the braking and all of the power delivery, so they wear fastest — this pattern gets them onto the rear axle to even out. Clean any rust or scale off the hub face before a wheel goes back on — debris trapped behind the wheel is a common cause of a wheel that will not seat flat and a vibration that shows up a week later.",
image: "/steps/tire-rotation-fwd.svg",
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
"With the vehicle's weight on the tires, torque every lug nut to 100 ft-lb (136 Nm) in a star pattern, working up to it in two or three passes. Set the tire pressures to the door-jamb placard values for their new positions. For TPMS: direct TPMS — sensors report their own position, so no reset is needed after a rotation. Then put a reminder on your phone to re-torque the lug nuts in 50-100 miles.",
image: "/steps/wheel-torque.svg",
torque: [{ fastener: "Wheel lug nuts", value: "100 ft-lb (136 Nm)" }],
},
],
},
// --------------------------------- WIPERS, CABIN + ENGINE AIR FILTERS
// Fastener-free jobs: nothing on any of these is torqued, so they carry
// noFasteners and an empty torqueSpecs array. Per-vehicle details were
// researched and cross-checked; three guides are deliberately absent
// because their access procedure could not be confirmed (Escape cabin
// filter, Silverado + Sierra engine air filter).
{
id: "jeep-grand-cherokee-wiper-blades",
vehicleId: "2014-jeep-grand-cherokee-3.6l",
title: "Wiper Blade Replacement",
jobType: "wiper-blades",
summary:
"Swap the front and rear wiper blades on the WK2 Grand Cherokee. No tools, no fasteners, and the fastest job in the catalog -- but the sizes are specific and easy to get wrong at the parts counter.",
difficulty: "Easy",
tier: "premium",
estTime: "15-20 min",
noFasteners: true,
tools: [
{ name: "No tools required", note: "Blades release by hand" },
{ name: "Folded towel", note: "Lay it on the glass in case an arm snaps back" },
],
parts: [
"Driver side wiper blade, 22 inch",
"Passenger side wiper blade, 21 inch",
"Rear wiper blade, 11 inch",
"Optional: washer fluid, since you are already there",
],
safety: [
"A wiper arm under spring tension will snap back hard enough to crack a windshield. Never let go of a raised arm, and lay a folded towel on the glass while you work.",
"Do not drive with the arms bare against the glass. Bare metal on glass scratches it permanently in a single wipe.",
"Never run the wipers on a dry windshield to test them. Wet the glass first.",
],
torqueSpecs: [],
steps: [
{
number: 1,
title: "Confirm the sizes before you buy",
instructions:
"This vehicle takes a 22 inch driver-side blade and a 21 inch passenger-side blade. The rear wiper on this vehicle takes a 11 inch blade and usually uses a different attachment than the fronts -- check it separately rather than assuming. Write the sizes down -- in-store lookup kiosks and online size charts are frequently wrong about body-style variants.",
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
},
{
id: "civic-wiper-blades",
vehicleId: "2018-honda-civic-1.5t",
title: "Wiper Blade Replacement",
jobType: "wiper-blades",
summary:
"Swap the front wiper blades on the 10th-gen Civic sedan. No tools, no fasteners, and the fastest job in the catalog -- but the sizes are specific and easy to get wrong at the parts counter.",
difficulty: "Easy",
tier: "premium",
estTime: "15-20 min",
noFasteners: true,
tools: [
{ name: "No tools required", note: "Blades release by hand" },
{ name: "Folded towel", note: "Lay it on the glass in case an arm snaps back" },
],
parts: [
"Driver side wiper blade, 26 inch",
"Passenger side wiper blade, 18 inch",
"Optional: washer fluid, since you are already there",
],
safety: [
"A wiper arm under spring tension will snap back hard enough to crack a windshield. Never let go of a raised arm, and lay a folded towel on the glass while you work.",
"Do not drive with the arms bare against the glass. Bare metal on glass scratches it permanently in a single wipe.",
"Never run the wipers on a dry windshield to test them. Wet the glass first.",
],
torqueSpecs: [],
steps: [
{
number: 1,
title: "Confirm the sizes before you buy",
instructions:
"This vehicle takes a 26 inch driver-side blade and a 18 inch passenger-side blade. This EX sedan has no rear wiper. Parts-store size charts routinely list a 14 inch rear blade for a 2018 Civic because they lump the sedan, coupe and hatchback into one entry -- that blade is for the hatchback. Do not buy one. Write the sizes down -- in-store lookup kiosks and online size charts are frequently wrong about body-style variants.",
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
},
{
id: "f150-wiper-blades",
vehicleId: "2015-ford-f150-5.0l",
title: "Wiper Blade Replacement",
jobType: "wiper-blades",
summary:
"Swap the front wiper blades on the 13th-gen F-150. No tools, no fasteners, and the fastest job in the catalog -- but the sizes are specific and easy to get wrong at the parts counter.",
difficulty: "Easy",
tier: "premium",
estTime: "15-20 min",
noFasteners: true,
tools: [
{ name: "No tools required", note: "Blades release by hand" },
{ name: "Folded towel", note: "Lay it on the glass in case an arm snaps back" },
],
parts: [
"Driver side wiper blade, 22 inch",
"Passenger side wiper blade, 22 inch",
"Optional: washer fluid, since you are already there",
],
safety: [
"A wiper arm under spring tension will snap back hard enough to crack a windshield. Never let go of a raised arm, and lay a folded towel on the glass while you work.",
"Do not drive with the arms bare against the glass. Bare metal on glass scratches it permanently in a single wipe.",
"Never run the wipers on a dry windshield to test them. Wet the glass first.",
],
torqueSpecs: [],
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
},
{
id: "ford-escape-wiper-blades",
vehicleId: "2021-ford-escape-1.5l",
title: "Wiper Blade Replacement",
jobType: "wiper-blades",
summary:
"Swap the front and rear wiper blades on the 2020+ Escape. No tools, no fasteners, and the fastest job in the catalog -- but the sizes are specific and easy to get wrong at the parts counter.",
difficulty: "Easy",
tier: "premium",
estTime: "15-20 min",
noFasteners: true,
tools: [
{ name: "No tools required", note: "Blades release by hand" },
{ name: "Folded towel", note: "Lay it on the glass in case an arm snaps back" },
],
parts: [
"Driver side wiper blade, 24 inch",
"Passenger side wiper blade, 20 inch",
"Rear wiper blade, 11 inch",
"Optional: washer fluid, since you are already there",
],
safety: [
"A wiper arm under spring tension will snap back hard enough to crack a windshield. Never let go of a raised arm, and lay a folded towel on the glass while you work.",
"Do not drive with the arms bare against the glass. Bare metal on glass scratches it permanently in a single wipe.",
"Never run the wipers on a dry windshield to test them. Wet the glass first.",
],
torqueSpecs: [],
steps: [
{
number: 1,
title: "Confirm the sizes before you buy",
instructions:
"This vehicle takes a 24 inch driver-side blade and a 20 inch passenger-side blade. The rear wiper on this vehicle takes a 11 inch blade and usually uses a different attachment than the fronts -- check it separately rather than assuming. Write the sizes down -- in-store lookup kiosks and online size charts are frequently wrong about body-style variants.",
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
},
{
id: "jeep-grand-cherokee-cabin-filter",
vehicleId: "2014-jeep-grand-cherokee-3.6l",
title: "Cabin Air Filter Replacement",
jobType: "cabin-air-filter",
summary:
"Replace the cabin air filter on the WK2 Grand Cherokee. It is the filter for the air you actually breathe, it is almost always overdue, and a clogged one is the usual reason the fan feels weak.",
difficulty: "Easy",
tier: "premium",
estTime: "25-35 min",
noFasteners: true,
tools: [
{ name: "Trim panel tool", note: "For the glove box shelf, if it is clipped" },
{ name: "Small flashlight", note: "The filter slot sits deep behind the dash" },
],
parts: [
"Cabin air filter (Mopar 68079487AA or equivalent)",
"Optional: a few spare trim clips, in case an old one breaks",
],
safety: [
"An old cabin filter can hold mould, pollen and rodent debris. Wear gloves, avoid shaking it out inside the car, and bag it before it goes in the bin.",
"Work with the ignition off. There is wiring behind the glove box on every one of these vehicles.",
"Do not force a trim panel. Plastic clips on a dash get brittle with age and heat -- if something will not move, a fastener is still holding it.",
],
torqueSpecs: [],
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
"The filter sits behind the glove box bin. On this platform the glove box shelf comes out of the instrument panel rather than just swinging down, so work slowly and keep track of which fasteners came from where.",
image: "/steps/cabin-filter-access.svg",
},
{
number: 4,
title: "Note the airflow direction, then pull the old filter",
instructions:
"Check the old filter for an airflow arrow and match it. If the old one has no readable arrow, note which way it came out before you pull it clear. Slide the old filter out slowly and keep it flat -- they collect a surprising amount of leaf litter and grit that will dump into the footwell if you tip it.",
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
},
{
id: "civic-cabin-filter",
vehicleId: "2018-honda-civic-1.5t",
title: "Cabin Air Filter Replacement",
jobType: "cabin-air-filter",
summary:
"Replace the cabin air filter on the 10th-gen Civic. It is the filter for the air you actually breathe, it is almost always overdue, and a clogged one is the usual reason the fan feels weak.",
difficulty: "Easy",
tier: "premium",
estTime: "15-20 min",
noFasteners: true,
tools: [
{ name: "No tools required", note: "The glove box and filter cover are both hand-released" },
{ name: "Small flashlight", note: "Makes the cover tabs much easier to find" },
],
parts: [
"Cabin air filter for the 10th-gen Civic",
"Optional: a few spare trim clips, in case an old one breaks",
],
safety: [
"An old cabin filter can hold mould, pollen and rodent debris. Wear gloves, avoid shaking it out inside the car, and bag it before it goes in the bin.",
"Work with the ignition off. There is wiring behind the glove box on every one of these vehicles.",
"Do not force a trim panel. Plastic clips on a dash get brittle with age and heat -- if something will not move, a fastener is still holding it.",
],
torqueSpecs: [],
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
"Squeeze both sides of the glove box inward to clear the bump stops and let it swing all the way down -- the glove box stays attached and no tools are needed. Behind it is the filter cover, held by two tabs on each side. Push the tabs inward and pull the cover straight out.",
image: "/steps/cabin-filter-access.svg",
},
{
number: 4,
title: "Note the airflow direction, then pull the old filter",
instructions:
"The airflow arrow on this vehicle points DOWN. Fit the new filter with its arrow pointing down. Slide the old filter out slowly and keep it flat -- they collect a surprising amount of leaf litter and grit that will dump into the footwell if you tip it.",
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
},
{
id: "f150-cabin-filter",
vehicleId: "2015-ford-f150-5.0l",
title: "Cabin Air Filter Replacement",
jobType: "cabin-air-filter",
summary:
"Replace the cabin air filter on the 13th-gen F-150. It is the filter for the air you actually breathe, it is almost always overdue, and a clogged one is the usual reason the fan feels weak.",
difficulty: "Moderate",
tier: "premium",
estTime: "40-50 min",
noFasteners: true,
tools: [
{ name: "Trim removal tool", note: "Plastic, not a screwdriver -- a screwdriver marks the dash" },
{ name: "7mm socket + short ratchet", note: "For the upper compartment bolts" },
{ name: "Small flashlight" },
],
parts: [
"Cabin air filter for the 2015+ F-150",
"Optional: a few spare trim clips, in case an old one breaks",
],
safety: [
"An old cabin filter can hold mould, pollen and rodent debris. Wear gloves, avoid shaking it out inside the car, and bag it before it goes in the bin.",
"Work with the ignition off. There is wiring behind the glove box on every one of these vehicles.",
"Do not force a trim panel. Plastic clips on a dash get brittle with age and heat -- if something will not move, a fastener is still holding it.",
],
torqueSpecs: [],
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
"This is the most involved cabin filter of the six vehicles in the catalog -- it is not a drop-the-glove-box job. Empty the glove box and lower it by pushing in on each side to release the tabs. Remove the front trim panel by disengaging its clips with a trim tool. Undo the bolts at the top of the upper compartment with a 7mm socket. Disconnect the electrical connector, then gently pry the upper glove compartment free.",
image: "/steps/cabin-filter-access.svg",
},
{
number: 4,
title: "Note the airflow direction, then pull the old filter",
instructions:
"Note the airflow direction marked on the old filter before you pull it out, and fit the new one the same way. Slide the old filter out slowly and keep it flat -- they collect a surprising amount of leaf litter and grit that will dump into the footwell if you tip it.",
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
},
{
id: "jeep-grand-cherokee-engine-air-filter",
vehicleId: "2014-jeep-grand-cherokee-3.6l",
title: "Engine Air Filter Replacement",
jobType: "engine-air-filter",
summary:
"Replace the engine air filter on the WK2 Grand Cherokee 3.6L. One of the few jobs with a real payoff that takes minutes and needs almost nothing in the way of tools.",
difficulty: "Easy",
tier: "premium",
estTime: "15-20 min",
noFasteners: true,
tools: [
{ name: "No tools required", note: "The latches are hand-operated" },
{ name: "Shop towel", note: "For wiping out the housing" },
],
parts: [
"Engine air filter element matched to this year and engine",
"Optional: a spare airbox lid clip, if yours look tired",
],
safety: [
"Work on a cold engine. There is nothing hot in the airbox itself, but the parts around it hold heat for a long time.",
"Never run the engine with the airbox open. Anything that gets pulled down the intake tube goes straight into the engine.",
"Do not drop anything into the open intake. If you do, stop and retrieve it before closing up -- do not start the engine and hope.",
],
torqueSpecs: [],
steps: [
{
number: 1,
title: "Find the airbox",
instructions:
"Follow the large intake tube back from the engine and it ends at a big black plastic box -- that is the airbox. It is the easiest component in the engine bay to identify because nothing else looks like it, so follow the tube rather than hunting by memory of where it sits on other cars.",
image: "/steps/airbox-open.svg",
},
{
number: 2,
title: "Open the housing",
instructions:
"The lid is held by two metal flip-latches along one side. Flip each latch away from the box and let it swing down, then lift the upper half of the housing off. The intake tube stays connected -- you do not need to loosen anything else.",
image: "/steps/airbox-open.svg",
},
{
number: 3,
title: "Lift the old element out and read it",
instructions:
"Pull the old filter straight up and out, noting which way round it sat. Hold it up to a light: if you cannot see light through the pleats, it is well past due. Look at the dirty side too -- leaves and seeds mean debris is getting past the intake snorkel, and a greasy film usually points at crankcase ventilation rather than the filter.",
image: "/steps/filter-airflow.svg",
},
{
number: 4,
title: "Clean out the empty housing",
instructions:
"There is almost always a layer of grit, leaf fragments and sometimes an acorn sitting in the bottom of the box. Wipe it out with a shop towel or pick it out by hand. Do not blow it out with compressed air while the housing is open to the intake -- that pushes debris toward the engine.",
image: "/steps/generic-cleanup.svg",
warning: "Anything left loose in the housing gets drawn against the new filter the moment you start the engine.",
},
{
number: 5,
title: "Seat the new element",
instructions:
"Drop the new filter in the same orientation the old one came out. Its rubber sealing edge must sit flat all the way around the housing lip without folding or crimping. A filter that is even slightly proud on one edge lets unfiltered air bypass it completely, which defeats the whole point of changing it.",
image: "/steps/filter-airflow.svg",
warning: "If the lid does not close with light pressure, the filter is not seated. Reseat it rather than forcing the lid.",
},
{
number: 6,
title: "Close up and verify",
instructions:
"Refit the lid and secure every clip, screw or clamp you released, reconnecting the intake tube if you disturbed it. Start the engine and listen: a whistle or sucking noise from the airbox means the lid is not sealed or a clip was missed. It should sound exactly as it did before you started.",
image: "/steps/generic-cleanup.svg",
},
],
},
{
id: "civic-engine-air-filter",
vehicleId: "2018-honda-civic-1.5t",
title: "Engine Air Filter Replacement",
jobType: "engine-air-filter",
summary:
"Replace the engine air filter on the 10th-gen Civic 1.5L Turbo. One of the few jobs with a real payoff that takes minutes and needs almost nothing in the way of tools.",
difficulty: "Easy",
tier: "premium",
estTime: "20-25 min",
noFasteners: true,
tools: [
{ name: "8mm socket + short ratchet", note: "Use this, NOT a screwdriver -- these screws strip easily" },
{ name: "Shop towel" },
],
parts: [
"Engine air filter element matched to this year and engine",
"Optional: a spare airbox lid clip, if yours look tired",
],
safety: [
"Work on a cold engine. There is nothing hot in the airbox itself, but the parts around it hold heat for a long time.",
"Never run the engine with the airbox open. Anything that gets pulled down the intake tube goes straight into the engine.",
"Do not drop anything into the open intake. If you do, stop and retrieve it before closing up -- do not start the engine and hope.",
],
torqueSpecs: [],
steps: [
{
number: 1,
title: "Find the airbox",
instructions:
"Follow the large intake tube back from the engine and it ends at a big black plastic box -- that is the airbox. It is the easiest component in the engine bay to identify because nothing else looks like it, so follow the tube rather than hunting by memory of where it sits on other cars.",
image: "/steps/airbox-open.svg",
},
{
number: 2,
title: "Open the housing",
instructions:
"Four screws hold the airbox lid, and this is where people wreck the job: on the 1.5L turbo those screws have 8mm hex heads in a JIS pattern, not a true Phillips. A Phillips screwdriver will cam out and round them off. Use an 8mm socket on a short ratchet instead. (The naturally-aspirated 2.0L Civic uses snap clips here, so a guide or video for an LX or Sport will not match this car.)",
image: "/steps/airbox-open.svg",
},
{
number: 3,
title: "Lift the old element out and read it",
instructions:
"Pull the old filter straight up and out, noting which way round it sat. Hold it up to a light: if you cannot see light through the pleats, it is well past due. Look at the dirty side too -- leaves and seeds mean debris is getting past the intake snorkel, and a greasy film usually points at crankcase ventilation rather than the filter.",
image: "/steps/filter-airflow.svg",
},
{
number: 4,
title: "Clean out the empty housing",
instructions:
"There is almost always a layer of grit, leaf fragments and sometimes an acorn sitting in the bottom of the box. Wipe it out with a shop towel or pick it out by hand. Do not blow it out with compressed air while the housing is open to the intake -- that pushes debris toward the engine.",
image: "/steps/generic-cleanup.svg",
warning: "Anything left loose in the housing gets drawn against the new filter the moment you start the engine.",
},
{
number: 5,
title: "Seat the new element",
instructions:
"Drop the new filter in the same orientation the old one came out. Its rubber sealing edge must sit flat all the way around the housing lip without folding or crimping. A filter that is even slightly proud on one edge lets unfiltered air bypass it completely, which defeats the whole point of changing it.",
image: "/steps/filter-airflow.svg",
warning: "If the lid does not close with light pressure, the filter is not seated. Reseat it rather than forcing the lid.",
},
{
number: 6,
title: "Close up and verify",
instructions:
"Refit the lid and secure every clip, screw or clamp you released, reconnecting the intake tube if you disturbed it. Start the engine and listen: a whistle or sucking noise from the airbox means the lid is not sealed or a clip was missed. It should sound exactly as it did before you started.",
image: "/steps/generic-cleanup.svg",
},
],
},
{
id: "f150-engine-air-filter",
vehicleId: "2015-ford-f150-5.0l",
title: "Engine Air Filter Replacement",
jobType: "engine-air-filter",
summary:
"Replace the engine air filter on the 13th-gen F-150 5.0L. One of the few jobs with a real payoff that takes minutes and needs almost nothing in the way of tools.",
difficulty: "Easy",
tier: "premium",
estTime: "15 min",
noFasteners: true,
tools: [
{ name: "No tools required", note: "Both lid clips release by hand" },
{ name: "Shop towel" },
],
parts: [
"Engine air filter element matched to this year and engine",
"Optional: a spare airbox lid clip, if yours look tired",
],
safety: [
"Work on a cold engine. There is nothing hot in the airbox itself, but the parts around it hold heat for a long time.",
"Never run the engine with the airbox open. Anything that gets pulled down the intake tube goes straight into the engine.",
"Do not drop anything into the open intake. If you do, stop and retrieve it before closing up -- do not start the engine and hope.",
],
torqueSpecs: [],
steps: [
{
number: 1,
title: "Find the airbox",
instructions:
"Follow the large intake tube back from the engine and it ends at a big black plastic box -- that is the airbox. It is the easiest component in the engine bay to identify because nothing else looks like it, so follow the tube rather than hunting by memory of where it sits on other cars.",
image: "/steps/airbox-open.svg",
},
{
number: 2,
title: "Open the housing",
instructions:
"Two clips hold the airbox lid. Release both and lift the lid enough to slide the element out.",
image: "/steps/airbox-open.svg",
},
{
number: 3,
title: "Lift the old element out and read it",
instructions:
"Pull the old filter straight up and out, noting which way round it sat. Hold it up to a light: if you cannot see light through the pleats, it is well past due. Look at the dirty side too -- leaves and seeds mean debris is getting past the intake snorkel, and a greasy film usually points at crankcase ventilation rather than the filter.",
image: "/steps/filter-airflow.svg",
},
{
number: 4,
title: "Clean out the empty housing",
instructions:
"There is almost always a layer of grit, leaf fragments and sometimes an acorn sitting in the bottom of the box. Wipe it out with a shop towel or pick it out by hand. Do not blow it out with compressed air while the housing is open to the intake -- that pushes debris toward the engine.",
image: "/steps/generic-cleanup.svg",
warning: "Anything left loose in the housing gets drawn against the new filter the moment you start the engine.",
},
{
number: 5,
title: "Seat the new element",
instructions:
"Drop the new filter in the same orientation the old one came out. Its rubber sealing edge must sit flat all the way around the housing lip without folding or crimping. A filter that is even slightly proud on one edge lets unfiltered air bypass it completely, which defeats the whole point of changing it.",
image: "/steps/filter-airflow.svg",
warning: "If the lid does not close with light pressure, the filter is not seated. Reseat it rather than forcing the lid.",
},
{
number: 6,
title: "Close up and verify",
instructions:
"Refit the lid and secure every clip, screw or clamp you released, reconnecting the intake tube if you disturbed it. Start the engine and listen: a whistle or sucking noise from the airbox means the lid is not sealed or a clip was missed. It should sound exactly as it did before you started.",
image: "/steps/generic-cleanup.svg",
},
],
},
{
id: "ford-escape-engine-air-filter",
vehicleId: "2021-ford-escape-1.5l",
title: "Engine Air Filter Replacement",
jobType: "engine-air-filter",
summary:
"Replace the engine air filter on the 2020+ Escape 1.5L EcoBoost. One of the few jobs with a real payoff that takes minutes and needs almost nothing in the way of tools.",
difficulty: "Easy",
tier: "premium",
estTime: "20 min",
noFasteners: true,
tools: [
{ name: "Flat screwdriver", note: "For the intake boot clamp" },
{ name: "Shop towel" },
],
parts: [
"Engine air filter element matched to this year and engine",
"Optional: a spare airbox lid clip, if yours look tired",
],
safety: [
"Work on a cold engine. There is nothing hot in the airbox itself, but the parts around it hold heat for a long time.",
"Never run the engine with the airbox open. Anything that gets pulled down the intake tube goes straight into the engine.",
"Do not drop anything into the open intake. If you do, stop and retrieve it before closing up -- do not start the engine and hope.",
],
torqueSpecs: [],
steps: [
{
number: 1,
title: "Find the airbox",
instructions:
"Follow the large intake tube back from the engine and it ends at a big black plastic box -- that is the airbox. It is the easiest component in the engine bay to identify because nothing else looks like it, so follow the tube rather than hunting by memory of where it sits on other cars.",
image: "/steps/airbox-open.svg",
},
{
number: 2,
title: "Open the housing",
instructions:
"This one differs from most: the intake boot has to come off first. Loosen the clamp on the housing cover with a screwdriver, gently pull the boot back and away from the cover, then release the two clips and lift the cover off. Ford's own manual warns to seat the new element without crimping its edges.",
image: "/steps/airbox-open.svg",
},
{
number: 3,
title: "Lift the old element out and read it",
instructions:
"Pull the old filter straight up and out, noting which way round it sat. Hold it up to a light: if you cannot see light through the pleats, it is well past due. Look at the dirty side too -- leaves and seeds mean debris is getting past the intake snorkel, and a greasy film usually points at crankcase ventilation rather than the filter.",
image: "/steps/filter-airflow.svg",
},
{
number: 4,
title: "Clean out the empty housing",
instructions:
"There is almost always a layer of grit, leaf fragments and sometimes an acorn sitting in the bottom of the box. Wipe it out with a shop towel or pick it out by hand. Do not blow it out with compressed air while the housing is open to the intake -- that pushes debris toward the engine.",
image: "/steps/generic-cleanup.svg",
warning: "Anything left loose in the housing gets drawn against the new filter the moment you start the engine.",
},
{
number: 5,
title: "Seat the new element",
instructions:
"Drop the new filter in the same orientation the old one came out. Its rubber sealing edge must sit flat all the way around the housing lip without folding or crimping. A filter that is even slightly proud on one edge lets unfiltered air bypass it completely, which defeats the whole point of changing it.",
image: "/steps/filter-airflow.svg",
warning: "If the lid does not close with light pressure, the filter is not seated. Reseat it rather than forcing the lid.",
},
{
number: 6,
title: "Close up and verify",
instructions:
"Refit the lid and secure every clip, screw or clamp you released, reconnecting the intake tube if you disturbed it. Start the engine and listen: a whistle or sucking noise from the airbox means the lid is not sealed or a clip was missed. It should sound exactly as it did before you started.",
image: "/steps/generic-cleanup.svg",
},
],
},
  ...jeepGrandCherokeeWk2Guides,
...gmK2xxGuides,
...gmT1xxGuides,
  ...toyotaRav4Guides,
  ...toyotaTacomaGuides,
];

// There was briefly an alias map here pointing a separate "Work Truck Regular
// Cab" vehicle id at this one's guides. That entry is gone: cab and trim are no
// longer separate catalog vehicles, because two entries sharing an engine, a
// transmission and every fluid meant duplicated guides, double-counted coverage
// and a VIN decode that asked the reader a question it could already answer.
// One catalog entry per year + model + engine + drivetrain. If cab or trim ever
// genuinely changes what someone buys or torques, that is a guide variant, not
// a second vehicle. See claude/silverado-catalog-collapse-2026-09-19.md.
// ---------------------------------------------------------------------------
// FITMENT RESOLUTION
//
// A guide reaches a vehicle by one of two routes.
//
//   vehicleId   written for that one vehicle. The original shape, still
//               correct for a genuinely one-off procedure.
//   fitment     written ONCE against a platform / engine / driveline key, and
//               bound to per-vehicle numbers here at resolve time.
//
// The rule the second route exists to enforce, and the reason it is worth the
// machinery: PROCEDURE INHERITS, NUMBERS DO NOT. A guide whose key matches a
// vehicle but which carries no verified figures entry for that vehicle
// resolves to NOTHING for it. It does not quietly fall back to the donor
// vehicle's torque and capacities.
//
// Silence is the correct failure mode here. A missing guide is a visible gap
// on the coverage page that someone comes back and fills. An inherited number
// is a reader putting a torque wrench on a figure that belongs to a different
// truck, with nothing anywhere on the page to suggest anything is wrong.
// ---------------------------------------------------------------------------

// Exported so the service schedules resolve on exactly the same key logic the
// guides do, rather than a second copy of it drifting out of step.
export function matchesFitment(f: GuideFitment, v: Vehicle): boolean {
if (!v.keys) return false;
if (v.keys[f.on] !== f.key) return false;
if (f.years && (v.year < f.years[0] || v.year > f.years[1])) return false;
if (f.except && f.except.indexOf(v.id) !== -1) return false;
return true;
}

// Returns null when the shared procedure cannot be honestly bound to this
// vehicle, which the caller treats exactly like no guide at all.
function bindGuide(g: RepairGuide, v: Vehicle, fig: GuideFigures): ResolvedGuide | null {
const slots: Record<string, string> = Object.assign(
{ vehicle: v.year + " " + v.make + " " + v.model },
fig.slots || {},
);
const fill = (s: string): string =>
s.replace(/\{\{(\w+)\}\}/g, (m, k: string) => (k in slots ? slots[k] : m));

const byFastener = new Map<string, TorqueSpec>();
for (const t of fig.torqueSpecs) byFastener.set(t.fastener, t);

const steps: RepairStep[] = [];
for (const s of g.steps) {
let torque = s.torque;
if (torque) {
const bound: TorqueSpec[] = [];
for (const t of torque) {
// A shared step names the fastener; this vehicle's own figures supply
// the value. No match means the guide was never actually sourced for
// this vehicle, so withhold the whole thing rather than render a
// number that came from somewhere else. This also permanently kills
// the old bug where a torque figure lived in two places and only one
// of them got corrected.
const real = byFastener.get(t.fastener);
if (!real) return null;
bound.push(t.onlyFor ? Object.assign({}, real, { onlyFor: t.onlyFor }) : real);
}
torque = bound;
}
steps.push(
Object.assign({}, s, {
title: fill(s.title),
instructions: fill(s.instructions),
warning: s.warning ? fill(s.warning) : undefined,
torque,
}),
);
}

const out: ResolvedGuide = Object.assign({}, g, {
id: fig.id,
vehicleId: v.id,
title: fill(g.title),
summary: fill(g.summary),
parts: fig.parts,
torqueSpecs: fig.torqueSpecs,
variantParts: fig.variantParts || g.variantParts,
steps,
});
delete out.fitment;
delete out.figures;
return out;
}

// Every guide every catalog vehicle is entitled to, already bound to that
// vehicle's own numbers. Resolved once at module load; both lookups read it.
export const resolvedRepairs: ResolvedGuide[] = (() => {
const out: ResolvedGuide[] = [];
for (const v of vehicles) {
for (const g of repairs) {
const vid = g.vehicleId;
if (vid) {
if (vid === v.id)
out.push({
...g,
vehicleId: vid,
parts: g.parts || [],
torqueSpecs: g.torqueSpecs || [],
});
continue;
}
if (!g.fitment || !matchesFitment(g.fitment, v)) continue;
const fig = g.figures ? g.figures[v.id] : undefined;
if (!fig) continue; // see the rule at the top of this section
const bound = bindGuide(g, v, fig);
if (bound) out.push(bound);
}
}
return out;
})();

export function getRepairsForVehicle(vehicleId: string): ResolvedGuide[] {
return resolvedRepairs.filter((r) => r.vehicleId === vehicleId);
}

export function getRepairById(id: string): ResolvedGuide | undefined {
return resolvedRepairs.find((r) => r.id === id);
}

export interface PendingFitment {
vehicleId: string;
guideId: string;
jobType?: JobTypeId;
reason: "no-figures" | "figures-incomplete";
}

// Every vehicle a shared guide COULD serve but does not yet, because its
// numbers have not been verified for that vehicle.
//
// This is what stops a shared procedure from looking like coverage it has not
// earned. The admin coverage page reads it to draw "procedure written, numbers
// unverified" as its own state, distinct from a job nobody has touched - the
// first is an afternoon of table lookups, the second is a whole guide to write,
// and a planner that cannot tell them apart is not much of a planner.
export function getPendingFitment(): PendingFitment[] {
const out: PendingFitment[] = [];
for (const v of vehicles) {
for (const g of repairs) {
if (g.vehicleId || !g.fitment) continue;
if (!matchesFitment(g.fitment, v)) continue;
const fig = g.figures ? g.figures[v.id] : undefined;
if (!fig) {
out.push({ vehicleId: v.id, guideId: g.id, jobType: g.jobType, reason: "no-figures" });
} else if (!bindGuide(g, v, fig)) {
out.push({ vehicleId: v.id, guideId: g.id, jobType: g.jobType, reason: "figures-incomplete" });
}
}
}
return out;
}
