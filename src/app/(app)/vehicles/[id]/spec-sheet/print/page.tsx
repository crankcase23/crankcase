import { notFound } from "next/navigation";
import { findVehicle, listRepairsForVehicle, listVehicles } from "@/lib/data";
import PrintVehicleSpecSheet from "@/components/PrintVehicleSpecSheet";

export function generateStaticParams() {
  return listVehicles().map((v) => ({ id: v.id }));
}

export default async function VehicleSpecSheetPrintPage(
  props: PageProps<"/vehicles/[id]/spec-sheet/print">
) {
  const { id } = await props.params;
  const vehicle = findVehicle(id);
  if (!vehicle) notFound();

  const repairGuides = listRepairsForVehicle(vehicle.id);

  return <PrintVehicleSpecSheet vehicle={vehicle} repairGuides={repairGuides} />;
}
