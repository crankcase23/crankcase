// Vehicle Configuration V1: how the BMW 328i (E90) CUSTOMER guides depend on transmission and drivetrain.
//
// The research behind these guides ran on one car (automatic, rear-wheel drive). The customer copy is built for that build:
//   * evidenceFor  names the builds the research actually covers, per guide and only on the axes that guide depends on.
//                  A customer whose SAVED configuration is outside it gets no procedure ("not available"), never a guess.
//   * forConfig    tags the steps / parts / tools / torque rows that only hold for those builds. They show when the customer
//                  confirmed that build and are withheld ("restricted") while it is unconfirmed or Not sure.
//   * NEUTRAL_*    remove, from the customer copy only, wording about builds the guide does not cover (xDrive transfer case,
//                  manual-pan part numbers, "check whether your car is RWD or xDrive"). Once the customer has confirmed
//                  Automatic + RWD those lines are noise, and leaving them would read as the guide still being unsure.
// The admin review drafts and the evidence ledgers keep the full research text; nothing here edits them.
// Every rule must match something (stale guard in build-drafts.mjs), and every removed or rewritten sentence is listed in
// docs/bmw-e90/CUSTOMER-SCRUB-REPORT.md.

const RWD = { drivetrain: ["rwd"] };
const AUTO = { transmission: ["automatic"] };
const AUTO_RWD = { transmission: ["automatic"], drivetrain: ["rwd"] };

/** Per ledger guide number. `steps|parts|tools|torque` rules match by regex and tag with forConfig; `allSteps`/`allParts`/`allTorque` tag everything that is not a blocked step. */
export const GUIDE_CONFIG = {
  1: {
    evidenceFor: RWD,
    evidenceNote: "Front brake sensor part numbers depend on the drive type, and only the rear-wheel-drive ones were researched.",
    parts: [{ re: /wear sensor/i, forConfig: RWD }],
    steps: [{ re: /^Confirm parts and prepare the car/, forConfig: RWD }],
  },
  4: {
    evidenceFor: AUTO,
    evidenceNote: "The exhaust sensor holder and exhaust variants depend on the transmission, and only the automatic ones were researched.",
    parts: [{ re: /Lambda probe bracket/i, forConfig: AUTO }],
    steps: [{ re: /^Reconnect and secure the harness/, forConfig: AUTO }],
  },
  5: {
    evidenceFor: RWD,
    evidenceNote: "Rear brake rotor and sensor part numbers depend on the drive type, and only the rear-wheel-drive ones were researched.",
    parts: [{ re: /wear sensor|brake rotor/i, forConfig: RWD }],
    steps: [{ re: /^Confirm parts, prepare and chock/, forConfig: RWD }],
  },
  6: {
    evidenceFor: AUTO,
    evidenceNote: "Access to the belt differs between automatic and manual cars (an extra oil-cooler fastener on the automatic), and only the automatic was researched.",
    steps: [{ re: /^Clear access to the belt/, forConfig: AUTO }],
  },
  8: {
    evidenceFor: AUTO,
    evidenceNote: "The radiator variant and the coolant capacity depend on the transmission, and only the automatic was researched.",
    parts: [{ re: /Capacities table on p\. 248/i, forConfig: AUTO }],
    steps: [{ re: /^Mix and fill/, forConfig: AUTO }],
  },
  9: {
    evidenceFor: AUTO_RWD,
    evidenceNote: "Coolant capacity and the transmission and differential notes depend on the build, and only the automatic rear-wheel-drive car was researched.",
    parts: [{ re: /Secondary figures for the N52 328i|Automatic transmission and rear differential fluid/i, forConfig: AUTO_RWD }],
    steps: [{ re: /^Transmission and differential/, forConfig: AUTO_RWD }],
  },
  13: {
    evidenceFor: RWD,
    evidenceNote: "Rotation and jack-point advice differ by drive type, and only the rear-wheel-drive car was researched.",
    steps: [{ re: /^SQUARE set: choose the rotation/, forConfig: RWD }, { re: /^Lift at the side jack pads/, forConfig: RWD }],
  },
  15: {
    evidenceFor: RWD,
    evidenceNote: "This guide covers the rear differential of a rear-wheel-drive car. The front differential and transfer case of other drive types were not researched.",
    allSteps: RWD, allParts: RWD, allTorque: RWD,
  },
  16: {
    evidenceFor: AUTO_RWD,
    evidenceNote: "The oil pan, drain plug and oil quantity were researched for the automatic rear-wheel-drive car. Other pans and drive types were not.",
    parts: [{ re: /drain plug|automatic-pan/i, forConfig: AUTO }, { re: /Engine oil quantity/i, forConfig: RWD }],
    torque: [{ re: /Oil drain plug/i, forConfig: AUTO }],
    steps: [{ re: /^Drain the sump/, forConfig: AUTO_RWD }, { re: /^Refit the drain plug/, forConfig: AUTO_RWD }, { re: /^Refill/, forConfig: RWD }],
  },
};

/** Wording about builds the guide does not cover. Applied per sentence BEFORE the removal pass, so a sentence that also carries a part number or figure keeps it. */
export const NEUTRAL_REWRITE = [
  [/The RealOEM diagram for this car's automatic pan also lists a second screw plug with O-ring and a protection cap whose purpose is not stated: remove only/, "The pan may also show a second screw plug with an O-ring and a protection cap whose purpose is not stated: remove only"],
  // ---- parts and tools: model lists
  [/ \(BMW; Bimmerworld: original pad for E9X LCI 328i from 2009; PMB lists 328i and 328i xDrive 2009-2013\)/, " (BMW; Bimmerworld: original pad for E9X LCI 328i from 2009; PMB lists the 328i 2009-2013)"],
  [/Front pad set, 328i \/ 328i xDrive \/ 328xi, built after/, "Front pad set, 328i, built after"],
  [/Front pad wear sensor, non-xDrive, /g, "Front pad wear sensor, "],
  [/Rear pad set, 328i \/ 328xi \/ 328i xDrive sedan\./, "Rear pad set, 328i sedan."],
  [/PMB: 328i 2007-2010, 328i xDrive 2009-2010/, "PMB: 328i 2007-2010"],
  [/; Jurid lists 328i xDrive 2009-2012\)/, "; Jurid lists 2009-2012)"],
  [/\(328i not named on Turner; Brembo listing says 328i xDrive 2011-2013\)/, "(328i not named on Turner; Brembo listing says 2011-2013)"],
  [/Engine air filter element, E90 328i\/328xi \(N52\)/, "Engine air filter element, E90 328i (N52)"],
  [/Front wiper blade set \(driver \+ passenger\), builds from 09\/2009 incl\. 2010 328i\/328i xDrive\./, "Front wiper blade set (driver + passenger), builds from 09/2009 incl. the 2010 328i."],
  [/\(X5 E70 xDrive30i, same engine, other chassis\)/, "(an X5 E70, same engine, other chassis)"],
  [/holder 11787548283 \(manual\) or 11787556835 \(automatic S205A\)/, "holder 11787556835 (automatic S205A)"],
  // ---- coolant capacity: keep the automatic figures, drop the manual ones
  [/Pelican \(E90 article\): about 8\.2 L automatic, about 8\.4 L manual\./, "Pelican (E90 article): about 8.2 L automatic."],
  [/Rick \(aggregate, no source named\): 8\.6 qt manual \/ 8\.9 qt automatic = about 8\.1 \/ 8\.4 L\. z4-forum thread: UK handbook p\.103 "8\.3 L" manual, a USA 3\.0si manual "7\.6 manual \/ 8\.4 auto" \(vehicle not clear\), a BMW service manual snippet "8 L manual with A\/C", poster own 8\.2 L\./, "Rick (aggregate, no source named): 8.9 qt automatic = about 8.4 L. z4-forum thread: a USA 3.0si \"8.4 auto\" (vehicle not clear), poster own 8.2 L."],
  [/^If the car is automatic, the two sources that name automatic/, "The two sources that name automatic"],
  [/about 8\.2 L \(8\.65 US qt\) manual \([^)]*\), about 8\.4 L/, "about 8.4 L"],
  // ---- differential guide
  [/OE catalog: 3\.73 with automatic \(S205A\) and 3\.23 \(row not tied to an option, likely manual\) on the 188L final drive\./, "OE catalog: 3.73 with automatic (S205A) on the 188L final drive."],
  [/^Confirm RWD \(the catalog shows no front differential or transfer case for the 328i\) and that the rear differential is an open type\./, "Confirm that the rear differential is an open type, not a limited-slip."],
  [/^If the car is actually xDrive or has an LSD, stop: this guide does not cover them\./, "If the car has a limited-slip differential (LSD), stop: this guide does not cover it."],
  [/^Wrong fluid in an LSD or transfer case can damage it \(bavmods; FCP\)\./, "Wrong fluid in a limited-slip differential can damage it (bavmods; FCP)."],
  // ---- belt
  [/; automatics also have a T25 oil-cooler fastener\)/, "; the automatic also has a T25 oil-cooler fastener)"],
  [/^If your car is an automatic and the fan shroud comes out, expect the extra T25 oil-cooler fastener; skip it if the shroud stays on\./, "If the fan shroud comes out, expect the extra T25 oil-cooler fastener; skip it if the shroud stays on."],
  // ---- oil change
  [/^The OE catalog lists a lead holder 11787556835 for the automatic \(S205A\) and 11787548283 otherwise; reuse/, "The OE catalog lists lead holder 11787556835 for the automatic (S205A); reuse"],
  [/ per the MY2011 328i xDrive owner's manual \(p\.262\)\./, " per the MY2011 328i owner's manual (p.262)."],
  [/; bimmerpost's 18 lb-ft is from a 2011 328i xDrive N51\./, "."],
  [/; bimmerpost thread is a 2011 328i xDrive; bavmods/, "; bavmods"],
  [/the plug orientation on this car's automatic pan is NOT established \(oil is reported to exit straight down on an N52 330i and sideways on a 2011 328i xDrive N51\)\./, "which way the oil leaves the plug is NOT established for this car (reports differ: straight down or sideways), so be ready for either."],
  // ---- tire rotation / pcv / retailer notes
  [/^Bare floor-jack cups can crack the plastic pads\. xDrive front centre point is reported to differ from RWD \(single forum source\)\./, "Bare floor-jack cups can crack the plastic pads."],
];

/** Sentences about the other builds that carry no fact for this one. A sentence matching OUT_RE after the rewrites is removed too (see build-drafts.mjs for the part-number guard). */
export const NEUTRAL_DROP = [
  // "this does not matter" notes: a customer with a confirmed build has nothing to check
  /^BimmerWorld: stock E9X 328i ratio is 3\.23 \(manual context\)\./,
  /^Turner: stock manual gearing 3\.15 or 3\.23\./,
  // "check whether your car is..." questions the saved configuration has answered
];

/** What must not survive in text a customer with Automatic + RWD can see (used by the generator guard and the tests). */
export const OUT_RE = new RegExp(
  [
    "x-?drive", "\\bxi\\b", "\\b3\\d\\dxi\\b", "\\bawd\\b", "all[- ]wheel", "four[- ]wheel", "transfer[- ]case",
    "front (?:differential|diff\\b|axle|drive ?shaft)", "manual[- ](?:trans\\w*|gearbox|pan|holder|cars?|shift|S205|vs)", "\\(manual\\)",
    "(?:\\bL|\\bqt|likely|\\bor|\\bvs\\.?|\\band|automatic\\s*/|/) manual\\b(?!\\s+(?:p\\.|page|or BMW))", "\\bmanual /", "automatic (?:and|or|vs\\.?) manual",
    "\\bstick shift", "\\bclutch\\b", "manual (?:gearing|context)", "manual-only", "\\b328i\\s*/\\s*328",
  ].join("|"),
  "i",
);

/** Customer wording replaced wholesale where the ledger text is a research note, not an instruction (the source facts stay in the ledger). `must` guards against the ledger changing underneath. */
export const STEP_OVERRIDES = [
  {
    g: 16,
    title: "Gather parts and warm the engine briefly",
    must: /11427566327/,
    instructions:
      "Get the parts in the Parts list: the oil filter kit (check that it includes the small centre O-ring), about 7 US quarts of oil in an approved viscosity and BMW LL-01 / High Performance 5W-30 class, and a spare drain washer. Have your tools ready. Run the engine a few minutes so the oil drains well, then park on level ground with the engine off.",
  },
];

/**
 * "Before you start" is for things a customer can DO: look at a label, compare a part, read a marking. The ledger's variant notes are
 * research (what RealOEM, a retailer or a forum said), and they stay in the ledger and the admin draft. The customer sees these short
 * checks instead, written from those same notes. `must` guards each against the ledger changing underneath it; a guide not listed
 * here has no "Before you start" step. Step numbers are never written here: the checks name steps by what they do.
 */
export const LEAD_OVERRIDES = {
  1: {
    must: /Front caliper guide-pin head/,
    text: "The front rotor diameter and MIN TH are stamped on the rotor, and the old pads must match the new kit; if they do not, stop and get the correct kit by VIN. Look at the caliper guide-pin head before applying a torque: sources agree on a hex socket head (7 mm, with 6 mm in one report), and one table lists a hexagon-head guide screw at a different figure. Look at the carrier bolt head before choosing a socket: sources call it a Torx screw or an 18 mm hex bolt. The car carries no spare wheel (run-flat tires).",
  },
  2: {
    must: /Check which headlight type/,
    text: "Check which headlight type your car has: halogen (the H7 and fog H8 paths) or xenon (D1S, a blocked step in this guide). To confirm, look at the bulb you pull out (H7 halogen vs D1S xenon). Any xenon work, including bulb replacement, is for a BMW center only. For parking, daytime-running and halo bulbs sources disagree (H8 vs H10W), so match the marking on the bulb you removed. Follow the fuse chart on the back of the glove-box cover: the web charts disagree with each other. Some tail-lamp positions are LED and serviced by a BMW center: open the cover and see whether you have bulb carriers or LED modules. The engine-bay fuse box is not an owner-serviceable item per BMW.",
  },
  3: {
    must: /How to identify: a Comfort Access key/,
    text: "Check which key you have. A Comfort Access key has a small release tab on the side that frees a metal valet blade, and a battery cover once the blade is out. A standard key is a sealed fob with no battery cover: it has an integrated rechargeable cell that charges in the ignition slot. The two can look alike from the front, so use the tab and cover test, not appearance. Follow the standard-key steps for a sealed key, and the Comfort Access steps only if the key has a side tab and a battery cover. Do not buy a CR2032 for a sealed standard key: the CR2032 is for Comfort Access keys only.",
  },
  4: {
    must: /To identify: compare the number printed on the old sensor/,
    text: "Compare the number printed on the old sensor (or its lead length) with 11787558055, 11787558073, 11787545074 or 11787545075 before buying; if it does not match, stop and match the old part, do not guess. Do not swap bank 1 and bank 2 sensors: the wiring lengths differ and harness stress can cause failure. The engine label differs between sources (N52K vs N52N), but it does not change the sensor numbers. The M3 and 335i (N54) pre-cat sensor numbers must not be used on a 328i.",
  },
  5: {
    must: /Rear caliper guide hardware/,
    text: "The rear rotor is 300x20 with MIN TH stamped on it, and the old pads must match the new kit; if not, stop and get the correct kit by VIN. Look at the rear caliper guide screw head and use the matching row in the torque table: sources describe a hexagon head (13 mm socket, 15 mm back-up wrench) and a socket-head variant. The carrier fasteners take a 16 mm socket.",
  },
  6: {
    must: /Access path differs by source/,
    text: "How much you take apart depends on tool clearance: some sources remove the snorkel, airbox and fan shroud, others remove the front intake duct and a duct across the radiator and raise the front of the car. Whether the new tensioner comes with a lock pin is not established, so the guide handles both. The engine label is not settled (N52K vs N52N), but it does not change this procedure.",
  },
  7: {
    must: /Battery capacity\/type/,
    text: "Read the battery label before buying. The parts catalog lists 70, 80 and 90 Ah flooded and 70, 80 and 92 Ah AGM options for this model, and which one your car left the factory with depends on its option codes. For an 80 Ah car, 94R/H7 is the expected size; compare the old battery's footprint and vent-port side before buying. Changing battery type (flooded vs AGM) or capacity requires coding in addition to registration. Registering the new battery needs a capable tool (ISTA/Rheingold, INPA/Tool32, NCS Expert or an aftermarket app or scanner).",
  },
  8: {
    must: /Radiator drain plug count/,
    text: "Open the expansion tank cap only on a cold engine; never add coolant when the engine is hot. The catalog lists two radiator drain plugs (left and right), so look for both. No BMW document gives the coolant capacity: about 8.2 to 8.4 L is reported for an automatic and sources differ, so fill by level and budget about 9 L. The automatic transmission fluid is a separate system and is not part of this coolant job.",
  },
  9: {
    must: /Oil level: electronic/,
    text: "The engine oil level on this car is electronic: there is no oil dipstick. Power steering is hydraulic, and a car without active steering uses the non-active reservoir. The rear differential is not an owner top-off item, and no catalog dipstick, filler or check plug is listed for the automatic transmission. Coolant capacity is not confirmed by a BMW document (about 8.4 to 8.5 L is reported for an automatic). The cabin filter housing cover hides the brake reservoir: sources describe six 8 mm screws, and the Cabin Air Filter guide says to remove every fastener you find.",
  },
  10: {
    must: /Aftermarket cowl\/delete kits/,
    text: "Check the part number on the old filter against 64319313519, the carbon element listed for this car. No BMW-grade removal procedure was found for the housing cover on this build date: most sources describe six 8 mm screws, so remove every fastener you find. Aftermarket cowl or delete kits exist and change the procedure: if the cover is not the factory one, follow what you see.",
  },
  11: {
    must: /Identify by cover/,
    text: "Confirm the valve cover is the plastic design. A plastic cover (later N52) fits this guide; a cast-metal cover with a separate heated vent valve is the early N52 (2006, some 2007 builds) and this guide does not apply.",
  },
  12: {
    must: /Euro airbox conversion/,
    text: "A previous owner may have fitted a different airbox, which cannot be known remotely: compare the removed element with 13717542294 before buying or fitting. The stock 328i airbox is a two-half box with housing screws; sources say six or seven, and the screw count and drive type are not confirmed, so do not force a bit. Disconnecting the battery is optional: only one source asks for it, to protect the MAF.",
  },
  13: {
    must: /How to tell: read the size on each sidewall/,
    text: "Read the size on each sidewall. If all four tires are the same size (a square set), front-to-rear rotation is allowed for non-directional tires. If the rear number is larger (a staggered set, for example 225/45R17 front and 255/40R17 rear), front wheels and tires never go to the rear. Directional tires carry an arrow or the word ROTATION on the sidewall: directional square tires may only swap front and rear on the same side, and directional staggered tires cannot be rotated without remounting. Metal valve stems mean direct TPMS (some 2009-13 E90s have the indirect type). Do not fit a compact spare or snow chains during a TPMS reset.",
  },
  14: {
    must: /Build date: wiper sets split at 09\/2009/,
    text: "The passenger blade is 19 in on the sedan (17 in on the coupe and convertible). Wiper sets split at 09/2009: a car built before 09/2009 needs the older set 61610427668.",
  },
  15: {
    must: /Open vs limited-slip/,
    text: "The differential is probably an open type, and the 75W-140 fluid is for M3 and limited-slip cars only. This guide assumes a screw plug with an O-ring (60 Nm); a sealing-ring plug has a different figure (65 Nm) in the service-manual table. One report says the plug can be obstructed by lower braces, so a snub-nose 14 mm hex or crowfoot may be needed.",
  },
  16: {
    must: /Drain plug orientation and hatch hardware/,
    text: "Confirm the engine code from the engine cover or underhood label: this guide is for the N52. A SULEV N51 variant exists in some US states, and its oil capacity and cap and plug differences were not found. Compare the approved oil with the oil-cap label or your owner's manual: approvals here were read from other model-year manuals. Undertray versions vary (Sport package cars reportedly have an extra front flap), so the hatch hardware may differ.",
  },
};
