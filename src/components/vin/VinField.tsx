"use client";

import { useId, useRef, useState } from "react";
import { normalizeVin, suggestCorrections, uncertainPositions, validateVin, VIN_LENGTH } from "@/lib/vin";
import { RETAKE_TIPS, scanVinFromImage, type ScanStage } from "@/lib/vinOcr";

/**
 * The VIN input shared by every lookup: type it, or Take Photo / Upload Photo and let the browser read it.
 *
 * Rules this component keeps:
 *  - A scan only PREFILLS the box, exactly as the camera read it. It never swaps a character for a "better" one.
 *  - Characters the camera was unsure of, or that cannot appear in a VIN (I, O, Q), are highlighted.
 *  - A scanned VIN needs an explicit "I checked this against my vehicle" confirmation before Look up is enabled.
 *  - A VIN that fails the format or check-digit rules is never looked up. Single-character corrections that would make it
 *    valid are OFFERED as buttons; nothing is applied until the customer presses one.
 *  - The photo is read in this browser and dropped; nothing is uploaded or kept.
 */
export default function VinField({
  onLookup,
  busy = false,
  busyLabel = "Looking up…",
  buttonLabel = "Look up",
}: {
  onLookup: (vin: string) => void | Promise<void>;
  busy?: boolean;
  busyLabel?: string;
  buttonLabel?: string;
}) {
  const uid = useId();
  const [value, setValue] = useState("");
  const [scanning, setScanning] = useState(false);
  const [progress, setProgress] = useState<{ fraction: number; stage: ScanStage }>({ fraction: 0, stage: "Preparing the photo" });
  const [scanMessage, setScanMessage] = useState<{ kind: "info" | "error"; text: string } | null>(null);
  const [scanned, setScanned] = useState<{ vin: string; confidences: (number | undefined)[]; alternatives: string[] } | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [needsRetake, setNeedsRetake] = useState(false);
  const [showErrors, setShowErrors] = useState(false);
  const cameraRef = useRef<HTMLInputElement>(null);
  const uploadRef = useRef<HTMLInputElement>(null);

  const vin = normalizeVin(value);
  const check = validateVin(vin);
  const fromScan = scanned !== null && vin === scanned.vin;
  const uncertain = fromScan ? uncertainPositions(vin, scanned.confidences) : !check.ok && showErrors && vin.length === VIN_LENGTH ? uncertainPositions(vin) : [];
  const suggestions = !check.ok && vin.length === VIN_LENGTH ? suggestCorrections(vin).slice(0, 4) : [];
  const canLookup = check.ok && (!fromScan || confirmed) && !busy && !scanning;

  async function onPick(files: FileList | null, input: HTMLInputElement | null) {
    const file = files?.[0];
    if (input) input.value = ""; // drop the browser's reference to the photo straight away
    if (!file) return;
    setScanMessage({ kind: "info", text: "Reading the photo…" });
    setProgress({ fraction: 0.02, stage: "Preparing the photo" }); // something is on screen the instant the photo is picked
    setScanning(true);
    setConfirmed(false);
    setNeedsRetake(false);
    try {
      const result = await scanVinFromImage(file, (fraction, stage) => setProgress((cur) => ({ fraction: Math.max(cur.fraction, fraction), stage: stage ?? cur.stage })));
      if (!result.ok) {
        setScanned(null);
        setNeedsRetake(result.reason === "unreadable");
        setScanMessage({ kind: "error", text: result.message });
        return;
      }
      setScanned({ vin: result.vin, confidences: result.confidences, alternatives: result.alternatives });
      setValue(result.vin);
      setShowErrors(true);
      setNeedsRetake(!result.checkDigitOk);
      setScanMessage({
        kind: "info",
        text: result.checkDigitOk
          ? "Here is what we read. Check every character against your vehicle before you continue."
          : "Here is the closest VIN we could read, but it does not pass the VIN check, so at least one character is probably wrong. Compare it to the VIN on your vehicle and fix any highlighted character yourself.",
      });
    } finally {
      setScanning(false);
    }
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setShowErrors(true);
    if (!canLookup) return;
    void onLookup(check.ok ? check.vin : vin);
  }

  return (
    <form onSubmit={submit} noValidate className="mt-4" data-testid="vin-form">
      <label htmlFor={`${uid}-vin`} className="sr-only">VIN</label>
      <div className="flex gap-2">
        <input
          id={`${uid}-vin`}
          data-testid="vin-input"
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            setShowErrors(false);
          }}
          placeholder="Enter 17-character VIN"
          maxLength={25}
          autoCapitalize="characters"
          autoCorrect="off"
          spellCheck={false}
          inputMode="text"
          aria-invalid={showErrors && !check.ok}
          aria-describedby={`${uid}-help`}
          className="min-w-0 flex-1 rounded-lg border border-slate-700 bg-slate-950 px-4 py-2 font-mono tracking-wider text-slate-100 placeholder:font-sans placeholder:tracking-normal placeholder:text-slate-500 focus:border-orange-500 focus:outline-none"
        />
        <button
          type="submit"
          data-testid="vin-lookup"
          disabled={busy || scanning || (showErrors && !canLookup)}
          className="rounded-lg bg-orange-500 px-5 py-2 font-semibold text-slate-950 hover:bg-orange-400 disabled:opacity-50"
        >
          {busy ? busyLabel : buttonLabel}
        </button>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-2">
        <button
          type="button"
          data-testid="vin-take-photo"
          onClick={() => cameraRef.current?.click()}
          disabled={scanning || busy}
          className="rounded-lg border border-slate-700 px-3 py-1.5 text-sm text-slate-200 hover:border-orange-500/60 disabled:opacity-50"
        >
          Take photo
        </button>
        <button
          type="button"
          data-testid="vin-upload-photo"
          onClick={() => uploadRef.current?.click()}
          disabled={scanning || busy}
          className="rounded-lg border border-slate-700 px-3 py-1.5 text-sm text-slate-200 hover:border-orange-500/60 disabled:opacity-50"
        >
          Upload photo
        </button>
        <span id={`${uid}-help`} className="text-xs text-slate-500">
          The VIN is on the dash by the windshield, the driver&apos;s door jamb sticker, or your registration. Photos are read in your
          browser and never uploaded or saved.
        </span>
        <input ref={cameraRef} data-testid="vin-photo-input-camera" type="file" accept="image/jpeg,image/png,image/webp" capture="environment" className="hidden" tabIndex={-1} aria-hidden onChange={(e) => onPick(e.target.files, e.target)} />
        <input ref={uploadRef} data-testid="vin-photo-input-upload" type="file" accept="image/jpeg,image/png,image/webp" className="hidden" tabIndex={-1} aria-hidden onChange={(e) => onPick(e.target.files, e.target)} />
      </div>

      <div role="status" aria-live="polite" data-testid="vin-scan-status" className={`mt-2 text-sm ${scanMessage?.kind === "error" ? "text-rose-300" : "text-slate-400"}`}>
        {scanning ? (
          <>
            Reading the photo…{" "}
            <span aria-hidden="true" data-testid="vin-scan-percent">{Math.round(progress.fraction * 100)}%</span>
            <span className="ml-2 text-slate-500" data-testid="vin-scan-stage">{progress.stage}</span>
          </>
        ) : (
          scanMessage?.text
        )}
      </div>
      {scanning ? (
        <div
          role="progressbar"
          aria-label="Reading the photo"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(progress.fraction * 100)}
          data-testid="vin-scan-progress"
          className="mt-1 h-1.5 w-full overflow-hidden rounded bg-slate-800"
        >
          <div className="h-full rounded bg-orange-500 transition-[width] duration-300" style={{ width: `${Math.round(progress.fraction * 100)}%` }} />
        </div>
      ) : null}

      {needsRetake ? (
        <div className="mt-2 rounded-lg border border-slate-700 p-3 text-sm text-slate-300" data-testid="vin-retake-tips">
          <p className="font-medium text-slate-200">For a better photo:</p>
          <ul className="mt-1 list-disc pl-5">
            {RETAKE_TIPS.map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {vin.length === VIN_LENGTH && (uncertain.length > 0 || fromScan) ? (
        <div className="mt-2" data-testid="vin-scan-chars" aria-label="Characters read">
          <div className="flex flex-wrap gap-1 font-mono text-base">
            {[...vin].map((ch, i) => {
              const doubt = uncertain.includes(i);
              return (
                <span
                  key={i}
                  data-uncertain={doubt ? "true" : "false"}
                  title={doubt ? "Check this character" : undefined}
                  className={`inline-flex h-8 w-6 items-center justify-center rounded border ${doubt ? "border-amber-400 bg-amber-400/20 text-amber-200" : "border-slate-700 text-slate-200"}`}
                >
                  {ch}
                </span>
              );
            })}
          </div>
          {uncertain.length > 0 ? (
            <p className="mt-1 text-xs text-amber-300" data-testid="vin-uncertain-note">
              Look again at the highlighted character{uncertain.length > 1 ? "s" : ""} (position{uncertain.length > 1 ? "s" : ""} {uncertain.map((p) => p + 1).join(", ")}). Lookalikes like 0/O/D, 1/I/L, 5/S, 8/B are easy to misread.
            </p>
          ) : null}
        </div>
      ) : null}

      {showErrors && !check.ok && vin.length > 0 ? (
        <p role="alert" data-testid="vin-error" className="mt-2 text-sm text-rose-300">{check.message}</p>
      ) : null}

      {suggestions.length > 0 && showErrors ? (
        <div className="mt-2 text-sm text-slate-300" data-testid="vin-suggestions">
          <span className="text-slate-400">Possible misread, tap to use it only if it matches your vehicle:</span>
          <div className="mt-1 flex flex-wrap gap-2">
            {suggestions.map((s) => (
              <button
                key={s.vin}
                type="button"
                data-testid="vin-suggestion"
                onClick={() => {
                  setValue(s.vin);
                  setScanned((cur) => (cur ? { ...cur, vin: s.vin } : cur));
                  setConfirmed(false);
                }}
                className="rounded-lg border border-slate-700 px-2 py-1 font-mono text-xs hover:border-orange-500/60"
              >
                position {s.position + 1}: {s.from} → {s.to}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {fromScan && check.ok ? (
        <label className="mt-3 flex cursor-pointer items-start gap-2 text-sm text-slate-200">
          <input
            type="checkbox"
            data-testid="vin-confirm-scan"
            checked={confirmed}
            onChange={(e) => setConfirmed(e.target.checked)}
            className="mt-1"
          />
          <span>I checked this VIN against my vehicle and every character is right.</span>
        </label>
      ) : null}
    </form>
  );
}
