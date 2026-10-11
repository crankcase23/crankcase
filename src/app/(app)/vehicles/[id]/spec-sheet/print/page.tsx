import { notFound } from "next/navigation";
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
  const { config } = await getViewerVehicle(id);
  const repairGuides = listRepairsForVehicle(vehicle.id).map((g) => resolveGuideForConfig(g, config, vehicle.make));

  return (
    <PrintVehicleSpecSheet
      vehicle={vehicle}
      repairGuides={repairGuides}
      specs={specRowsForConfig(vehicle, config)}
      fluids={fluidsForConfig(vehicle, config)}
      subline={[vehicle.engine, ...summaryLine(vehicle, config)].join(" · ")}
    />
  );
}
