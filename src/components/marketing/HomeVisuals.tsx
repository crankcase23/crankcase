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
      {/* base: a dark ROOM, not a dark div. Lit from the upper right where the
          tube lights hang, falling to near-black at the edges. */}
      <div className="absolute inset-0 bg-[radial-gradient(110%_85%_at_78%_8%,#1c2742_0%,#0f1830_38%,#070d1c_70%,#020617_100%)]" />

      {/* service-manual grid on the back wall, gone by the floor line */}
      <div className="cg-grid absolute inset-0 [mask-image:linear-gradient(to_bottom,rgba(0,0,0,0.55),transparent_62%)]" />

      {/* overhead tube lights: two thin bars with a cool bloom, top right */}
      <div className="absolute right-4 top-6 h-px w-36 bg-slate-100/60 sm:hidden" />
      <div className="absolute right-4 top-6 h-4 w-36 -translate-y-1/2 bg-slate-200/15 blur-lg sm:hidden" />
      <div className="absolute right-[6%] top-8 hidden h-px w-[22rem] bg-slate-100/80 sm:block lg:top-10 lg:w-[30rem]" />
      <div className="absolute right-[6%] top-8 hidden h-6 w-[22rem] -translate-y-1/2 bg-slate-200/20 blur-xl sm:block lg:top-10 lg:w-[30rem]" />
      <div className="absolute right-[40%] top-[4.25rem] hidden h-px w-40 bg-slate-100/45 lg:block" />
      <div className="absolute right-[40%] top-[4.25rem] hidden h-5 w-40 -translate-y-1/2 bg-slate-200/15 blur-lg lg:block" />
      {/* the same light, falling on the back wall */}
      <div className="absolute right-[-10%] top-[-30%] h-[60rem] w-[60rem] rounded-full bg-slate-300/[0.05] blur-3xl" />

      {/* floor plane: a perspective grid that starts a third of the way down */}
      <FloorPlane className="absolute inset-x-0 bottom-0 h-[46%] w-full text-slate-300 opacity-70 sm:h-[42%]" />

      {/* warm floor pool under the vehicle -- low and wide, never behind text */}
      <div className="absolute bottom-[-6rem] right-[-4rem] h-56 w-[52rem] rounded-[100%] bg-orange-400/[0.11] blur-3xl" />

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
          {/* desktop / tablet: the vehicle is anchored to the viewport's right
              edge with its wheels on the floor; the guide card sits over its
              rear quarter like a manual laid on the fender */}
          <VehicleLinework
            tonal
            className="absolute -right-24 bottom-1 hidden w-[48rem] max-w-none text-slate-300 opacity-[0.7] sm:block lg:-right-24 lg:w-[56rem]"
          />
          {/* mobile: low and cropped at the right edge, behind the card */}
          <VehicleLinework
            tonal
            className="absolute -right-40 bottom-1 w-[34rem] max-w-none text-slate-300 opacity-[0.45] sm:hidden"
          />
        </>
      )}

      {/* copy protection: the left third goes dark so the headline never
          fights the scene (mobile: top-to-bottom instead) */}
      <div className="absolute inset-0 hidden bg-gradient-to-r from-slate-950/90 via-slate-950/45 to-transparent sm:block" />
      <div className="absolute inset-0 bg-gradient-to-b from-slate-950/85 via-slate-950/40 to-slate-950/10 sm:hidden" />
      {/* vignette */}
      <div className="absolute inset-0 bg-[radial-gradient(95%_85%_at_50%_45%,transparent_55%,rgba(2,6,23,0.75)_100%)]" />
    </div>
  );
}

/**
 * Perspective floor. Lines converge on a vanishing point above the top edge;
 * horizontals bunch toward the horizon. Masked so it fades into the wall.
 */
export function FloorPlane({ className }: { className?: string }) {
  // 1600 x 400 box; vanishing point at (800, -260).
  const vpX = 800;
  const vpY = -260;
  const verticals = Array.from({ length: 21 }, (_, i) => -1200 + i * 200);
  const horizontals = [0.08, 0.17, 0.28, 0.41, 0.56, 0.74, 0.94];
  return (
    <svg
      viewBox="0 0 1600 400"
      preserveAspectRatio="none"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth={1}
      aria-hidden
      style={{ maskImage: "linear-gradient(to bottom, transparent 0%, rgba(0,0,0,0.95) 40%, rgba(0,0,0,0.8) 100%)" }}
    >
      <g strokeOpacity={0.3}>
        {verticals.map((x) => (
          <line key={x} x1={vpX} y1={vpY} x2={x} y2={400} />
        ))}
      </g>
      <g strokeOpacity={0.34}>
        {horizontals.map((t) => (
          <line key={t} x1={0} y1={t * 400} x2={1600} y2={t * 400} />
        ))}
      </g>
      {/* the floor line itself */}
      <line x1={0} y1={0.5} x2={1600} y2={0.5} strokeOpacity={0.4} />
    </svg>
  );
}

/**
 * A generic crossover in side elevation. It is deliberately no particular
 * make -- Crankcase is for the Pathfinder and the Grand Cherokee alike -- and
 * deliberately not a photograph.
 *
 * `tonal` fills the body, glass and tires so the vehicle has mass and a
 * shadow on the floor; without it the drawing is pure linework.
 */
export function VehicleLinework({ className, tonal = false }: { className?: string; tonal?: boolean }) {
  const body =
    "M52 236 L40 202 L44 172 L72 150 L250 132 L302 128 L338 86 Q352 74 382 72 L518 72 Q558 74 580 96 L618 150 L640 172 L640 224 L620 240 L596 240 A56 56 0 0 0 484 240 L246 240 A56 56 0 0 0 134 240 L52 236 Z";
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
      {tonal && (
        <defs>
          <filter id="cg-veh-shadow" x="-20%" y="-50%" width="140%" height="200%">
            <feGaussianBlur stdDeviation="14" />
          </filter>
          <linearGradient id="cg-veh-body" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="currentColor" stopOpacity="0.34" />
            <stop offset="0.55" stopColor="currentColor" stopOpacity="0.16" />
            <stop offset="1" stopColor="currentColor" stopOpacity="0.06" />
          </linearGradient>
        </defs>
      )}
      {tonal && (
        <>
          {/* contact shadow on the floor */}
          <ellipse cx="365" cy="282" rx="330" ry="16" fill="#000" fillOpacity="0.55" filter="url(#cg-veh-shadow)" stroke="none" />
          {/* body mass, lit from above */}
          <path d={body} fill="url(#cg-veh-body)" stroke="none" />
          {/* glass, a touch darker than the panel */}
          <path d="M318 128 L346 88 L382 80 L446 80 L446 128 Z" fill="#020617" fillOpacity="0.35" stroke="none" />
          <path d="M456 80 L518 80 Q548 82 568 102 L592 128 L456 128 Z" fill="#020617" fillOpacity="0.35" stroke="none" />
          {/* tires */}
          <circle cx="190" cy="232" r="46" fill="#020617" fillOpacity="0.6" stroke="none" />
          <circle cx="540" cy="232" r="46" fill="#020617" fillOpacity="0.6" stroke="none" />
          <circle cx="190" cy="232" r="28" fill="currentColor" fillOpacity="0.08" stroke="none" />
          <circle cx="540" cy="232" r="28" fill="currentColor" fillOpacity="0.08" stroke="none" />
        </>
      )}
      <g strokeOpacity={tonal ? 0.5 : 1}>
        {/* body */}
        <path d={body} />
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
      </g>
      {tonal ? (
        /* highlight along the roof and hood: the light is above and to the right */
        <path d="M76 149 L250 131 L302 127 M340 85 Q352 74 382 72 L518 72 Q558 74 580 96" strokeOpacity={0.9} strokeWidth={2} />
      ) : (
        <>
          {/* ground and one dimension line -- spec-sheet cue, nothing more */}
          <path d="M20 280 L700 280" strokeOpacity={0.5} />
          <path d="M190 288 L190 296 M540 288 L540 296 M190 292 L540 292" strokeOpacity={0.45} strokeWidth={1} />
          <path d="M40 40 L40 52 M34 46 L46 46 M680 40 L680 52 M674 46 L686 46" strokeOpacity={0.4} strokeWidth={1} />
        </>
      )}
    </svg>
  );
}

/**
 * Tool-chest drawer fronts, as a repeating pattern for the jobs band. Seams,
 * a pull bar per drawer, nothing else. Meant to be read at 4-6% opacity.
 */
export function DrawerTexture({ className }: { className?: string }) {
  return (
    <svg className={className} aria-hidden>
      <defs>
        <pattern id="cg-drawers" width="360" height="72" patternUnits="userSpaceOnUse">
          <rect x="0.5" y="0.5" width="359" height="71" fill="none" stroke="currentColor" strokeOpacity="0.7" />
          <line x1="0" y1="1.5" x2="360" y2="1.5" stroke="#fff" strokeOpacity="0.3" />
          <rect x="140" y="31" width="80" height="6" rx="3" fill="currentColor" fillOpacity="0.6" />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#cg-drawers)" />
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

export function IconArrowRight(p: IconProps) {
  return (
    <IconBase {...p}>
      <path d="M5 12h14M13 6l6 6-6 6" />
    </IconBase>
  );
}

export function IconPlay(p: IconProps) {
  return (
    <IconBase {...p}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M10 8.5v7l5.5-3.5z" fill="currentColor" stroke="none" />
    </IconBase>
  );
}

export function IconBolt(p: IconProps) {
  return (
    <IconBase {...p}>
      <path d="M13 2.5L4.5 13.5H11L10 21.5l8.5-11H12z" />
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
