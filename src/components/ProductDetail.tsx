"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { Product } from "@/types/product";
import { addToCart } from "@/lib/cart";
import { pickDefaultColor } from "@/lib/products";
import CrankcaseMark from "@/components/CrankcaseMark";

interface GalleryImage {
  url: string;
  label: string;
}

// Builds the photo strip for whichever color is currently selected: front and
// back first (when we have them — a mug or sticker pack won't), then
// whatever additional angles/lifestyle shots the product carries. Falls back
// to the product-level images when the product has no color options at all.
function galleryFor(product: Product, colorName?: string): GalleryImage[] {
  const selectedColor = product.colors?.find((c) => c.name === colorName);
  const front = selectedColor?.imageUrl ?? product.imageUrl;
  const back = selectedColor?.backImageUrl ?? product.backImageUrl;

  const images: GalleryImage[] = [];
  if (front) images.push({ url: front, label: "Front" });
  if (back) images.push({ url: back, label: "Back" });
  (product.additionalImageUrls ?? []).forEach((url, i) => {
    images.push({ url, label: `More ${i + 1}` });
  });
  return images;
}

export default function ProductDetail({ product }: { product: Product }) {
  const [size, setSize] = useState(product.sizes?.[0]);
  const [color, setColor] = useState(pickDefaultColor(product.colors)?.name);
  const [justAdded, setJustAdded] = useState(false);

  const selectedColor = product.colors?.find((c) => c.name === color);
  const gallery = useMemo(() => galleryFor(product, color), [product, color]);
  const [activeImage, setActiveImage] = useState(0);

  // Jumping color resets which photo is active, since a color swap can
  // change how many photos there are (not every color has a back shot).
  const safeActiveImage = activeImage < gallery.length ? activeImage : 0;
  const mainImage = gallery[safeActiveImage]?.url;

  function handleColorChange(name: string) {
    setColor(name);
    setActiveImage(0);
  }

  function handleAdd() {
    addToCart(product.id, 1, size, color);
    setJustAdded(true);
    setTimeout(() => setJustAdded(false), 1500);
  }

  return (
    <div className="grid gap-10 md:grid-cols-2">
      {/* Gallery */}
      <div>
        <div
          className="flex aspect-square items-center justify-center overflow-hidden rounded-xl border border-slate-800"
          style={{ backgroundColor: selectedColor?.hex ?? product.tileColor }}
        >
          {mainImage ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={mainImage} alt={product.name} className="h-full w-full object-cover" />
          ) : (
            <CrankcaseMark className="h-24 w-24" accentFill="#f97316" panFill="#0f172a" />
          )}
        </div>

        {gallery.length > 1 && (
          <div className="mt-3 flex gap-2">
            {gallery.map((img, i) => (
              <button
                key={img.url}
                type="button"
                onClick={() => setActiveImage(i)}
                aria-label={`Show ${img.label.toLowerCase()} view`}
                aria-pressed={safeActiveImage === i}
                className={`h-16 w-16 shrink-0 overflow-hidden rounded-lg border-2 transition ${
                  safeActiveImage === i
                    ? "border-orange-400"
                    : "border-slate-700 hover:border-slate-500"
                }`}
                style={{ backgroundColor: selectedColor?.hex ?? product.tileColor }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={img.url} alt={`${product.name} — ${img.label}`} className="h-full w-full object-cover" />
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Details */}
      <div className="flex flex-col gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">{product.name}</h1>
          <p className="mt-1 text-xl font-semibold text-orange-400">${product.price}</p>
        </div>

        <p className="text-slate-400">{product.fullDescription ?? product.description}</p>

        {product.colors && (
          <div>
            <div className="mb-2 text-sm font-medium text-slate-300">
              Color{selectedColor ? `: ${selectedColor.name}` : ""}
            </div>
            <div className="flex items-center gap-2">
              {product.colors.map((c) => (
                <button
                  key={c.name}
                  type="button"
                  onClick={() => handleColorChange(c.name)}
                  title={c.name}
                  aria-label={`Color: ${c.name}`}
                  aria-pressed={color === c.name}
                  className={`h-8 w-8 rounded-full border-2 transition ${
                    color === c.name ? "border-orange-400" : "border-slate-700 hover:border-slate-500"
                  }`}
                  style={{ backgroundColor: c.hex }}
                />
              ))}
            </div>
          </div>
        )}

        {product.sizes && (
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-300" htmlFor="size-select">
              Size
            </label>
            <select
              id="size-select"
              value={size}
              onChange={(e) => setSize(e.target.value)}
              className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-200 sm:w-48"
            >
              {product.sizes.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
        )}

        <button
          type="button"
          onClick={handleAdd}
          className="mt-2 w-full rounded-lg bg-orange-500 px-4 py-3 text-sm font-semibold text-slate-950 hover:bg-orange-400 sm:w-48"
        >
          {justAdded ? "Added ✓" : "Add to Cart"}
        </button>

        <Link href="/swag" className="mt-2 text-sm text-slate-400 hover:text-slate-200">
          &larr; Back to Swag Store
        </Link>
      </div>
    </div>
  );
}
