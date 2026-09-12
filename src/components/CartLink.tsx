"use client";

import Link from "next/link";
import { useCartCount } from "@/lib/cart";

export default function CartLink({ className }: { className?: string }) {
  const count = useCartCount();
  return (
    <Link href="/cart" className={className}>
      Cart{count > 0 ? ` (${count})` : ""}
    </Link>
  );
}
