import sharp from "sharp";
import { mkdirSync } from "node:fs";

mkdirSync("public/icons", { recursive: true });

// The "Sump Mark" — Crankcase's icon, matching src/components/CrankcaseMark.tsx.
// Drawn from the actual crankcase oil pan: the pentagon is the pan-plus-sump
// silhouette, the five dots are the bolts sealing it to the block along the
// top flange, and the hex at the tip is the drain plug. `pad` scales the
// artwork down slightly to keep it inside the safe zone on maskable icons,
// which get cropped to a circle/rounded-square by the OS.
const svg = (size, pad = 0) => {
  const safeScale = 512 / (512 + pad * 2 * 1.5);
  return `
<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="96" fill="#0f172a"/>
  <g transform="translate(256,256) scale(${safeScale}) translate(-256,-256)">
    <polygon points="76.8,97.6 435.2,97.6 332.8,238.4 256,379.2 179.2,238.4" fill="#f97316"/>
    <line x1="179.2" y1="238.4" x2="332.8" y2="238.4" stroke="#0f172a" stroke-width="8"/>
    <circle cx="102.4" cy="97.6" r="16" fill="#0f172a"/>
    <circle cx="179.2" cy="97.6" r="16" fill="#0f172a"/>
    <circle cx="256" cy="97.6" r="16" fill="#0f172a"/>
    <circle cx="332.8" cy="97.6" r="16" fill="#0f172a"/>
    <circle cx="409.6" cy="97.6" r="16" fill="#0f172a"/>
    <g transform="translate(256,388.8)">
      <polygon points="28.8,0 14.4,24.96 -14.4,24.96 -28.8,0 -14.4,-24.96 14.4,-24.96" fill="#0f172a"/>
    </g>
  </g>
</svg>`;
};

const targets = [
  { file: "public/icons/icon-192.png", size: 192, pad: 0 },
  { file: "public/icons/icon-512.png", size: 512, pad: 0 },
  { file: "public/icons/icon-maskable-512.png", size: 512, pad: 48 },
  { file: "public/icons/apple-touch-icon.png", size: 180, pad: 0 },
];

for (const t of targets) {
  await sharp(Buffer.from(svg(t.size, t.pad)))
    .resize(t.size, t.size)
    .png()
    .toFile(t.file);
  console.log("wrote", t.file);
}
