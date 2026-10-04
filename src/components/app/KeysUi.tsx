import { VISUAL_UNLOCKED_COUNT, keysPriceForNthVehicle } from "@/lib/keysPricing";
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

export function KeysPanel({ vehicleName, backdrop }: { vehicleName: string; backdrop?: React.ReactNode }) {
  // Presentation only: the first rung of the published ladder. The full Garage
  // Rewards ladder lives on the Pricing page, not here.
  const price = keysPriceForNthVehicle(VISUAL_UNLOCKED_COUNT + 1);
  return (
    <section
      className="vh-panel relative isolate overflow-hidden rounded-2xl"
      aria-label="Get the Keys"
    >
      <span
        aria-hidden
        className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-orange-500/70 to-transparent"
      />
      {backdrop ? (
        <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 opacity-[0.3] [mask-image:linear-gradient(to_right,transparent_35%,black_90%)]">
          {backdrop}
        </div>
      ) : null}
      <span
        aria-hidden
        className="pointer-events-none absolute -right-20 -top-24 -z-10 h-72 w-[28rem] bg-[radial-gradient(closest-side,rgba(251,146,60,0.16),transparent)]"
      />
      <div className="grid items-center gap-x-10 gap-y-5 p-6 md:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)] md:p-8">
        <div>
          <p className="inline-flex items-center gap-2 text-[0.7rem] font-extrabold uppercase tracking-[0.24em] text-orange-400" style={display}>
            <IconLock className="h-3.5 w-3.5" />
            Keys
          </p>
          <h2
            className="mt-2 text-[2rem] font-extrabold uppercase leading-[0.96] text-slate-50 sm:text-[2.6rem]"
            style={display}
          >
            Your vehicle is in the garage. Now get the <span className="text-orange-500">Keys.</span>
          </h2>
        </div>

        <div>
          <p className="text-xl font-semibold text-slate-50">
            <span className="font-mono text-3xl font-bold">${price}</span>{" "}
            <span className="text-slate-300">to get your first set of Keys</span>
          </p>
          <p className="mt-2 text-sm leading-relaxed text-slate-300">
            One-time payment. Permanent access for this {vehicleName}. No subscription.
          </p>
          <button
            type="button"
            disabled
            className="mt-4 w-full cursor-not-allowed rounded-lg bg-orange-500/90 px-5 py-3 text-base font-semibold text-slate-950 opacity-70"
          >
            Get the Keys
          </button>
          <p className="mt-3 text-xs leading-relaxed text-slate-500">
            Garage Rewards apply to additional vehicles. Checkout isn&apos;t open yet, so nothing is locked or charged today.
          </p>
        </div>
      </div>
    </section>
  );
}
