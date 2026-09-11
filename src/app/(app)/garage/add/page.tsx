import type { Metadata } from "next";
import AddVehicleClient from "./AddVehicleClient";

export const metadata: Metadata = {
  title: "Add a Vehicle",
  description: "Add a vehicle to your garage — pick from our supported vehicles or add your own.",
};

export default function AddVehiclePage() {
  return <AddVehicleClient />;
}
