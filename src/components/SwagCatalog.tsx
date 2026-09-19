"use client";

import { useMemo, useState } from "react";
import type { Product, ProductCategory } from "@/types/product";
import ProductCard from "@/components/ProductCard";

const CATEGORY_LABELS: Record<ProductCategory, string> = {
  shirts: "Shirts",
  sweatshirts: "Sweatshirts",
  hoodies: "Hoodies",
  hats: "Hats",
  accessories: "Accessories",
};

// Preferred display order for the filter buttons. A category only shows up
// as a button when at least one product actually has it, so an empty
// category (e.g. no sweatshirts in the catalog yet) doesn't leave a dead
// tab with nothing behind it — it just appears automatically once a
// product in that category exists.
const CATEGORY_ORDER: ProductCategory[] = ["shirts", "sweatshirts", "hoodies", "hats", "accessories"];

export default function SwagCatalog({ products }: { products: Product[] }) {
  const [active, setActive] = useState<ProductCategory | "all">("all");

  const categories = useMemo(
    () => CATEGORY_ORDER.filter((category) => products.some((p) => p.category === category)),
    [products]
  );

  const visible = active === "all" ? products : products.filter((p) => p.category === active);

  return (
    <div>
      <div className="mb-8 flex flex-wrap gap-2">
        <FilterButton label="All" isActive={active === "all"} onClick={() => setActive("all")} />
        {categories.map((category) => (
          <FilterButton
            key={category}
            label={CATEGORY_LABELS[category]}
            isActive={active === category}
            onClick={() => setActive(category)}
          />
        ))}
      </div>

      {visible.length === 0 ? (
        <p className="text-slate-400">No products in this category yet.</p>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {visible.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      )}
    </div>
  );
}

function FilterButton({
  label,
  isActive,
  onClick,
}: {
  label: string;
  isActive: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={isActive}
      className={`rounded-full border px-4 py-1.5 text-sm font-semibold transition ${
        isActive
          ? "border-orange-400 bg-orange-500 text-slate-950"
          : "border-slate-700 bg-slate-900 text-slate-300 hover:border-slate-500 hover:text-slate-100"
      }`}
    >
      {label}
    </button>
  );
}
