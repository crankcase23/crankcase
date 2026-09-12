import type { Metadata } from "next";
import { PRODUCTS } from "@/data/products";
import ProductCard from "@/components/ProductCard";

export const metadata: Metadata = {
  title: "Swag Store",
  description: "Crankcase Garage merch, tees, hoodies, hats, and stickers. Preview catalog, checkout coming soon.",
};

export default function SwagPage() {
  const apparel = PRODUCTS.filter((p) => p.category === "apparel");
  const accessories = PRODUCTS.filter((p) => p.category === "accessories");

  return (
    <div className="mx-auto max-w-5xl px-4 py-12">
      <div className="mb-10">
        <h1 className="text-3xl font-bold text-slate-100">Swag Store</h1>
        <p className="mt-2 max-w-2xl text-slate-400">
          A first look at Crankcase Garage merch. Designs, sizing, and pricing below are placeholders while we
          finalize a print-on-demand partner, browse and add things to your cart, but checkout isn&apos;t live yet.
        </p>
      </div>

      <section className="mb-12">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-500">Apparel</h2>
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {apparel.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      </section>

      <section>
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-500">Accessories</h2>
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {accessories.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      </section>
    </div>
  );
}
