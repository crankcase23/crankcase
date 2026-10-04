"use client";

import { useEffect, useId, useSyncExternalStore } from "react";
import { display } from "@/components/app/AppKit";

// ONE collapsible-chapter pattern for the whole Vehicle Home page.
//
// - The entire heading row is a single <button> (inside the <h2>), so the whole
//   row taps / clicks / responds to Enter and Space. aria-expanded and
//   aria-controls say what it does.
// - The summary under the title is real data passed in by the caller, so a
//   collapsed chapter still tells the owner something.
// - Open/closed is remembered per vehicle in this browser (localStorage). No
//   backend, no schema. If storage is blocked it still works for the session
//   (in-memory fallback). Server render and first paint use `defaultOpen`, so
//   there is no hydration mismatch.
// - A link or URL hash that targets this chapter (or an id inside it, listed in
//   `opensOn`) opens it, so jump links, the tiles and "add mileage" always land
//   on something visible.

const EVT = "cg-vh-sections";
const mem = new Map<string, boolean>();

function read(key: string): boolean | null {
  const m = mem.get(key);
  if (m !== undefined) return m;
  try {
    const v = window.localStorage.getItem(key);
    return v === "1" ? true : v === "0" ? false : null;
  } catch {
    return null;
  }
}

function write(key: string, open: boolean) {
  mem.set(key, open);
  try {
    window.localStorage.setItem(key, open ? "1" : "0");
  } catch {
    /* storage blocked: the in-memory value still holds for this visit */
  }
  window.dispatchEvent(new Event(EVT));
}

function subscribe(cb: () => void) {
  window.addEventListener(EVT, cb);
  window.addEventListener("storage", cb);
  return () => {
    window.removeEventListener(EVT, cb);
    window.removeEventListener("storage", cb);
  };
}

export function IconChevron({ open, className = "" }: { open: boolean; className?: string }) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`h-4 w-4 transition-transform duration-200 ${open ? "rotate-180" : ""} ${className}`}
    >
      <path d="M5 7.5l5 5 5-5" />
    </svg>
  );
}

export default function Section({
  id,
  vehicleId,
  eyebrow,
  title,
  summary,
  defaultOpen = false,
  attention = false,
  opensOn = [],
  chip,
  glow = "left",
  children,
}: {
  id: string;
  vehicleId: string;
  eyebrow: string;
  title: string;
  /** Real, owner-useful one-liner shown under the title (always visible). */
  summary: React.ReactNode;
  defaultOpen?: boolean;
  /** Tints the summary orange: this chapter holds something that needs a look. */
  attention?: boolean;
  /** Extra element ids / hashes that should open this chapter. */
  opensOn?: string[];
  chip?: React.ReactNode;
  glow?: "left" | "right" | "none";
  children: React.ReactNode;
}) {
  const key = `cg:vh:${vehicleId}:${id}`;
  const stored = useSyncExternalStore(
    subscribe,
    () => read(key),
    () => null,
  );
  const open = stored ?? defaultOpen;
  const uid = useId();
  const bodyId = `${uid}-body`;

  const targets = opensOn.join("|");
  useEffect(() => {
    const open = (h: string) => {
      if (!h || !(h === id || targets.split("|").includes(h))) return;
      write(key, true);
      // Two frames: let the open state paint before scrolling to what is inside.
      requestAnimationFrame(() =>
        requestAnimationFrame(() => {
          const el = document.getElementById(h);
          el?.scrollIntoView({ block: "start" });
          if (el && h !== id && el instanceof HTMLInputElement) el.focus({ preventScroll: true });
        }),
      );
    };
    const fromHash = () => open(decodeURIComponent(window.location.hash.slice(1)));
    // next/link changes hash-only URLs with pushState, which fires no hashchange,
    // so in-page links are also caught at the click.
    const onClick = (e: MouseEvent) => {
      const a = (e.target as Element | null)?.closest?.('a[href^="#"]');
      if (a) open(decodeURIComponent((a.getAttribute("href") ?? "").slice(1)));
    };
    fromHash();
    window.addEventListener("hashchange", fromHash);
    document.addEventListener("click", onClick);
    return () => {
      window.removeEventListener("hashchange", fromHash);
      document.removeEventListener("click", onClick);
    };
  }, [id, key, targets]);

  const glowCls =
    glow === "none"
      ? ""
      : glow === "left"
        ? "bg-[radial-gradient(34rem_14rem_at_8%_0%,rgba(234,138,40,0.10),transparent_72%)]"
        : "bg-[radial-gradient(34rem_14rem_at_92%_0%,rgba(234,138,40,0.10),transparent_72%)]";

  return (
    <section id={id} className="relative mt-12 scroll-mt-32 sm:mt-16" aria-labelledby={`${uid}-h`}>
      {glow !== "none" ? (
        <div aria-hidden className={`pointer-events-none absolute inset-x-0 -top-10 -z-10 h-72 ${glowCls}`} />
      ) : null}
      <div className={`vh-seam ${open ? "mb-5 sm:mb-6" : "mb-4"}`} aria-hidden />
      <div className={open ? "" : "vh-panel rounded-2xl"}>
        <h2 id={`${uid}-h`} className="m-0">
          <button
            type="button"
            aria-expanded={open}
            aria-controls={bodyId}
            onClick={() => write(key, !open)}
            className={`group flex min-h-[4.5rem] w-full items-center justify-between gap-4 text-left focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-orange-400 ${
              open ? "px-0 py-1" : "rounded-2xl px-5 py-4 sm:px-6"
            }`}
          >
            <span className="min-w-0">
              <span className="flex items-center gap-3" aria-hidden>
                <span className="h-px w-6 shrink-0 bg-orange-500" />
                <span className="text-[0.7rem] font-extrabold uppercase tracking-[0.24em] text-orange-400" style={display}>
                  {eyebrow}
                </span>
              </span>
              <span
                className="mt-1.5 block text-[2.1rem] font-extrabold uppercase leading-[0.95] tracking-[0.005em] text-slate-50 sm:text-[2.9rem]"
                style={display}
              >
                {title}
              </span>
              <span
                className={`mt-2 block font-mono text-[0.78rem] leading-snug tracking-wide ${
                  attention ? "text-orange-300" : "text-slate-400"
                }`}
              >
                {summary}
              </span>
            </span>
            <span className="flex shrink-0 items-center gap-3">
              {chip ? <span className="hidden sm:block">{chip}</span> : null}
              <span
                aria-hidden
                className={`flex h-11 w-11 items-center justify-center rounded-full border text-slate-200 transition-colors ${
                  open
                    ? "border-orange-500/50 bg-orange-500/10 text-orange-300"
                    : "border-white/15 bg-black/30 group-hover:border-white/35"
                }`}
              >
                <IconChevron open={open} />
              </span>
            </span>
          </button>
        </h2>
      </div>
      <div id={bodyId} hidden={!open} className="pt-6">
        {children}
      </div>
    </section>
  );
}
