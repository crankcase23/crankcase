"use client";

import { useMemo, useState } from "react";
import type { RepairStep } from "@/types/vehicle";
import RepairStepCard from "@/components/RepairStepCard";

// Renders a guide step list, and on brake guides the pads-only versus
// pads-and-rotors choice.
//
// The steps are filtered and RENUMBERED rather than the reader being told to
// skip a range. Two reasons: counting steps with greasy hands on a phone
// propped against a fender is a bad ask, and a hardcoded "skip steps 5-8"
// silently goes wrong the moment anyone edits the guide.
//
// Default is rotors included. Rotors are cheap enough now that machining often
// costs more than replacing, plenty are under minimum thickness by the time the
// pads are done, and new pads on grooved rotors is a classic DIY mistake.
export default function StepList({
  steps,
  hasRotorOption,
}: {
  steps: RepairStep[];
  hasRotorOption?: boolean;
}) {
  const [includeRotors, setIncludeRotors] = useState(true);

  const rotorStepCount = useMemo(
    () => steps.filter((s) => s.rotorsOnly).length,
    [steps]
  );

  const visible = useMemo(() => {
    const kept =
      hasRotorOption && !includeRotors
        ? steps.filter((s) => !s.rotorsOnly)
        : steps;
    return kept.map((s, i) => ({ ...s, number: i + 1 }));
  }, [steps, hasRotorOption, includeRotors]);

  const choiceClass = (active: boolean) =>
    active
      ? "rounded-lg border border-orange-500 bg-orange-500 px-4 py-2 text-sm font-semibold text-slate-950"
      : "rounded-lg border border-slate-700 bg-slate-950 px-4 py-2 text-sm font-medium text-slate-300 hover:border-orange-500/60";

  return (
    <div>
      {hasRotorOption && rotorStepCount > 0 && (
        <div className="mb-5 rounded-xl border border-slate-800 bg-slate-900 p-4">
          <p className="text-sm font-semibold text-slate-100">
            Are you replacing the rotors too?
          </p>
          <p className="mt-1 text-xs text-slate-400">
            Most people replacing pads replace the rotors at the same time. Pick
            one and the steps below change to match — there is nothing to skip
            and nothing to count.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setIncludeRotors(true)}
              aria-pressed={includeRotors}
              className={choiceClass(includeRotors)}
            >
              Pads and rotors
            </button>
            <button
              type="button"
              onClick={() => setIncludeRotors(false)}
              aria-pressed={!includeRotors}
              className={choiceClass(!includeRotors)}
            >
              Pads only
            </button>
          </div>
          <p className="mt-3 text-xs text-slate-500">
            {includeRotors
              ? `Showing all ${visible.length} steps, including the ${rotorStepCount} that cover the rotors.`
              : `Showing ${visible.length} steps. ${rotorStepCount} rotor steps hidden.`}
          </p>
        </div>
      )}

      <div className="space-y-4">
        {visible.map((step) => (
          <RepairStepCard key={step.number} step={step} />
        ))}
      </div>
    </div>
  );
}
