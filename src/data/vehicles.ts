import { Vehicle } from "@/types/vehicle";

// Reference figures compiled from general/publicly-known specifications for these
// model years. They are a starting point for the DIY mechanic, NOT a substitute
// for the vehicle's factory service manual or a build-sheet/door-jamb sticker
// check — capacities and torque values can vary by trim, options, and running
// changes within a model year. Every page that shows these values repeats that
// warning; treat this file as the place to swap in verified numbers over time.
//
// Engine Oil entries below are now sourced from the Open Labor Project API
// (openlaborproject.com) as of 2026-09-16 — see provenance on each entry.
// Everything else in this file is still hand-typed "curated" reference data.

export const vehicles: Vehicle[] = [
{
id: "2014-jeep-grand-cherokee-3.6l",
year: 2014,
make: "Jeep",
model: "Grand Cherokee",
trim: "Laredo (2WD)",
engine: "3.6L Pentastar V6 (24-valve)",
drivetrain: "RWD (2WD)",
transmission: "8-speed automatic (ZF 8HP70/845RE)",
specs: [
{ label: "Engine", value: "3.6L Pentastar V6, 290 hp / 260 lb-ft" },
{ label: "Drivetrain", value: "RWD (2WD)" },
{ label: "Transmission", value: "8-speed automatic (845RE)" },
{ label: "Curb weight", value: "~4,510 lb" },
{ label: "Fuel tank", value: "24.6 gal" },
{ label: "Recommended fuel", value: "Regular unleaded, 87 octane" },
{ label: "Battery", value: "Group size 48 (H6), ~700 CCA" },
{ label: "Wheel lug nut torque", value: "130 ft-lb (176 Nm)" },
{ label: "Front tire size (base)", value: "245/70R17" },
],
fluids: [
{
name: "Engine Oil",
capacity: "6.0 qt (5.7 L) with filter change",
spec: "5W-20 full synthetic, API SN / ILSAC GF-5",
notes: "Cartridge-style filter under intake plenum, not spin-on. Some Pentastar service info lists 0W-20 instead of 5W-20 — check your oil fill cap or door-jamb sticker before buying oil.",
provenance: { source: "curated" },
},
{
name: "Engine Coolant",
capacity: "~12.9 qt (12.2 L) system capacity",
spec: "Mopar OAT (orange), 5-year/100k mi coolant, 50/50 premix",
},
{
name: "Automatic Transmission Fluid (845RE)",
capacity: "~4.2 qt (4.0 L) for a pan drain-and-fill (service fill)",
spec: "ZF LIFEGUARD 8 (ATF)",
notes: "Total dry-fill is much higher (~9.5 qt); a fluid/filter service only replaces what drains from the pan.",
},
{
name: "Rear Axle Fluid (2WD)",
capacity: "~1.0-1.5 qt (0.9-1.4 L)",
spec: "Mopar 75W-85 gear oil (GL-5)",
notes: "Checked 2026-09-19 and left broadly as written — published figures for the WK2 rear axle range from about 0.95 qt to 1.5 qt depending on axle and drivetrain, so this is shown as a range rather than a single number. Fill to the bottom edge of the fill plug hole with the vehicle level; that is the factory procedure and is self-correcting.",
},
{
name: "Power Steering Fluid",
capacity: "~1.0 qt (fill as needed to MAX mark)",
spec: "Mopar ATF+4",
},
{
name: "Brake Fluid",
capacity: "Fill to MAX line in reservoir",
spec: "DOT 3",
},
{
name: "Windshield Washer Fluid",
capacity: "~4.9 qt (4.6 L) reservoir",
spec: "All-season washer fluid",
},
],
},
{
id: "2018-honda-civic-1.5t",
year: 2018,
make: "Honda",
model: "Civic",
trim: "EX (Sedan)",
engine: "1.5L Turbo I4 (L15B7)",
drivetrain: "FWD",
transmission: "CVT",
specs: [
{ label: "Engine", value: "1.5L turbocharged I4, 174 hp / 162 lb-ft" },
{ label: "Drivetrain", value: "FWD" },
{ label: "Transmission", value: "CVT" },
{ label: "Curb weight", value: "~2,762 lb" },
{ label: "Fuel tank", value: "12.4 gal" },
{ label: "Recommended fuel", value: "Regular unleaded, 87 octane" },
{ label: "Battery", value: "Group size 51R, ~410 CCA" },
{ label: "Wheel lug nut torque", value: "80 ft-lb (108 Nm)" },
{ label: "Front tire size (EX)", value: "215/55R16" },
],
fluids: [
{
name: "Engine Oil",
capacity: "3.7 qt (3.5 L) with filter change",
spec: "0W-20 full synthetic, API SN or higher",
provenance: { source: "curated" },
},
{
name: "Engine Coolant",
capacity: "~4.5 qt (4.3 L) system capacity",
spec: "Honda Long Life (Type 2) coolant, blue, 50/50 premix",
},
{
name: "CVT Fluid",
capacity: "~2.8-3.3 qt (2.6-3.1 L) for a drain-and-fill",
spec: "Honda CVTF (HCF-2)",
notes: "Use Honda-spec CVT fluid only — non-CVT ATF can damage the transmission.",
},
{
name: "Brake Fluid",
capacity: "Fill to MAX line in reservoir",
spec: "DOT 3",
},
{
name: "Windshield Washer Fluid",
capacity: "~3.2 qt (3.0 L) reservoir",
spec: "All-season washer fluid",
},
],
},
{
id: "2015-ford-f150-5.0l",
year: 2015,
make: "Ford",
model: "F-150",
trim: "XLT SuperCrew (4x4)",
engine: "5.0L Coyote V8",
drivetrain: "4WD",
transmission: "6-speed automatic (6R80)",
specs: [
{ label: "Engine", value: "5.0L Coyote V8, 385 hp / 387 lb-ft" },
{ label: "Drivetrain", value: "4WD" },
{ label: "Transmission", value: "6-speed automatic (6R80)" },
{ label: "Curb weight", value: "~4,950 lb" },
{ label: "Fuel tank", value: "26 gal (36 gal optional)" },
{ label: "Recommended fuel", value: "Regular unleaded, 87 octane" },
{ label: "Battery", value: "Group size 65, ~750 CCA" },
{ label: "Wheel lug nut torque", value: "150 ft-lb (203 Nm)" },
{ label: "Front tire size (XLT)", value: "265/70R17" },
],
fluids: [
{
name: "Engine Oil",
capacity: "8.8 qt (8.3 L) with filter change",
spec: "5W-20 synthetic blend, API SN",
notes: "Larger sump than this truck's V6 engine options — don't reuse a V6 F-150 oil-change kit.",
provenance: { source: "curated" },
},
{
name: "Engine Coolant",
capacity: "~16.6 qt (15.7 L) system capacity",
spec: "Motorcraft Orange (Gold) Full-Life coolant, 50/50 premix",
},
{
name: "Automatic Transmission Fluid (6R80)",
capacity: "~4-5 qt (3.8-4.7 L) for a pan drain-and-fill (service fill)",
spec: "Mercon LV (MERCON LV automatic transmission fluid)",
},
{
name: "Front Differential Fluid (4WD)",
capacity: "~2.8 pt (1.3 L)",
spec: "SAE 75W-140 synthetic gear oil",
},
{
name: "Rear Differential Fluid",
capacity: "~2.75-3.5 qt (2.6-3.3 L), Ford 9.75-inch axle",
spec: "SAE 75W-140 synthetic gear oil (+ friction modifier if limited-slip)",
notes: "CORRECTED 2026-09-19. This previously read ~3.3 pt (1.6 L), which is roughly 40% under every source checked and would leave the axle badly underfilled. Sources still disagree on the exact figure — a reference axle spec gives 2.75 qt (5.5 pt) and Open Labor Project returned 3.5 qt — so treat the range as a guide to how much to buy, not a measured fill. Fill to the bottom edge of the fill plug hole with the vehicle level, which is the actual factory procedure and is self-correcting.",
},
{
name: "Transfer Case Fluid",
capacity: "~1.5 qt (1.4 L)",
spec: "Motorcraft MERCON LV",
},
{
name: "Brake Fluid",
capacity: "Fill to MAX line in reservoir",
spec: "DOT 3",
},
{
name: "Windshield Washer Fluid",
capacity: "~6.7 qt (6.3 L) reservoir",
spec: "All-season washer fluid",
},
],
},
{
id: "2020-chevrolet-silverado-1500-5.3l",
year: 2020,
make: "Chevrolet",
model: "Silverado 1500",
trim: "LT Crew Cab (4WD)",
engine: "5.3L EcoTec3 V8 (L84)",
drivetrain: "4WD",
transmission: "8-speed automatic (8L80)",
specs: [
{ label: "Engine", value: "5.3L EcoTec3 V8, 355 hp / 383 lb-ft" },
{ label: "Drivetrain", value: "4WD" },
{ label: "Transmission", value: "8-speed automatic (8L80)" },
{ label: "Curb weight", value: "~5,000 lb" },
{ label: "Fuel tank", value: "24 gal (26 gal optional)" },
{ label: "Recommended fuel", value: "Regular unleaded, 87 octane" },
{ label: "Battery", value: "Group size 78 (H6), ~730 CCA" },
{ label: "Wheel lug nut torque", value: "140 ft-lb (190 Nm)" },
{ label: "Front tire size (LT)", value: "265/60R18" },
],
fluids: [
{
name: "Engine Oil",
capacity: "8.0 qt (7.6 L) with filter change",
spec: "dexos1 0W-20 full synthetic",
notes: "Spin-on canister filter, not a cartridge — a standard filter wrench or strap tool works.",
},
{
name: "Engine Coolant",
capacity: "~13.7 qt (13.0 L) system capacity",
spec: "GM DEX-COOL (orange), extended-life, 50/50 premix",
},
{
name: "Automatic Transmission Fluid (8L80)",
capacity: "~4-5 qt (3.8-4.7 L) for a pan drain-and-fill (service fill)",
spec: "GM DEXRON-HP full synthetic ATF",
notes: "Total dry-fill is much higher; a fluid/filter service only replaces what drains from the pan.",
},
{
name: "Front Differential Fluid (4WD)",
capacity: "~2.1 pt (1.0 L)",
spec: "SAE 75W-90 synthetic gear oil",
},
{
name: "Rear Differential Fluid",
capacity: "~5.5 pt (2.75 qt / 2.6 L), AAM 9.76-inch axle",
spec: "SAE 75W-85 synthetic axle lubricant (GM 19300457) — 75W-90 is a common substitute (+ friction modifier if limited-slip)",
notes: "CORRECTED 2026-09-19. This previously read ~3.4 pt (1.6 L), which is roughly 40% under every source checked and would leave the axle badly underfilled — the same error that was found on the F-150's 9.75-inch axle, apparently from the same bad basis. GM's own fill spec for the 1500-series rear axle is 75W-85, not the 75W-90 originally listed here. Fill to the bottom edge of the fill plug hole with the vehicle level; that is the factory procedure and is self-correcting whichever published figure you trust.",
},
{
name: "Transfer Case Fluid (4WD)",
capacity: "~2.9 qt (2.7 L)",
spec: "GM Auto-Trac II transfer case fluid",
},
{
name: "Brake Fluid",
capacity: "Fill to MAX line in reservoir",
spec: "DOT 3",
},
{
name: "Windshield Washer Fluid",
capacity: "~7.4 qt (7.0 L) reservoir",
spec: "All-season washer fluid",
},
],
},
{
id: "2020-gmc-sierra-1500-5.3l",
year: 2020,
make: "GMC",
model: "Sierra 1500",
trim: "SLE Crew Cab (4WD)",
engine: "5.3L EcoTec3 V8 (L84)",
drivetrain: "4WD",
transmission: "8-speed automatic (8L80)",
specs: [
{ label: "Engine", value: "5.3L EcoTec3 V8, 355 hp / 383 lb-ft" },
{ label: "Drivetrain", value: "4WD" },
{ label: "Transmission", value: "8-speed automatic (8L80)" },
{ label: "Curb weight", value: "~5,050 lb" },
{ label: "Fuel tank", value: "24 gal (26 gal optional)" },
{ label: "Recommended fuel", value: "Regular unleaded, 87 octane" },
{ label: "Battery", value: "Group size 78 (H6), ~730 CCA" },
{ label: "Wheel lug nut torque", value: "140 ft-lb (190 Nm)" },
{ label: "Front tire size (SLE)", value: "265/60R18" },
],
fluids: [
{
name: "Engine Oil",
capacity: "8.0 qt (7.6 L) with filter change",
spec: "dexos1 0W-20 full synthetic",
notes: "Same 5.3L EcoTec3 (L84) engine and GM T1XX platform as the Chevrolet Silverado 1500 — spin-on canister filter, not a cartridge. A standard filter wrench or strap tool works.",
},
{
name: "Engine Coolant",
capacity: "~13.7 qt (13.0 L) system capacity",
spec: "GM DEX-COOL (orange), extended-life, 50/50 premix",
},
{
name: "Automatic Transmission Fluid (8L80)",
capacity: "~4-5 qt (3.8-4.7 L) for a pan drain-and-fill (service fill)",
spec: "GM DEXRON-HP full synthetic ATF",
notes: "Total dry-fill is much higher; a fluid/filter service only replaces what drains from the pan.",
},
{
name: "Front Differential Fluid (4WD)",
capacity: "~2.1 pt (1.0 L)",
spec: "SAE 75W-90 synthetic gear oil",
},
{
name: "Rear Differential Fluid",
capacity: "~5.5 pt (2.75 qt / 2.6 L), AAM 9.76-inch axle",
spec: "SAE 75W-85 synthetic axle lubricant (GM 19300457) — 75W-90 is a common substitute (+ friction modifier if limited-slip)",
notes: "CORRECTED 2026-09-19. This previously read ~3.4 pt (1.6 L), which is roughly 40% under every source checked and would leave the axle badly underfilled — the same error that was found on the F-150's 9.75-inch axle, apparently from the same bad basis. GM's own fill spec for the 1500-series rear axle is 75W-85, not the 75W-90 originally listed here. Fill to the bottom edge of the fill plug hole with the vehicle level; that is the factory procedure and is self-correcting whichever published figure you trust.",
},
{
name: "Transfer Case Fluid (4WD)",
capacity: "~2.9 qt (2.7 L)",
spec: "GM Auto-Trac II transfer case fluid",
},
{
name: "Brake Fluid",
capacity: "Fill to MAX line in reservoir",
spec: "DOT 3",
},
{
name: "Windshield Washer Fluid",
capacity: "~7.4 qt (7.0 L) reservoir",
spec: "All-season washer fluid",
},
],
},
{
id: "2021-ford-escape-1.5l",
year: 2021,
make: "Ford",
model: "Escape",
trim: "SE (FWD)",
engine: "1.5L EcoBoost Turbo I3",
drivetrain: "FWD",
transmission: "8-speed automatic (8F35)",
specs: [
{ label: "Engine", value: "1.5L turbocharged I3, 181 hp / 190 lb-ft" },
{ label: "Drivetrain", value: "FWD" },
{ label: "Transmission", value: "8-speed automatic (8F35)" },
{ label: "Curb weight", value: "~3,400 lb" },
{ label: "Fuel tank", value: "18.6 gal" },
{ label: "Recommended fuel", value: "Regular unleaded, 87 octane" },
{ label: "Battery", value: "Group size 96R, ~590 CCA" },
{ label: "Wheel lug nut torque", value: "100 ft-lb (136 Nm)" },
{ label: "Front tire size (SE)", value: "225/60R17" },
],
fluids: [
{
name: "Engine Oil",
capacity: "5.3 qt (5.05 L) with filter change",
spec: "SAE 5W-20 synthetic blend, API SP (Motorcraft or equivalent)",
notes: "CORRECTED 2026-09-19 against the 2021 Escape owner's manual, which specifies 5.3 qt / 5.05 L and Motorcraft SAE 5W-20 Synthetic Blend meeting API SP. This entry previously read 5.7 qt of 0W-20 full synthetic — a 0.4 qt overfill and the wrong viscosity. Spin-on canister filter (Motorcraft FL-910-S or equivalent), not a cartridge — a standard filter wrench or strap tool works.",
},
{
name: "Engine Coolant",
capacity: "~6.9 qt (6.5 L) system capacity",
spec: "Motorcraft Orange (Gold) Full-Life coolant, 50/50 premix",
},
{
name: "Automatic Transmission Fluid (8F35)",
capacity: "~3.9 qt (3.7 L) for a pan drain-and-fill (service fill)",
spec: "Motorcraft Mercon ULV (ultra-low viscosity ATF)",
notes: "Ford calls this transmission \"filled for life\" with no dipstick — a fluid/filter service only replaces what drains from the pan.",
},
{
name: "Brake Fluid",
capacity: "Fill to MAX line in reservoir",
spec: "DOT 3",
},
{
name: "Windshield Washer Fluid",
capacity: "~3.9 qt (3.7 L) reservoir",
spec: "All-season washer fluid",
},
],
},
];

export function getVehicleById(id: string): Vehicle | undefined {
return vehicles.find((v) => v.id === id);
}
