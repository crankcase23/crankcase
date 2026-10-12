import { notFound, redirect } from "next/navigation";
import ChooseYourCar from "@/components/app/ChooseYourCar";
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

  const viewer = await getViewerVehicle(id);
  if (viewer.redirectTo) redirect(`/vehicles/${viewer.redirectTo}/service-history/print`);
  if (viewer.choose) {
    return <ChooseYourCar vehicleLabel={`${vehicle.year} ${vehicle.make} ${vehicle.model}`} cars={viewer.choose} hrefFor={(g) => `/vehicles/${g}/service-history/print`} />;
  }
  const { config } = viewer;

  return (
    <PrintServiceHistory
      vehicleId={id}
      vehicleLabel={`${vehicle.year} ${vehicle.make} ${vehicle.model} ${vehicle.trim ?? ""}`.trim()}
      vehicleSubline={[vehicle.engine, ...summaryLine(vehicle, config)].join(" · ")}
      backHref={`/vehicles/${id}`}
    />
  );
}
