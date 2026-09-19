import type { Metadata } from "next";
import { PRODUCTS } from "@/data/products";
import SwagCatalog from "@/components/SwagCatalog";

export const metadata: Metadata = {
  title: "Swag Store",
  description: "Crankcase Garage merch, tees, hoodies, hats, and stickers. Preview catalog, checkout coming soon.",
};

export default function SwagPage() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-12">
      <div className="mb-10">
        <h1 className="text-3xl font-bold text-slate-100">Swag Store</h1>
        <p className="mt-2 max-w-2xl text-slate-400">
          A first look at Crankcase Garage merch. Designs, sizing, and pricing below are placeholders while we
          finalize a print-on-demand partner, browse and add things to your cart, but checkout isn&apos;t live yet.
        </p>
      </div>

      <SwagCatalog products={PRODUCTS} />
    </div>
  );
}
