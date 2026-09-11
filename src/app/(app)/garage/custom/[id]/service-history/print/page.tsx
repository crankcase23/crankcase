"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useGarage } from "@/lib/garage";
import PrintServiceHistory from "@/components/PrintServiceHistory";

export default function CustomServiceHistoryPrintPage() {
  const params = useParams<{ id: string }>();
  const { findCustom, isLoading } = useGarage();
  const entry = findCustom(params.id);

  if (isLoading) return null;

  if (!entry || entry.kind !== "custom") {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 text-center">
        <h1 className="text-xl font-bold text-slate-50">Vehicle not found</h1>
        <p className="mt-2 text-sm text-slate-400">
          This vehicle isn&apos;t in your garage on this browser.
        </p>
        <Link href="/garage" className="mt-4 inline-block text-sm font-medium text-orange-400 hover:text-orange-300">
          &larr; Back to garage
        </Link>
      </div>
    );
  }

  const { custom } = entry;
  const label = [custom.year, custom.make, custom.model, custom.trim].filter(Boolean).join(" ") || "Your vehicle";

  return (
    <PrintServiceHistory
      vehicleId={entry.id}
      vehicleLabel={label}
      vehicleSubline={custom.engine}
      backHref={`/garage/custom/${entry.id}`}
    />
  );
}
