import {
  KEYS_LADDER,
  VISUAL_UNLOCKED_COUNT,
  keysPriceForNthVehicle,
} from "@/lib/keysPricing";
import { IconLock } from "@/components/app/AppIcons";
import { display } from "@/components/app/AppKit";

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
      <span
        aria-hidden
        className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-orange-500/70 to-transparent"
      />
      <div className="grid items-center gap-x-12 gap-y-6 p-6 md:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] md:p-8">
        <div>
          <p className="inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-orange-400">
            <IconLock className="h-3.5 w-3.5" />
            Keys
          </p>
          <h2
            className="mt-2 text-[1.9rem] font-extrabold uppercase leading-[0.98] text-slate-50 sm:text-4xl"
            style={display}
          >
            Your vehicle is in the garage. Now get the <span className="text-orange-500">Keys.</span>
          </h2>
          <p className="mt-3 max-w-md text-sm leading-relaxed text-slate-300">
            One payment. Permanent access to everything Crankcase Garage does
            for this {vehicleName}.
          </p>
        </div>

        <div>
          <div className="flex items-baseline gap-2.5">
            <span className="font-mono text-4xl font-bold leading-none text-slate-50">
              ${price}
            </span>
            <span className="text-sm text-slate-400">first vehicle</span>
          </div>

          <ol
            className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[13px] text-slate-400"
            aria-label="Price per vehicle"
          >
            {KEYS_LADDER.map((p, i) => (
              <li
                key={i}
                className={i === VISUAL_UNLOCKED_COUNT ? "text-slate-100" : undefined}
              >
                <span className="text-slate-500">
                  {i === KEYS_LADDER.length - 1 ? `${i + 1}th+` : ["1st", "2nd", "3rd"][i]}
                </span>{" "}
                <span className="font-mono font-semibold">${p}</span>
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
          <p className="mt-3 text-xs leading-relaxed text-slate-500">
            Checkout isn&apos;t open yet, so nothing is locked or charged today.
            One payment per vehicle, not a subscription. The free oil-change
            guide stays free either way.
          </p>
        </div>
      </div>
    </section>
  );
}
