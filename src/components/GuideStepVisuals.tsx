"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import type { GuideStepVisual, VisualCallout } from "@/types/guideVisuals";
import { CloseIcon } from "@/components/GuideIcons";

/**
 * Renders the verified visuals for one Wrench Mode step: zero, one or many.
 * The caller passes only visuals that already cleared lib/guideVisuals
 * (right vehicle, verified). This component adds the last safeguard: if an
 * image fails to load, that whole figure (callouts included) is dropped, so a
 * broken file can never leave floating arrows over nothing.
 *
 * Callouts: label pill at `labelAt`, a line to `target`, an arrowhead and ring
 * on the component. Positions are percentages of the image, so they stay glued
 * to it at any size. The same labels are ALSO listed under the picture, so the
 * information does not depend on seeing the overlay.
 *
 * Height: the picture is capped (see MAX_H) so it cannot swallow the screen,
 * and tapping it opens a larger view. Nothing here captures vertical drags, so
 * page scrolling and the step swipe are untouched; the picture itself is a
 * plain button, which the swipe handler ignores by design.
 */

const MAX_H = "max-h-[min(46dvh,520px)]";

function angleDeg(from: { x: number; y: number }, to: { x: number; y: number }, w: number, h: number) {
  // Angle in real pixel space, not percent space, so the head follows the line.
  return (Math.atan2((to.y - from.y) * h, (to.x - from.x) * w) * 180) / Math.PI;
}

function Overlay({ vis, big }: { vis: GuideStepVisual; big?: boolean }) {
  const cs = vis.callouts ?? [];
  if (!cs.length) return null;
  return (
    <>
      <svg
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 h-full w-full"
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
      >
        {cs.map((c, i) => (
          <g key={i}>
            <line x1={c.labelAt.x} y1={c.labelAt.y} x2={c.target.x} y2={c.target.y} stroke="#000" strokeOpacity="0.75" strokeWidth={big ? 7 : 6} vectorEffect="non-scaling-stroke" />
            <line x1={c.labelAt.x} y1={c.labelAt.y} x2={c.target.x} y2={c.target.y} stroke="#fb923c" strokeWidth={big ? 4 : 3} vectorEffect="non-scaling-stroke" />
          </g>
        ))}
      </svg>
      {cs.map((c, i) => (
        <span key={`t${i}`} aria-hidden="true">
          <span
            className="pointer-events-none absolute h-7 w-7 -translate-x-1/2 -translate-y-1/2 rounded-full border-[3px] border-orange-400 shadow-[0_0_0_2px_rgba(0,0,0,0.75)]"
            style={{ left: `${c.target.x}%`, top: `${c.target.y}%` }}
          />
          <span
            className="pointer-events-none absolute h-0 w-0"
            style={{
              left: `${c.target.x}%`,
              top: `${c.target.y}%`,
              transform: `rotate(${angleDeg(c.labelAt, c.target, vis.width, vis.height)}deg)`,
            }}
          >
            {/* Head points along the line; its tip stops at the ring's edge (14px out). */}
            <span className="absolute left-[-30px] top-[-9px] h-0 w-0 border-y-[9px] border-l-[16px] border-y-transparent border-l-orange-400 drop-shadow-[0_0_2px_rgba(0,0,0,0.9)]" />
          </span>
          <span
            className="pointer-events-none absolute flex -translate-x-1/2 -translate-y-1/2 items-center gap-1 whitespace-nowrap rounded-lg bg-black/85 px-1.5 py-0.5 text-xs font-bold leading-tight text-white shadow-lg ring-1 ring-orange-400/70 sm:gap-1.5 sm:px-2 sm:py-1 sm:text-base"
            style={{ left: `${c.labelAt.x}%`, top: `${c.labelAt.y}%` }}
          >
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-orange-500 text-xs font-extrabold text-black">
              {String.fromCharCode(65 + (i % 26))}
            </span>
            <span>{c.label}</span>
          </span>
        </span>
      ))}
    </>
  );
}

function Legend({ callouts }: { callouts: VisualCallout[] }) {
  return (
    <ol className="mt-3 grid gap-2 sm:grid-cols-2" aria-label="Labels on this picture">
      {callouts.map((c, i) => (
        <li key={i} className="flex items-start gap-2.5 text-lg leading-snug text-slate-200">
          <span
            aria-hidden="true"
            className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-orange-500 text-sm font-extrabold text-black"
          >
            {String.fromCharCode(65 + (i % 26))}
          </span>
          <span>{c.label}</span>
        </li>
      ))}
    </ol>
  );
}

function Lightbox({ vis, onClose }: { vis: GuideStepVisual; onClose: () => void }) {
  const [zoom, setZoom] = useState(false);

  useEffect(() => {
    // Capture phase + stopPropagation: while this view is open, arrow keys must
    // not step the guide behind it, and Escape closes only this view.
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        onClose();
      } else if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
        e.stopPropagation();
      }
    }
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [onClose]);

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Larger view: ${vis.caption}`}
      className="fixed inset-0 z-[120] flex flex-col bg-black"
      // React bubbles portal events to Wrench Mode's swipe surface; stop them.
      onPointerDown={(e) => e.stopPropagation()}
      onPointerUp={(e) => e.stopPropagation()}
      onPointerCancel={(e) => e.stopPropagation()}
    >
      <div className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-2">
        <p className="min-w-0 flex-1 truncate text-base text-slate-300">{vis.caption}</p>
        <button
          type="button"
          onClick={() => setZoom((z) => !z)}
          className="min-h-[48px] rounded-xl border border-white/20 bg-[#22262b] px-4 text-base font-bold text-[#f5f3ee]"
        >
          {zoom ? "Fit to screen" : "Zoom in"}
        </button>
        <button
          type="button"
          onClick={onClose}
          autoFocus
          aria-label="Close larger view"
          className="flex h-12 w-12 items-center justify-center rounded-xl border border-white/20 bg-[#22262b] text-[#f5f3ee]"
        >
          <CloseIcon className="h-6 w-6" />
        </button>
      </div>
      <div className="min-h-0 flex-1 overflow-auto p-3" style={{ touchAction: "pan-x pan-y pinch-zoom" }}>
        <div
          className="relative mx-auto"
          style={{
            width: zoom ? "220%" : "100%",
            maxWidth: zoom ? "none" : `min(100%, calc((100dvh - 96px) * ${vis.width / vis.height}))`,
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={vis.src} alt={vis.alt} width={vis.width} height={vis.height} className="block h-auto w-full rounded-lg" draggable={false} />
          <Overlay vis={vis} big />
        </div>
      </div>
    </div>,
    document.body
  );
}

function Figure({ vis, onBroken }: { vis: GuideStepVisual; onBroken: (id: string) => void }) {
  const [open, setOpen] = useState(false);
  const cs = vis.callouts ?? [];
  return (
    <figure className="overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-b from-[#1f2226] to-[#1a1d21] shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_20px_40px_-28px_rgba(0,0,0,0.9)]">
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={`Open larger view: ${vis.caption}`}
        className="block w-full bg-black/40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-orange-400"
      >
        <span className="relative mx-auto block w-fit max-w-full">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={vis.src}
            alt={vis.alt}
            width={vis.width}
            height={vis.height}
            loading="lazy"
            decoding="async"
            draggable={false}
            onError={() => onBroken(vis.id)}
            className={`block h-auto w-auto max-w-full ${MAX_H} object-contain`}
            style={{ aspectRatio: `${vis.width} / ${vis.height}` }}
          />
          <Overlay vis={vis} />
        </span>
      </button>
      <figcaption className="p-4 sm:p-5">
        <p className="text-lg font-semibold leading-snug text-[#f5f3ee] sm:text-xl">{vis.caption}</p>
        <p className="mt-1 text-sm font-semibold uppercase tracking-wider text-slate-400">Tap the picture to enlarge</p>
        <p className="mt-2 inline-flex items-center gap-2 rounded-md border border-orange-500/40 bg-orange-500/10 px-2 py-1 text-sm font-semibold text-orange-200">
          <span aria-hidden="true">✓</span>
          <span>
            Verified for {vis.application.year} {vis.application.make} {vis.application.model}
            {vis.application.trim ? ` ${vis.application.trim}` : ""} · {vis.application.engine}
          </span>
        </p>
        {cs.length > 0 && <Legend callouts={cs} />}
      </figcaption>
      {open && <Lightbox vis={vis} onClose={() => setOpen(false)} />}
    </figure>
  );
}

export default function GuideStepVisuals({ visuals }: { visuals: GuideStepVisual[] }) {
  const [broken, setBroken] = useState<string[]>([]);
  const shown = visuals.filter((v) => !broken.includes(v.id));
  if (!shown.length) return null;
  return (
    <section aria-label="Pictures for this step" className="mt-6 space-y-4">
      {shown.map((v) => (
        <Figure key={v.id} vis={v} onBroken={(id) => setBroken((b) => (b.includes(id) ? b : [...b, id]))} />
      ))}
    </section>
  );
}
