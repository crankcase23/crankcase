// Read a VIN barcode out of a photo, entirely in the browser. The image is never uploaded anywhere.
//
// Door-jamb stickers and many windshield plates carry the VIN as a Code 39 / Code 128 / Data Matrix / PDF417 barcode.
// Chromium's built-in BarcodeDetector is tried first (fast, native); everything else falls back to @zxing/library, loaded
// only when a photo is actually scanned. Printed-text-only VINs (no barcode) are not read here: the customer types those.
import { extractVinCandidates } from "@/lib/vin";

export type ScanResult =
  | { ok: true; vin: string; others: string[] }
  | { ok: false; reason: "no-barcode" | "no-vin" | "bad-image" };

type Detector = { detect(src: ImageBitmapSource): Promise<{ rawValue: string }[]> };
type DetectorCtor = (new (o?: { formats?: string[] }) => Detector) & { getSupportedFormats?: () => Promise<string[]> };

const FORMATS = ["code_39", "code_128", "data_matrix", "pdf_417", "qr_code"];

async function nativeDetect(file: File): Promise<string[] | null> {
  const Ctor = (globalThis as unknown as { BarcodeDetector?: DetectorCtor }).BarcodeDetector;
  if (!Ctor) return null;
  try {
    const supported = (await Ctor.getSupportedFormats?.()) ?? FORMATS;
    const formats = FORMATS.filter((f) => supported.includes(f));
    if (!formats.length) return null;
    const bmp = await createImageBitmap(file);
    const hits = await new Ctor({ formats }).detect(bmp);
    bmp.close?.();
    return hits.map((h) => h.rawValue);
  } catch {
    return null;
  }
}
async function zxingDetect(file: File): Promise<string[]> {
  const { BrowserMultiFormatReader, BarcodeFormat, DecodeHintType } = await import("@zxing/library");
  const hints = new Map();
  hints.set(DecodeHintType.POSSIBLE_FORMATS, [BarcodeFormat.CODE_39, BarcodeFormat.CODE_128, BarcodeFormat.DATA_MATRIX, BarcodeFormat.PDF_417, BarcodeFormat.QR_CODE]);
  hints.set(DecodeHintType.TRY_HARDER, true);
  const reader = new BrowserMultiFormatReader(hints);
  const out: string[] = [];
  // Phone photos are huge; also try a downscaled copy, which often decodes when the full-size one does not.
  for (const maxSide of [0, 1600, 1000]) {
    const url = maxSide ? await downscale(file, maxSide) : URL.createObjectURL(file);
    if (!url) continue;
    try {
      const r = await reader.decodeFromImageUrl(url);
      out.push(r.getText());
      break;
    } catch {
      /* not found at this size; try the next */
    } finally {
      URL.revokeObjectURL(url);
    }
  }
  reader.reset();
  return out;
}

async function downscale(file: File, maxSide: number): Promise<string | null> {
  try {
    const bmp = await createImageBitmap(file);
    const k = Math.min(1, maxSide / Math.max(bmp.width, bmp.height));
    const c = document.createElement("canvas");
    c.width = Math.round(bmp.width * k);
    c.height = Math.round(bmp.height * k);
    c.getContext("2d")!.drawImage(bmp, 0, 0, c.width, c.height);
    bmp.close?.();
    const blob: Blob | null = await new Promise((res) => c.toBlob(res, "image/png"));
    return blob ? URL.createObjectURL(blob) : null;
  } catch {
    return null;
  }
}

export async function scanVinFromPhoto(file: File): Promise<ScanResult> {
  if (!file.type.startsWith("image/")) return { ok: false, reason: "bad-image" };
  let raw = (await nativeDetect(file)) ?? [];
  let vins = raw.flatMap(extractVinCandidates);
  if (!vins.length) {
    try {
      raw = [...raw, ...(await zxingDetect(file))];
    } catch {
      return { ok: false, reason: "bad-image" };
    }
    vins = raw.flatMap(extractVinCandidates);
  }
  const unique = [...new Set(vins)];
  if (unique.length) return { ok: true, vin: unique[0], others: unique.slice(1) };
  return { ok: false, reason: raw.length ? "no-vin" : "no-barcode" };
}
