"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useCurrentMileage } from "@/lib/currentMileage";
import { IconChevronLeft } from "@/components/app/AppIcons";

// A slim identity strip that appears only once the big header has scrolled
// away. It is fixed under the site nav (which is sticky, 65px), takes 44px, and
// is never in the document flow, so it cannot push or cover content when it is
// hidden. Sections use scroll-mt to clear nav + strip when jumped to.
export default function StickyVehicleBar({ vehicleId, label }: { vehicleId: string; label: string }) {
  const sentinel = useRef<HTMLDivElement>(null);
  const [show, setShow] = useState(false);
  const { miles, source } = useCurrentMileage(vehicleId);

  useEffect(() => {
    const el = sentinel.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(
      ([e]) => setShow(!e.isIntersecting && e.boundingClientRect.top < 0),
      { rootMargin: "-65px 0px 0px 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <>
      <div ref={sentinel} aria-hidden className="h-px" />
      <div
        aria-hidden={!show}
        className={`fixed inset-x-0 top-[65px] z-30 border-b border-white/10 bg-[#0a0807]/90 backdrop-blur transition duration-200 ${
          show ? "translate-y-0 opacity-100" : "pointer-events-none -translate-y-2 opacity-0 [visibility:hidden]"
        }`}
      >
        <div className="mx-auto flex h-11 max-w-6xl items-center justify-between gap-3 px-4">
          <p className="flex min-w-0 items-baseline gap-3 text-sm">
            <span className="truncate font-semibold text-slate-100">{label}</span>
            {miles != null ? (
              <span className="shrink-0 font-mono text-xs text-slate-400">
                {miles.toLocaleString("en-US")} mi{source === "service" ? " · last service" : ""}
              </span>
            ) : null}
          </p>
          <Link
            href="/garage"
            tabIndex={show ? 0 : -1}
            className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-slate-300 hover:text-white"
          >
            <IconChevronLeft className="h-3.5 w-3.5" />
            Garage
          </Link>
        </div>
      </div>
    </>
  );
}
