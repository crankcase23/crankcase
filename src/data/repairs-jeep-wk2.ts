import { RepairGuide } from "@/types/vehicle";

// Additional guides for the 2014 Jeep Grand Cherokee (WK2, 3.6L Pentastar).
//
// Kept in its own file rather than appended to src/data/repairs.ts, which has
// grown past 130 KB and 2,500 lines. Editing that file through the GitHub web
// editor means replacing the whole thing, which is slow and risky; a per-vehicle
// file is additive and independently reviewable. New vehicles should follow this
// pattern rather than growing the monolith further.
//
// Torque figures here are curated reference values unless a provenance field
// says otherwise, exactly as in repairs.ts. Every one still carries the standing
// disclaimer: confirm against the factory service manual or the label on the
// vehicle before final tightening.

export const jeepGrandCherokeeWk2Guides: RepairGuide[] = [
  {
    id: "jeep-grand-cherokee-key-fob-battery",
    vehicleId: "2014-jeep-grand-cherokee-3.6l",
    title: "Key Fob Battery Replacement",
    jobType: "key-fob-battery",
    summary:
      "Swap the coin cell in the Grand Cherokee remote. No tools beyond a coin or a small flat blade, and no reprogramming afterward.",
    difficulty: "Easy",
    tier: "premium",
    estTime: "5 min",
    noFasteners: true,
    tools: [
      { name: "Small flat-blade screwdriver", note: "A coin or a guitar pick works and is less likely to mar the case" },
    ],
    parts: ["CR2032 lithium coin cell (one)"],
    safety: [
      "Coin cells are a serious swallowing hazard for small children and pets. Dispose of the old one where it cannot be found.",
      "Do not force the case halves apart with a metal blade at the seam - work the latch instead, or you will scar the plastic.",
    ],
    torqueSpecs: [],
    steps: [
      {
        number: 1,
        title: "Release the emergency key blade",
        instructions:
          "Slide the release latch on the side of the fob and pull the metal emergency key blade out. The blade covers part of the case seam, so the fob will not open cleanly with it still in place.",
      },
      {
        number: 2,
        title: "Split the case",
        instructions:
          "Insert the blade or a coin into the notch left by the key blade and twist gently. The two halves separate along the seam. Work around the edge rather than prying hard in one spot.",
      },
      {
        number: 3,
        title: "Note the orientation, then lift the old cell out",
        instructions:
          "Look at which way the cell faces before you touch it. On this fob the positive side faces up, toward the back cover. Ease the cell out from under the retaining clip.",
        warning:
          "Photograph it with your phone before removing it if you are unsure. Installing a coin cell upside down will not damage it, but the fob simply will not work and it is an easy thing to get backwards.",
      },
      {
        number: 4,
        title: "Fit the new cell",
        instructions:
          "Handle the new CR2032 by its edges. Skin oil on the faces adds resistance and shortens its life. Slide it under the clip the same way up as the one you removed.",
      },
      {
        number: 5,
        title: "Close up and test",
        instructions:
          "Press the halves together until the seam clicks shut all the way around, reinsert the emergency key blade, and test lock and unlock from a few feet away. No reprogramming is needed - the fob keeps its pairing through a battery change.",
      },
    ],
  },
  {
    id: "jeep-grand-cherokee-fluid-checks",
    vehicleId: "2014-jeep-grand-cherokee-3.6l",
    title: "Fluid Checks & Top-Offs",
    jobType: "fluid-checks",
    summary:
      "Walk every fluid you can legitimately check on a WK2 Grand Cherokee, what correct looks like, and which one you cannot check at all without a scan tool.",
    difficulty: "Easy",
    tier: "premium",
    estTime: "15-20 min",
    noFasteners: true,
    tools: [
      { name: "Shop rag or paper towels" },
      { name: "Funnel", note: "A long-neck funnel keeps coolant off the belt and pulleys" },
      { name: "Flashlight", note: "The brake reservoir markings are hard to read in a dim garage" },
    ],
    parts: [
      "5W-20 full synthetic engine oil, API SN / ILSAC GF-5 (top-off only)",
      "Mopar Antifreeze/Coolant 10 Year/150,000 Mile OAT, 50/50 premix (top-off only)",
      "DOT 3 brake fluid, sealed container (top-off only)",
      "Windshield washer fluid",
    ],
    safety: [
      "Check coolant cold. Opening a hot pressurised system sprays scalding coolant. If the overflow bottle is warm to the touch, wait.",
      "Brake fluid strips paint on contact and absorbs moisture from open air. Wipe spills immediately and never top off from a container that has been sitting open.",
      "A brake reservoir that keeps dropping is not a top-off job. Falling brake fluid means worn pads or a leak - find the cause before driving.",
    ],
    torqueSpecs: [],
    steps: [
      {
        number: 1,
        title: "Park level and let it sit",
        instructions:
          "Park on level ground and shut the engine off. Oil needs five to ten minutes to drain back before the dipstick reads true, and coolant needs to be cold. Checking either one straight after a drive gives you a number you cannot trust.",
      },
      {
        number: 2,
        title: "Engine oil",
        instructions:
          "Pull the dipstick, wipe it, reseat it fully, and pull it again. The level should sit between the two marks. If it needs topping off, add a little at a time - capacity is 6.0 qt (5.7 L) with a filter change, and overfilling is its own problem.",
        warning:
          "Some Pentastar service information lists 0W-20 rather than 5W-20. Match whatever your oil fill cap or door-jamb sticker says rather than assuming.",
      },
      {
        number: 3,
        title: "Coolant",
        instructions:
          "Read the level on the side of the translucent overflow bottle against its MIN and MAX marks. Do not unscrew the pressure cap to check - the bottle tells you what you need to know. Top off with the same 10 Year/150,000 Mile OAT formula already in the system.",
        warning:
          "Do not add orange HOAT coolant to this system. 2013-2014 is the changeover window for this generation and mixing the two chemistries is the scenario that gels a cooling system. Check your underhood label.",
      },
      {
        number: 4,
        title: "Brake fluid",
        instructions:
          "The reservoir sits on the master cylinder against the firewall on the driver side. Read the level through the translucent body against the MIN and MAX marks. A level that has drifted down slowly over tens of thousands of miles is usually pads wearing, not a leak - the fluid follows the pistons out.",
      },
      {
        number: 5,
        title: "Windshield washer",
        instructions:
          "Fill the washer bottle to the neck. Use a winter-rated fluid if you see freezing temperatures - plain water or summer fluid can freeze the lines and crack the pump.",
      },
      {
        number: 6,
        title: "The transmission, and why you are not checking it",
        instructions:
          "The 845RE eight-speed in this Grand Cherokee is a sealed unit. There is no dipstick and no owner-serviceable level check. Checking it properly means bringing the fluid to a specific temperature and opening a level plug underneath, which is a shop job. If you suspect a transmission fluid problem, that is a diagnosis, not a top-off.",
        warning:
          "Ignore any guide that tells you to check this transmission with a dipstick. That advice belongs to an older Grand Cherokee and there is no dipstick tube to use.",
      },
    ],
  },
  {
    id: "jeep-grand-cherokee-fuse-bulb",
    vehicleId: "2014-jeep-grand-cherokee-3.6l",
    title: "Fuse & Bulb Replacement",
    jobType: "fuse-bulb",
    summary:
      "Find the fuse boxes on a WK2 Grand Cherokee, test a fuse properly, and change an exterior bulb without guessing at the part number.",
    difficulty: "Easy",
    tier: "premium",
    estTime: "15-30 min",
    noFasteners: true,
    tools: [
      { name: "Fuse puller", note: "Usually clipped inside the underhood fuse box lid" },
      { name: "Test light or multimeter", note: "The only reliable way to tell a blown fuse from a good one" },
      { name: "Nitrile gloves", note: "Skin oil on a halogen bulb creates a hot spot and shortens its life" },
    ],
    parts: [
      "Replacement fuse of the identical amperage rating",
      "Replacement bulb - read the number off the old bulb, see step 4",
    ],
    safety: [
      "Never fit a fuse of higher amperage than the one that blew. The fuse is protecting wiring that cannot carry more current, and a larger fuse turns a dead circuit into a fire.",
      "A fuse that blows again immediately is telling you about a short. Stop replacing it and find the fault.",
      "Turn the lights off and let a halogen bulb cool before touching it. They run hot enough to burn.",
    ],
    torqueSpecs: [],
    steps: [
      {
        number: 1,
        title: "Find the right box",
        instructions:
          "The main Power Distribution Centre sits under the hood on the driver side. Unclip the lid and keep it - the fuse map is printed on its underside, and that map is specific to your build. Use it rather than a chart found online.",
      },
      {
        number: 2,
        title: "Identify the circuit before you pull anything",
        instructions:
          "Match the dead accessory to a labelled position on the lid map. Pulling fuses at random to find the bad one wastes time and risks breaking a good one in a tight socket.",
      },
      {
        number: 3,
        title: "Test rather than eyeball",
        instructions:
          "Blade fuses often fail with the element intact-looking. With the circuit live, touch a test light to each of the two exposed contacts on the top of the fuse. Light on both means the fuse is good. Light on one and not the other means it is blown. Replace with the same amperage and colour.",
        warning:
          "If you pull the fuse to inspect it, hold it up against a bright light. A hairline break in the element is easy to miss against a dark background.",
      },
      {
        number: 4,
        title: "For a bulb, read the old one",
        instructions:
          "Bulb fitments vary by trim and by whether the vehicle left the factory with halogen or HID projectors. Pull the old bulb and read the type number moulded into its base, or check the owner manual for your build. Do not buy from a generic year-make-model chart - those routinely list the wrong bulb for a trim the vehicle never had.",
        warning:
          "This is the single most common way people end up with the wrong part for this job. Thirty seconds reading the old bulb beats a return trip.",
      },
      {
        number: 5,
        title: "Fit the new bulb clean",
        instructions:
          "Handle a halogen capsule by its metal base only, never the glass. If you do touch the glass, wipe it with isopropyl alcohol before fitting. Seat it, twist to lock, and reconnect the plug until it clicks.",
      },
      {
        number: 6,
        title: "Test before you button up",
        instructions:
          "Switch the circuit on and confirm it works before refitting covers or the fuse box lid. Check high beam, low beam and the turn signal on that side - it is easy to disturb a neighbouring connector while working.",
      },
    ],
  },
  {
    id: "jeep-grand-cherokee-battery",
    vehicleId: "2014-jeep-grand-cherokee-3.6l",
    title: "Battery Replacement",
    jobType: "battery",
    summary:
      "Replace the battery on a WK2 Grand Cherokee, where it lives under the front passenger seat rather than under the hood.",
    difficulty: "Moderate",
    tier: "premium",
    estTime: "45-60 min",
    tools: [
      { name: "10 mm socket and ratchet", note: "Terminal nuts and the hold-down" },
      { name: "Socket extension", note: "The hold-down sits at the back of the tray, under the seat" },
      { name: "Torque wrench", note: "Low range - terminal hardware is easy to snap" },
      { name: "Terminal brush or wire brush" },
      { name: "Memory saver", note: "Optional, plugs into the OBD-II port to hold radio presets and settings" },
    ],
    parts: [
      "Group H7 (94R) AGM battery, roughly 800 CCA",
      "Terminal protectant spray or dielectric grease",
    ],
    safety: [
      "Disconnect the negative terminal first and reconnect it last. Touching a wrench between the positive post and any metal while the negative is still attached will arc hard.",
      "This vehicle takes an AGM battery. Fitting a conventional flooded battery in a cabin location is the wrong call - AGM is sealed and does not vent acid gas into the interior.",
      "The battery is heavy and you are lifting it out of a tray at an awkward angle from a kneeling position. Lift with the case, never by the terminals.",
      "Do not let the positive terminal touch the seat frame or any body metal while you are manoeuvring the battery out.",
    ],
    torqueSpecs: [
      {
        fastener: "Battery terminal clamp nuts",
        value: "5 ft-lb (7 Nm)",
        notes:
          "Curated reference figure. These are small fasteners into soft lead - snug and secure, not tight. Overtightening deforms the clamp or cracks the post. Confirm against the factory service manual.",
      },
      {
        fastener: "Battery hold-down bracket bolt",
        value: "9 ft-lb (12 Nm)",
        notes:
          "Curated reference figure. The hold-down only needs to stop the battery moving - it is not a structural fastener. Confirm against the factory service manual.",
      },
    ],
    steps: [
      {
        number: 1,
        title: "Know where you are going",
        instructions:
          "On the WK2 Grand Cherokee the battery is not under the hood. It sits in a tray beneath the front passenger seat. There is a jump-start post under the hood for boosting, which is what confuses people - the post is not the battery.",
        warning:
          "If a guide tells you to open the hood and lift the battery out, it is describing a different Grand Cherokee generation. Stop and check it matches 2011-2021.",
      },
      {
        number: 2,
        title: "Make room",
        instructions:
          "Slide the passenger seat fully rearward and recline the backrest to open up the footwell. Ignition off, key out of the vehicle. If you want to keep your radio presets and stored settings, plug a memory saver into the OBD-II port now.",
      },
      {
        number: 3,
        title: "Expose the battery",
        instructions:
          "Lift the floor covering and remove the access cover over the battery tray in the passenger footwell. Work the trim loose gently - the clips are plastic and cold plastic breaks.",
        warning:
          "Access details vary slightly across the 2011-2021 run and by trim. Look at what is actually in front of you rather than forcing anything that does not want to move.",
      },
      {
        number: 4,
        title: "Negative first",
        instructions:
          "Loosen the negative clamp nut with a 10 mm socket, lift the clamp off the post, and tuck it aside where it cannot spring back onto the terminal. Only then loosen and remove the positive clamp, and cover the positive post with its cap or a rag.",
      },
      {
        number: 5,
        title: "Release the hold-down and lift it out",
        instructions:
          "Remove the hold-down bracket bolt at the base of the battery - an extension helps reach it. Disconnect the battery vent hose if one is fitted. Lift the battery straight up and out, keeping it level.",
        warning:
          "If a vent hose is attached, it has to be transferred to the new battery. An AGM battery in a cabin location vents through that hose for a reason - do not leave it off.",
      },
      {
        number: 6,
        title: "Clean and fit the new battery",
        instructions:
          "Brush both cable clamps and the tray clean of corrosion. Set the new battery in with the posts oriented the same way as the old one, refit the vent hose, then fit the hold-down bracket and torque it to 9 ft-lb (12 Nm).",
      },
      {
        number: 7,
        title: "Positive first on the way back",
        instructions:
          "Reverse the disconnect order. Fit and torque the positive clamp to 5 ft-lb (7 Nm), then the negative. Spray both with terminal protectant. A small spark as the negative seats is normal.",
      },
      {
        number: 8,
        title: "Reassemble and check",
        instructions:
          "Refit the access cover and floor covering, return the seat to position, and start the engine. Expect to reset the clock and radio presets if you did not use a memory saver. Check that the power seats, windows and dash warning lights all behave normally before you call it done.",
      },
    ],
  },
];
