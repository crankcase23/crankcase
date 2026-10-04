import {
  KEYS_LADDER,
  VISUAL_UNLOCKED_COUNT,
  keysPriceForNthVehicle,
} from "@/lib/keysPricing";
import { IconLock } from "@/components/app/AppIcons";
import { display, Stamp } from "@/components/app/AppKit";

// Visual layer for "Keys" (the per-vehicle unlock). Matches the approved
// Vehicle Free / Locked mockup (clutch/26 board 3).
//
// VISUAL-ONLY. Nothing here reads or writes an unlock, starts checkout, or
// changes what the user can open: every guide, spec and log on the page stays
// reachable exactly as before because enforcement does not exist yet. The Keys
// chips mark where the approved design places the gate; the button is
// disabled and says so. Do not wire an onClick here -- checkout is a separate,
// not-yet-built package.

export function FreeChip() {
  return (
    <span className="cg-stamp inline-flex items-center whitespace-nowrap rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1.5 text-emerald-300">
      Free
    </span>
  );
}

export function KeysChip() {
  return (
    <span className="cg-stamp inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border border-white/20 bg-slate-950/50 px-2.5 py-1.5 text-slate-300">
      <IconLock className="h-3 w-3" />
      Keys
    </span>
  );
}

export function KeysPanel({ vehicleName }: { vehicleName: string }) {
  const next = VISUAL_UNLOCKED_COUNT + 1;
  const price = keysPriceForNthVehicle(next);
  return (
    <section
      className="cg-glass relative overflow-hidden rounded-2xl"
      aria-label="Get the Keys"
    >
      <div className="grid gap-x-10 gap-y-2 p-6 md:grid-cols-2 md:p-8">
        <div>
          <Stamp>Garage Rewards</Stamp>
          <h2
            className="mt-2 text-3xl font-extrabold uppercase leading-[0.95] text-slate-50 md:text-4xl"
            style={display}
          >
            Your vehicle is in the garage. Now get the <span className="text-orange-500">Keys.</span>
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-slate-300">
            One payment. Permanent access to everything Crankcase Garage does
            for this {vehicleName}.
          </p>
        </div>

        <div>
          <div className="mt-1 flex items-baseline gap-3 md:mt-0">
            <span className="font-mono text-5xl font-bold leading-none text-slate-50">
              ${price}
            </span>
            <span className="text-sm text-slate-400">first vehicle</span>
          </div>

          <ol
            className="mt-4 grid grid-cols-4 gap-2"
            aria-label="Garage Rewards price ladder"
          >
            {KEYS_LADDER.map((p, i) => (
              <li
                key={i}
                className={`cg-well rounded-lg px-2 py-2 text-center ${i === VISUAL_UNLOCKED_COUNT ? "!border-slate-300/70" : ""}`}
              >
                <div className="cg-stamp">
                  {i === KEYS_LADDER.length - 1
                    ? `${i + 1}th+`
                    : ["1st", "2nd", "3rd"][i]}
                </div>
                <div className="mt-1 font-mono text-base font-semibold text-slate-100">
                  ${p}
                </div>
              </li>
            ))}
          </ol>

          <button
            type="button"
            disabled
            className="mt-5 w-full cursor-not-allowed rounded-lg bg-orange-500/90 px-5 py-3 text-base font-semibold text-slate-950 opacity-70"
          >
            Get the Keys
          </button>
          <p className="mt-3 text-xs leading-relaxed text-slate-400">
            Checkout isn&apos;t open yet, so nothing is locked or charged today.
            One payment per vehicle, not a subscription. The free oil-change
            guide stays free either way.
          </p>
        </div>
      </div>
    </section>
  );
}
