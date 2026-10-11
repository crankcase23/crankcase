"use client";

import GuideWithWrenchMode from "@/components/GuideWithWrenchMode";
import type { BreadcrumbItem } from "@/components/GuideOverview";
import type { WrenchCompletionConfig } from "@/lib/wrenchSteps";
import type { ResolvedGuide, Vehicle } from "@/types/vehicle";

/**
 * Customer host for the Overall Guide + Wrench Mode experience. Server pages cannot hand a function to a client
 * component, so this thin wrapper supplies the Service History save: the same POST the rest of the garage UI uses.
 * It writes nothing on its own; the completion sheet only calls it after the customer enters a mileage and taps Save,
 * and the API requires a signed-in user (a signed-out save fails and the sheet says so, nothing is ended).
 */
export default function GuideWithServiceSave({
  guide,
  vehicle,
  breadcrumb,
}: {
  guide: ResolvedGuide;
  vehicle: Vehicle;
  breadcrumb?: BreadcrumbItem[];
}) {
  const completion: WrenchCompletionConfig = {
    vehicleLabel: `${vehicle.year} ${vehicle.make} ${vehicle.model}`,
    save: async (entry) => {
      const res = await fetch(`/api/garage/${encodeURIComponent(vehicle.id)}/service`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date: entry.date, mileage: entry.mileage, title: entry.title, guideId: entry.guideId }),
      });
      if (!res.ok) throw new Error(`save failed (${res.status})`);
    },
  };
  return <GuideWithWrenchMode guide={guide} vehicle={vehicle} breadcrumb={breadcrumb} completion={completion} />;
}
