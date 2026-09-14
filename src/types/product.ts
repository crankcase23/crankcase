export type ProductCategory = "apparel" | "accessories";

export interface ProductColor {
  // Display name from Printify, e.g. "Black", "Heather Grey".
  name: string;
  // Swatch color as a hex string (Printify's own value for this color), e.g. "#0f172a".
  hex: string;
  // Product photo for this specific color, when Printify has one tied to it.
  // Falls back to the product's main imageUrl when not set.
  imageUrl?: string;
}

export interface Product {
  id: string;
  slug: string;
  name: string;
  description: string;
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
  // Printify's product id, so re-running the sync can be traced back to source.
  printifyProductId?: string;
}
