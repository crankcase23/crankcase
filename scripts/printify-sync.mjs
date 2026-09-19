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
// - Category ("shirts" | "sweatshirts" | "hoodies" | "hats" | "accessories")
//   is guessed from the product title: "hoodie" -> hoodies, "sweatshirt"/
//   "crewneck" -> sweatshirts, "hat"/"cap"/"beanie"/"trucker" -> hats,
//   "tee"/"t-shirt"/"shirt"/"tank" -> shirts, everything else (mugs,
//   stickers, keychains, etc.) -> accessories. Printify's "API" store type
//   doesn't expose a tags field in its editor, so there's nothing to
//   hand-tag; rename the product in Printify if it lands in the wrong
//   section, or add a keyword to the matching list below.
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
// - fullDescription carries the complete, untruncated description (for the
//   product detail page); description stays the ~180-char card blurb.
// - Each color also gets a backImageUrl when Printify has a "back"-angle
//   mockup for it (see pickBackImage's comment for the caveat on how that's
//   detected), and every product gets up to 6 additionalImageUrls (its
//   other mockups) for the detail page's photo gallery.
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

function cleanText(html) {
  return html
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, " ")
    .trim();
}

// Short blurb for the catalog card grid.
function stripHtml(html) {
  const text = cleanText(html);
  return text.length > 180 ? `${text.slice(0, 177)}...` : text;
}

// Complete, untruncated description for the product detail page.
function stripHtmlFull(html) {
  return cleanText(html);
}

const VALID_CATEGORIES = ["shirts", "sweatshirts", "hoodies", "hats", "accessories"];

// Checked in this order — "sweatshirt" contains the substring "shirt", so
// sweatshirts must be matched before the shirt keywords or every sweatshirt
// would land in "shirts".
const HOODIE_KEYWORDS = ["hoodie"];
const SWEATSHIRT_KEYWORDS = ["sweatshirt", "crewneck", "crew neck"];
const HAT_KEYWORDS = ["hat", "cap", "beanie", "trucker"];
const SHIRT_KEYWORDS = ["tee", "t-shirt", "shirt", "tank"];

function pickCategory(tags, title) {
  // Printify's "API" store type doesn't expose a product tags field in its
  // editor UI, so tags will normally be empty — this is here in case that
  // ever changes, or you tag products some other way via the API directly.
  const lower = (tags ?? []).map((t) => t.toLowerCase());
  const tagMatch = VALID_CATEGORIES.find((c) => lower.includes(c));
  if (tagMatch) return tagMatch;

  // Practical fallback: guess from the product title.
  const t = (title ?? "").toLowerCase();
  if (HOODIE_KEYWORDS.some((k) => t.includes(k))) return "hoodies";
  if (SWEATSHIRT_KEYWORDS.some((k) => t.includes(k))) return "sweatshirts";
  if (HAT_KEYWORDS.some((k) => t.includes(k))) return "hats";
  if (SHIRT_KEYWORDS.some((k) => t.includes(k))) return "shirts";
  return "accessories";
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

// Finds a "back of garment" mockup among the images tied to a given color's
// variants. Printify's own images[] entries carry a `position` field for
// which side of the product a mockup shows (e.g. "front"/"back") on the
// product types that have one — apparel does, a mug or sticker sheet
// doesn't. When that field is present and one of the matching images is
// tagged "back", use it. Falls back to undefined (no back view) rather than
// guessing, since a wrong guess (a folded-flat shot, a close-up) would be
// worse than simply not showing a second angle.
//
// CAVEAT: this has only been checked against this shop's own catalog by
// reading rendered mockup URLs in Printify's UI, not against raw API JSON
// (this sandbox can't reach api.printify.com to confirm the exact field
// name/values Printify sends back). If a real sync run doesn't pick up back
// images that clearly exist in Printify's mockup library, log one raw
// `images` entry and check its actual field names against this function.
function pickBackImage(matchingImages) {
  if (!matchingImages || matchingImages.length === 0) return undefined;
  const back = matchingImages.find((img) => /back/i.test(img.position ?? ""));
  return back?.src;
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

      // Variant.options is an array of option-VALUE ids, but Printify does
      // NOT reliably keep it in the same group order for every variant —
      // e.g. on one hat, "One size / Black" came back as [size, color] while
      // "One size / White" came back as [color, size]. So match by checking
      // whether this value's id appears ANYWHERE in a variant's options,
      // never by position (value ids are unique across all option groups,
      // so membership is unambiguous).
      //
      // Also require is_enabled: a color group's `values` list is every
      // swatch the underlying blueprint supports (Gildan 2000 alone offers
      // 60+, a trucker hat's multi-tone combos included), not just the ones
      // actually picked for this product — Printify still creates a variant
      // entry for each with is_enabled: false. Only a color with at least
      // one is_enabled variant was actually chosen in Printify's "Select
      // variants" picker. (Not checking is_available too: a picked color's
      // one SKU can be flagged out of stock by the supplier without the
      // merchant having removed the color — same reasoning as pickSizes()
      // above not checking per-variant availability.)
      const variantIds = (variants ?? [])
        .filter((v) => Array.isArray(v.options) && v.options.includes(value.id) && v.is_enabled)
        .map((v) => v.id);
      if (variantIds.length === 0) return null;

      const matchingImages = (images ?? []).filter(
        (img) => Array.isArray(img.variant_ids) && img.variant_ids.some((id) => variantIds.includes(id))
      );
      const image = matchingImages.find((img) => img.is_default) ?? matchingImages[0];
      const backImage = pickBackImage(matchingImages);

      return { name: value.title, hex, imageUrl: image?.src, backImageUrl: backImage };
    })
    .filter(Boolean);

  return colors.length ? colors : undefined;
}

// Extra photos for the detail page's gallery: every mockup for the product
// beyond the one used as its main card image, capped so a hat with a dozen
// lifestyle shots doesn't turn the gallery into a wall of thumbnails.
const MAX_ADDITIONAL_IMAGES = 6;

function pickAdditionalImages(images, mainImageUrl) {
  if (!images || images.length === 0) return undefined;
  const extras = images
    .map((img) => img.src)
    .filter((src) => src && src !== mainImageUrl);
  const unique = Array.from(new Set(extras)).slice(0, MAX_ADDITIONAL_IMAGES);
  return unique.length ? unique : undefined;
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
  const description = stripHtml(printifyProduct.description ?? "");
  const fullDescription = stripHtmlFull(printifyProduct.description ?? "");
  const imageUrl = pickImage(printifyProduct.images);
  const colors = pickColors(printifyProduct.options, printifyProduct.variants, printifyProduct.images);

  return {
    id: `printify-${printifyProduct.id}`,
    slug: slugify(printifyProduct.title),
    name: printifyProduct.title,
    description,
    // Only worth a separate field when it actually differs from the
    // truncated blurb — keeps products.ts from carrying a duplicate copy of
    // every short description.
    fullDescription: fullDescription !== description ? fullDescription : undefined,
    price: pickPrice(printifyProduct.variants),
    category: pickCategory(printifyProduct.tags, printifyProduct.title),
    sizes: pickSizes(printifyProduct.options),
    colors,
    tileColor: FALLBACK_TILE_COLOR,
    imageUrl,
    // Product-level fallback back image: whichever color's back view would
    // otherwise show first (or the default image's own match, for products
    // with no color options at all).
    backImageUrl: colors?.find((c) => c.backImageUrl)?.backImageUrl,
    additionalImageUrls: pickAdditionalImages(printifyProduct.images, imageUrl),
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
      p.fullDescription ? `    fullDescription: ${JSON.stringify(p.fullDescription)},` : null,
      `    price: ${p.price},`,
      `    category: ${JSON.stringify(p.category)},`,
      p.sizes ? `    sizes: ${JSON.stringify(p.sizes)},` : null,
      p.colors ? `    colors: ${JSON.stringify(p.colors)},` : null,
      `    tileColor: ${JSON.stringify(p.tileColor)},`,
      p.imageUrl ? `    imageUrl: ${JSON.stringify(p.imageUrl)},` : null,
      p.backImageUrl ? `    backImageUrl: ${JSON.stringify(p.backImageUrl)},` : null,
      p.additionalImageUrls ? `    additionalImageUrls: ${JSON.stringify(p.additionalImageUrls)},` : null,
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
