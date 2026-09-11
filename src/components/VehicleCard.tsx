import Link from "next/link";
import { Vehicle } from "@/types/vehicle";

export default function VehicleCard({ vehicle }: { vehicle: Vehicle }) {
  return (
    <Link
      href={`/vehicles/${vehicle.id}`}
      className="group block rounded-xl border border-slate-800 bg-slate-900 p-5 transition hover:border-orange-500 hover:bg-slate-800/80"
    >
      <div className="text-xs uppercase tracking-wide text-orange-400 font-semibold">
        {vehicle.year}
      </div>
      <div className="mt-1 text-xl font-bold text-slate-100">
        {vehicle.make} {vehicle.model}
      </div>
      <div className="text-sm text-slate-400">{vehicle.trim}</div>
      <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-300">
        <span className="rounded-full bg-slate-800 px-2.5 py-1">{vehicle.engine}</span>
        <span className="rounded-full bg-slate-800 px-2.5 py-1">{vehicle.drivetrain}</span>
        <span className="rounded-full bg-slate-800 px-2.5 py-1">{vehicle.transmission}</span>
      </div>
      <div className="mt-4 text-sm font-medium text-orange-400 group-hover:text-orange-300">
        View specs & repair guides &rarr;
      </div>
    </Link>
  );
}
