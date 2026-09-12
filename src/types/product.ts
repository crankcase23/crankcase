export type ProductCategory = "apparel" | "accessories";

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
  // Hex color for the placeholder product tile, used when imageUrl isn't set.
  tileColor: string;
  // Real product photo (from Printify). When present, ProductCard shows this
  // instead of the colored placeholder tile.
  imageUrl?: string;
  // Printify's product id, so re-running the sync can be traced back to source.
  printifyProductId?: string;
}
