"use client";

import { useState } from "react";
import Link from "next/link";
import { Product } from "@/types/product";
import { addToCart } from "@/lib/cart";
import { pickDefaultColor, productHref } from "@/lib/products";
import CrankcaseMark from "@/components/CrankcaseMark";

export default function ProductCard({ product }: { product: Product }) {
  const [size, setSize] = useState(product.sizes?.[0]);
  const [color, setColor] = useState(pickDefaultColor(product.colors)?.name);
  const [justAdded, setJustAdded] = useState(false);

  const selectedColor = product.colors?.find((c) => c.name === color);
  const displayImage = selectedColor?.imageUrl ?? product.imageUrl;

  function handleAdd() {
    addToCart(product.id, 1, size, color);
    setJustAdded(true);
    setTimeout(() => setJustAdded(false), 1500);
  }

  return (
    <div className="flex flex-col overflow-hidden rounded-xl border border-slate-800 bg-slate-900">
      <Link
        href={productHref(product)}
        className="flex h-40 items-center justify-center overflow-hidden"
        style={{ backgroundColor: selectedColor?.hex ?? product.tileColor }}
      >
        {displayImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={displayImage}
            alt={product.name}
            className="h-full w-full object-cover"
          />
        ) : (
          <CrankcaseMark className="h-14 w-14" accentFill="#f97316" panFill="#0f172a" />
        )}
      </Link>
      <div className="flex flex-1 flex-col gap-2 p-4">
        <Link href={productHref(product)} className="w-fit">
          <h3 className="font-semibold text-slate-100 hover:text-orange-400">{product.name}</h3>
        </Link>
        <p className="text-sm text-slate-400">{product.description}</p>

        {product.colors && (
          <div className="flex items-center gap-2 pt-1">
            {product.colors.map((c) => (
              <button
                key={c.name}
                type="button"
                onClick={() => setColor(c.name)}
                title={c.name}
                aria-label={`Color: ${c.name}`}
                aria-pressed={color === c.name}
                className={`h-6 w-6 rounded-full border-2 transition ${
                  color === c.name ? "border-orange-400" : "border-slate-700 hover:border-slate-500"
                }`}
                style={{ backgroundColor: c.hex }}
              />
            ))}
          </div>
        )}

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
