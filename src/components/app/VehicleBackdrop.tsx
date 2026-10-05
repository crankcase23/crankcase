import { existsSync } from "node:fs";
import path from "node:path";
import { PhotoScene, WorkshopScene } from "@/components/marketing/Cinematic";

/**
 * Header backdrop for a catalog vehicle. Uses the vehicle's own photograph
 * (public/images/vehicles/<id>.jpg) when one exists, pinned to the right with
 * the copy side kept dark. With no photograph it falls back to the plain
 * workshop wall: never a drawn or generated stand-in for the real vehicle.
 */
export default function VehicleBackdrop({ vehicleId }: { vehicleId: string }) {
  const file = `${vehicleId}.jpg`;
  const has = existsSync(path.join(process.cwd(), "public", "images", "vehicles", file));
  return has ? <PhotoScene src={`/images/vehicles/${file}`} fit="right" /> : <WorkshopScene />;
}
