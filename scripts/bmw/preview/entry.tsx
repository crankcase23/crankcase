import { createRoot } from "react-dom/client";
import GuideWithWrenchMode from "@/components/GuideWithWrenchMode";
import { bmwDraftGuides } from "@/data/admin-test-guides/bmw-2010-328i-drafts";
import { vehicleTitle } from "@/lib/guideOverview";
import GuideStepVisuals from "@/components/GuideStepVisuals";
import type { GuideStepVisual } from "@/types/guideVisuals";
import type { ResolvedGuide } from "@/types/vehicle";

// Test harness for the REAL guide components, no login or database. It renders exactly what
// /admin/guides/test/<slug> renders (GuideWithWrenchMode), minus the admin chrome. Not shipped: never imported by src/.
//   preview.html?slug=bmw-2010-328i-oil-change      one guide
//   preview.html                                    index of all BMW drafts
const qs = new URLSearchParams(location.search);
const slug = qs.get("slug");
const fixture = qs.get("fixture"); // error-state fixtures, derived from a real BMW draft so everything else is genuine
const root = createRoot(document.getElementById("root")!);
const base = bmwDraftGuides.find((g) => g.slug === "bmw-2010-328i-oil-change")!;
const brokenVisual = { id: "broken", src: "/guide-visuals/does-not-exist.png", width: 1600, height: 1000, alt: "x", caption: "FIXTURE broken picture", application: { year: 2010, make: "BMW", model: "328i", engine: "x" }, provenance: {} } as unknown as GuideStepVisual;
const FIXTURES: Record<string, ResolvedGuide> = {
  "empty-steps": { ...base.guide, steps: [] },
  "no-torque": { ...base.guide, torqueSpecs: [] },
  "no-parts-tools": { ...base.guide, parts: [], tools: [] },
};
const entry = fixture && FIXTURES[fixture] ? { guide: FIXTURES[fixture], vehicle: base.vehicle, slug: fixture } : bmwDraftGuides.find((g) => g.slug === slug);
if (fixture === "broken-image") {
  root.render(<main className="p-6" data-testid="broken-image-host"><GuideStepVisuals visuals={[brokenVisual]} /><p data-testid="after">content after the picture</p></main>);
} else if (slug && !entry) {
  root.render(<main data-testid="not-found" className="p-6 text-white">No guide for slug: {slug}</main>);
} else if (entry) {
  (window as unknown as { __guide: unknown }).__guide = { id: entry.guide.id, steps: entry.guide.steps.length, torque: entry.guide.torqueSpecs.length, tools: entry.guide.tools.length, parts: entry.guide.parts.length };
  root.render(
    <div className="mx-auto max-w-6xl px-4 py-4">
      <GuideWithWrenchMode guide={entry.guide} vehicle={entry.vehicle} breadcrumb={[{ label: "Service Guides", href: "#" }, { label: vehicleTitle(entry.vehicle) }]} />
    </div>
  );
} else {
  root.render(
    <main className="p-6 text-white">
      <h1 className="text-xl font-bold">BMW drafts ({bmwDraftGuides.length})</h1>
      <ul>{bmwDraftGuides.map((g) => <li key={g.slug}><a className="underline" href={`?slug=${g.slug}`}>{g.guide.title}</a></li>)}</ul>
    </main>
  );
}
