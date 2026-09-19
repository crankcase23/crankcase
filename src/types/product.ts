export type ProductCategory = "shirts" | "sweatshirts" | "hoodies" | "hats" | "accessories";

export interface ProductColor {
  // Display name from Printify, e.g. "Black", "Heather Grey".
  name: string;
  // Swatch color as a hex string (Printify's own value for this color), e.g. "#0f172a".
  hex: string;
  // Product photo for this specific color, when Printify has one tied to it.
  // Falls back to the product's main imageUrl when not set.
  imageUrl?: string;
  // Back-of-garment photo for this color, when Printify has a "back" angle
  // mockup for it. Not every product has a back print or a back mockup
  // selected (mugs, keychains, stickers never will) — the detail page only
  // shows a back view when this is set.
  backImageUrl?: string;
}

export interface Product {
  id: string;
  slug: string;
  name: string;
  // Short blurb for the catalog grid card — truncated to ~180 characters so
  // cards stay a consistent height. See fullDescription for the complete text.
  description: string;
  // Complete, untruncated description for the product detail page. Falls
  // back to `description` when a product hasn't been given a longer one
  // (i.e. its full description already fit under the truncation limit).
  fullDescription?: string;
  // Price in whole US dollars. Placeholder pricing for hand-authored products;
  // for Printify-synced products this is the lowest enabled-variant price, rounded.
  price: number;
  category: ProductCategory;
  sizes?: string[];
  // Color options from Printify's "Colors" variant group, when the product has one.
  colors?: ProductColor[];
  // Hex color for the placeholder product tile, used when imageUrl isn't set.
  tileColor: string;
  // Real product photo (from Printify). When present, ProductCard shows this
  // instead of the colored placeholder tile. Acts as the fallback image when
  // a selected color has no imageUrl of its own.
  imageUrl?: string;
  // Back-of-garment photo, used on the detail page when the selected color
  // has no backImageUrl of its own (e.g. a product with no color options).
  backImageUrl?: string;
  // Additional product photos (alternate angles, close-ups, lifestyle shots)
  // shown in the detail page's photo gallery, beyond the main front/back pair.
  additionalImageUrls?: string[];
  // Printify's product id, so re-running the sync can be traced back to source.
  printifyProductId?: string;
}
