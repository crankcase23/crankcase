import { test } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const require = createRequire(import.meta.url);
const esbuild = require("esbuild");
const out = await esbuild.build({
  entryPoints: [path.join(ROOT, "src/db/resolveDatabaseUrl.ts")], bundle: true, format: "esm", platform: "node", write: false,
});
const { resolveDatabaseUrl } = await import("data:text/javascript;base64," + Buffer.from(out.outputFiles[0].text).toString("base64"));

const PROD = "postgres://prod-host/prod";
const PREV = "postgres://preview-host/preview";

test("production and local use DATABASE_URL", () => {
  assert.equal(resolveDatabaseUrl({ VERCEL_ENV: "production", DATABASE_URL: PROD }), PROD);
  assert.equal(resolveDatabaseUrl({ DATABASE_URL: PROD }), PROD); // local / tests / CI: no VERCEL_ENV
  assert.equal(resolveDatabaseUrl({ VERCEL_ENV: "development", DATABASE_URL: PROD }), PROD);
});

test("preview uses PREVIEW_DB_DATABASE_URL, never DATABASE_URL", () => {
  assert.equal(resolveDatabaseUrl({ VERCEL_ENV: "preview", DATABASE_URL: PROD, PREVIEW_DB_DATABASE_URL: PREV }), PREV);
});

test("preview FAILS CLOSED: no preview URL means no database, not the production one", () => {
  assert.equal(resolveDatabaseUrl({ VERCEL_ENV: "preview", DATABASE_URL: PROD }), undefined);
  assert.equal(resolveDatabaseUrl({ VERCEL_ENV: "preview", DATABASE_URL: PROD, PREVIEW_DB_DATABASE_URL: "" }), undefined);
});

test("production never reads the preview URL", () => {
  assert.equal(resolveDatabaseUrl({ VERCEL_ENV: "production", DATABASE_URL: PROD, PREVIEW_DB_DATABASE_URL: PREV }), PROD);
});
