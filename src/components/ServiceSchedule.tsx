import Link from "next/link";
import type { Vehicle, ResolvedGuide } from "@/types/vehicle";
import {
  getServiceSchedule,
  milestonesFor,
  describeInterval,
  type ServiceScheduleItem,
} from "@/data/service-schedules";
import { TierBadge } from "@/components/tables";

// The "what is due at 30,000 miles" view the user report asked for.
//
// Two deliberate choices about what this does NOT do:
//
// 1. Engine oil never appears under a mileage heading on these vehicles,
//    because the manufacturer does not put it there. It is monitor-governed,
//    and it is surfaced in words below the grid instead.
// 2. A job the manufacturer publishes no interval for renders as exactly that,
//    never as "lifetime fill" and never quietly omitted.

function milesLabel(n: number): string {
  return n >= 1000 ? n / 1000 + "k" : String(n);
}

export default function ServiceSchedule({
  vehicle,
  guides,
}: {
  vehicle: Vehicle;
  guides: ResolvedGuide[];
}) {
  const schedule = getServiceSchedule(vehicle);
  if (!schedule) return null;

  const milestones = milestonesFor(schedule, 8);
  const byJob = new Map<string, ResolvedGuide>();
  for (const g of guides) if (g.jobType) byJob.set(g.jobType, g);

  const offGrid = schedule.items.filter((i) => i.normal.kind !== "miles");

  const rowLabel = (item: ServiceScheduleItem) => {
    const guide = item.jobType ? byJob.get(item.jobType) : undefined;
    if (!guide) return <span className="text-slate-300">{item.label}</span>;
    return (
      <Link
        href={"/vehicles/" + vehicle.id + "/repairs/" + guide.id}
        className="text-orange-400 underline-offset-2 hover:text-orange-300 hover:underline"
      >
        {item.label}
      </Link>
    );
  };

  return (
    <section className="mt-8">
      <div className="mb-3 flex items-center gap-2">
        <h2 className="text-lg font-semibold text-slate-100">Factory Service Schedule</h2>
        <TierBadge tier="free" />
      </div>

      <p className="mb-4 max-w-3xl text-sm text-slate-400">
        What the manufacturer actually asks for, on their own mileage grid &mdash; not a
        quick-lube chain&rsquo;s version of it. Source: {schedule.sourceLabel}.
      </p>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {milestones.map((m) => (
          <div
            key={m.miles}
            className="rounded-lg border border-slate-800 bg-slate-900/60 p-3"
          >
            <div className="mb-2 text-sm font-semibold text-slate-100">
              {milesLabel(m.miles)} miles
            </div>
            <ul className="space-y-1 text-[13px]">
              {m.normal.map((item) => (
                <li key={item.label}>{rowLabel(item)}</li>
              ))}
              {m.severeOnly.map((item) => (
                <li key={item.label} className="text-amber-300/80">
                  {item.label}
                  <span className="ml-1 text-[11px] text-amber-500/70">severe only</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      {offGrid.length > 0 && (
        <div className="mt-5 rounded-lg border border-slate-800 bg-slate-900/40 p-4">
          <h3 className="mb-1 text-sm font-semibold text-slate-100">
            Not on a mileage
          </h3>
          <p className="mb-3 max-w-3xl text-[13px] text-slate-500">
            These are the rows people get told a number for anyway. The manufacturer
            either lets the truck decide, schedules them by time, or does not schedule
            them at all.
          </p>
          <dl className="space-y-3">
            {offGrid.map((item) => (
              <div key={item.label}>
                <dt className="text-[13px] font-medium text-slate-200">
                  {rowLabel(item)}
                  <span className="ml-2 font-normal text-slate-400">
                    &mdash; {describeInterval(item.normal)}
                  </span>
                  {item.confidence === "low" && (
                    <span className="ml-2 rounded border border-slate-700 px-1 py-0.5 text-[10px] uppercase tracking-wide text-slate-500">
                      unverified
                    </span>
                  )}
                </dt>
                {item.note && (
                  <dd className="mt-0.5 max-w-3xl text-[12px] leading-relaxed text-slate-500">
                    {item.note}
                  </dd>
                )}
              </div>
            ))}
          </dl>
        </div>
      )}

      <p className="mt-3 max-w-3xl text-[12px] text-slate-500">
        Rows marked <span className="text-amber-300/80">severe only</span> apply if you
        work the vehicle: {schedule.severeDefinition}
      </p>
    </section>
  );
}
