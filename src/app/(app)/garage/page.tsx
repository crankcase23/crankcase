import type { Metadata } from "next";
import GarageClient from "./GarageClient";

export const metadata: Metadata = {
  title: "Your Garage",
  description: "Your vehicles, their specs, fluids, and repair guides.",
};

export default function GaragePage() {
  return <GarageClient />;
}
