import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireAdmin } from "@/lib/admin/rbac";
import { findGuideRecord } from "@/lib/admin/guides";
import { formatNumber } from "@/lib/admin/format";
import { Panel, Badge, EmptyState, FieldList, MicroLabel, Table, THead, TBody, TR, TH, TD } from "@/components/admin/ui";
import { Meter } from "@/components/admin/charts";
import { Icon } from "@/components/admin/icons";

export const metadata = { title: "Guide detail" };

export default async function AdminGuideDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireAdmin("guides.view");
  if (!ctx) redirect("/admin");

  const { id } = await params;
  const record = findGuideRecord(id);
  if (!record) notFound();

  const { guide, vehicle, issues, completeness, status } = record;
  const required = issues.filter((i) => i.severity === "required");
  const recommended = issues.filter((i) => i.severity === "recommended");

  return (
    <div>
      <div className="mb-4">
        <Link href="/admin/guides" className="text-xs text-slate-500 hover:text-orange-300">
          ← All guides
        </Link>
      </div>

      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <MicroLabel>{record.vehicleLabel}</MicroLabel>
          <h1
            className="mt-1 text-2xl font-bold tracking-wide text-slate-50 sm:text-3xl"
            style={{ fontFamily: "var(--font-display)", letterSpacing: "0.03em" }}
          >
            {guide.title}
          </h1>
          <div className="mt-1.5 flex flex-wrap items-center gap-2">
            <Badge tone={guide.tier === "free" ? "positive" : "accent"}>{guide.tier}</Badge>
            <Badge tone="muted">{guide.difficulty}</Badge>
            <Badge tone="muted">{guide.estTime}</Badge>
            {status === "incomplete" ? (
              <Badge tone="critical">incomplete</Badge>
            ) : (
              <Badge tone="positive">publish-ready</Badge>
            )}
          </div>
        </div>
        {vehicle && (
          <a
            href={`/vehicles/${vehicle.id}/repairs/${guide.id}`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 rounded-md border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs text-slate-200 hover:border-orange-500/50 hover:text-orange-300"
          >
            View live guide
            <Icon name="external" className="h-3.5 w-3.5" />
          </a>
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
        <div className="space-y-4">
          {/* -------------------------------------------- publish checklist */}
          <Panel
            title="Publish checklist"
            eyebrow={status === "incomplete" ? "Not ready" : "Ready"}
            subtitle="This guide is already live — everything in src/data/repairs.ts renders to users. These are the gaps."
            accent
          >
            {issues.length === 0 ? (
              <div className="flex items-center gap-2 text-sm text-emerald-400">
                <Icon name="shield" className="h-4 w-4" />
                Every check passes. Nothing missing.
              </div>
            ) : (
              <div className="space-y-4">
                {required.length > 0 && (
                  <div>
                    <MicroLabel className="text-rose-400">Blocking — required</MicroLabel>
                    <ul className="mt-2 space-y-1.5">
                      {required.map((i) => (
                        <li
                          key={i.field}
                          className="flex items-start gap-2 rounded-md border border-rose-500/20 bg-rose-500/5 px-3 py-2"
                        >
                          <span className="mt-0.5 shrink-0 text-rose-400">
                            <Icon name="alert" className="h-3.5 w-3.5" />
                          </span>
                          <span className="text-xs text-slate-300">
                            <span className="font-mono text-[10px] uppercase tracking-wider text-rose-400">
                              {i.field}
                            </span>
                            <span className="ml-2">{i.message}</span>
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {recommended.length > 0 && (
                  <div>
                    <MicroLabel className="text-amber-400">Quality — recommended</MicroLabel>
                    <ul className="mt-2 space-y-1.5">
                      {recommended.map((i) => (
                        <li key={i.field} className="flex items-start gap-2 px-3 py-1.5">
                          <span className="mt-0.5 shrink-0 text-amber-400">
                            <Icon name="alert" className="h-3.5 w-3.5" />
                          </span>
                          <span className="text-xs text-slate-400">
                            <span className="font-mono text-[10px] uppercase tracking-wider text-slate-500">
                              {i.field}
                            </span>
                            <span className="ml-2">{i.message}</span>
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </Panel>

          {/* ---------------------------------------------- guide structure */}
          <Panel title="Guide structure" eyebrow="Content">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <MicroLabel>Tools required ({guide.tools.length})</MicroLabel>
                {guide.tools.length === 0 ? (
                  <p className="mt-1 text-xs text-rose-400">None listed</p>
                ) : (
                  <ul className="mt-1.5 space-y-1 text-xs text-slate-300">
                    {guide.tools.map((t) => (
                      <li key={t.name}>
                        {t.name}
                        {t.note && <span className="text-slate-600"> — {t.note}</span>}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <div>
                <MicroLabel>Parts required ({guide.parts.length})</MicroLabel>
                {guide.parts.length === 0 ? (
                  <p className="mt-1 text-xs text-rose-400">None listed</p>
                ) : (
                  <ul className="mt-1.5 space-y-1 text-xs text-slate-300">
                    {guide.parts.map((p) => (
                      <li key={p}>{p}</li>
                    ))}
                  </ul>
                )}
              </div>
              <div className="sm:col-span-2">
                <MicroLabel>Safety warnings ({guide.safety.length})</MicroLabel>
                {guide.safety.length === 0 ? (
                  <p className="mt-1 text-xs text-rose-400">None listed — required on every guide</p>
                ) : (
                  <ul className="mt-1.5 space-y-1 text-xs text-slate-300">
                    {guide.safety.map((s) => (
                      <li key={s}>{s}</li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </Panel>

          {/* ----------------------------------------------- torque specs */}
          <Panel title="Torque specifications" eyebrow={`${guide.torqueSpecs.length}`} padded={false}>
            {guide.torqueSpecs.length === 0 ? (
              <div className="p-4">
                <EmptyState title="No torque specs" message="This is the core of the product — a guide without them is incomplete." />
              </div>
            ) : (
              <Table minWidth={560}>
                <THead>
                  <tr>
                    <TH>Fastener</TH>
                    <TH>Torque</TH>
                    <TH>Source</TH>
                  </tr>
                </THead>
                <TBody>
                  {guide.torqueSpecs.map((t) => (
                    <TR key={t.fastener}>
                      <TD>{t.fastener}</TD>
                      <TD mono>
                        {t.value}
                        {t.notes && <div className="mt-0.5 font-sans text-[11px] text-slate-500">{t.notes}</div>}
                      </TD>
                      <TD>
                        <Badge tone={t.provenance?.source === "open-labor-project" ? "positive" : "muted"}>
                          {t.provenance?.source === "open-labor-project"
                            ? t.provenance.confidence ?? "sourced"
                            : "hand-typed"}
                        </Badge>
                      </TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
            )}
          </Panel>

          {/* --------------------------------------------------- procedure */}
          <Panel title="Step-by-step procedure" eyebrow={`${guide.steps.length} steps`} padded={false}>
            {guide.steps.length === 0 ? (
              <div className="p-4">
                <EmptyState title="No steps" message="This guide has no procedure." />
              </div>
            ) : (
              <ol className="divide-y divide-slate-800/70">
                {guide.steps.map((step) => (
                  <li key={step.number} className="px-4 py-3">
                    <div className="flex items-start gap-3">
                      <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-slate-700 bg-slate-800/60 font-mono text-[10px] text-slate-400">
                        {String(step.number).padStart(2, "0")}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm text-slate-100">{step.title}</span>
                          {step.image ? (
                            <Badge tone="positive">illustrated</Badge>
                          ) : (
                            <Badge tone="muted">no image</Badge>
                          )}
                          {step.warning && <Badge tone="critical">warning</Badge>}
                        </div>
                        <p className="mt-1 text-xs leading-relaxed text-slate-400">{step.instructions}</p>
                        {step.instructions.trim().length <= 40 && (
                          <p className="mt-1 text-[11px] text-amber-400">
                            Very short — this step likely needs more hand-holding.
                          </p>
                        )}
                      </div>
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </Panel>
        </div>

        {/* ---------------------------------------------------------- rail */}
        <div className="space-y-4">
          <Panel title="Completeness" eyebrow="Score" accent>
            <div className="mb-3 text-center">
              <div
                className={`text-5xl font-bold tabular-nums ${
                  completeness >= 90 ? "text-emerald-400" : completeness >= 70 ? "text-amber-400" : "text-rose-400"
                }`}
                style={{ fontFamily: "var(--font-display)" }}
              >
                {completeness}%
              </div>
              <MicroLabel>against the full guide structure</MicroLabel>
            </div>
            <Meter
              value={completeness}
              tone={completeness >= 90 ? "positive" : completeness >= 70 ? "warning" : "critical"}
            />
            <div className="mt-3 space-y-1 text-[11px]">
              <div className="flex justify-between">
                <span className="text-slate-500">Required missing</span>
                <span className={required.length > 0 ? "text-rose-400" : "text-emerald-400"}>{required.length}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Recommended missing</span>
                <span className={recommended.length > 0 ? "text-amber-400" : "text-emerald-400"}>
                  {recommended.length}
                </span>
              </div>
            </div>
          </Panel>

          <Panel title="At a glance" eyebrow="Metrics">
            <FieldList
              rows={[
                { label: "Guide ID", value: <span className="font-mono text-[11px] text-slate-400">{guide.id}</span> },
                { label: "Tier", value: guide.tier },
                { label: "Difficulty", value: guide.difficulty },
                { label: "Estimated time", value: guide.estTime },
                { label: "Steps", value: formatNumber(record.stepCount) },
                {
                  label: "Illustrated steps",
                  value: `${record.illustratedSteps} / ${record.stepCount}`,
                },
                { label: "Torque specs", value: formatNumber(record.torqueCount) },
                {
                  label: "Sourced specs",
                  value:
                    record.realDataSpecs > 0 ? (
                      <span className="text-emerald-400">
                        {record.realDataSpecs} / {record.torqueCount}
                      </span>
                    ) : (
                      <span className="text-amber-400">none</span>
                    ),
                },
                { label: "Tools", value: formatNumber(guide.tools.length) },
                { label: "Parts", value: formatNumber(guide.parts.length) },
              ]}
            />
          </Panel>

          <Panel title="Editing" eyebrow="How to change this">
            <p className="text-[11px] leading-relaxed text-slate-500">
              This guide lives in <span className="font-mono text-slate-400">src/data/repairs.ts</span> under version
              control. Edit it there and commit — git gives every torque-spec change an author, a diff, a review point
              and a one-command rollback, which a database editor would not. Clear the checklist above before you push.
            </p>
          </Panel>
        </div>
      </div>
    </div>
  );
}
