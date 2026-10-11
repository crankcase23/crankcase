#!/usr/bin/env node
// Builds the no-login preview harness (esbuild + Tailwind via the project's own PostCSS plugin) into --out DIR.
//   node scripts/bmw/preview/build.mjs --out DIR
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const require = createRequire(path.join(ROOT, "package.json"));
const esbuild = require("esbuild");
const postcss = require("postcss");
const tailwind = require("@tailwindcss/postcss");

const a = process.argv.slice(2);
const out = path.resolve(a[a.indexOf("--out") + 1] ?? "");
if (!a.includes("--out") || !out) { console.error("usage: build.mjs --out DIR"); process.exit(2); }
fs.mkdirSync(out, { recursive: true });
const here = path.join(ROOT, "scripts/bmw/preview");

await esbuild.build({
  entryPoints: [path.join(here, "entry.tsx")],
  bundle: true, outfile: path.join(out, "preview.js"), format: "iife", jsx: "automatic", platform: "browser",
  define: { "process.env.NODE_ENV": '"production"' },
  alias: { "@": path.join(ROOT, "src"), "next/link": path.join(here, "stubs/next-link.tsx"), "next/image": path.join(here, "stubs/next-image.tsx") },
  logLevel: "warning",
});
const cssFile = path.join(ROOT, "src/app/globals.css");
const css = await postcss([tailwind()]).process(fs.readFileSync(cssFile, "utf8"), { from: cssFile });
fs.writeFileSync(path.join(out, "preview.css"), css.css);
fs.writeFileSync(path.join(out, "preview.html"), `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>BMW preview harness</title><link rel="stylesheet" href="preview.css"></head><body><div id="root"></div><script src="preview.js"></script></body></html>\n`);
console.log("built", out);
