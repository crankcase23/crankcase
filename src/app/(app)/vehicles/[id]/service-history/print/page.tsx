import { notFound } from "next/navigation";
import { catalogIdOf } from "@/lib/garageId";
import { findVehicle, listVehicles } from "@/lib/data";
import PrintServiceHistory from "@/components/PrintServiceHistory";
import { getViewerVehicle } from "@/lib/viewerConfig";
import { summaryLine } from "@/lib/vehicleConfig";

export function generateStaticParams() {
  return listVehicles().map((v) => ({ id: v.id }));
}

export default async function ServiceHistoryPrintPage(
  props: PageProps<"/vehicles/[id]/service-history/print">
) {
  const { id } = await props.params;
  const vehicle = findVehicle(catalogIdOf(id));
  if (!vehicle) notFound();

  const { config } = await getViewerVehicle(id);

  return (
    <PrintServiceHistory
      vehicleId={id}
      vehicleLabel={`${vehicle.year} ${vehicle.make} ${vehicle.model} ${vehicle.trim ?? ""}`.trim()}
      vehicleSubline={[vehicle.engine, ...summaryLine(vehicle, config)].join(" · ")}
      backHref={`/vehicles/${id}`}
    />
  );
}
