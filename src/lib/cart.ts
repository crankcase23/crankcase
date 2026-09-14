"use client";

import { useSyncExternalStore } from "react";

export interface CartItem {
  productId: string;
  size?: string;
  color?: string;
  quantity: number;
}

const STORAGE_KEY = "crankcase:cart";
const listeners = new Set<() => void>();

// Cache the last-parsed cart alongside the raw string it came from, so
// getSnapshot() returns the SAME array reference when localStorage hasn't
// actually changed. useSyncExternalStore requires this — if getSnapshot
// returns a brand-new array every call (e.g. via JSON.parse each time),
// React sees a "changed" value on every check and re-renders forever,
// which is exactly the "Maximum update depth exceeded" crash this caused.
let cachedRaw: string | null = null;
let cachedItems: CartItem[] = [];

function readCart(): CartItem[] {
  if (typeof window === "undefined") return cachedItems;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw === cachedRaw) return cachedItems;
    cachedRaw = raw;
    cachedItems = raw ? (JSON.parse(raw) as CartItem[]) : [];
    return cachedItems;
  } catch {
    return cachedItems;
  }
}

function writeCart(items: CartItem[]) {
  if (typeof window === "undefined") return;
  cachedItems = items;
  cachedRaw = JSON.stringify(items);
  window.localStorage.setItem(STORAGE_KEY, cachedRaw);
  listeners.forEach((l) => l());
}

function subscribe(callback: () => void) {
  listeners.add(callback);
  return () => listeners.delete(callback);
}

function getSnapshot(): CartItem[] {
  return readCart();
}

function getServerSnapshot(): CartItem[] {
  return cachedItems;
}

function sameLine(a: CartItem, productId: string, size?: string, color?: string) {
  return a.productId === productId && (a.size ?? null) === (size ?? null) && (a.color ?? null) === (color ?? null);
}

export function addToCart(productId: string, quantity = 1, size?: string, color?: string) {
  const items = readCart();
  const idx = items.findIndex((i) => sameLine(i, productId, size, color));
  let next: CartItem[];
  if (idx >= 0) {
    next = items.slice();
    next[idx] = { ...next[idx], quantity: next[idx].quantity + quantity };
  } else {
    next = [...items, { productId, size, color, quantity }];
  }
  writeCart(next);
}

export function updateQuantity(productId: string, quantity: number, size?: string, color?: string) {
  const items = readCart();
  const idx = items.findIndex((i) => sameLine(i, productId, size, color));
  if (idx === -1) return;
  let next: CartItem[];
  if (quantity <= 0) {
    next = items.filter((_, i) => i !== idx);
  } else {
    next = items.slice();
    next[idx] = { ...next[idx], quantity };
  }
  writeCart(next);
}

export function removeFromCart(productId: string, size?: string, color?: string) {
  const items = readCart().filter((i) => !sameLine(i, productId, size, color));
  writeCart(items);
}

export function clearCart() {
  writeCart([]);
}

export function useCart(): CartItem[] {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

export function useCartCount(): number {
  const items = useCart();
  return items.reduce((sum, i) => sum + i.quantity, 0);
}
