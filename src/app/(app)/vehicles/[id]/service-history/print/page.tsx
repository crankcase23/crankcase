import { notFound } from "next/navigation";
import { findVehicle, listVehicles } from "@/lib/data";
import PrintServiceHistory from "@/components/PrintServiceHistory";

export function generateStaticParams() {
  return listVehicles().map((v) => ({ id: v.id }));
}

export default async function ServiceHistoryPrintPage(
  props: PageProps<"/vehicles/[id]/service-history/print">
) {
  const { id } = await props.params;
  const vehicle = findVehicle(id);
  if (!vehicle) notFound();

  return (
    <PrintServiceHistory
      vehicleId={vehicle.id}
      vehicleLabel={`${vehicle.year} ${vehicle.make} ${vehicle.model} ${vehicle.trim ?? ""}`.trim()}
      vehicleSubline={`${vehicle.engine} · ${vehicle.drivetrain} · ${vehicle.transmission}`}
      backHref={`/vehicles/${vehicle.id}`}
    />
  );
}
