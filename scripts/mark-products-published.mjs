#!/usr/bin/env node
// One-time fix: tell Printify these products finished publishing.
//
// Every product in this store is stuck showing "Publishing" in the Printify
// dashboard, and while a product is in that state Printify disables editing
// its design, price, duplicating it, and deleting it — everything. That
// state is supposed to clear when the sales channel confirms the product
// import succeeded, but our site is a read-only consumer of the Printify
// API, not a real sales-channel integration that calls back — so nothing
// ever tells Printify "yep, got it, we're done." This script sends that
// confirmation by hand, for every product currently stuck.
//
// Run this once from a machine with `.env.local` present (needs
// PRINTIFY_API_TOKEN + PRINTIFY_SHOP_ID, which are already in this repo's
// .env.local):
//
//   node scripts/mark-products-published.mjs
//
// Safe to re-run — Printify just no-ops on an already-published product.

import { readFileSync, existsSync } from "node:fs";
import path from "node:path";

function loadEnvLocal() {
  const envPath = path.resolve(process.cwd(), ".env.local");
  if (!existsSync(envPath)) return;
  for (const line of readFileSync(envPath, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim();
    if (!(key in process.env)) process.env[key] = value;
  }
}

loadEnvLocal();

const TOKEN = process.env.PRINTIFY_API_TOKEN;
const SHOP_ID = process.env.PRINTIFY_SHOP_ID;
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://crankcasegarage.vercel.app";

if (!TOKEN || !SHOP_ID) {
  console.error(
    "Missing PRINTIFY_API_TOKEN or PRINTIFY_SHOP_ID (checked .env.local and process.env)."
  );
  process.exit(1);
}

// Every product currently stuck in "Publishing" in the Printify dashboard.
// `slug` is only used to build a cosmetic "handle" URL for Printify's own
// records — it doesn't need to resolve to a real per-product page.
const PRODUCTS = [
  { id: "6aa4db3db64b58138306526d", slug: "sump-mark-tee" },
  { id: "6aa7511990272f2ad80e9ac3", slug: "sump-mark-hoodie" },
  { id: "6aa751abc873c20060032651", slug: "garage-trucker-hat" },
  { id: "6aa7534a554068c3710fecac", slug: "sump-mark-sticker-pack" },
  { id: "6aa753fa6ddcf1f9d7024506", slug: "shop-mug" },
  { id: "6aa754cb9cc826e1120571ce", slug: "sump-mark-enamel-keychain" },
];

async function markPublished({ id, slug }) {
  const res = await fetch(
    `https://api.printify.com/v1/shops/${SHOP_ID}/products/${id}/publishing_succeeded.json`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        external: {
          id,
          handle: `${SITE_URL}/swag#${slug}`,
        },
      }),
    }
  );

  if (res.ok) {
    console.log(`OK   ${slug} (${id}) marked published`);
  } else {
    const body = await res.text();
    console.error(`FAIL ${slug} (${id}): ${res.status} ${body}`);
  }
}

for (const product of PRODUCTS) {
  await markPublished(product);
}

console.log(
  "\nDone. Refresh My Products in Printify -- status should now read Published, and edit/duplicate/delete should be unlocked."
);
