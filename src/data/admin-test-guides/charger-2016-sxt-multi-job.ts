import type { ResolvedGuide, RepairStep, TorqueSpec, Vehicle } from "@/types/vehicle";

// ---------------------------------------------------------------------------
// ADMIN TEST GUIDE #001 -- NOT PUBLISHED.
//
// 2016 Dodge Charger SXT, 3.6L Pentastar V6: one combined multi-job service
// (intake manifold seals, oil filter/cooler housing, spark plugs, ignition
// coils, fuel injectors, PCV valve, engine oil/filter, cooling-system refill).
//
// WHERE THIS FILE IS ALLOWED TO BE IMPORTED: src/app/admin/guides/** only.
//
// It is deliberately NOT part of src/data/repairs.ts or src/data/vehicles.ts.
// Everything customer-facing -- the vehicle catalog, guide catalog, search,
// generateStaticParams, the coverage report, entitlements -- reads those two
// files and nothing else, so a guide that lives here cannot appear there.
// Do not "tidy" it into either file, and do not import it from any route
// outside /admin.
//
// CONTENT RULE: every value below was supplied as verified guide content
// (prepared and source-checked separately) and is loaded exactly as given.
// Where the supplied content deliberately says VERIFY, the warning is kept
// verbatim rather than filled in. Never fill a value from general knowledge.
//
// SCHEMA NOTE: the renderer shows a step's instructions as ONE paragraph
// (RepairStepCard does not preserve line breaks), so the supplied line-per-
// sentence steps and bullet lists are joined into sentences, with lists
// written inline after a colon and separated by semicolons. Phases have no
// grouping element, so each step title carries its phase.
// ---------------------------------------------------------------------------

export interface AdminTestGuide {
  /** URL slug under /admin/guides/test/ */
  slug: string;
  vehicle: Vehicle;
  guide: ResolvedGuide;
}

const VEHICLE_ID = "admin-test-2016-dodge-charger-sxt";

// Defined here and nowhere else. Not in the catalog, so it cannot be reached
// from the vehicle pages, VIN decode matching, or search. Drivetrain and
// transmission are required by the Vehicle type but irrelevant to this repair
// and never displayed, so they are left empty rather than filled or flagged.
const vehicle: Vehicle = {
  id: VEHICLE_ID,
  year: 2016,
  make: "Dodge",
  model: "Charger",
  trim: "SXT",
  engine: "3.6L Pentastar V6",
  drivetrain: "",
  transmission: "",
  specs: [],
  fluids: [],
};

// Verbatim warnings from the supplied content.
const V_STEP = "⚠ VERIFY SPEC BEFORE SERVICE";
const V_TORQUE = "⚠ VERIFY EXACT TORQUE BEFORE SERVICE";
const V_SEQ = "⚠ VERIFY FASTENER SEQUENCE BEFORE SERVICE";

const P1 = "Phase 1 · Preparation";
const P2 = "Phase 2 · Release Fuel Pressure";
const P3 = "Phase 3 · Drain Fluids";
const P4 = "Phase 4 · Remove Air Inlet System";
const P5 = "Phase 5 · Upper Intake Manifold";
const P6 = "Phase 6 · Ignition Coils and Spark Plugs";
const P7 = "Phase 7 · Fuel Rail and Injectors";
const P8 = "Phase 8 · Lower Intake Manifold";
const P9 = "Phase 9 · Oil Filter / Cooler Housing";
const P10 = "Phase 10 · PCV Valve";
const P11 = "Phase 11 · Lower Intake Reassembly";
const P12 = "Phase 12 · Install Fuel Rail and New Injectors";
const P13 = "Phase 13 · Install New Ignition Coils";
const P14 = "Phase 14 · Upper Intake Reassembly";
const P15 = "Phase 15 · Engine Oil and Coolant";
const P16 = "Phase 16 · Restore and Prime Fuel System";
const P17 = "Phase 17 · First Start";
const P18 = "Phase 18 · Warm-Up and Final Check";

function step(
  number: number,
  phase: string,
  title: string,
  instructions: string,
  extra: Partial<Pick<RepairStep, "warning" | "torque">> = {}
): RepairStep {
  return { number, title: `${phase} — ${title}`, instructions, ...extra };
}

function t(fastener: string, value: string): TorqueSpec {
  return { fastener, value };
}

const steps: RepairStep[] = [
  // ------------------------------------------------------------ PHASE 1
  step(1, P1, "Begin with a cold engine",
    "Park on a level surface. Set the parking brake. Allow the engine to cool completely before opening the cooling system or beginning intake/fuel-system work. Do not intentionally warm the engine for this repair."),
  step(2, P1, "Remove engine cover",
    "Pull upward at the retaining grommets and remove the decorative engine cover. Set it aside."),

  // ------------------------------------------------------------ PHASE 2
  step(3, P2, "Remove fuel-filler cap",
    "Remove the fuel cap to relieve tank vapor pressure."),
  step(4, P2, "Locate the front Power Distribution Center",
    "Open the under-hood Power Distribution Center. Locate: Cavity 37 — 10A RED mini fuse. The 2016 Charger owner's manual identifies cavity 37 as supplying several Charger/300 circuits including the fuel-pump relay. Verify cavity numbering against the PDC cover before removal."),
  step(5, P2, "Remove F37",
    "Remove fuse F37. Keep it somewhere it cannot disappear into another dimension."),
  step(6, P2, "Depressurize fuel system",
    "Start the engine. Allow it to run until it stalls. Attempt to restart it. Continue until the engine will no longer run. Turn ignition OFF. NOTE: Removing the fuel-pump circuit may store a diagnostic trouble code. This can be cleared afterward with a scan tool."),
  step(7, P2, "Disconnect negative battery cable",
    "Disconnect and isolate the negative battery cable. The Charger battery is located in the trunk. Fuel-system work can now begin."),

  // ------------------------------------------------------------ PHASE 3
  step(8, P3, "Drain engine oil",
    "Position drain pan. Remove oil drain plug and allow oil to drain. Because the oil-filter housing is being removed, draining the crankcase first reduces the amount of oil entering the engine valley."),
  step(9, P3, "Lower coolant level",
    "Only when the engine is completely cold, drain sufficient coolant to lower the cooling-system level below the oil cooler/housing. Capture coolant cleanly if it will be reused. Use only compatible OAT coolant meeting FCA MS.90032 when refilling."),

  // ------------------------------------------------------------ PHASE 4
  step(10, P4, "Remove intake duct",
    "Disconnect the IAT electrical connector. Loosen the clamp at the throttle body. Loosen the clamp at the air-cleaner housing. Release the intake assembly from its retaining grommet. Remove the intake hose/resonator assembly."),
  step(11, P4, "Photograph and label connections",
    "Before disconnecting the upper intake, photograph hose and wiring routing. Label anything whose location is not obvious. Identify: throttle-body connector; MAP-related connections; PCV hose; EVAP connections; brake-booster vacuum connection; harness retainers; intake support hardware."),

  // ------------------------------------------------------------ PHASE 5
  step(12, P5, "Disconnect upper-intake connections",
    "Disconnect all electrical connectors, vacuum hoses, PCV plumbing, EVAP plumbing and retainers necessary to free the upper manifold. Do not pull on wiring. Release connector locks properly."),
  step(13, P5, "Remove upper intake manifold",
    "Remove the upper-intake fasteners and support hardware. Lift the upper intake away from the lower intake. Do not allow dirt or hardware to fall into the intake runners."),
  step(14, P5, "Protect exposed intake openings",
    "Immediately cover exposed intake openings with clean lint-free material.",
    { warning: "DO NOT LEAVE OPEN INTAKE PORTS UNPROTECTED. A dropped nut, bolt or piece of debris can enter the engine." }),

  // ------------------------------------------------------------ PHASE 6
  step(15, P6, "Disconnect ignition coils",
    "Disconnect all six coil electrical connectors. Remove the coil retaining bolts. Remove all six coils."),
  step(16, P6, "Clean spark-plug wells",
    "Before removing any plug, use compressed air or a shop vacuum to remove dirt and debris from each spark-plug well. Do not allow debris to enter the cylinders."),
  step(17, P6, "Remove spark plugs",
    "Remove all six spark plugs. Keep the removed plugs arranged by cylinder if you want to compare their condition. Inspect for: oil contamination; heavy carbon; unusual electrode wear; one plug significantly different from the others."),
  step(18, P6, "Install new spark plugs",
    "Thread each plug into the cylinder head by hand first. Never use the ratchet to start the threads. Torque: 18 N·m / 13 ft-lb. Do not use anti-seize unless specifically required by the spark-plug manufacturer.",
    { torque: [t("Spark plugs", "18 N·m / 13 ft-lb")] }),

  // ------------------------------------------------------------ PHASE 7
  step(19, P7, "Disconnect injector connectors",
    "Disconnect all six fuel-injector electrical connectors. Inspect connector locks for damage."),
  step(20, P7, "Prepare fuel-line connection",
    "Place absorbent shop towels beneath the fuel-supply quick-connect. Residual gasoline may remain even after the pressure-release procedure. No smoking, sparks or ignition sources."),
  step(21, P7, "Disconnect fuel supply",
    "Release the fuel-supply quick-connect using the correct method for the installed fitting. Cover/cap the open connection to prevent contamination."),
  step(22, P7, "Remove fuel rail",
    "Remove the four fuel-rail retaining bolts. Carefully rock and lift the rail evenly. Do not bend or kink the tube joining the left and right rail sections. Be prepared for one or more injectors to remain in the lower manifold and for residual fuel to spill."),
  step(23, P7, "Remove old injectors",
    "Remove all six injectors. Remove and discard the old injector O-rings. Do not reuse old injector O-rings."),
  step(24, P7, "Prepare new injectors",
    "Install new O-rings on the new injectors. Lightly lubricate the O-rings with clean engine oil. Do not use RTV or random grease. Install injectors into the fuel rail and install their retaining/safety clips as applicable. Set the prepared rail aside somewhere clean."),

  // ------------------------------------------------------------ PHASE 8
  step(25, P8, "Remove lower intake",
    "Remove the lower-intake retaining bolts. Lift the lower intake from the cylinder heads."),
  step(26, P8, "PROTECT THE ENGINE",
    "Immediately cover all exposed cylinder-head intake ports. Before doing anything else, verify that every intake port is protected.",
    { warning: "NOTHING GOES INTO THESE PORTS." }),
  step(27, P8, "Remove old intake seals",
    "Remove the old lower-intake seals/gaskets. Clean the manifold and cylinder-head sealing surfaces carefully. Use plastic/non-marring tools where necessary. Do not allow gasket debris or abrasive material into the engine."),

  // ------------------------------------------------------------ PHASE 9
  step(28, P9, "Prepare engine valley",
    "Place absorbent material around the oil-filter housing. Expect residual engine oil and coolant when the housing is removed. Disconnect the relevant oil/coolant sensor connectors and coolant plumbing from the housing."),
  step(29, P9, "Remove oil-filter housing",
    "Remove the five housing-to-engine bolts. Lift the housing vertically from the engine. Avoid spilling trapped oil/coolant into open engine passages."),
  step(30, P9, "Clean the valley",
    "Remove accumulated oil, coolant and debris from the engine valley. This is an excellent opportunity to clean residue from the old leaking housing. Do not push contamination into oil or coolant passages."),
  step(31, P9, "Inspect replacement housing",
    "Verify: correct housing; correct oil filter; all required housing-to-engine seals installed; cooler attached correctly; sensors present or transferred correctly; no shipping caps remain; sealing surfaces clean."),
  step(32, P9, "Install replacement housing",
    `Position the housing squarely on the engine. Start all five bolts by hand. Tighten gradually using the correct sequence: ${V_SEQ}. Final torque: 12 N·m / 106 in-lb.`,
    {
      warning: "INCH-POUNDS. Do not use an impact wrench.",
      torque: [t("Oil-filter housing to engine", "12 N·m / 106 in-lb")],
    }),

  // ----------------------------------------------------------- PHASE 10
  step(33, P10, "Locate PCV valve",
    "The 3.6L Pentastar PCV valve is located on the right side cylinder-head/valve-cover area and connects to the intake through the PCV hose. Disconnect the PCV hose."),
  step(34, P10, "Replace PCV valve",
    `Remove the three retaining screws. Remove the PCV valve and seal. Clean and inspect the sealing surface. Install the new seal and PCV valve. Torque: ${V_STEP}. Reconnect the PCV hose during final reassembly.`,
    { torque: [t("PCV retaining screws", V_STEP)] }),

  // ----------------------------------------------------------- PHASE 11
  step(35, P11, "Final intake-port inspection",
    "Before installing the lower intake: vacuum/clean the surrounding area. Inspect every intake port. Verify there are no: fasteners; dirt; old gasket fragments; paper/shop towel pieces; tools; other debris. Only then remove the protective port covers."),
  step(36, P11, "Install new lower-intake seals",
    "Install the new seals correctly into their grooves. Do not use RTV unless explicitly specified by the gasket manufacturer."),
  step(37, P11, "Install lower intake",
    `Position the manifold squarely over the cylinder heads. Start all fasteners by hand. Tighten using the proper sequence: ${V_SEQ}. Final torque: 8 N·m / 71 in-lb. Do not overtighten the composite intake.`,
    { torque: [t("Lower intake manifold", "8 N·m / 71 in-lb")] }),

  // ----------------------------------------------------------- PHASE 12
  step(38, P12, "Clean injector bores",
    "Make sure all six injector bores in the lower intake are clean."),
  step(39, P12, "Install rail",
    "Confirm each injector O-ring has a light coating of clean engine oil. Align all six injectors with their bores. Press the rail evenly into place. Do not use the rail bolts to force a badly aligned injector into its bore. If one refuses to seat, remove and inspect it."),
  step(40, P12, "Torque fuel rail",
    `Install the four rail retaining bolts. Tighten in the specified sequence: ${V_SEQ}. Final torque: 7 N·m / 62 in-lb.`,
    { torque: [t("Fuel rail retaining bolts", "7 N·m / 62 in-lb")] }),
  step(41, P12, "Reconnect fuel system",
    "Reconnect: six injector electrical connectors; fuel-supply quick-connect. Physically verify that the fuel-line fitting is fully locked."),

  // ----------------------------------------------------------- PHASE 13
  step(42, P13, "Install coils",
    `Install the six new coils onto the spark plugs with a gentle twisting motion. Install coil retaining bolts. Torque: ${V_STEP}. Reconnect all six electrical connectors.`,
    {
      warning:
        "IMPORTANT: Chrysler service information specifically warns against using silicone-based dielectric grease on the 3.6L ignition-coil boots.",
      torque: [t("Ignition-coil retaining bolts", V_STEP)],
    }),

  // ----------------------------------------------------------- PHASE 14
  step(43, P14, "Install new upper-intake seals",
    "Remove the old upper-intake seals. Clean the mating surfaces. Install the new seals correctly into their grooves."),
  step(44, P14, "Install upper intake",
    `Position the upper intake without disturbing the seals. Start all seven attaching bolts by hand. Tightening sequence: ${V_SEQ}. Final torque: 8 N·m / 71 in-lb. Do not overtighten. The upper intake uses low-torque fasteners threading into composite components.`,
    { torque: [t("Upper intake manifold attaching bolts", "8 N·m / 71 in-lb")] }),
  step(45, P14, "Reconnect upper-intake systems",
    "Reconnect every item removed during teardown: throttle-body connector; MAP-related connectors; PCV hose; EVAP plumbing; brake-booster vacuum hose; harness retainers; support brackets; intake plumbing; IAT connector. Use the photographs taken during disassembly as a final routing reference."),

  // ----------------------------------------------------------- PHASE 15
  step(46, P15, "Install new oil filter",
    "Install the correct filter into the new housing. Verify the filter-cap O-ring is correctly positioned. Do not accidentally install the cap O-ring in the wrong groove."),
  step(47, P15, "Finish oil service",
    "Install the engine oil drain plug and torque to 27 N·m / 20 ft-lb. Add: 6 qt / 5.6 L SAE 5W-20 API-certified oil meeting FCA MS-6395. After startup and shutdown, verify final level with the dipstick.",
    { torque: [t("Engine oil drain plug", "27 N·m / 20 ft-lb")] }),
  step(48, P15, "Refill cooling system",
    "Use: OAT coolant meeting FCA MS.90032. Do not mix OAT with HOAT or generic incompatible coolant. If using concentrate, mix with distilled/deionized water. A full dry cooling system is approximately 10 qt / 9.5 L, but this repair should require only replacement of the amount actually drained/lost. Do not blindly add the full-system capacity. Establish the correct final level after bleeding."),
  step(49, P15, "Bleed cooling system",
    "With the engine cold, use the cooling-system bleed point while filling. Fill until coolant reaches the bleed point without significant trapped air, then close the bleeder. Continue filling to the proper reservoir level. Do not open a hot cooling system."),

  // ----------------------------------------------------------- PHASE 16
  step(50, P16, "Reinstall fuel-pump fuse",
    "Verify ignition is OFF. Reinstall: F37 — 10A RED."),
  step(51, P16, "Reconnect battery",
    "Reconnect the negative battery cable."),
  step(52, P16, "Prime fuel system",
    "Cycle ignition to RUN without starting the engine. Allow the pump to run. Switch ignition OFF. Repeat several times to refill and pressurize the fuel rail."),
  step(53, P16, "MANDATORY FUEL LEAK INSPECTION",
    "Before starting the engine, inspect: all six injectors; injector-to-rail seals; injector-to-manifold seals; fuel rail; fuel-supply quick-connect. Use a flashlight. Look and smell for gasoline.",
    { warning: "IF ANY FUEL IS VISIBLE OR SMELLED, DO NOT START THE ENGINE. Correct the leak first." }),

  // ----------------------------------------------------------- PHASE 17
  step(54, P17, "Start engine",
    "Start the engine. A slightly longer initial crank may occur while the fuel system finishes priming. Allow the engine to idle. Do not immediately rev the engine."),
  step(55, P17, "Immediate inspection",
    "Check for: fuel leaks; oil leaks; coolant leaks; vacuum leaks/hissing; misfires; check-engine light; abnormal noises.",
    { warning: "If a strong fuel smell or visible leak appears: SHUT ENGINE OFF IMMEDIATELY." }),

  // ----------------------------------------------------------- PHASE 18
  step(56, P18, "Reach operating temperature",
    "Allow the engine to reach normal operating temperature while monitoring: coolant temperature; coolant level; oil-filter housing area; fuel rail; injector seals; intake manifold; vacuum connections. Do not stand directly in line with the cooling fan while the engine is operating."),
  step(57, P18, "Final shutdown inspection",
    "Shut engine off. Allow several minutes for oil to drain back. Recheck: engine oil level; coolant level after safe cooldown; oil-filter housing/engine valley; fuel rail and injectors; coolant connections; intake/vacuum connections. Correct levels as necessary."),
  step(58, P18, "Scan for DTCs",
    "Scan the vehicle. Remember that removing the fuel-pump fuse during the factory pressure-release procedure can create a stored diagnostic trouble code. Clear appropriate service-related codes and verify that no new misfire, injector, throttle, MAP or fuel-system faults return."),
  step(59, P18, "Final road test",
    "Once the engine is leak-free and operating normally: perform a short road test. Return and perform one final visual inspection for: oil; fuel; coolant; vacuum leaks. Recheck fluid levels after the engine cools. SERVICE COMPLETE."),
];

const guide: ResolvedGuide = {
  id: "admin-test-charger-2016-sxt-multi-job",
  vehicleId: VEHICLE_ID,
  title: "Intake Gaskets + Oil Filter Housing + Spark Plugs + Coils + Fuel Injectors + PCV Valve",
  summary:
    "This procedure combines several overlapping repairs into one optimized teardown. Instead of removing and reinstalling the intake system separately for each repair, the engine is opened once, all accessible components are serviced, and the engine is reassembled once. Jobs included: upper/lower intake manifold seals; oil filter/cooler housing assembly; six spark plugs; six ignition coils; six fuel injectors; PCV valve; engine oil and filter; cooling-system refill/top-off.",
  difficulty: "Advanced",
  estTime:
    "Approximately 4–6 hours for an experienced DIY mechanic working carefully. Allow additional time for cleaning the engine valley, stubborn connectors, cooling-system bleeding, and final inspection.",
  tier: "premium", // not rendered on this page; this guide is outside the tier system
  tools: [
    { name: "1/4-inch ratchet" },
    { name: "3/8-inch ratchet" },
    { name: "Socket set" },
    { name: "E-Torx sockets" },
    { name: "Torx bits" },
    { name: "5/8-inch spark-plug socket" },
    { name: "Long extensions" },
    { name: "Wobble/universal extension" },
    { name: "INCH-POUND torque wrench" },
    { name: "Foot-pound torque wrench" },
    { name: "Fuel-line disconnect tool if required by installed fitting" },
    { name: "Picks/hook tools" },
    { name: "Hose-clamp pliers" },
    { name: "Needle-nose pliers" },
    { name: "Magnetic pickup tool" },
    { name: "Compressed air or shop vacuum" },
    { name: "Drain pans" },
    { name: "Funnel/cooling-system filling equipment" },
    { name: "Flashlight" },
    { name: "Scan tool recommended" },
  ],
  parts: [
    "Oil-filter/cooler housing assembly with new seals",
    "Six spark plugs",
    "Six ignition coils",
    "Six fuel injectors",
    "New injector O-rings",
    "PCV valve and seal",
    "Upper intake seals/gaskets",
    "Lower intake seals/gaskets",
    "New oil filter",
    "6 qt SAE 5W-20 engine oil meeting FCA MS-6395",
    "OAT coolant meeting FCA MS.90032",
    "Distilled water if using coolant concentrate",
    "Brake cleaner",
    "Shop towels",
    "Clean engine oil for injector O-ring lubrication",
    "Caps/plugs or clean covering for open fuel connections",
    // Verified service data that is not a torque value. The guide renderer has
    // no fluids/service-data section, so it rides in Parts & Supplies.
    "Service data — Engine oil capacity with filter: 6 qt / 5.6 L",
    "Service data — Engine oil: SAE 5W-20, FCA MS-6395",
    "Service data — Coolant: OAT coolant meeting FCA MS.90032",
    "Service data — Full cooling-system capacity: approximately 10 qt / 9.5 L (this repair: replace only the coolant drained/lost)",
    "Service data — Fuel pressure: approximately 58 psi ±5 psi during normal operation",
  ],
  safety: [
    "Allow the engine to cool completely before opening the cooling system or beginning intake/fuel-system work.",
    "Residual gasoline may remain even after the pressure-release procedure. No smoking, sparks or ignition sources.",
    "DO NOT LEAVE OPEN INTAKE PORTS UNPROTECTED. A dropped nut, bolt or piece of debris can enter the engine.",
    "IF ANY FUEL IS VISIBLE OR SMELLED, DO NOT START THE ENGINE. Correct the leak first.",
    "Do not open a hot cooling system.",
    "Do not stand directly in line with the cooling fan while the engine is operating.",
  ],
  torqueSpecs: [
    t("Spark plugs", "18 N·m / 13 ft-lb"),
    { fastener: "Fuel rail retaining bolts", value: "7 N·m / 62 in-lb", notes: `Tightening sequence: ${V_SEQ}` },
    { fastener: "Lower intake manifold", value: "8 N·m / 71 in-lb", notes: `Tightening sequence: ${V_SEQ}` },
    { fastener: "Oil-filter housing to engine", value: "12 N·m / 106 in-lb", notes: `Tightening sequence: ${V_SEQ}` },
    t("Engine oil drain plug", "27 N·m / 20 ft-lb"),
    {
      fastener: "Upper intake manifold attaching bolts",
      value: "8 N·m / 71 in-lb",
      notes:
        `Seven attaching bolts. Tightening sequence: ${V_SEQ}. Chrysler Pentastar service material identifies the upper intake as a low-torque composite-manifold assembly; do not substitute generic hand-tightening.`,
    },
    t("PCV retaining screws", V_TORQUE),
    t("Ignition-coil retaining bolts", V_TORQUE),
  ],
  steps,
};

export const adminTestGuides: AdminTestGuide[] = [
  { slug: "2016-charger-sxt-multi-job", vehicle, guide },
];

export function listAdminTestGuides(): AdminTestGuide[] {
  return adminTestGuides;
}

export function findAdminTestGuide(slug: string): AdminTestGuide | undefined {
  return adminTestGuides.find((g) => g.slug === slug);
}
