import type { Metadata } from "next";
import DecodeClient from "./DecodeClient";

export const metadata: Metadata = {
  title: "VIN Lookup",
  description: "Free VIN decode for basic year/make/model/engine info, and a quick way to add a vehicle to your garage.",
};

export default function DecodePage() {
  return <DecodeClient />;
}
