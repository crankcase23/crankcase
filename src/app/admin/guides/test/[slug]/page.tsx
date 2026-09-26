import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import { requireAdmin } from "@/lib/admin/rbac";
import { findAdminTestGuide } from "@/data/admin-test-guides/charger-2016-sxt-multi-job";
import GuideWithWrenchMode from "@/components/GuideWithWrenchMode";
import { vehicleTitle } from "@/lib/guideOverview";

// ADMIN TEST GUIDE ROUTE. Renders an unpublished guide with the standard
// customer guide components (GuideBody / StepList / RepairStepCard) so it
// feels exactly like a real Crankcase guide in the garage.
//
// The guide data lives in src/data/admin-test-guides, which nothing outside
// /admin imports -- that is what keeps it out of the customer catalog. This
// page adds the second gate: it lives under /admin (the layout bounces
// non-admins) AND checks requireAdmin itself, because a layout is not the
// security boundary. See src/lib/admin/rbac.ts.
//
// Deliberately omitted vs the customer guide page: ViewTracker and
// FeedbackWidget (they write analytics/feedback rows against a guide id that
// is not in the catalog) and DataDisclaimer (its "routine maintenance only,
// not engine work" wording contradicts this job).

export const metadata: Metadata = {
  title: "Admin test guide",
  robots: { index: false, follow: false },
};

export default async function AdminTestGuidePage({ params }: { params: Promise<{ slug: string }> }) {
  const ctx = await requireAdmin("guides.view");
  if (!ctx) redirect("/admin");

  const { slug } = await params;
  const entry = findAdminTestGuide(slug);
  if (!entry) notFound();
  const { guide, vehicle } = entry;

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Link href="/admin/guides" className="text-sm text-slate-400 hover:text-slate-200">
          &larr; Back to Service Guides
        </Link>
        <span className="inline-flex items-center rounded-full border border-amber-500/40 bg-amber-500/10 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider text-amber-300">
          Admin test guide — not published
        </span>
      </div>

      <GuideWithWrenchMode
        guide={guide}
        vehicle={vehicle}
        breadcrumb={[
          { label: "Service Guides", href: "/admin/guides" },
          { label: vehicleTitle(vehicle) },
        ]}
      />
    </div>
  );
}
