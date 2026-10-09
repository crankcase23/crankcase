// RECONSTRUCTED TEST suite — quarantine / labeling. Not derived from the lost 158/94/90 suites.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { sha256 } from "../src/canon.mjs";
import { RECONSTRUCTION_BANNER } from "../src/enums.mjs";
import { REGISTRY } from "./support/fixtures.mjs";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const list = (d, ext) => fs.readdirSync(path.join(root, d)).filter((f) => f.endsWith(ext)).map((f) => path.join(root, d, f));

test("RECONSTRUCTED TEST: recovered/ files still match their frozen SHA256 (nothing modified)", () => {
  const lines = fs.readFileSync(path.join(root, "recovered/SHA256SUMS.txt"), "utf8").trim().split("\n");
  assert.ok(lines.length >= 10);
  for (const l of lines) { const [h, f] = l.split(/\s+/); assert.equal(sha256(fs.readFileSync(path.join(root, "recovered", f))), h, f); }
});

// IN-REPO ADAPTATION (recovery branch): git does not track the read-only bit, so a fresh checkout is always writable and this
// check cannot hold there. Immutability of recovered/ is enforced in the repo by the SHA256SUMS test above plus code review.
// The original assertion is kept verbatim and runs when GF_ENFORCE_READONLY=1 (e.g. on a locked-down archive copy).
test("RECONSTRUCTED TEST: recovered/ files are read-only on disk", { skip: process.env.GF_ENFORCE_READONLY === "1" ? false : "SKIPPED (not passed): git checkouts are writable; set GF_ENFORCE_READONLY=1 on a locked copy. Hash freeze is enforced by the SHA256SUMS test." }, () => {
  const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]));
  for (const f of walk(path.join(root, "recovered"))) assert.equal(fs.statSync(f).mode & 0o222, 0, `${f} is writable`);
});

test("RECONSTRUCTED TEST: every src/*.mjs carries the RECONSTRUCTED-V1 / not-the-original header", () => {
  for (const f of list("src", ".mjs")) { const head = fs.readFileSync(f, "utf8").split("\n").slice(0, 2).join("\n"); assert.match(head, /RECONSTRUCTED-V1/, f); assert.match(head, /NOT the lost original/i, f); }
});

test("RECONSTRUCTED TEST: no src file writes into recovered/", () => {
  for (const f of list("src", ".mjs")) assert.ok(!/recovered\//.test(fs.readFileSync(f, "utf8")), `${f} mentions recovered/`);
});

test("RECONSTRUCTED TEST: the banner text is exact", () => {
  assert.equal(RECONSTRUCTION_BANNER, "THIS GUIDE FACTORY IMPLEMENTATION IS RECONSTRUCTED FROM SURVIVING EVIDENCE. IT IS NOT THE LOST ORIGINAL IMPLEMENTATION.");
  for (const f of ["README-RECONSTRUCTED.md", ...fs.readdirSync(path.join(root, "docs")).map((d) => `docs/${d}`)]) assert.ok(fs.readFileSync(path.join(root, f), "utf8").startsWith("**" + RECONSTRUCTION_BANNER), `${f} must open with the banner`);
});

test("RECONSTRUCTED TEST: fixture registry equals the recovered applications.json", () => {
  assert.deepEqual(JSON.parse(fs.readFileSync(path.join(root, "recovered/visual-sources/applications.json"), "utf8")), REGISTRY);
});
