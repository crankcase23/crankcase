export type ProductCategory = "apparel" | "accessories";

export interface Product {
  id: string;
  slug: string;
  name: string;
  description: string;
  // Price in whole US dollars. Placeholder pricing, not final.
  price: number;
  category: ProductCategory;
  sizes?: string[];
  // Hex color for the placeholder product tile (no real product photography yet).
  tileColor: string;
}
