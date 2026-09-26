"use client";

import { useEffect } from "react";
import BrandLogo from "@/components/BrandLogo";
import { CloseIcon } from "@/components/GuideIcons";

/**
 * Confirmation shown before intentionally ending a Wrench Mode session.
 * "Keep Wrenching" (also Escape and the close button) changes nothing.
 * "Exit Wrench Mode" clears the saved position.
 */
export default function ExitWrenchDialog({
  onKeep,
  onExit,
}: {
  onKeep: () => void;
  onExit: () => void;
}) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        onKeep();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onKeep]);

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="wm-exit-title"
        aria-describedby="wm-exit-desc"
        className="relative w-full max-w-xl rounded-3xl border border-white/10 bg-gradient-to-b from-[#1f2226] to-[#15181b] p-6 text-center shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_30px_80px_rgba(0,0,0,0.7)] sm:p-8"
      >
        <button
          type="button"
          onClick={onKeep}
          aria-label="Close this dialog"
          className="absolute right-3 top-3 flex h-11 w-11 items-center justify-center rounded-xl text-slate-400 hover:bg-white/5 hover:text-white"
        >
          <CloseIcon className="h-6 w-6" />
        </button>
        <div className="flex justify-center">
          <BrandLogo className="h-9 w-auto" />
        </div>
        <h2 id="wm-exit-title" className="mt-6 text-3xl font-bold text-[#f5f3ee]">
          Exit Wrench Mode?
        </h2>
        <p id="wm-exit-desc" className="mt-3 text-lg leading-relaxed text-slate-300">
          <span className="block">Your current Wrench Mode position will be cleared.</span>
          <span className="block">You can always start again from the Overall Guide.</span>
        </p>
        <div className="mt-7 grid gap-3 sm:grid-cols-2">
          <button
            type="button"
            autoFocus
            onClick={onKeep}
            className="min-h-[60px] whitespace-nowrap rounded-2xl border border-white/15 bg-[#22262b] px-4 text-lg font-bold text-[#f5f3ee] hover:bg-[#2a2f35]"
          >
            Keep Wrenching
          </button>
          <button
            type="button"
            onClick={onExit}
            className="min-h-[60px] whitespace-nowrap rounded-2xl border border-orange-300/60 bg-gradient-to-b from-orange-400 to-orange-500 px-4 text-lg font-extrabold text-black shadow-[inset_0_1px_0_rgba(255,255,255,0.35),0_2px_0_rgba(0,0,0,0.6)]"
          >
            Exit Wrench Mode
          </button>
        </div>
      </div>
    </div>
  );
}
