import { display } from "@/components/app/AppKit";

// Shared chapter framing for the lower half of Vehicle Home: a quiet eyebrow,
// the display-face title, an optional chip and one line of lede, then the
// content with real breathing room. The panel class is the dark glass the
// homepage and My Garage use. Server-safe (no hooks).

export const PANEL = "vh-panel rounded-2xl";

export function Chapter({
  eyebrow,
  title,
  chip,
  lede,
  children,
  className = "mt-16 sm:mt-20",
}: {
  eyebrow?: string;
  title: string;
  chip?: React.ReactNode;
  lede?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={className}>
      <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-2">
        <div className="min-w-0">
          {eyebrow ? (
            <p className="text-[0.72rem] font-extrabold uppercase tracking-[0.22em] text-orange-400" style={display}>
              {eyebrow}
            </p>
          ) : null}
          <h2 className="cg-section-title mt-1 !text-[1.9rem] sm:!text-[2.4rem]">{title}</h2>
        </div>
        {chip ? <div className="pb-1">{chip}</div> : null}
      </div>
      {lede ? <div className="mt-3 max-w-2xl text-[0.95rem] leading-relaxed text-slate-400">{lede}</div> : null}
      <div className="mt-6">{children}</div>
    </section>
  );
}
