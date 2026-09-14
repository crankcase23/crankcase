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

function readCart(): CartItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as CartItem[]) : [];
  } catch {
    return [];
  }
}

function writeCart(items: CartItem[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
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

function sameLine(a: CartItem, productId: string, size?: string, color?: string) {
  return a.productId === productId && (a.size ?? null) === (size ?? null) && (a.color ?? null) === (color ?? null);
}

export function addToCart(productId: string, quantity = 1, size?: string, color?: string) {
  const items = readCart();
  const existing = items.find((i) => sameLine(i, productId, size, color));
  if (existing) {
    existing.quantity += quantity;
  } else {
    items.push({ productId, size, color, quantity });
  }
  writeCart(items);
}

export function updateQuantity(productId: string, quantity: number, size?: string, color?: string) {
  const items = readCart();
  const line = items.find((i) => sameLine(i, productId, size, color));
  if (!line) return;
  if (quantity <= 0) {
    writeCart(items.filter((i) => i !== line));
  } else {
    line.quantity = quantity;
    writeCart(items);
  }
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
