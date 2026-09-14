// One-off sync script: pulls the real product catalog from Printify and
// regenerates src/data/products.ts from it.
//
// Usage (from the repo root, Node 20+):
//   node --env-file=.env.local scripts/printify-sync.mjs
//
// Requires two env vars (put them in .env.local, which is gitignored — never
// commit real values):
//   PRINTIFY_API_TOKEN - Personal Access Token, from Printify > My Profile > Connections
//   PRINTIFY_SHOP_ID   - the numeric id of your Printify store (find it by
//                        hitting GET https://api.printify.com/v1/shops.json
//                        with the token above, or from the store URL in the
//                        Printify dashboard)
//
// What it does:
// - Fetches every product in the shop (paginated) via the Printify API.
// - Keeps only products marked `visible: true` in Printify.
// - Category ("apparel" vs "accessories") is guessed from the product title
//   (sticker/mug/keychain/etc. -> accessories, everything else -> apparel,
//   hats included). Printify's "API" store type doesn't expose a tags field
//   in its editor, so there's nothing to hand-tag; rename the product in
//   Printify if it lands in the wrong section.
// - Sizes come from a Printify option group named "Size" if the product has
//   one. This is a simple first pass: it lists every size value Printify has
//   for the product, it does NOT check per-variant availability, so a
//   sold-out single size can still show as selectable. Fine for a
//   browse-only catalog with checkout disabled; revisit before real checkout.
// - Colors come from a Printify option group named "Colors"/"Color", when
//   the product has one. Each color gets its swatch hex (from Printify's
//   own `colors` field on the option value) and, when available, the
//   product photo tied to that color's variants. Colors Printify didn't
//   give a hex for are skipped rather than guessed. IMPORTANT: a Printify
//   option group's `values` list is every color the underlying blueprint
//   (e.g. "Gildan 2000") supports — dozens of them — not just the ones
//   actually offered on this product. Only a color with at least one
//   `is_enabled` variant is a real, selected color; the rest are just the
//   blueprint's full swatch catalog and must be filtered out.
// - Price is the lowest enabled variant's price (Printify prices are in
//   cents), rounded to a whole dollar.
// - Image is the product's default image, falling back to the first image.
//
// Safety: if Printify returns zero visible products (e.g. you haven't
// uploaded anything yet, or the token/shop id is wrong), this script refuses
// to overwrite src/data/products.ts — it would otherwise wipe out the
// existing catalog and leave /swag empty. Fix the setup and re-run.
//
// Re-running this script is the whole "sync": it always fully regenerates
// src/data/products.ts from whatever is in Printify right now. Once you've
// run it successfully, Printify is the source of truth for the catalog —
// don't hand-edit src/data/products.ts afterward, it'll just get overwritten
// next sync.

import { writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const API_BASE = "https://api.printify.com/v1";
const TOKEN = process.env.PRINTIFY_API_TOKEN;
const SHOP_ID = process.env.PRINTIFY_SHOP_ID;

if (!TOKEN || !SHOP_ID) {
  console.error(
    "Missing PRINTIFY_API_TOKEN and/or PRINTIFY_SHOP_ID.\n" +
      "Put both in .env.local and run with: node --env-file=.env.local scripts/printify-sync.mjs"
  );
  process.exit(1);
}

async function printifyFetch(pathname) {
  const res = await fetch(`${API_BASE}${pathname}`, {
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      "User-Agent": "crankcase-garage-sync/1.0",
    },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Printify API ${pathname} -> ${res.status} ${res.statusText}\n${body}`);
  }
  return res.json();
}

async function fetchAllProducts() {
  const all = [];
  let page = 1;
  for (;;) {
    const data = await printifyFetch(
      `/shops/${SHOP_ID}/products.json?page=${page}&limit=50`
    );
    const items = data.data ?? [];
    all.push(...items);
    const lastPage = data.last_page ?? page;
    if (items.length === 0 || page >= lastPage) break;
    page += 1;
  }
  return all;
}

function slugify(title) {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function stripHtml(html) {
  const text = html
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, " ")
    .trim();
  return text.length > 180 ? `${text.slice(0, 177)}...` : text;
}

const ACCESSORY_KEYWORDS = [
  "sticker",
  "mug",
  "keychain",
  "tote",
  "bag",
  "magnet",
  "pin",
  "poster",
  "print",
  "coaster",
  "phone case",
  "mousepad",
  "bottle",
];

function pickCategory(tags, title) {
  // Printify's "API" store type doesn't expose a product tags field in its
  // editor UI, so tags will normally be empty — this is here in case that
  // ever changes, or you tag products some other way via the API directly.
  const lower = (tags ?? []).map((t) => t.toLowerCase());
  if (lower.includes("accessories")) return "accessories";
  if (lower.includes("apparel")) return "apparel";

  // Practical fallback: guess from the product title. A hat/cap still
  // counts as apparel here, matching how this site's catalog is organized.
  const t = (title ?? "").toLowerCase();
  if (ACCESSORY_KEYWORDS.some((k) => t.includes(k))) return "accessories";
  return "apparel";
}

function pickSizes(options) {
  const sizeGroup = (options ?? []).find((o) => /size/i.test(o.name ?? ""));
  if (!sizeGroup) return undefined;
  const values = (sizeGroup.values ?? []).map((v) => v.title).filter(Boolean);
  return values.length ? values : undefined;
}

function pickImage(images) {
  if (!images || images.length === 0) return undefined;
  const def = images.find((i) => i.is_default);
  return (def ?? images[0]).src;
}

function pickColors(options, variants, images) {
  const groupIndex = (options ?? []).findIndex((o) => /colou?rs?/i.test(o.name ?? ""));
  if (groupIndex === -1) return undefined;
  const colorGroup = options[groupIndex];

  const colors = (colorGroup.values ?? [])
    .map((value) => {
      // Printify gives most color option values a `colors` array of hex swatches
      // (two entries for a heather/marl blend) — use the first as the swatch.
      const hex = Array.isArray(value.colors) && value.colors.length > 0 ? value.colors[0] : undefined;
      if (!hex) return null;

      // Variant.options is an array of option-VALUE ids, one per option group,
      // in the same order as the product's `options` array — match this
      // color's value id at this group's position to find its variants.
      // A color group's `values` list is every swatch the underlying
      // blueprint supports (Gildan 2000 alone offers 60+), not just the
      // ones actually offered on this product — `product.variants` is
      // already scoped to only the combinations picked in Printify's
      // "Select variants" picker, so requiring at least one matching
      // variant here (any status) is enough to drop the blueprint-only
      // colors. Deliberately NOT filtering on is_enabled/is_available: a
      // color the merchant picked can still have its one SKU flagged
      // unavailable by the supplier (e.g. a sold-out size), and that
      // shouldn't erase the whole color from the picker — same reasoning
      // as pickSizes() above not checking per-variant availability.
      const variantIds = (variants ?? [])
        .filter((v) => Array.isArray(v.options) && v.options[groupIndex] === value.id)
        .map((v) => v.id);
      if (variantIds.length === 0) return null;

      const matchingImages = (images ?? []).filter(
        (img) => Array.isArray(img.variant_ids) && img.variant_ids.some((id) => variantIds.includes(id))
      );
      const image = matchingImages.find((img) => img.is_default) ?? matchingImages[0];

      return { name: value.title, hex, imageUrl: image?.src };
    })
    .filter(Boolean);

  return colors.length ? colors : undefined;
}

function pickPrice(variants) {
  const enabled = (variants ?? []).filter((v) => v.is_enabled && v.is_available);
  const pool = enabled.length ? enabled : variants ?? [];
  if (pool.length === 0) return 0;
  const cents = Math.min(...pool.map((v) => v.price));
  return Math.round(cents / 100);
}

const FALLBACK_TILE_COLOR = "#1e293b";

function toProduct(printifyProduct) {
  return {
    id: `printify-${printifyProduct.id}`,
    slug: slugify(printifyProduct.title),
    name: printifyProduct.title,
    description: stripHtml(printifyProduct.description ?? ""),
    price: pickPrice(printifyProduct.variants),
    category: pickCategory(printifyProduct.tags, printifyProduct.title),
    sizes: pickSizes(printifyProduct.options),
    colors: pickColors(printifyProduct.options, printifyProduct.variants, printifyProduct.images),
    tileColor: FALLBACK_TILE_COLOR,
    imageUrl: pickImage(printifyProduct.images),
    printifyProductId: String(printifyProduct.id),
  };
}

function renderProductsFile(products) {
  const lines = products.map((p) => {
    const fields = [
      `    id: ${JSON.stringify(p.id)},`,
      `    slug: ${JSON.stringify(p.slug)},`,
      `    name: ${JSON.stringify(p.name)},`,
      `    description: ${JSON.stringify(p.description)},`,
      `    price: ${p.price},`,
      `    category: ${JSON.stringify(p.category)},`,
      p.sizes ? `    sizes: ${JSON.stringify(p.sizes)},` : null,
      p.colors ? `    colors: ${JSON.stringify(p.colors)},` : null,
      `    tileColor: ${JSON.stringify(p.tileColor)},`,
      p.imageUrl ? `    imageUrl: ${JSON.stringify(p.imageUrl)},` : null,
      p.printifyProductId ? `    printifyProductId: ${JSON.stringify(p.printifyProductId)},` : null,
    ].filter(Boolean);
    return `  {\n${fields.join("\n")}\n  }`;
  });

  return `import { Product } from "@/types/product";

// GENERATED by scripts/printify-sync.mjs — do not hand-edit, it gets
// overwritten on the next sync. Last synced: ${new Date().toISOString()}
export const PRODUCTS: Product[] = [
${lines.join(",\n")},
];

export function getProductBySlug(slug: string): Product | undefined {
  return PRODUCTS.find((p) => p.slug === slug);
}
`;
}

async function main() {
  console.log(`Fetching products for shop ${SHOP_ID}...`);
  const raw = await fetchAllProducts();
  const visible = raw.filter((p) => p.visible);
  console.log(`Found ${raw.length} product(s), ${visible.length} visible.`);

  if (visible.length === 0) {
    console.error(
      "No visible products came back from Printify — refusing to overwrite " +
        "src/data/products.ts (that would empty out /swag). Upload and " +
        "publish at least one product in Printify, then re-run."
    );
    process.exit(1);
  }

  const products = visible.map(toProduct);
  const fileContents = renderProductsFile(products);

  const outPath = path.join(
    path.dirname(fileURLToPath(import.meta.url)),
    "..",
    "src",
    "data",
    "products.ts"
  );
  await writeFile(outPath, fileContents, "utf-8");
  console.log(`Wrote ${products.length} product(s) to ${outPath}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
