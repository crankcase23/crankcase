"use client";

import { useRef, useState } from "react";
import { scanVinFromPhoto } from "@/lib/vinScan";

// Take Photo / Upload Photo. Reads the VIN barcode on this device (nothing is uploaded) and hands the result to the parent
// as a suggestion. The parent puts it in the VIN box where the customer reviews and can edit it before anything is decoded
// or saved: a scan never adds a vehicle by itself.
export default function VinPhotoScan({ onVin }: { onVin: (vin: string) => void }) {
  const cam = useRef<HTMLInputElement>(null);
  const up = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  async function handle(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    setMsg(null);
    const r = await scanVinFromPhoto(file);
    setBusy(false);
    if (r.ok) {
      onVin(r.vin);
      setMsg({ kind: "ok", text: `Read ${r.vin} from the photo. Check it against your car, fix anything that's off, then continue.${r.others.length ? " (The photo had more than one VIN-like code; check it's the right one.)" : ""}` });
    } else {
      setMsg({
        kind: "err",
        text:
          r.reason === "bad-image"
            ? "That file couldn't be read as a photo. Try again, or type the VIN."
            : "Couldn't read a VIN barcode from that photo. Try the door-jamb sticker (or windshield plate) with the barcode in focus and well lit, or type the VIN.",
      });
    }
  }

  const btn = "rounded-lg border border-slate-600 bg-slate-950 px-4 py-2 text-sm font-medium text-slate-100 hover:border-orange-500 disabled:opacity-50";
  return (
    <div className="mt-3" data-testid="vin-photo-scan">
      <div className="flex flex-wrap gap-2">
        <button type="button" className={btn} disabled={busy} onClick={() => cam.current?.click()}>Take Photo</button>
        <button type="button" className={btn} disabled={busy} onClick={() => up.current?.click()}>Upload Photo</button>
        {busy && <span className="self-center text-sm text-slate-400">Reading photo…</span>}
      </div>
      <input ref={cam} data-testid="vin-photo-camera" type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => { void handle(e.target.files?.[0]); e.target.value = ""; }} />
      <input ref={up} data-testid="vin-photo-upload" type="file" accept="image/*" className="hidden" onChange={(e) => { void handle(e.target.files?.[0]); e.target.value = ""; }} />
      <p className="mt-2 text-xs text-slate-500">Reads the VIN barcode on your door-jamb sticker. The photo stays on this device; it is never uploaded.</p>
      {msg && (
        <div role="status" className={`mt-2 rounded-lg border px-3 py-2 text-sm ${msg.kind === "ok" ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300" : "border-amber-500/30 bg-amber-500/10 text-amber-300"}`}>
          {msg.text}
        </div>
      )}
    </div>
  );
}
