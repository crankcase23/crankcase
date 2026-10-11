#!/usr/bin/env node
// One command: build the no-login preview harness into a temp dir and drive all 16 BMW drafts (desktop + phone).
//   npm run bmw:preview -- --out DIR [--shots all|key|none] [--slugs a,b]
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
const here = path.dirname(fileURLToPath(import.meta.url));
const a = process.argv.slice(2);
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "bmw-preview-"));
const run = (f, args) => spawnSync(process.execPath, [path.join(here, f), ...args], { stdio: "inherit" }).status ?? 1;
if (run("build.mjs", ["--out", tmp])) process.exit(1);
process.exit(run("capture.mjs", ["--dir", tmp, ...(a.includes("--out") ? [] : ["--out", path.join(tmp, "shots")]), ...a]));
