"use client";

import { useState } from "react";
import { Product } from "@/types/product";
import { addToCart } from "@/lib/cart";
import CrankcaseMark from "@/components/CrankcaseMark";

export default function ProductCard({ product }: { product: Product }) {
  const [size, setSize] = useState(product.sizes?.[0]);
  const [justAdded, setJustAdded] = useState(false);

  function handleAdd() {
    addToCart(product.id, 1, size);
    setJustAdded(true);
    setTimeout(() => setJustAdded(false), 1500);
  }

  return (
    <div className="flex flex-col overflow-hidden rounded-xl border border-slate-800 bg-slate-900">
      <div
        className="flex h-40 items-center justify-center"
        style={{ backgroundColor: product.tileColor }}
      >
        <CrankcaseMark className="h-14 w-14" accentFill="#f97316" panFill="#0f172a" />
      </div>
      <div className="flex flex-1 flex-col gap-2 p-4">
        <h3 className="font-semibold text-slate-100">{product.name}</h3>
        <p className="text-sm text-slate-400">{product.description}</p>
        <div className="mt-auto flex items-center justify-between pt-2">
          <span className="font-semibold text-orange-400">${product.price}</span>
          {product.sizes && (
            <select
              value={size}
              onChange={(e) => setSize(e.target.value)}
              className="rounded-md border border-slate-700 bg-slate-950 px-2 py-1 text-sm text-slate-200"
              aria-label={`Size for ${product.name}`}
            >
              {product.sizes.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          )}
        </div>
        <button
          type="button"
          onClick={handleAdd}
          className="mt-2 rounded-lg bg-orange-500 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-orange-400"
        >
          {justAdded ? "Added ✓" : "Add to Cart"}
        </button>
      </div>
    </div>
  );
}
