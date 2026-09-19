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

  // On "All", group products into labeled sections by category (same idea as
  // the vehicle page's GuideGroups: a job you came for sits under the heading
  // you'd have looked for it under, instead of one undifferentiated pile).
  // Once a specific category is picked, that grouping is redundant with the
  // active filter button, so it collapses to a single flat grid.
  const sections = useMemo(() => {
    if (active !== "all") {
      return [{ category: active, items: products.filter((p) => p.category === active) }];
    }
    return categories.map((category) => ({
      category,
      items: products.filter((p) => p.category === category),
    }));
  }, [active, categories, products]);

  const isEmpty = sections.every((s) => s.items.length === 0);

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

      {isEmpty ? (
        <p className="text-slate-400">No products in this category yet.</p>
      ) : active === "all" ? (
        <div className="space-y-10">
          {sections.map((section) => (
            <div key={section.category}>
              <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-orange-400">
                {CATEGORY_LABELS[section.category]}
                <span className="rounded-full bg-slate-800 px-2 py-0.5 text-[11px] font-medium text-slate-400">
                  {section.items.length}
                </span>
              </h2>
              <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {section.items.map((product) => (
                  <ProductCard key={product.id} product={product} />
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {sections[0].items.map((product) => (
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
