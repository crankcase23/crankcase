"use client";

import Link from "next/link";
import { useCart, updateQuantity, removeFromCart } from "@/lib/cart";
import { PRODUCTS } from "@/data/products";

function findProduct(productId: string) {
  return PRODUCTS.find((p) => p.id === productId);
}

export default function CartClient() {
  const items = useCart();
  const lines = items
    .map((item) => ({ item, product: findProduct(item.productId) }))
    .filter((l) => l.product);
  const subtotal = lines.reduce((sum, { item, product }) => sum + (product?.price ?? 0) * item.quantity, 0);

  if (lines.length === 0) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 text-center">
        <h1 className="text-2xl font-bold text-slate-100">Your cart is empty</h1>
        <p className="mt-2 text-slate-400">
          Head over to the{" "}
          <Link href="/swag" className="text-orange-400 hover:underline">
            swag store
          </Link>{" "}
          and add something to your toolbox.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-12">
      <h1 className="mb-6 text-2xl font-bold text-slate-100">Your Cart</h1>

      <div className="divide-y divide-slate-800 rounded-xl border border-slate-800 bg-slate-900">
        {lines.map(({ item, product }) => (
          <div key={`${item.productId}-${item.size ?? ""}`} className="flex items-center gap-4 p-4">
            <div className="flex-1">
              <div className="font-medium text-slate-100">{product?.name}</div>
              {item.size && <div className="text-sm text-slate-500">Size: {item.size}</div>}
            </div>
            <input
              type="number"
              min={1}
              value={item.quantity}
              onChange={(e) => updateQuantity(item.productId, Number(e.target.value), item.size)}
              className="w-16 rounded-md border border-slate-700 bg-slate-950 px-2 py-1 text-center text-slate-200"
              aria-label={`Quantity for ${product?.name}`}
            />
            <div className="w-16 text-right text-slate-300">${(product?.price ?? 0) * item.quantity}</div>
            <button
              type="button"
              onClick={() => removeFromCart(item.productId, item.size)}
              className="text-slate-500 hover:text-white"
              aria-label={`Remove ${product?.name} from cart`}
              title="Remove"
            >
              ✕
            </button>
          </div>
        ))}
      </div>

      <div className="mt-6 flex items-center justify-between text-lg font-semibold text-slate-100">
        <span>Subtotal</span>
        <span>${subtotal}</span>
      </div>

      <div className="mt-6 rounded-xl border border-dashed border-slate-700 bg-slate-900/60 p-4 text-center">
        <button
          type="button"
          disabled
          className="w-full cursor-not-allowed rounded-lg bg-slate-700 px-4 py-3 font-semibold text-slate-400"
        >
          Checkout, Coming Soon
        </button>
        <p className="mt-2 text-xs text-slate-500">
          Real payment processing and order fulfillment aren&apos;t wired up yet, this cart is just a preview.
        </p>
      </div>
    </div>
  );
}
