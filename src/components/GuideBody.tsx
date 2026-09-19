"use client";

import { useMemo, useState } from "react";
import { ToolList, BulletList, TorqueTable } from "@/components/tables";
import StepList from "@/components/StepList";
import type { RepairGuide } from "@/types/vehicle";

/**
 * The part of a repair guide that reacts to how the reader's specific vehicle
 * was built: tools, parts, torque specs and steps.
 *
 * WHY THIS EXISTS. Some facts a reader needs depend on their build, and the
 * ones that matter are the ones that change what they BUY or what they TORQUE.
 * The Silverado rear axle is the worked example: a 10-bolt cover takes 4.2
 * pints and a 12-bolt takes 5.5. That fact used to live in step one of the
 * guide, which a reader reaches while lying under the truck on jack stands -
 * several hours after the parts run where the information was actually needed.
 *
 * So the questions render ABOVE the parts list, not inside the procedure.
 *
 * NOTHING IS HIDDEN BY DEFAULT. Until a question is answered, every option
 * still shows, tagged with which build it applies to, because a reader who
 * does not yet know which axle they have still deserves a complete guide.
 * Answering a question filters the noise out; it never reveals something that
 * was being withheld.
 */
export default function GuideBody({ guide }: { guide: RepairGuide }) {
  const groups = useMemo(() => guide.variants ?? [], [guide.variants]);
  const [picked, setPicked] = useState<Record<string, string>>({});

  // option id -> its label, and option id -> the group that owns it
  const { labelOf, groupOf } = useMemo(() => {
    const labelOf: Record<string, string> = {};
    const groupOf: Record<string, string> = {};
    for (const g of groups) {
      for (const o of g.options) {
        labelOf[o.id] = o.label;
        groupOf[o.id] = g.id;
      }
    }
    return { labelOf, groupOf };
  }, [groups]);

  /** Visible if it matches a selection, or if every question it depends on is unanswered. */
  function show(onlyFor?: string[]) {
    if (!onlyFor || onlyFor.length === 0) return true;
    if (onlyFor.some((id) => picked[groupOf[id]] === id)) return true;
    return onlyFor.every((id) => !picked[groupOf[id]]);
  }

  /** The "applies to" tag shown while the owning question is unanswered. */
  function tag(onlyFor?: string[]) {
    if (!onlyFor || onlyFor.length === 0) return null;
    if (onlyFor.some((id) => picked[groupOf[id]] === id)) return null;
    return onlyFor.map((id) => labelOf[id] ?? id).join(" / ");
  }

  const tools = guide.tools.filter((t) => show(t.onlyFor));

  // Variant parts lead the list: they are the ones that need a decision, so
  // they belong where a reader standing in the parts aisle will see them first.
  const parts = [
    ...(guide.variantParts ?? [])
      .filter((p) => show(p.onlyFor))
      .map((p) => {
        const t = tag(p.onlyFor);
        return t ? p.text + " [" + t + "]" : p.text;
      }),
    ...guide.parts,
  ];

  const torqueSpecs = guide.torqueSpecs
    .filter((t) => show(t.onlyFor))
    .map((t) => {
      const label = tag(t.onlyFor);
      return label ? { ...t, fastener: t.fastener + " [" + label + "]" } : t;
    });

  const steps = guide.steps.filter((s) => show(s.onlyFor));

  return (
    <>
      {groups.length > 0 && (
        <section className="mt-8">
          <div className="mb-3 flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <h2 className="text-lg font-semibold text-slate-100">Before You Buy Parts</h2>
            <span className="text-sm text-slate-500">
              These answers change what you need. Settle them before the parts run.
            </span>
          </div>

          <div className="space-y-3">
            {groups.map((g) => (
              <div key={g.id} className="rounded-xl border border-slate-800 bg-slate-900 p-4">
                <h3 className="font-semibold text-slate-100">{g.question}</h3>
                <p className="mt-1 text-sm text-slate-400">{g.howToTell}</p>

                <div className="mt-3 flex flex-wrap gap-2">
                  {g.options.map((o) => {
                    const on = picked[g.id] === o.id;
                    return (
                      <button
                        key={o.id}
                        type="button"
                        aria-pressed={on}
                        onClick={() =>
                          setPicked((p) => ({ ...p, [g.id]: on ? "" : o.id }))
                        }
                        className={
                          on
                            ? "rounded-lg border border-orange-500 bg-orange-500/15 px-3 py-2 text-sm font-medium text-orange-300"
                            : "rounded-lg border border-slate-700 px-3 py-2 text-sm text-slate-300 hover:border-slate-500 hover:text-white"
                        }
                      >
                        {o.label}
                        {o.hint && (
                          <span className="ml-2 text-xs text-slate-500">{o.hint}</span>
                        )}
                      </button>
                    );
                  })}
                </div>

                <p className="mt-3 text-xs text-slate-500">
                  {picked[g.id]
                    ? "Filtered below. Tap again to clear."
                    : "Not answered yet, so everything below shows every option, tagged in square brackets with the build it applies to."}
                </p>
              </div>
            ))}
          </div>
        </section>
      )}

      <div className="mt-8 grid gap-8 sm:grid-cols-2">
        <section>
          <h2 className="mb-3 text-lg font-semibold text-slate-100">Tools Needed</h2>
          <ToolList tools={tools} />
        </section>
        <section>
          <h2 className="mb-3 text-lg font-semibold text-slate-100">Parts &amp; Supplies</h2>
          <BulletList items={parts} />
        </section>
      </div>

      <section className="mt-8">
        <h2 className="mb-3 text-lg font-semibold text-slate-100">Safety Notes</h2>
        <div className="rounded-xl border border-rose-500/30 bg-rose-500/5 p-4">
          <BulletList items={guide.safety} />
        </div>
      </section>

      <section className="mt-8">
        <h2 className="mb-3 text-lg font-semibold text-slate-100">Torque Specs</h2>
        <TorqueTable specs={torqueSpecs} />
      </section>

      <section className="mt-10">
        <h2 className="mb-4 text-lg font-semibold text-slate-100">Step-by-Step</h2>
        <StepList steps={steps} hasRotorOption={guide.hasRotorOption} />
      </section>
    </>
  );
}
