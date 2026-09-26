"use client";

import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import type { ResolvedGuide, Vehicle } from "@/types/vehicle";
import type { WrenchCompletionConfig } from "@/lib/wrenchSteps";
import { deriveOverview, vehicleTitle } from "@/lib/guideOverview";
import BrandLogo from "@/components/BrandLogo";
import {
  CalendarIcon,
  CarIcon,
  CloseIcon,
  CompleteBadge,
  GaugeIcon,
  OrangeCheck,
  SaveIcon,
} from "@/components/GuideIcons";

/**
 * The "Job complete" sheet shown when Complete is pressed on the final step.
 *
 * It only ever calls `config.save` if the host supplied one. It never writes
 * anywhere on its own, never invents a vehicle, and never pretends to save.
 * Outcomes are reported through onFinished("saved" | "skipped"); "Back to the
 * last step" (or Escape, or the close button) closes the sheet without ending
 * anything.
 *
 * What is SAVED is the canonical guide title and guide id. The checklist shown
 * on screen is the same guide's own "Jobs included" list, for reading only.
 */

function todayISO(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function prettyDate(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return iso;
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

const DISPLAY = "font-[family-name:var(--font-display)]";
const LABEL = "text-xs font-bold uppercase tracking-[0.18em] text-slate-400";

export default function WrenchCompletionSheet({
  guide,
  vehicle,
  config,
  onBack,
  onFinished,
}: {
  guide: ResolvedGuide;
  vehicle: Vehicle;
  config: WrenchCompletionConfig;
  onBack: () => void;
  onFinished: (outcome: "saved" | "skipped") => void;
}) {
  const [mileage, setMileage] = useState("");
  const [confirmSkip, setConfirmSkip] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [date, setDate] = useState(todayISO);
  const [editingDate, setEditingDate] = useState(false);
  const jobs = useMemo(() => deriveOverview(guide).jobs, [guide]);

  const digits = mileage.replace(/[,\s]/g, "");
  const mileageValid = /^\d{1,7}$/.test(digits);
  const dateValid = /^\d{4}-\d{2}-\d{2}$/.test(date);
  const canSave = Boolean(config.save) && mileageValid && dateValid && !saving;

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key !== "Escape" || saving) return;
      e.preventDefault();
      if (confirmSkip) setConfirmSkip(false);
      else onBack();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [confirmSkip, saving, onBack]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!config.save || !mileageValid || !dateValid || saving) return;
    setSaving(true);
    setError(null);
    try {
      await config.save({
        date,
        mileage: Number(digits),
        title: guide.title,
        guideId: guide.id,
      });
      onFinished("saved");
    } catch {
      setSaving(false);
      setError("Could not save that to Service History. Nothing was ended; try again.");
    }
  }

  return (
    <div className="absolute inset-0 z-10 flex items-end justify-center bg-black/75 backdrop-blur-sm sm:items-center sm:p-6">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="wm-complete-title"
        className="relative max-h-full w-full max-w-lg overflow-y-auto rounded-t-3xl border border-white/10 bg-gradient-to-b from-[#1f2226] to-[#15181b] p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_-20px_60px_rgba(0,0,0,0.6)] sm:rounded-3xl sm:p-7"
      >
        <button
          type="button"
          onClick={confirmSkip ? () => setConfirmSkip(false) : onBack}
          disabled={saving}
          aria-label={confirmSkip ? "Go back" : "Close this dialog"}
          className="absolute right-3 top-3 flex h-11 w-11 items-center justify-center rounded-xl text-slate-400 hover:bg-white/5 hover:text-white disabled:opacity-40"
        >
          <CloseIcon className="h-6 w-6" />
        </button>
        <div className="flex justify-center pt-1">
          <BrandLogo className="h-8 w-auto" />
        </div>

        {confirmSkip ? (
          <div className="pt-8 pb-2 text-center">
            <h2
              id="wm-complete-title"
              className="text-2xl font-bold leading-snug text-[#f5f3ee]"
            >
              Finish without saving this service to Service History?
            </h2>
            <div className="mt-7 grid gap-3 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => setConfirmSkip(false)}
                autoFocus
                className="min-h-[60px] rounded-2xl border border-white/15 bg-[#22262b] px-4 text-lg font-bold text-[#f5f3ee] hover:bg-[#2a2f35]"
              >
                Go Back
              </button>
              <button
                type="button"
                onClick={() => onFinished("skipped")}
                className="min-h-[60px] rounded-2xl border border-white/15 bg-transparent px-4 text-lg font-semibold text-slate-300 hover:bg-white/5"
              >
                Finish Without Saving
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={onSubmit} noValidate>
            <div className="mt-3 flex flex-col items-center text-center">
              <CompleteBadge className="h-14 w-14" />
              <p
                className={`${DISPLAY} mt-3 text-lg font-extrabold uppercase tracking-[0.22em] text-orange-400`}
              >
                Job complete
              </p>
              <p className="mt-1 text-4xl font-extrabold tracking-tight text-[#f5f3ee]">
                Great work!
              </p>
              <h2
                id="wm-complete-title"
                className="mt-2 text-lg font-medium leading-snug text-slate-200"
              >
                Add this service to your vehicle history?
              </h2>
            </div>

            <div className="mt-4 overflow-hidden rounded-2xl border border-white/10 bg-black/25">
              <div className="flex items-center gap-4 border-b border-white/10 px-4 py-3">
                <CarIcon className="h-9 w-9 shrink-0 text-slate-200" />
                <div className="min-w-0">
                  <p className="truncate text-lg font-semibold leading-tight text-[#f5f3ee]">
                    {config.vehicleLabel ?? vehicleTitle(vehicle)}
                  </p>
                  <p className="text-sm text-slate-400">{vehicle.engine}</p>
                </div>
              </div>
              <div className="px-4 py-3">
                <p className={LABEL}>Service performed</p>
                {jobs.length > 0 ? (
                  <ul className="mt-2.5 grid grid-cols-2 gap-x-3 gap-y-2">
                    {jobs.map((j) => (
                      <li key={j} className="flex items-start gap-2 text-sm leading-snug text-slate-200 sm:text-[15px]">
                        <OrangeCheck className="mt-0.5 h-4 w-4 shrink-0" />
                        <span>{j}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-2 text-base leading-snug text-slate-200">{guide.title}</p>
                )}
              </div>
              <div className="grid grid-cols-[0.85fr_1.15fr] divide-x divide-white/10 border-t border-white/10">
                <div className="px-4 py-3">
                  <p className={LABEL}>Date</p>
                  {editingDate ? (
                    <input
                      type="date"
                      value={date}
                      onChange={(e) => setDate(e.target.value)}
                      aria-label="Service date"
                      className="mt-1.5 min-h-[44px] w-full rounded-lg border border-white/20 bg-black/40 px-2 text-base text-[#f5f3ee] focus:border-orange-400 focus:outline-none"
                    />
                  ) : (
                    <div className="mt-1.5 flex items-center gap-2 text-base text-[#f5f3ee]">
                      <CalendarIcon className="h-5 w-5 shrink-0 text-slate-300" />
                      <span>{prettyDate(date)}</span>
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={() => setEditingDate((v) => !v)}
                    className="mt-1 min-h-[36px] text-sm font-semibold text-sky-300 hover:text-sky-200"
                  >
                    {editingDate ? "Done" : "Edit"}
                  </button>
                </div>
                <div className="px-4 py-3">
                  <label htmlFor="wm-mileage" className={LABEL}>
                    Current mileage
                  </label>
                  <div className="mt-1.5 flex items-center gap-2">
                    <GaugeIcon className="h-5 w-5 shrink-0 text-slate-300" />
                    <input
                      id="wm-mileage"
                      inputMode="numeric"
                      autoComplete="off"
                      autoFocus
                      value={mileage}
                      onChange={(e) => setMileage(e.target.value)}
                      aria-invalid={mileage !== "" && !mileageValid}
                      placeholder="84,500"
                      className="min-h-[48px] w-full min-w-0 rounded-lg border border-white/20 bg-black/40 px-2.5 font-mono text-xl text-[#f5f3ee] placeholder:text-slate-600 focus:border-orange-400 focus:outline-none"
                    />
                    <span className="text-base font-semibold text-slate-400">mi</span>
                  </div>
                </div>
              </div>
            </div>
            {mileage !== "" && !mileageValid && (
              <p className="mt-2 text-base text-amber-300">
                Enter the mileage as whole miles, digits only.
              </p>
            )}

            {!config.save && (
              <p
                role="note"
                className="mt-4 rounded-xl border border-dashed border-amber-400/60 bg-amber-400/10 p-3 text-base text-amber-100"
              >
                Saving is unavailable here.{" "}
                {config.unavailableReason ??
                  "This page has no signed-in vehicle to attach a Service History entry to."}
              </p>
            )}
            {error && (
              <p role="alert" className="mt-4 text-base font-semibold text-rose-300">
                {error}
              </p>
            )}

            <div className="mt-4 space-y-2.5">
              <button
                type="submit"
                disabled={!canSave}
                className="flex min-h-[60px] w-full items-center justify-center gap-3 rounded-2xl border border-orange-300/60 bg-gradient-to-b from-orange-400 to-orange-500 px-4 text-lg font-extrabold uppercase tracking-wide text-black shadow-[inset_0_1px_0_rgba(255,255,255,0.35),0_2px_0_rgba(0,0,0,0.6)] disabled:cursor-not-allowed disabled:opacity-40"
              >
                <SaveIcon className="h-5 w-5" />
                <span>{saving ? "Saving…" : "Save to Service History"}</span>
              </button>
              <button
                type="button"
                onClick={() => setConfirmSkip(true)}
                disabled={saving}
                className="min-h-[52px] w-full rounded-2xl border border-white/15 bg-[#22262b] px-4 text-lg font-semibold text-[#f5f3ee] hover:bg-[#2a2f35] disabled:opacity-40"
              >
                Not now
              </button>
              <button
                type="button"
                onClick={onBack}
                disabled={saving}
                className="min-h-[40px] w-full text-base font-medium text-slate-400 underline-offset-4 hover:text-slate-200 hover:underline disabled:opacity-40"
              >
                Back to the last step
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
