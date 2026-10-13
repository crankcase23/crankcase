// Dev probe: runs the SAME multi-pass Tesseract reads the browser scanner uses, in Node, on image files, and prints raw OCR lines.
// Usage: node scripts/vin/ocr-probe.mjs <image>...   (assets from public/ocr, no network)
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const require = createRequire(path.join(ROOT, "package.json"));
const { createWorker, PSM } = require("tesseract.js");
const worker = await createWorker("eng", 1, { workerPath: path.join(ROOT, "node_modules/tesseract.js/src/worker-script/node/index.js"), corePath: path.join(ROOT, "public/ocr/core"), langPath: path.join(ROOT, "public/ocr/lang"), gzip: true });
await worker.setParameters({ tessedit_char_whitelist: "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789" });
for (const f of process.argv.slice(2)) {
  for (const [name, psm] of [["SINGLE_BLOCK", PSM.SINGLE_BLOCK], ["SPARSE_TEXT", PSM.SPARSE_TEXT], ["AUTO", PSM.AUTO]]) {
    await worker.setParameters({ tessedit_pageseg_mode: psm });
    const { data } = await worker.recognize(fs.readFileSync(f), {}, { blocks: true, text: true });
    console.log(`--- ${path.basename(f)} ${name}`); console.log(data.text.trim());
  }
}
await worker.terminate();
