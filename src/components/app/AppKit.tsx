import Link from "next/link";
import { Stamp } from "@/components/marketing/HomeVisuals";

// ---------------------------------------------------------------------------
// Shared building blocks for the signed-in app ("Modern Performance Garage,
// restrained edition"). These are the SAME tokens the approved homepage uses,
// lifted out so the app interior wears them identically instead of re-guessing:
//
//   - graphite panels (cg-panel), recessed wells (cg-well), stamped micro-labels
//     (cg-stamp), the faint drafting grid (cg-grid): src/app/globals.css
//   - Big Shoulders Display for headings only, never body copy
//   - orange spent on: the primary CTA, the eyebrow hairline + label, and the
//     numbers/states that are specific to the user's own vehicle. Everything
//     else is off-white, steel and blue-gray; emerald means "good".
//   - one focus ring for every button-shaped link
//
// Server-safe: no hooks, no client code. Import freely from either side.
// ---------------------------------------------------------------------------

export const display = { fontFamily: "var(--font-display)" } as const;

export const FOCUS =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-400";
export const BTN_PRIMARY = `inline-flex items-center justify-center gap-2 rounded-lg bg-orange-500 px-5 py-2.5 font-semibold text-slate-950 shadow-lg shadow-black/40 hover:bg-orange-400 ${FOCUS}`;
export const BTN_SECONDARY = `inline-flex items-center justify-center gap-2 rounded-lg border border-slate-600 bg-slate-900/50 px-5 py-2.5 font-semibold text-slate-200 hover:border-slate-400 hover:text-white ${FOCUS}`;

/** Orange hairline + tracked display label. Same component shape as the homepage's. */
export function Eyebrow({ children, as: Tag = "p" }: { children: React.ReactNode; as?: "p" | "h2" }) {
  return (
    <Tag className="flex items-center gap-3">
      <span className="h-px w-8 shrink-0 bg-orange-500" aria-hidden />
      <span className="text-xs font-extrabold uppercase tracking-[0.22em] text-orange-400" style={display}>
        {children}
      </span>
    </Tag>
  );
}

/** Page title block: eyebrow, display H1, optional lede. Actions sit to the right on wide screens. */
export function AppPageHeader({
  eyebrow,
  title,
  lede,
  actions,
}: {
  eyebrow: string;
  title: string;
  lede?: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-5">
      <div className="min-w-0">
        <Eyebrow>{eyebrow}</Eyebrow>
        <h1
          className="mt-3 text-5xl font-extrabold uppercase leading-[0.95] tracking-tight text-slate-50 sm:text-6xl"
          style={display}
        >
          {title}
        </h1>
        {lede ? <p className="mt-3 max-w-2xl text-slate-400">{lede}</p> : null}
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap items-center gap-4">{actions}</div> : null}
    </div>
  );
}

type ChipTone = "ready" | "neutral" | "attention";
const CHIP: Record<ChipTone, string> = {
  ready: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
  neutral: "border-slate-600 bg-slate-900/60 text-slate-300",
  attention: "border-orange-500/40 bg-orange-500/10 text-orange-300",
};

/** Pill used for state ("Specs ready", "No curated specs yet"). Mono stamp type, never a button. */
export function StatusChip({ tone = "neutral", children }: { tone?: ChipTone; children: React.ReactNode }) {
  return (
    <span
      className={`cg-stamp inline-flex items-center whitespace-nowrap rounded-full border px-2.5 py-1.5 ${CHIP[tone]}`}
    >
      {children}
    </span>
  );
}

/** Text link with the homepage's arrow, for in-panel navigation. */
export function ArrowLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className={`inline-flex items-center gap-1 text-sm font-medium text-orange-400 hover:text-orange-300 ${FOCUS}`}>
      {children} <span aria-hidden>&rarr;</span>
    </Link>
  );
}

export { Stamp };
