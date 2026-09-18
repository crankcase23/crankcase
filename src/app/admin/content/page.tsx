import Link from "next/link";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/admin/rbac";
import {
  listContent,
  getContentCounts,
  CONTENT_KINDS,
  CONTENT_STATUSES,
  CONTENT_KIND_LABELS,
  type ContentKind,
  type ContentStatus,
} from "@/lib/admin/content";
import { formatDate, relativeTime } from "@/lib/admin/format";
import {
  PageHeader,
  Panel,
  Table,
  THead,
  TBody,
  TR,
  TH,
  TD,
  Badge,
  EmptyState,
  KpiCard,
} from "@/components/admin/ui";

export const metadata = { title: "Content" };

export default async function AdminContentPage({
  searchParams,
}: {
  searchParams: Promise<{ kind?: string; status?: string; ok?: string }>;
}) {
  const ctx = await requireAdmin("content.view");
  if (!ctx) redirect("/admin");

  const params = await searchParams;
  const kind = (CONTENT_KINDS as readonly string[]).includes(params.kind ?? "")
    ? (params.kind as ContentKind)
    : undefined;
  const status = (CONTENT_STATUSES as readonly string[]).includes(params.status ?? "")
    ? (params.status as ContentStatus)
    : undefined;

  const [rows, counts] = await Promise.all([listContent({ kind, status }), getContentCounts()]);
  const canEdit = ctx.permissions.has("content.edit");

  function buildHref(overrides: Record<string, string | undefined>) {
    const sp = new URLSearchParams();
    const merged = { kind, status, ...overrides };
    for (const [k, v] of Object.entries(merged)) if (v) sp.set(k, v);
    const qs = sp.toString();
    return `/admin/content${qs ? `?${qs}` : ""}`;
  }

  return (
    <div>
      <PageHeader
        title="CONTENT"
        description="Articles, FAQs, announcements and featured slots. Repair guides are managed under Service Guides — their content lives in version control."
        action={
          canEdit ? (
            <Link
              href="/admin/content/new"
              className="inline-flex items-center gap-1.5 rounded-md border border-orange-500 bg-orange-500 px-3 py-1.5 text-xs font-medium text-slate-950 hover:bg-orange-400"
            >
              + New content
            </Link>
          ) : undefined
        }
      />

      {params.ok && (
        <div className="mb-4 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-2.5 text-sm text-emerald-300">
          {decodeURIComponent(params.ok)}
        </div>
      )}

      <div className="mb-5 grid grid-cols-3 gap-3">
        <KpiCard label="Published" value={counts.published ?? 0} tone="positive" href="/admin/content?status=published" />
        <KpiCard
          label="Draft"
          value={counts.draft ?? 0}
          tone={(counts.draft ?? 0) > 0 ? "warning" : "default"}
          href="/admin/content?status=draft"
        />
        <KpiCard label="Archived" value={counts.archived ?? 0} tone="muted" href="/admin/content?status=archived" />
      </div>

      <Panel padded={false} accent>
        <div className="flex flex-wrap items-center gap-3 border-b border-slate-800/80 px-4 py-3">
          <div className="flex flex-wrap items-center gap-1">
            {[{ label: "All types", value: undefined }, ...CONTENT_KINDS.map((k) => ({ label: CONTENT_KIND_LABELS[k], value: k }))].map(
              (f) => (
                <Link
                  key={f.label}
                  href={buildHref({ kind: f.value })}
                  className={`rounded-md px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.12em] transition-colors ${
                    kind === f.value ? "bg-orange-500 text-slate-950" : "text-slate-400 hover:bg-slate-800 hover:text-slate-100"
                  }`}
                >
                  {f.label}
                </Link>
              )
            )}
          </div>
          <span className="hidden text-slate-800 sm:inline">|</span>
          <div className="flex flex-wrap items-center gap-1">
            {[{ label: "Any status", value: undefined }, ...CONTENT_STATUSES.map((s) => ({ label: s, value: s }))].map((f) => (
              <Link
                key={f.label}
                href={buildHref({ status: f.value })}
                className={`rounded-md px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.12em] transition-colors ${
                  status === f.value ? "bg-orange-500 text-slate-950" : "text-slate-400 hover:bg-slate-800 hover:text-slate-100"
                }`}
              >
                {f.label}
              </Link>
            ))}
          </div>
        </div>

        {rows.length === 0 ? (
          <div className="p-4">
            <EmptyState
              title={kind || status ? "No matches" : "Waiting for data"}
              message={
                kind || status
                  ? "Nothing matches these filters."
                  : "No content has been created yet. Articles, FAQs and announcements you add here become available to the site."
              }
              action={
                canEdit ? (
                  <Link
                    href="/admin/content/new"
                    className="inline-flex items-center gap-1.5 rounded-md border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs text-slate-200 hover:border-orange-500/50 hover:text-orange-300"
                  >
                    Create the first one
                  </Link>
                ) : undefined
              }
            />
          </div>
        ) : (
          <Table minWidth={800}>
            <THead>
              <tr>
                <TH>Title</TH>
                <TH>Type</TH>
                <TH>Status</TH>
                <TH>Published</TH>
                <TH>Last modified</TH>
                <TH align="right">Order</TH>
              </tr>
            </THead>
            <TBody>
              {rows.map((c) => (
                <TR key={c.id}>
                  <TD>
                    <Link href={`/admin/content/${c.id}`} className="text-slate-100 hover:text-orange-300">
                      {c.title}
                    </Link>
                    <div className="font-mono text-[10px] text-slate-600">/{c.slug}</div>
                  </TD>
                  <TD>
                    <Badge tone="muted">{CONTENT_KIND_LABELS[c.kind as ContentKind] ?? c.kind}</Badge>
                  </TD>
                  <TD>
                    <Badge
                      tone={c.status === "published" ? "positive" : c.status === "draft" ? "warning" : "muted"}
                    >
                      {c.status}
                    </Badge>
                  </TD>
                  <TD mono muted>
                    {c.publishedAt ? formatDate(c.publishedAt) : <span className="text-slate-700">—</span>}
                  </TD>
                  <TD mono muted>
                    {relativeTime(c.updatedAt)}
                  </TD>
                  <TD align="right" mono muted>
                    {c.sortOrder}
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        )}
      </Panel>
    </div>
  );
}
