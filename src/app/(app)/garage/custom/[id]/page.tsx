import type { Metadata } from "next";
import CustomVehicleClient from "./CustomVehicleClient";

export const metadata: Metadata = {
  title: "Your Vehicle",
  description: "Track service history and maintenance reminders for a vehicle in your garage.",
};

export default function CustomVehiclePage() {
  return <CustomVehicleClient />;
}
