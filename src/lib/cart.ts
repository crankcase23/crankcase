"use client";

import { useSyncExternalStore } from "react";

export interface CartItem {
  productId: string;
  size?: string;
  quantity: number;
}

const STORAGE_KEY = "crankcase:cart";
const listeners = new Set<() => void>();

// Cache the last-read snapshot so getSnapshot returns a stable reference when nothing changed.
// Without this, useSyncExternalStore sees a new array every render and loops forever.
let cachedRaw: string | null = null;
let cachedItems: CartItem[] = [];

function readCart(): CartItem[] {
  if (typeof window === "undefined") return [];
  let raw: string | null = null;
  try {
    raw = window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return cachedItems;
  }
  if (raw === cachedRaw) return cachedItems;
  cachedRaw = raw;
  try {
    cachedItems = raw ? (JSON.parse(raw) as CartItem[]) : [];
  } catch {
    cachedItems = [];
  }
  return cachedItems;
}

function writeCart(items: CartItem[]) {
  if (typeof window === "undefined") return;
  const raw = JSON.stringify(items);
  window.localStorage.setItem(STORAGE_KEY, raw);
  cachedRaw = raw;
  cachedItems = items;
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
  return [];
}

function sameLine(a: CartItem, productId: string, size?: string) {
  return a.productId === productId && (a.size ?? null) === (size ?? null);
}

export function addToCart(productId: string, quantity = 1, size?: string) {
  const items = readCart().slice();
  const existing = items.find((i) => sameLine(i, productId, size));
  if (existing) {
    existing.quantity += quantity;
  } else {
    items.push({ productId, size, quantity });
  }
  writeCart(items);
}

export function updateQuantity(productId: string, quantity: number, size?: string) {
  const items = readCart();
  const line = items.find((i) => sameLine(i, productId, size));
  if (!line) return;
  if (quantity <= 0) {
    writeCart(items.filter((i) => i !== line));
  } else {
    writeCart(items.map((i) => (i === line ? { ...i, quantity } : i)));
  }
}

export function removeFromCart(productId: string, size?: string) {
  const items = readCart().filter((i) => !sameLine(i, productId, size));
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
