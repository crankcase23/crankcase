import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { findVehicle, findRepair, allRepairs } from "@/lib/data";
import { ToolList, BulletList, TorqueTable, DifficultyBadge, TierBadge } from "@/components/tables";
import RepairStepCard from "@/components/RepairStepCard";
import DataDisclaimer from "@/components/DataDisclaimer";
import ViewTracker from "@/components/ViewTracker";
import FeedbackWidget from "@/components/FeedbackWidget";

export function generateStaticParams() {
  return allRepairs().map((r) => ({ id: r.vehicleId, repairId: r.id }));
}

export async function generateMetadata(
  props: PageProps<"/vehicles/[id]/repairs/[repairId]">
): Promise<Metadata> {
  const { id, repairId } = await props.params;
  const vehicle = findVehicle(id);
  const guide = findRepair(repairId);
  if (!vehicle || !guide) return {};
  return {
    title: `${guide.title} — ${vehicle.year} ${vehicle.make} ${vehicle.model}`,
    description: guide.summary,
  };
}

export default async function RepairGuidePage(
  props: PageProps<"/vehicles/[id]/repairs/[repairId]">
) {
  const { id, repairId } = await props.params;
  const vehicle = findVehicle(id);
  const guide = findRepair(repairId);
  if (!vehicle || !guide || guide.vehicleId !== vehicle.id) notFound();

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      {/* Records the view for admin analytics. Renders nothing. */}
      <ViewTracker type="guide.viewed" objectId={guide.id} objectType="guide" />
      <Link
        href={`/vehicles/${vehicle.id}`}
        className="text-sm text-slate-400 hover:text-slate-200"
      >
        &larr; Back to {vehicle.year} {vehicle.make} {vehicle.model}
      </Link>

      <div className="mt-3 mb-6 flex flex-wrap items-center gap-3">
        <h1 className="text-3xl font-bold text-slate-50">{guide.title}</h1>
        <TierBadge tier={guide.tier} />
        <DifficultyBadge difficulty={guide.difficulty} />
      </div>
      <p className="max-w-2xl text-slate-400">{guide.summary}</p>
      <div className="mt-3 flex flex-wrap gap-4 text-sm text-slate-400">
        <span>⏱ Estimated time: {guide.estTime}</span>
        <span>
          🚗 {vehicle.year} {vehicle.make} {vehicle.model} ({vehicle.engine})
        </span>
      </div>

      {guide.tier === "premium" && (
        <div className="mt-6 rounded-xl border border-orange-500/30 bg-orange-500/10 px-4 py-3 text-sm text-orange-200">
          🔒 <span className="font-semibold">Premium guide.</span> Shown in full for now while
          we&apos;re still building — once accounts and per-vehicle unlocks ship, guides like this
          one will require unlocking {vehicle.year} {vehicle.make} {vehicle.model}. Specs, fluid
          capacities, and the basic oil-change guide stay free forever.
        </div>
      )}

      <div className="mt-6">
        <DataDisclaimer />
      </div>

      <div className="mt-8 grid gap-8 sm:grid-cols-2">
        <section>
          <h2 className="mb-3 text-lg font-semibold text-slate-100">Tools Needed</h2>
          <ToolList tools={guide.tools} />
        </section>
        <section>
          <h2 className="mb-3 text-lg font-semibold text-slate-100">Parts &amp; Supplies</h2>
          <BulletList items={guide.parts} />
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
        <TorqueTable specs={guide.torqueSpecs} />
      </section>

      <section className="mt-10">
        <h2 className="mb-4 text-lg font-semibold text-slate-100">Step-by-Step</h2>
        <div className="space-y-4">
          {guide.steps.map((step) => (
            <RepairStepCard key={step.number} step={step} />
          ))}
        </div>
      </section>

      {/* Torque specs are the one thing on this site that can hurt someone if
          they're wrong, so the report control lives on every guide. */}
      <FeedbackWidget vehicleId={vehicle.id} guideId={guide.id} />
    </div>
  );
}
