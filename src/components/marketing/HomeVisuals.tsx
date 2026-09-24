import Image from "next/image";

// ---------------------------------------------------------------------------
// Visual layer for the marketing homepage: the hero backdrop, the line-drawn
// vehicle, and the small mechanical icon set. Pure SVG/CSS, no client code,
// no animation. Everything here is decoration -- every element is aria-hidden
// and the page reads identically with this file deleted.
//
// Design target: "Modern Performance Garage, restrained edition". Atmosphere
// comes from depth (graphite panels, seams, a faint service-manual grid, one
// warm practical light) rather than from photography or glow. Orange is
// reserved for the primary CTA, the section eyebrow, and the numbers that are
// specific to the reader's vehicle.
// ---------------------------------------------------------------------------

/**
 * Optional hero photograph. Leave null until there is a production-ready,
 * properly licensed image; the backdrop then renders the line-drawn vehicle
 * instead. When set, the image is placed BEHIND the overlay gradients so the
 * headline never has to fight it -- expect it to read at roughly 30-40%.
 *
 * Brief for the eventual photo: an ordinary vehicle in a home garage or
 * driveway, partially in frame, desaturated, lit warm from one side. Not a
 * lifted truck, not a muscle car, not a race bay.
 */
export type HeroImage = { src: string; alt: string };
export const HERO_IMAGE: HeroImage | null = null;

export function HeroBackdrop({ image = HERO_IMAGE }: { image?: HeroImage | null }) {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
      {/* base: deep navy fading to near-black, lighter toward the top-left */}
      <div className="absolute inset-0 bg-[radial-gradient(120%_90%_at_18%_0%,#111a2e_0%,#070d1a_45%,#020617_100%)]" />

      {/* service-manual grid, dissolving toward the bottom */}
      <div className="cg-grid absolute inset-0 [mask-image:linear-gradient(to_bottom,rgba(0,0,0,0.8),transparent_88%)]" />

      {/* one warm practical light, as if from a bay lamp above the workbench */}
      <div className="absolute -left-32 -top-44 h-[30rem] w-[40rem] rounded-full bg-orange-500/[0.09] blur-3xl" />

      {image ? (
        <>
          <Image
            src={image.src}
            alt=""
            fill
            priority
            sizes="100vw"
            className="object-cover object-right-bottom opacity-40 grayscale-[35%]"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-slate-950 via-slate-950/85 to-slate-950/40" />
          <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-transparent to-slate-950/70" />
        </>
      ) : (
        <>
          {/* desktop / tablet: the vehicle sits low and right, wheels on the proof-strip "floor" */}
          <VehicleLinework className="absolute bottom-10 -right-24 hidden w-[48rem] max-w-none text-slate-300 opacity-[0.17] sm:block lg:bottom-12 lg:-right-20 lg:w-[54rem]" />
          {/* mobile: a compact establishing element behind the headline, cropped at the right edge */}
          <VehicleLinework className="absolute -right-36 top-4 w-[30rem] max-w-none text-slate-300 opacity-[0.14] sm:hidden" />
        </>
      )}

      {/* bay floor: the bottom of the hero settles into the proof strip */}
      <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-slate-950/90 to-transparent" />
    </div>
  );
}

/**
 * A generic crossover in side elevation, drawn as technical linework. It is
 * deliberately no particular make -- Crankcase is for the Pathfinder and the
 * Grand Cherokee alike -- and deliberately not a photograph, so it stays a
 * background texture rather than a subject.
 */
export function VehicleLinework({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 720 300"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      {/* body */}
      <path d="M52 236 L40 202 L44 172 L72 150 L250 132 L302 128 L338 86 Q352 74 382 72 L518 72 Q558 74 580 96 L618 150 L640 172 L640 224 L620 240 L596 240 A56 56 0 0 0 484 240 L246 240 A56 56 0 0 0 134 240 L52 236 Z" />
      {/* glass */}
      <path d="M318 128 L346 88 L382 80 L446 80 L446 128 Z" />
      <path d="M456 80 L518 80 Q548 82 568 102 L592 128 L456 128 Z" />
      {/* door seams, handles, mirror */}
      <path d="M451 128 L451 234" />
      <path d="M592 128 L586 234" strokeOpacity={0.6} />
      <rect x="404" y="150" width="24" height="5" rx="2.5" />
      <rect x="506" y="150" width="24" height="5" rx="2.5" />
      <path d="M302 128 L296 118 L318 116 L322 128" />
      {/* lights */}
      <path d="M46 162 L92 152 L98 164 L54 172 Z" />
      <rect x="628" y="150" width="12" height="26" rx="2" />
      {/* rocker */}
      <path d="M142 224 L478 224" strokeOpacity={0.6} />
      {/* wheels */}
      <g>
        <circle cx="190" cy="232" r="46" />
        <circle cx="190" cy="232" r="28" strokeOpacity={0.8} />
        <circle cx="190" cy="232" r="5" />
        <path d="M190 204 L190 227 M216 224 L195 231 M206 254 L193 237 M174 254 L187 237 M164 224 L185 231" strokeOpacity={0.6} />
      </g>
      <g>
        <circle cx="540" cy="232" r="46" />
        <circle cx="540" cy="232" r="28" strokeOpacity={0.8} />
        <circle cx="540" cy="232" r="5" />
        <path d="M540 204 L540 227 M566 224 L545 231 M556 254 L543 237 M524 254 L537 237 M514 224 L535 231" strokeOpacity={0.6} />
      </g>
      {/* ground and one dimension line -- spec-sheet cue, nothing more */}
      <path d="M20 280 L700 280" strokeOpacity={0.5} />
      <path d="M190 288 L190 296 M540 288 L540 296 M190 292 L540 292" strokeOpacity={0.45} strokeWidth={1} />
      <path d="M40 40 L40 52 M34 46 L46 46 M680 40 L680 52 M674 46 L686 46" strokeOpacity={0.4} strokeWidth={1} />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Icons. 24x24, stroke-based, currentColor. Kept deliberately small in number.
// ---------------------------------------------------------------------------

type IconProps = { className?: string };

function IconBase({ className, children }: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      {children}
    </svg>
  );
}

export function IconCar(p: IconProps) {
  return (
    <IconBase {...p}>
      <path d="M3 13l2.2-5.3A1.5 1.5 0 0 1 6.6 7h10.8a1.5 1.5 0 0 1 1.4.7L21 13v5.5a.5.5 0 0 1-.5.5H19a2 2 0 1 1-4 0H9a2 2 0 1 1-4 0H3.5a.5.5 0 0 1-.5-.5V13z" />
      <path d="M3 13h18M6.5 16h1M16.5 16h1" />
    </IconBase>
  );
}

export function IconClipboard(p: IconProps) {
  return (
    <IconBase {...p}>
      <rect x="5" y="4" width="14" height="17" rx="2" />
      <path d="M9 2.5h6v3H9zM9 11h6M9 15h4" />
    </IconBase>
  );
}

export function IconClipboardCheck(p: IconProps) {
  return (
    <IconBase {...p}>
      <rect x="5" y="4" width="14" height="17" rx="2" />
      <path d="M9 2.5h6v3H9zM8.5 13l2.5 2.5 4.5-5" />
    </IconBase>
  );
}

export function IconWrench(p: IconProps) {
  return (
    <IconBase {...p}>
      <path d="M14.5 6.5a4.2 4.2 0 0 0-5.3 5.3L3 18l3 3 6.2-6.2a4.2 4.2 0 0 0 5.3-5.3l-2.6 2.6-2.5-.6-.6-2.5z" />
    </IconBase>
  );
}

export function IconGauge(p: IconProps) {
  return (
    <IconBase {...p}>
      <path d="M4.5 16.5a8 8 0 1 1 15 0" />
      <path d="M12 16.5l4-5.5" />
      <circle cx="12" cy="16.5" r="1.2" fill="currentColor" stroke="none" />
    </IconBase>
  );
}

export function IconClock(p: IconProps) {
  return (
    <IconBase {...p}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5V12l3 2" />
    </IconBase>
  );
}

export function IconSteps(p: IconProps) {
  return (
    <IconBase {...p}>
      <path d="M8 6h12M8 12h12M8 18h12" />
      <circle cx="4" cy="6" r="1" fill="currentColor" stroke="none" />
      <circle cx="4" cy="12" r="1" fill="currentColor" stroke="none" />
      <circle cx="4" cy="18" r="1" fill="currentColor" stroke="none" />
    </IconBase>
  );
}

export function IconBox(p: IconProps) {
  return (
    <IconBase {...p}>
      <path d="M3 8l9-4.5L21 8v8.5L12 21l-9-4.5z" />
      <path d="M3 8l9 4.5L21 8M12 12.5V21" />
    </IconBase>
  );
}

export function IconShield(p: IconProps) {
  return (
    <IconBase {...p}>
      <path d="M12 3l7.5 2.8v5.7c0 4.6-3.2 7.9-7.5 9.5-4.3-1.6-7.5-4.9-7.5-9.5V5.8z" />
      <path d="M12 8.5v4.5M12 16h.01" />
    </IconBase>
  );
}

export function IconHex(p: IconProps) {
  return (
    <IconBase {...p}>
      <path d="M12 2.8l8 4.6v9.2l-8 4.6-8-4.6V7.4z" />
      <circle cx="12" cy="12" r="3" />
    </IconBase>
  );
}

export function IconTarget(p: IconProps) {
  return (
    <IconBase {...p}>
      <circle cx="12" cy="12" r="8" />
      <circle cx="12" cy="12" r="3" />
      <path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
    </IconBase>
  );
}

/** Stamped micro-label: mono, tracked, quiet. The "printed on the panel" voice. */
export function Stamp({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <span className={`cg-stamp ${className}`}>{children}</span>;
}
