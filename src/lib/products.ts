import type { Product, ProductColor } from "@/types/product";

// Most of this catalog is worn in a garage, where white is a genuinely bad
// idea (see: every stain a mechanic has ever caused). Default the color
// swatch to Black when a product offers it, rather than whatever color
// happens to be first in Printify's own variant order (usually White).
// Falls back to the first color when there's no Black option at all.
const PREFERRED_DEFAULT_COLOR = "black";

export function pickDefaultColor(colors?: ProductColor[]): ProductColor | undefined {
  if (!colors || colors.length === 0) return undefined;
  return (
    colors.find((c) => c.name.toLowerCase() === PREFERRED_DEFAULT_COLOR) ?? colors[0]
  );
}

export function productHref(product: Product): string {
  return `/swag/${product.slug}`;
}
