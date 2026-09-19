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
  {
    id: "jeep-grand-cherokee-coolant",
    vehicleId: "2014-jeep-grand-cherokee-3.6l",
    title: "Coolant Drain & Fill",
    jobType: "coolant",
    summary:
      "Drain-and-refill the cooling system on the 3.6 Pentastar and burp the air out. Nothing is unbolted and no gasket is disturbed.",
    difficulty: "Moderate",
    tier: "premium",
    estTime: "60-90 min",
    noFasteners: true,
    tools: [
      { name: "Drain pan", note: "At least 3 gallons - system capacity is around 12.9 qt" },
      { name: "Long-neck funnel or spill-free funnel kit", note: "A spill-free funnel makes burping far easier" },
      { name: "Pliers", note: "For a hose clamp only if your radiator has no petcock" },
      { name: "Jack and jack stands", note: "Only if you cannot reach the petcock from above" },
    ],
    parts: [
      "Mopar Antifreeze/Coolant 10 Year/150,000 Mile Formula OAT, 50/50 premix - roughly 13 qt to refill the system",
      "Distilled water if you buy concentrate instead of premix",
    ],
    safety: [
      "Cold engine only. A hot cooling system is pressurised and will spray scalding coolant the moment the cap moves. If the upper hose is warm to the touch, stop and wait.",
      "Coolant is sweet-tasting and lethal to pets and wildlife. Catch every drop, keep the pan covered, and take the old fluid to a recycler.",
      "Never open the pressure cap as the first move. Release pressure only when the engine is genuinely cold.",
    ],
    torqueSpecs: [],
    steps: [
      {
        number: 1,
        title: "Confirm what is already in the system",
        instructions:
          "Read the underhood coolant label and look at the colour in the overflow bottle. This vehicle should have the 10 Year/150,000 Mile OAT formula. 2013-2014 is the changeover window for this generation, so some cars in this range left with the older orange HOAT chemistry.",
        warning:
          "Do not mix OAT and HOAT. Mixing the two chemistries is the scenario that turns coolant to gel and plugs a heater core. If you cannot tell what is in there, a full flush with distilled water first is the safe route.",
      },
      {
        number: 2,
        title: "Park cold and level",
        instructions:
          "Park on level ground, engine off and cold. Set the heater controls to full hot - that opens the heater core so it drains and fills with the rest of the system rather than trapping old fluid.",
      },
      {
        number: 3,
        title: "Position the pan and open the drain",
        instructions:
          "Slide the drain pan under the lower driver side of the radiator. Open the petcock by hand - it is plastic and turns with finger pressure. Then loosen the pressure cap to let the system breathe and the coolant will run freely.",
        warning:
          "The petcock is plastic and hand-tight by design. Do not put pliers or a wrench on it. Cracking that fitting turns a fluid change into a radiator replacement.",
      },
      {
        number: 4,
        title: "Let it drain out fully",
        instructions:
          "Give it fifteen to twenty minutes to stop dripping. A drain-and-fill recovers what is in the radiator and some of the block - expect to pull out less than full system capacity, which is normal and is why a second drain-and-fill a few hundred miles later is worth doing if the old fluid looked bad.",
      },
      {
        number: 5,
        title: "Close up and refill",
        instructions:
          "Close the petcock finger-tight. Fit the funnel to the filler neck and pour the new 50/50 premix in slowly. Slow pouring lets air escape instead of forming a pocket. Fill until the funnel holds a steady level above the neck.",
      },
      {
        number: 6,
        title: "Burp the air out",
        instructions:
          "With the funnel still fitted and full, start the engine and let it idle with the heater on full hot. As the thermostat opens you will see the level drop and bubbles come up through the funnel. Keep topping the funnel so it never runs dry. Continue until the bubbling stops and the upper hose is hot.",
        warning:
          "Watch the temperature gauge the entire time. If it climbs past normal, shut the engine off immediately - that means air is still trapped and the pump is not circulating.",
      },
      {
        number: 7,
        title: "Set the final level and check for leaks",
        instructions:
          "Shut the engine off, remove the funnel, fit the pressure cap, and set the overflow bottle to its cold MAX mark. Look under the car for drips at the petcock.",
      },
      {
        number: 8,
        title: "Re-check after a heat cycle",
        instructions:
          "Drive it, let it cool completely, then check the overflow bottle again. It is normal for the level to fall once as the last air works out. Top off cold to MAX and check once more after the next drive.",
      },
    ],
  },
  {
    id: "jeep-grand-cherokee-serpentine-belt",
    vehicleId: "2014-jeep-grand-cherokee-3.6l",
    title: "Serpentine Belt Replacement",
    jobType: "serpentine-belt",
    summary:
      "Swap the accessory drive belt on the 3.6 Pentastar. The automatic tensioner does the work - the whole job is releasing it and routing the new belt correctly.",
    difficulty: "Moderate",
    tier: "premium",
    estTime: "45-60 min",
    noFasteners: true,
    tools: [
      { name: "Serpentine belt tool or long breaker bar", note: "A belt tool with a swivel head earns its keep in a tight bay" },
      { name: "Socket to fit the tensioner pulley bolt", note: "Read the size off your own tensioner - do not assume" },
      { name: "Phone camera", note: "The single most important tool in this job, see step 2" },
    ],
    parts: ["Serpentine accessory drive belt for the 3.6L Pentastar"],
    safety: [
      "Engine off and cool, key out. A belt that starts turning with your hand in the drive will take fingers.",
      "The tensioner is spring-loaded and under real force. Keep your fingers clear of the pulley path and never let the bar slip while the tensioner is held back.",
    ],
    torqueSpecs: [],
    steps: [
      {
        number: 1,
        title: "Look for the routing label",
        instructions:
          "Check the underhood label and the radiator support for a belt routing diagram. If your vehicle still has one, it is the most trustworthy routing source you will find, because it matches the accessories this vehicle was actually built with.",
      },
      {
        number: 2,
        title: "Photograph the existing routing",
        instructions:
          "Before touching anything, take several clear photos of the belt path from different angles - which pulleys it wraps, and critically which ones it touches on the smooth back side versus the ribbed side. Do this even if you found a label.",
        warning:
          "A belt routed even one pulley wrong will squeal, shred, or drive the water pump backwards. Do not rely on memory and do not trust a generic diagram found online for a year-make-model - accessory layouts vary with options.",
      },
      {
        number: 3,
        title: "Inspect what you are replacing",
        instructions:
          "Look the old belt over as you work. Glazing, cracks across the ribs, or missing chunks explain a squeal. Also spin each idler and the tensioner pulley by hand once the belt is off - roughness or wobble means a bearing on the way out, and replacing the belt alone will not fix the noise.",
      },
      {
        number: 4,
        title: "Release the tensioner",
        instructions:
          "Fit the belt tool or breaker bar to the tensioner pulley bolt and rotate the tensioner arm to take the load off. Hold it there, slip the belt off the easiest accessible pulley - usually an idler - then let the tensioner down slowly.",
        warning:
          "Let the tensioner return under control. Letting it snap back can damage the internal damper.",
      },
      {
        number: 5,
        title: "Route the new belt",
        instructions:
          "Work the new belt onto every pulley except the last one, following your photos exactly. Make sure the ribs sit in the grooves everywhere and the smooth back only ever rides on a smooth idler.",
      },
      {
        number: 6,
        title: "Tension and seat it",
        instructions:
          "Release the tensioner again, slip the belt onto the final pulley, and ease the tensioner onto the belt. Walk around every pulley and confirm the belt is centred and fully seated in the grooves - a belt riding one rib off will destroy itself in minutes.",
      },
      {
        number: 7,
        title: "Run it and listen",
        instructions:
          "Start the engine and let it idle. Watch the belt track straight and listen for chirping. Shut it off, re-check that the belt is still seated on every pulley, and check again after a short drive.",
      },
    ],
  },
  {
    id: "jeep-grand-cherokee-pcv-valve",
    vehicleId: "2014-jeep-grand-cherokee-3.6l",
    title: "PCV Valve Replacement",
    jobType: "pcv-valve",
    summary:
      "Replace the PCV valve on the 3.6 Pentastar. A cheap twist-lock part with no torque spec and genuinely awful access - the hardest easy job on this engine.",
    difficulty: "Moderate",
    tier: "premium",
    estTime: "45-90 min",
    noFasteners: true,
    tools: [
      { name: "Long needle-nose pliers", note: "Reaching the release tab is the entire difficulty of this job" },
      { name: "Flashlight or inspection light" },
      { name: "Small mirror", note: "You will be working largely by feel - a mirror helps you learn the shape first" },
      { name: "Nitrile gloves" },
    ],
    parts: ["PCV valve, Mopar 68083202AC (supersedes 68083202AB)"],
    safety: [
      "Engine off and cool. The valve sits against the firewall next to hot exhaust and hot coolant lines.",
      "Expect a small amount of oil in the old valve. Have a rag ready so it does not end up down the back of the engine.",
    ],
    torqueSpecs: [],
    steps: [
      {
        number: 1,
        title: "Know what you are in for",
        instructions:
          "The PCV valve is on the rear of the passenger side valve cover, facing the firewall. It is a separate serviceable part - the intake does not have to come off - but it is close to invisible from above and most of the work happens by feel. Budget more time than the part cost suggests.",
        warning:
          "If a guide tells you to remove the intake manifold for this, it is describing the oil cooler job or a different engine. Removing the intake is not required to change the PCV valve.",
      },
      {
        number: 2,
        title: "Find it by hand",
        instructions:
          "Reach down behind the passenger side valve cover toward the firewall and locate the valve and the hose clipped to it. Use the mirror and light to build a picture of which way the release tab faces before you try to move anything.",
      },
      {
        number: 3,
        title: "Disconnect the hose",
        instructions:
          "Release the hose connector from the valve and set the hose aside where it will not fall further down the back of the engine.",
      },
      {
        number: 4,
        title: "Release the twist-lock",
        instructions:
          "The valve is a quarter-turn twist-lock, not a threaded fitting. Press and hold the release tab while rotating the valve counterclockwise. Doing both at once in that space is the part everyone struggles with - long needle-nose pliers on the tab give you the leverage your fingers cannot.",
        warning:
          "Do not simply wrench on it. It does not unscrew, and forcing it while the tab is still engaged is how the old valve gets snapped off in the cover.",
      },
      {
        number: 5,
        title: "Compare old and new before fitting",
        instructions:
          "Hold the two side by side and confirm the body, tab position and seal match. Tip the old one up - a small amount of oil inside is normal; heavy sludge suggests the engine is due for shorter oil intervals.",
      },
      {
        number: 6,
        title: "Fit the new valve",
        instructions:
          "Seat the new valve into the cover and rotate it clockwise until the tab clicks home. Tug it lightly - a valve that is not locked will work loose and throw a vacuum leak and a rough idle.",
      },
      {
        number: 7,
        title: "Reconnect and verify",
        instructions:
          "Click the hose connector back on, start the engine and listen. A steady idle and no hissing means the seal is good. A new whistle or a rough idle means the valve or the hose is not fully seated - go back and check it.",
      },
    ],
  },
  {
    id: "jeep-grand-cherokee-o2-sensor",
    vehicleId: "2014-jeep-grand-cherokee-3.6l",
    title: "Oxygen Sensor Replacement",
    jobType: "o2-sensor",
    summary:
      "Unbolt-and-rebolt replacement of an oxygen sensor on the 3.6 Pentastar, including how to tell which of the four the code is actually pointing at.",
    difficulty: "Moderate",
    tier: "premium",
    estTime: "45-90 min",
    tools: [
      { name: "Oxygen sensor socket", note: "7/8 in (22 mm) with a slot for the wiring pigtail" },
      { name: "Ratchet and extensions" },
      { name: "Penetrating oil" },
      { name: "Torque wrench" },
      { name: "OBD-II scanner", note: "To read the code and to clear it afterward" },
      { name: "Jack and jack stands", note: "For the downstream sensors" },
    ],
    parts: [
      "Oxygen sensor for the specific position named by your code - upstream and downstream are not interchangeable",
      "Anti-seize, only if the new sensor does not arrive pre-coated",
    ],
    safety: [
      "Exhaust components stay hot long after shutdown. Let the vehicle sit until the exhaust is cool enough to hold.",
      "Never work under a vehicle held up by a jack alone. Jack stands on solid ground, every time.",
      "A seized sensor in cold steel will round off or snap. Penetrating oil and patience beat brute force - a snapped sensor in the bung is a much bigger job.",
    ],
    torqueSpecs: [
      {
        fastener: "Oxygen sensor into exhaust bung",
        value: "30 ft-lb (41 Nm)",
        notes:
          "Curated reference figure. Overtightening strips the bung threads, which is the failure that turns this into exhaust work. Confirm against the factory service manual or the instructions packed with your sensor.",
      },
    ],
    steps: [
      {
        number: 1,
        title: "Read the code and identify the position",
        instructions:
          "Scan the vehicle and note the exact code. This engine has four sensors - upstream and downstream on each bank. Bank 1 and Bank 2 refer to cylinder banks and Sensor 1 is upstream of the catalyst, Sensor 2 downstream. Replacing the wrong one is the most common wasted afternoon on this job.",
        warning:
          "An oxygen sensor code does not always mean a failed sensor. An exhaust leak upstream of a sensor produces the same lean reading. Look for leaks before spending money.",
      },
      {
        number: 2,
        title: "Soak the threads early",
        instructions:
          "Spray penetrating oil on the sensor threads and let it sit. Twenty minutes is a reasonable minimum, longer is better on a high-mileage vehicle. Doing this first costs nothing and prevents most snapped sensors.",
      },
      {
        number: 3,
        title: "Get access",
        instructions:
          "Upstream sensors are usually reachable from above near the exhaust manifolds. Downstream sensors need the vehicle raised - jack it, set jack stands, and chock the wheels before going underneath.",
      },
      {
        number: 4,
        title: "Unplug before unscrewing",
        instructions:
          "Trace the sensor wiring to its connector and unplug it first, releasing any clips holding the harness. Turning the sensor with the connector still attached twists and destroys the pigtail.",
      },
      {
        number: 5,
        title: "Remove the sensor",
        instructions:
          "Fit the oxygen sensor socket with the pigtail through the slot and break the sensor loose counterclockwise. If it will not move, stop, re-soak and wait rather than leaning harder.",
      },
      {
        number: 6,
        title: "Fit the new one",
        instructions:
          "Check whether the new sensor came with anti-seize already on the threads - most do, and adding more is unnecessary. Keep anti-seize off the sensor tip entirely. Start it by hand to be certain it is not cross-threading, then torque to 30 ft-lb (41 Nm).",
        warning:
          "Hand-start it. Cross-threading an exhaust bung is the one mistake here that cannot be undone in a driveway.",
      },
      {
        number: 7,
        title: "Reconnect, clear and confirm",
        instructions:
          "Plug the connector back in and secure the harness away from the exhaust. Lower the vehicle, clear the code with your scanner, and drive it. The light staying off through a few drive cycles is the confirmation - if it returns, the sensor was not the fault.",
      },
    ],
  },
];
