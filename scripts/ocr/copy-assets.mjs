// Copies the OCR engine and its English model out of node_modules into public/ocr so the VIN photo scan runs entirely
// from our own origin: no CDN, no third party ever sees a request, and no image ever leaves the browser. Run by
// predev/prebuild; the output is git-ignored. Idempotent.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const out = path.join(root, "public", "ocr");
const nm = (...p) => path.join(root, "node_modules", ...p);
const files = [
  [nm("tesseract.js", "dist", "worker.min.js"), "worker.min.js"],
  [nm("tesseract.js-core", "tesseract-core-lstm.wasm.js"), "core/tesseract-core-lstm.wasm.js"],
  [nm("tesseract.js-core", "tesseract-core-simd-lstm.wasm.js"), "core/tesseract-core-simd-lstm.wasm.js"],
  [nm("@tesseract.js-data", "eng", "4.0.0_best_int", "eng.traineddata.gz"), "lang/eng.traineddata.gz"],
];
for (const [from, to] of files) {
  if (!fs.existsSync(from)) {
    console.warn(`ocr assets: missing ${path.relative(root, from)} (run npm install); the VIN photo scan will be unavailable`);
    continue;
  }
  const dest = path.join(out, to);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  if (!fs.existsSync(dest) || fs.statSync(dest).size !== fs.statSync(from).size) fs.copyFileSync(from, dest);
}
