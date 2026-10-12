import { notFound, redirect } from "next/navigation";
import ChooseYourCar from "@/components/app/ChooseYourCar";
import { catalogIdOf } from "@/lib/garageId";
import { findVehicle, listRepairsForVehicle, listVehicles } from "@/lib/data";
import PrintVehicleSpecSheet from "@/components/PrintVehicleSpecSheet";
import { getViewerVehicle } from "@/lib/viewerConfig";
import { fluidsForConfig, specRowsForConfig, summaryLine } from "@/lib/vehicleConfig";
import { resolveGuideForConfig } from "@/lib/guideConfig";

export function generateStaticParams() {
  return listVehicles().map((v) => ({ id: v.id }));
}

export default async function VehicleSpecSheetPrintPage(
  props: PageProps<"/vehicles/[id]/spec-sheet/print">
) {
  const { id } = await props.params;
  const vehicle = findVehicle(catalogIdOf(id));
  if (!vehicle) notFound();

  // The printed sheet is for THIS customer's build: specs, fluids and torque tables follow their saved configuration,
  // exactly like the vehicle page and the guides.
  const viewer = await getViewerVehicle(id);
  if (viewer.redirectTo) redirect(`/vehicles/${viewer.redirectTo}/spec-sheet/print`);
  if (viewer.choose) {
    return <ChooseYourCar vehicleLabel={`${vehicle.year} ${vehicle.make} ${vehicle.model}`} cars={viewer.choose} hrefFor={(g) => `/vehicles/${g}/spec-sheet/print`} />;
  }
  const { config } = viewer;
  const repairGuides = listRepairsForVehicle(vehicle.id).map((g) => resolveGuideForConfig(g, config, vehicle.make));

  return (
    <PrintVehicleSpecSheet
      vehicle={vehicle}
      repairGuides={repairGuides}
      specs={specRowsForConfig(vehicle, config)}
      fluids={fluidsForConfig(vehicle, config)}
      subline={[vehicle.engine, ...summaryLine(vehicle, config)].join(" · ")}
      backHref={`/vehicles/${id}`}
    />
  );
}
