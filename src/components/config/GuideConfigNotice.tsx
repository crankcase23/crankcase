import Link from "next/link";
import type { ConfigResolution } from "@/lib/guideConfig";
import { choiceLabel, confirmedValue, type VehicleConfig } from "@/lib/vehicleConfig";

/**
 * What the customer's saved configuration did to THIS guide, in plain words. It says nothing when the guide does not
 * depend on the build. Once every axis the guide needs is confirmed it is one quiet line, not a warning: a confirmed
 * answer resolves the uncertainty, so no "might be RWD or xDrive" disclaimer survives it.
 */
export default function GuideConfigNotice({
  resolution,
  config,
  make,
  vehicleId,
  inGarage,
}: {
  resolution: ConfigResolution;
  config: VehicleConfig | null;
  make?: string;
  vehicleId: string;
  inGarage: boolean;
}) {
  if (resolution.status === "none") return null;
  const edit = `/vehicles/${vehicleId}#vehicle-config`;
  const t = confirmedValue(config, "transmission");
  const d = confirmedValue(config, "drivetrain");
  const mine = [t ? choiceLabel("transmission", t, make) : null, d ? choiceLabel("drivetrain", d, make) : null].filter(Boolean).join(" · ");

  if (resolution.status === "applied") {
    return (
      <p className="mt-4 text-sm text-slate-400" data-testid="config-applied">
        Showing the procedure for your {mine}.{" "}
        <Link href={edit} className="font-semibold text-orange-400 hover:text-orange-300">Edit configuration</Link>
      </p>
    );
  }

  if (resolution.status === "unavailable") {
    return (
      <div role="alert" className="mt-4 rounded-xl border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-sm text-rose-200" data-testid="config-unavailable">
        <p className="font-semibold">No verified procedure for your configuration yet.</p>
        <p className="mt-1">{resolution.unavailableReason}</p>
        <Link href={edit} className="mt-2 inline-block font-semibold text-orange-300 hover:text-orange-200">Edit configuration</Link>
      </div>
    );
  }

  const axes = resolution.pendingAxes.join(" and ");
  return (
    <div role="note" className="mt-4 rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-200" data-testid="config-needs-confirmation">
      <p className="font-semibold">Confirm your {axes} to see every step.</p>
      <p className="mt-1">
        {resolution.restrictedCount > 0
          ? `${resolution.restrictedCount} item${resolution.restrictedCount === 1 ? " is" : "s are"} restricted until you do. `
          : ""}
        This guide covers more than one build, and we do not assume which one is yours.
      </p>
      {inGarage ? (
        <Link href={edit} className="mt-2 inline-block font-semibold text-orange-300 hover:text-orange-200">Confirm configuration</Link>
      ) : (
        <Link href="/garage/add" className="mt-2 inline-block font-semibold text-orange-300 hover:text-orange-200">Add this vehicle to your garage to confirm it</Link>
      )}
    </div>
  );
}
