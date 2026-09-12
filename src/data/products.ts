import { Product } from "@/types/product";

// Placeholder catalog, no real product photography, sizing, or final pricing yet.
// Tile colors/descriptions are stand-ins until Andy picks real designs and a print-on-demand provider.
export const PRODUCTS: Product[] = [
  {
    id: "tee-sump-mark",
    slug: "sump-mark-tee",
    name: "Sump Mark Tee",
    description: "Soft cotton tee with the Sump Mark on the chest. Charcoal with the brass/orange mark.",
    price: 24,
    category: "apparel",
    sizes: ["S", "M", "L", "XL", "XXL"],
    tileColor: "#1e293b",
  },
  {
    id: "hoodie-sump-mark",
    slug: "sump-mark-hoodie",
    name: "Sump Mark Hoodie",
    description: "Heavyweight pullover hoodie, same Sump Mark chest print, lined pocket.",
    price: 48,
    category: "apparel",
    sizes: ["S", "M", "L", "XL", "XXL"],
    tileColor: "#0f172a",
  },
  {
    id: "hat-trucker",
    slug: "garage-trucker-hat",
    name: "Garage Trucker Hat",
    description: "Structured trucker hat, mesh back, embroidered wordmark on the front panel.",
    price: 22,
    category: "apparel",
    tileColor: "#292524",
  },
  {
    id: "sticker-pack",
    slug: "sump-mark-sticker-pack",
    name: "Sump Mark Sticker Pack",
    description: "5 vinyl stickers, the Sump Mark, the full wordmark, and 3 shop-quote stickers for the toolbox.",
    price: 8,
    category: "accessories",
    tileColor: "#f97316",
  },
  {
    id: "mug-shop",
    slug: "shop-mug",
    name: "Shop Mug",
    description: "12oz ceramic mug for the coffee that gets you through a brake job. Sump Mark on the side.",
    price: 16,
    category: "accessories",
    tileColor: "#44403c",
  },
  {
    id: "keychain-enamel",
    slug: "sump-mark-keychain",
    name: "Sump Mark Enamel Keychain",
    description: "Hard enamel keychain, the Sump Mark in brass and charcoal, keyring included.",
    price: 12,
    category: "accessories",
    tileColor: "#78350f",
  },
];

export function getProductBySlug(slug: string): Product | undefined {
  return PRODUCTS.find((p) => p.slug === slug);
}
