import { DrawerTexture, FloorPlane, VehicleLinework } from "@/components/marketing/HomeVisuals";

// ---------------------------------------------------------------------------
// Cinematic scene layers for the marketing hero and the interior page heads.
// Pure CSS/SVG, decorative, aria-hidden. Lives beside HomeVisuals.tsx rather
// than inside it so the earlier homepage visuals stay untouched.
//
// The approved mockup (Website Theme 1) is a photographic garage: a dark bay,
// warm overhead practicals, a tool chest on the left, wet concrete, and a
// vehicle lit from the side. We do not have a licensed photograph, so this
// builds the same room out of light: lamp cones, a warm floor pool, bokeh,
// the tool chest, and the vehicle drawn tonally with a rim light. A photo can
// replace `scene` later without touching any page that uses it.
// ---------------------------------------------------------------------------

/** Soft warm out-of-focus practicals. Positions are % of the container. */
const BOKEH: { x: string; y: string; s: number; o: number; c: string }[] = [
  { x: "62%", y: "34%", s: 14, o: 0.55, c: "#fdba74" },
  { x: "70%", y: "27%", s: 9, o: 0.45, c: "#fed7aa" },
  { x: "88%", y: "40%", s: 18, o: 0.4, c: "#fb923c" },
  { x: "93%", y: "22%", s: 10, o: 0.5, c: "#fde68a" },
  { x: "55%", y: "20%", s: 8, o: 0.35, c: "#fdba74" },
  { x: "80%", y: "58%", s: 12, o: 0.3, c: "#fb923c" },
];

export function CinematicScene({ variant = "hero" }: { variant?: "hero" | "page" | "band" }) {
  const hero = variant === "hero";
  const band = variant === "band";
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
      {/* the room: near-black, cool at the edges, a little warm where the lamps hang */}
      <div className="absolute inset-0 bg-[radial-gradient(95%_80%_at_72%_18%,#16202e_0%,#0b121c_46%,#05080e_100%)]" />

      {/* tool chest on the left wall: drawer fronts, masked to dissolve */}
      <DrawerTexture
        className={`absolute inset-y-0 left-0 h-full w-[46%] text-slate-300 [mask-image:linear-gradient(to_right,rgba(0,0,0,0.9),transparent_85%)] ${
          hero ? "opacity-[0.10]" : "opacity-[0.07]"
        }`}
      />

      {/* overhead practicals: two lamp bars with a bloom and a light cone down the wall */}
      <div className="absolute right-[8%] top-0 h-[62%] w-[34rem] bg-[conic-gradient(from_180deg_at_50%_0%,transparent_158deg,rgba(253,186,116,0.2)_180deg,transparent_202deg)]" />
      <div className="absolute right-[30%] top-0 h-[52%] w-[26rem] bg-[conic-gradient(from_180deg_at_50%_0%,transparent_162deg,rgba(253,186,116,0.14)_180deg,transparent_198deg)]" />
      <div className="absolute right-[10%] top-[1.6rem] h-[3px] w-[18rem] rounded-full bg-orange-100/90 shadow-[0_0_28px_8px_rgba(253,186,116,0.45)] sm:w-[26rem]" />
      <div className="absolute right-[34%] top-[2.6rem] hidden h-[3px] w-[10rem] rounded-full bg-orange-100/70 shadow-[0_0_22px_6px_rgba(253,186,116,0.3)] lg:block" />

      {/* floor: wet-concrete perspective and a warm pool where the vehicle stands */}
      <FloorPlane className="absolute inset-x-0 bottom-0 h-[44%] w-full text-slate-300 opacity-[0.38]" />
      <div className="absolute -bottom-10 right-[-6rem] h-48 w-[56rem] rounded-[100%] bg-orange-400/[0.24] blur-3xl" />

      {/* the vehicle: tonal drawing, rim-lit, with its own contact shadow */}
      {hero && (
        <>
          <div className="absolute bottom-3 right-[2rem] h-8 w-[44rem] rounded-[100%] bg-black/80 blur-2xl max-sm:hidden" />
          <VehicleLinework
            tonal
            className="absolute bottom-5 right-[1rem] w-[46rem] max-w-none text-slate-200 opacity-[0.8] drop-shadow-[0_0_30px_rgba(251,146,60,0.22)] max-sm:right-[-12rem] max-sm:w-[36rem] max-sm:opacity-[0.35] lg:w-[50rem]"
          />
        </>
      )}

      {/* a shorter band: the same vehicle, smaller, standing at the right edge */}
      {band && (
        <>
          <div className="absolute bottom-3 right-[3rem] h-6 w-[26rem] rounded-[100%] bg-black/80 blur-xl max-sm:hidden" />
          <VehicleLinework
            tonal
            className="absolute bottom-4 right-[2rem] w-[30rem] max-w-none text-slate-200 opacity-[0.7] drop-shadow-[0_0_24px_rgba(251,146,60,0.2)] max-lg:hidden"
          />
        </>
      )}

      {/* bokeh */}
      {BOKEH.map((b, i) => (
        <span
          key={i}
          className="absolute rounded-full blur-[3px] max-sm:hidden"
          style={{ left: b.x, top: b.y, width: b.s, height: b.s, opacity: b.o, background: b.c, boxShadow: `0 0 ${b.s * 2}px ${b.s / 2}px ${b.c}55` }}
        />
      ))}

      {/* copy protection + vignette: the left reads dark, the bottom hands off to the next band */}
      <div className="absolute inset-0 bg-gradient-to-r from-[#05080e]/92 via-[#05080e]/40 to-transparent max-sm:from-[#05080e]/70" />
      <div className="absolute inset-0 bg-gradient-to-t from-[#05080e] via-transparent to-[#05080e]/60" />
      <div className="absolute inset-0 [background:radial-gradient(120%_100%_at_50%_40%,transparent_55%,rgba(2,4,8,0.7)_100%)]" />
    </div>
  );
}

/**
 * Photographic scene: a full-bleed photograph under layered grading. The photo
 * does the work; the overlays only (1) keep the left third dark enough for the
 * headline, (2) pull the bottom into the next band, and (3) add warm light
 * leaks and a vignette so the picture sits IN the page instead of on it.
 */
export function PhotoScene({
  src,
  position = "70% 50%",
  copySide = "left",
  shift = "0%",
  fit = "cover",
  className = "",
}: {
  src: string;
  position?: string;
  copySide?: "left" | "none";
  /** Slide the photo sideways (the edge it uncovers is the page's own black). */
  shift?: string;
  /** "right": whole photo, full height, pinned to the right edge (nothing is cropped). */
  fit?: "cover" | "right";
  className?: string;
}) {
  return (
    <div aria-hidden className={`pointer-events-none absolute inset-0 -z-10 overflow-hidden bg-[#05080e] ${className}`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt=""
        className={fit === "right" ? "absolute inset-y-0 right-0 h-full w-auto max-w-none" : "absolute inset-0 h-full w-full object-cover"}
        style={{
          objectPosition: position,
          transform: `translateX(${shift})`,
          ...(fit === "right" ? { maskImage: "linear-gradient(to right, transparent 0%, #000 34%)", WebkitMaskImage: "linear-gradient(to right, transparent 0%, #000 34%)" } : null),
        }}
        fetchPriority="high"
      />
      {/* grade: deepen the blacks, keep the amber */}
      <div className="absolute inset-0 bg-[#05080e]/10 mix-blend-multiply" />
      {/* warm light leaks, screened over the photo */}
      <div className="absolute -right-24 -top-24 h-[34rem] w-[44rem] bg-[radial-gradient(closest-side,rgba(251,146,60,0.12),transparent)] mix-blend-screen" />
      
      {copySide === "left" && (
        <div className="absolute inset-0 bg-gradient-to-r from-[#05080e] via-[#05080e]/65 via-[24%] to-transparent to-[52%]" />
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-[#05080e] via-transparent via-[22%] to-[#05080e]/35" />
      <div className="absolute inset-0 [background:radial-gradient(130%_110%_at_60%_45%,transparent_52%,rgba(2,4,8,0.55)_100%)]" />
    </div>
  );
}
