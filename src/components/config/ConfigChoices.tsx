"use client";

import { useId } from "react";
import type { ConfigAxis } from "@/types/vehicle";
import { choiceLabel, UNKNOWN, type AxisChoice, type ConfigOptions } from "@/lib/vehicleConfig";

// The two radio groups (transmission, drivetrain) shared by Confirm Your Ride (add flow) and Edit Configuration.
// Presentation only: it offers exactly the options it is given (never an impossible one, see configOptionsFor) plus
// Not sure, and reports the customer's pick. It never selects anything on its own; a preselection comes in as `value`.

export type ConfigValue = { transmission: AxisChoice | null; drivetrain: AxisChoice | null };

function howToTell(axis: ConfigAxis, make?: string): string {
  if (axis === "transmission") return "A clutch pedal (three pedals) means manual. Two pedals means an automatic, CVT or dual-clutch.";
  const badge = /bmw/i.test(make ?? "") ? "an xDrive badge" : "an AWD or 4WD badge";
  return `Look for ${badge} on the trunk or tailgate, or check your door-jamb sticker or owner's manual. No badge usually means two-wheel drive.`;
}
const QUESTION: Record<ConfigAxis, string> = { transmission: "Transmission", drivetrain: "Drivetrain" };

export default function ConfigChoices({
  make,
  options,
  value,
  onChange,
  basis,
  disabled,
}: {
  make?: string;
  options: ConfigOptions;
  value: ConfigValue;
  onChange: (axis: ConfigAxis, v: AxisChoice) => void;
  /** Axes whose current value came from the VIN lookup rather than the customer, so the screen can say so. */
  basis?: Partial<Record<ConfigAxis, string>>;
  disabled?: boolean;
}) {
  const uid = useId();
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {(["transmission", "drivetrain"] as const).map((axis) => {
        const list = [...options[axis].options, UNKNOWN] as AxisChoice[];
        const picked = value[axis];
        return (
          <fieldset key={axis} className="rounded-xl border border-slate-800 bg-slate-950/60 p-4" disabled={disabled}>
            <legend className="px-1 text-sm font-semibold text-slate-100">{QUESTION[axis]}</legend>
            <p className="text-xs text-slate-500">{howToTell(axis, make)}</p>
            <div className="mt-3 space-y-2" role="radiogroup" aria-label={QUESTION[axis]}>
              {list.map((opt) => {
                const id = `${uid}-${axis}-${opt}`;
                const on = picked === opt;
                return (
                  <label
                    key={opt}
                    htmlFor={id}
                    className={`flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-2 text-sm transition ${
                      on ? "border-orange-500 bg-orange-500/10 text-orange-200" : "border-slate-700 text-slate-300 hover:border-slate-500"
                    }`}
                  >
                    <input
                      id={id}
                      type="radio"
                      name={`${uid}-${axis}`}
                      value={opt}
                      checked={on}
                      onChange={() => onChange(axis, opt)}
                      data-axis={axis}
                      className="h-4 w-4 accent-orange-500"
                    />
                    <span>{choiceLabel(axis, opt, make)}</span>
                  </label>
                );
              })}
            </div>
            {picked === UNKNOWN && (
              <p className="mt-2 text-xs text-amber-300">
                We won&apos;t assume. Steps that depend on your {axis} stay restricted until you confirm it.
              </p>
            )}
            {picked && picked !== UNKNOWN && basis?.[axis] && (
              <p className="mt-2 text-xs text-slate-400">Suggested from {basis[axis]}. Confirm it matches your vehicle.</p>
            )}
          </fieldset>
        );
      })}
    </div>
  );
}
