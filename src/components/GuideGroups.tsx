import Link from "next/link";
import type { JobTypeId, RepairGuide } from "@/types/vehicle";
import { DifficultyBadge, TierBadge } from "@/components/tables";

/**
 * Guides are authored one job type at a time across the whole catalog, so the
 * order a single vehicle gets them back in is whatever order the jobs happened
 * to be written in -- oil, front brakes, tire rotation, wipers, cabin filter --
 * with anything added later sitting at the bottom. On the vehicle page that
 * reads as a pile.
 *
 * Grouping by system gives the list an order a person can predict: the job you
 * came for sits under the heading you would have looked for it under. A new job
 * type only needs slotting into the right group below, and one that is missed
 * still renders, under "Other", instead of disappearing off the page.
 */
const GROUPS: { title: string; jobs: JobTypeId[] }[] = [
  {
    title: "Engine & Drivetrain",
    jobs: [
      "oil-change",
      "coolant",
      "serpentine-belt",
      "pcv-valve",
      "o2-sensor",
      "spark-plugs",
      "driveline-fluid",
    ],
  },
  {
    title: "Brakes & Tires",
    jobs: ["brake-pads-front", "brake-pads-rear", "tire-rotation"],
  },
  {
    title: "Filters",
    jobs: ["engine-air-filter", "cabin-air-filter"],
  },
  {
    title: "Electrical",
    jobs: ["battery", "fuse-bulb", "key-fob-battery"],
  },
  {
    title: "Checks & Visibility",
    jobs: ["fluid-checks", "wiper-blades"],
  },
];

function GuideCard({
  vehicleId,
  guide,
}: {
  vehicleId: string;
  guide: RepairGuide;
}) {
  return (
    <Link
      href={`/vehicles/${vehicleId}/repairs/${guide.id}`}
      className="group block rounded-xl border border-slate-800 bg-slate-900 p-5 transition hover:border-orange-500 hover:bg-slate-800/80"
    >
      <div className="flex items-center justify-between gap-3">
        <h4 className="font-semibold text-slate-100">{guide.title}</h4>
        <div className="flex shrink-0 items-center gap-1.5">
          <TierBadge tier={guide.tier} />
          <DifficultyBadge difficulty={guide.difficulty} />
        </div>
      </div>
      <p className="mt-2 text-sm text-slate-400">{guide.summary}</p>
      <div className="mt-3 flex items-center justify-between text-xs text-slate-500">
        <span>⏱ {guide.estTime}</span>
        <span className="font-medium text-orange-400 group-hover:text-orange-300">
          Open guide &rarr;
        </span>
      </div>
    </Link>
  );
}

export default function GuideGroups({
  vehicleId,
  guides,
}: {
  vehicleId: string;
  guides: RepairGuide[];
}) {
  if (guides.length === 0) {
    return (
      <section className="mt-10">
        <h2 className="cg-section-title mb-3">
          Repair Guides
        </h2>
        <p className="text-sm text-slate-500">
          No repair guides for this vehicle yet.
        </p>
      </section>
    );
  }

  const used = new Set<string>();
  const sections: { title: string; items: RepairGuide[] }[] = [];

  for (const group of GROUPS) {
    const items: RepairGuide[] = [];
    for (const job of group.jobs) {
      for (const guide of guides) {
        if (guide.jobType === job) {
          items.push(guide);
          used.add(guide.id);
        }
      }
    }
    if (items.length > 0) sections.push({ title: group.title, items });
  }

  const leftovers = guides.filter((g) => !used.has(g.id));
  if (leftovers.length > 0) sections.push({ title: "Other", items: leftovers });

  return (
    <section className="mt-10">
      <div className="mb-4 flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h2 className="cg-section-title">Repair Guides</h2>
        <span className="text-sm text-slate-500">
          {guides.length} {guides.length === 1 ? "guide" : "guides"} for this
          vehicle
        </span>
      </div>

      <div className="space-y-8">
        {sections.map((section) => (
          <div key={section.title}>
            <h3 className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-orange-400">
              {section.title}
              <span className="rounded-full bg-slate-800 px-2 py-0.5 text-[11px] font-medium text-slate-400">
                {section.items.length}
              </span>
            </h3>
            <div className="grid gap-4 sm:grid-cols-2">
              {section.items.map((guide) => (
                <GuideCard
                  key={guide.id}
                  vehicleId={vehicleId}
                  guide={guide}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
