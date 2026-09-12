import type { Metadata } from "next";
import CartClient from "./CartClient";

export const metadata: Metadata = {
  title: "Your Cart",
  description: "Your Crankcase Garage swag cart.",
};

export default function CartPage() {
  return <CartClient />;
}
