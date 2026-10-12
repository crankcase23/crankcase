import type { Metadata } from "next";
import AddVehicleClient from "./AddVehicleClient";
import { fallbackEnabled } from "@/lib/vinFallback";

// Read per request: whether the NHTSA-outage fallback is on is a server setting the owner flips without a rebuild.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Add a Vehicle",
  description: "Add a vehicle to your garage — pick from our supported vehicles or add your own.",
};

export default function AddVehiclePage() {
  return <AddVehicleClient fallbackEnabled={fallbackEnabled()} />;
}
