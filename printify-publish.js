#!/usr/bin/env node
/**
 * Printify custom-store publish helper.
 *
 * ROOT CAUSE (per Printify support, 2026-09-19): for a store connected via
 * the Printify API as a "custom" integration (not a native Etsy/Shopify/etc.
 * channel), the "Publish" button in the Printify web UI does NOT work. It
 * kicks off Printify's standard publish flow, which expects the external
 * integration to call back and confirm success (`publishing_succeeded.json`).
 * Nothing on our side does that automatically, so products get permanently
 * stuck showing "Publishing" no matter how many times you click Publish.
 *
 * This script does the full API-side publish handshake a real custom
 * integration is supposed to do:
 *   1. publishing_failed.json  -> clears any currently-stuck publish attempt
 *   2. publish.json            -> tells Printify which fields to publish
 *   3. publishing_succeeded.json -> confirms success with an external id/handle,
 *                                    which is the step that actually flips the
 *                                    status to "Published"
 *
 * USE THIS INSTEAD OF THE "PUBLISH" BUTTON for every future product on this
 * shop (Shop ID 28911308) to avoid the same stuck-forever problem.
 *
 * Setup:
 *   - Requires PRINTIFY_API_TOKEN in the environment or in .env.local
 *     (get it from Printify > My Profile > Connections > Generate new token,
 *     or reuse whatever token the sync:printify script already uses)
 *   - Node 18+ (uses built-in fetch)
 *
 * Usage:
 *   node printify-publish.js --fix-stuck
 *       Fixes the two known-stuck launch shirts (No F*cks Given Tee,
 *       Dirty Things Tee) end to end.
 *
 *   node printify-publish.js <product_id> --title "Product Title"
 *       Full publish handshake for any one product going forward.
 *
 *   node printify-publish.js <product_id> --reset-only
 *       Just clears a stuck "Publishing" status without republishing
 *       (use if you want to fix the pricing/design first, then publish
 *       separately).
 *
 * Optional flags:
 *   --external-id ID           override the external id sent to Printify
 *   --external-handle HANDLE   override the external handle/URL sent to Printify
 *   --shop-id ID                override shop id (defaults to 28911308)
 */

const fs = require('fs');
const path = require('path');

function loadEnvLocal() {
  const envPath = path.join(process.cwd(), '.env.local');
  if (!fs.existsSync(envPath)) return;
  const lines = fs.readFileSync(envPath, 'utf8').split('\n');
  for (const line of lines) {
    const m = line.match(/^\s*([\w.-]+)\s*=\s*(.*)\s*$/);
    if (!m) continue;
    const key = m[1];
    let val = (m[2] || '').trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = val;
  }
}
loadEnvLocal();

function getFlag(args, name) {
  const i = args.indexOf(`--${name}`);
  return i !== -1 ? args[i + 1] : undefined;
}

function slugify(str) {
  return String(str)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

async function callPrintify(baseUrl, token, productId, endpoint, body) {
  const url = `${baseUrl}/${productId}/${endpoint}.json`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json;
  try {
    json = text ? JSON.parse(text) : {};
  } catch {
    json = text;
  }
  return { status: res.status, ok: res.ok, body: json };
}

async function fullPublish(baseUrl, token, productId, title, opts = {}) {
  const { resetOnly, externalId, externalHandle } = opts;

  console.log(`\n[${productId}] Step 1/3: clearing any stuck publish attempt (publishing_failed)...`);
  const r1 = await callPrintify(baseUrl, token, productId, 'publishing_failed', {
    reason: 'Resetting stuck custom-store publish before republishing via API.',
  });
  console.log(`[${productId}]   -> HTTP ${r1.status}`, r1.ok ? 'OK' : JSON.stringify(r1.body));

  if (resetOnly) {
    console.log(`[${productId}] --reset-only set, stopping here.`);
    return;
  }

  console.log(`[${productId}] Step 2/3: triggering publish...`);
  const r2 = await callPrintify(baseUrl, token, productId, 'publish', {
    title: true,
    description: true,
    images: true,
    variants: true,
    tags: true,
    keyFeatures: true,
    shipping_template: true,
  });
  console.log(`[${productId}]   -> HTTP ${r2.status}`, r2.ok ? 'OK' : JSON.stringify(r2.body));

  const slug = slugify(title || productId);
  const finalExternalId = externalId || slug;
  const finalExternalHandle = externalHandle || `https://crankcasegarage.com/swag/${slug}`;

  console.log(`[${productId}] Step 3/3: confirming publish succeeded (external id: ${finalExternalId})...`);
  const r3 = await callPrintify(baseUrl, token, productId, 'publishing_succeeded', {
    external: {
      id: finalExternalId,
      handle: finalExternalHandle,
    },
  });
  console.log(`[${productId}]   -> HTTP ${r3.status}`, r3.ok ? 'OK' : JSON.stringify(r3.body));

  console.log(`[${productId}] Done. Check https://printify.com/app/store/products/1 — should now show "Published".`);
}

const KNOWN_STUCK = [
  { id: '6aab67af3415bd15880a09e0', title: 'No F*cks Given Tee' },
  { id: '6aabf9606dd21b409403d432', title: 'Dirty Things Tee' },
];

async function main() {
  const args = process.argv.slice(2);
  const shopId = getFlag(args, 'shop-id') || process.env.PRINTIFY_SHOP_ID || '28911308';
  const token = process.env.PRINTIFY_API_TOKEN;

  if (!token) {
    console.error(
      'Missing PRINTIFY_API_TOKEN. Set it in .env.local (same value your sync:printify script uses) or export it in your shell.'
    );
    process.exit(1);
  }

  const baseUrl = `https://api.printify.com/v1/shops/${shopId}/products`;

  if (args.includes('--fix-stuck')) {
    console.log(`Fixing the ${KNOWN_STUCK.length} known-stuck products on shop ${shopId}...`);
    for (const p of KNOWN_STUCK) {
      await fullPublish(baseUrl, token, p.id, p.title);
    }
    console.log('\nAll done. Re-check https://printify.com/app/store/products/1 for both products.');
    return;
  }

  const productId = args[0];
  if (!productId) {
    console.error('Usage:');
    console.error('  node printify-publish.js --fix-stuck');
    console.error('  node printify-publish.js <product_id> --title "Product Title" [--reset-only] [--external-id ID] [--external-handle HANDLE]');
    process.exit(1);
  }

  await fullPublish(baseUrl, token, productId, getFlag(args, 'title'), {
    resetOnly: args.includes('--reset-only'),
    externalId: getFlag(args, 'external-id'),
    externalHandle: getFlag(args, 'external-handle'),
  });
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
