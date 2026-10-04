import Link from "next/link";
import type { Vehicle, ResolvedGuide } from "@/types/vehicle";
import {
  getServiceSchedule,
  milestonesFor,
  describeInterval,
  type ServiceScheduleItem,
} from "@/data/service-schedules";
import { TierBadge } from "@/components/tables";
import { Chapter, PANEL } from "@/components/app/Chapter";

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

  // The job that recurs at EVERY service - tire rotation on all three of these
  // schedules - is pulled out and stated once. Left in the grid it repeats in
  // every card and buries the thing the reader came for, which is what is
  // special about 30,000 or 100,000 miles.
  const everyService = schedule.items.filter(
    (i) => i.normal.kind === "miles" && i.normal.miles === schedule.gridStep,
  );
  const recurring = new Set(everyService.map((i) => i.label));

  const milestones = milestonesFor(schedule, 999)
    .map((m) => ({
      ...m,
      normal: m.normal.filter((i) => !recurring.has(i.label)),
    }))
    .filter((m) => m.normal.length > 0 || m.severeOnly.length > 0);
  // Not every vehicle puts a "severe only" row on the grid. The Jeep's single
  // severe rule belongs to a monitor-governed job, which is deliberately kept
  // off the mileage grid, so that page renders no marked rows at all. A legend
  // pointing at a marker the reader cannot find reads as a missing row, so it
  // only claims one when one is actually rendered.
  const hasSevereOnly = milestones.some((m) => m.severeOnly.length > 0);
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
    <Chapter
      eyebrow="By the book"
      title="Factory Service Schedule"
      chip={<TierBadge tier="free" />}
      lede={
        <>
          What the manufacturer actually asks for, on their own mileage grid &mdash; not a
          quick-lube chain&rsquo;s version of it. Source: {schedule.sourceLabel}.
        </>
      }
    >

      {everyService.length > 0 && (
        <p className="mb-4 rounded-xl border border-white/[0.09] bg-[#080d15]/60 px-4 py-3 text-sm text-slate-300">
          <span className="font-semibold text-slate-100">
            Every {schedule.gridStep.toLocaleString("en-US")} miles:
          </span>{" "}
          {everyService.map((i) => i.label).join(", ")}
          <span className="ml-2 text-[12px] text-slate-500">
            &mdash; the interval the rest of the schedule is built on
          </span>
        </p>
      )}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {milestones.map((m) => (
          <div
            key={m.miles}
            className={`${PANEL} p-4`}
          >
            <div className="mb-2 text-base font-semibold text-slate-50">
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
        <div className="mt-5 rounded-xl border border-white/[0.09] bg-[#080d15]/60 p-5">
          <h3 className="mb-1 text-sm font-semibold text-slate-100">
            Not on a mileage
          </h3>
          <p className="mb-3 max-w-3xl text-[13px] text-slate-500">
            These are the rows people get told a number for anyway. The manufacturer
            either lets the vehicle decide, schedules them by time, or does not
            schedule them at all.
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
        {hasSevereOnly ? (
          <>
            Rows marked <span className="text-amber-300/80">severe only</span> apply if
            you work the vehicle: {schedule.severeDefinition}
          </>
        ) : (
          <>Severe service on this vehicle means: {schedule.severeDefinition}</>
        )}
      </p>
    </Chapter>
  );
}
