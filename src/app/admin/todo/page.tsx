import Link from "next/link";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/admin/rbac";
import {
  listFeedback,
  listTasks,
  getBuildQueue,
  getTodoSummary,
  FEEDBACK_STATUSES,
  FEEDBACK_KIND_LABELS,
  TASK_CATEGORIES,
  CATEGORY_LABELS,
  type FeedbackStatus,
} from "@/lib/admin/todo";
import { relativeTime, formatDateTime, formatNumber } from "@/lib/admin/format";
import {
  PageHeader,
  Panel,
  KpiCard,
  Badge,
  EmptyState,
  MicroLabel,
  AdminButton,
} from "@/components/admin/ui";
import { Icon } from "@/components/admin/icons";

export const metadata = { title: "To-Do" };

export default async function AdminTodoPage({
  searchParams,
}: {
  searchParams: Promise<{ inbox?: string; done?: string; ok?: string; error?: string }>;
}) {
  const ctx = await requireAdmin("todo.view");
  if (!ctx) redirect("/admin");

  const params = await searchParams;
  const inboxFilter = (FEEDBACK_STATUSES as readonly string[]).includes(params.inbox ?? "")
    ? (params.inbox as FeedbackStatus)
    : "new";
  const showDone = params.done === "1";
  const canManage = ctx.permissions.has("todo.manage");

  const [reports, tasks, signals, summary] = await Promise.all([
    listFeedback(inboxFilter),
    listTasks(showDone),
    getBuildQueue(),
    getTodoSummary(),
  ]);

  const severityTone = { critical: "critical", warning: "warning", info: "muted" } as const;

  return (
    <div>
      <PageHeader
        title="TO-DO"
        description="What users are telling you, what the data says is missing, and whatever else you've parked here."
      />

      {params.ok && (
        <div className="mb-4 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-2.5 text-sm text-emerald-300">
          {decodeURIComponent(params.ok)}
        </div>
      )}
      {params.error && (
        <div className="mb-4 rounded-lg border border-rose-500/30 bg-rose-500/10 px-4 py-2.5 text-sm text-rose-300">
          {decodeURIComponent(params.error)}
        </div>
      )}

      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <KpiCard
          label="New Reports"
          value={summary.newFeedback}
          tone={summary.newFeedback > 0 ? "critical" : "default"}
          hint="from real users"
          href="/admin/todo?inbox=new#inbox"
        />
        <KpiCard label="In Triage" value={summary.triagedFeedback} href="/admin/todo?inbox=triaged#inbox" />
        <KpiCard
          label="Build Signals"
          value={summary.signals}
          hint={`${summary.criticalSignals} critical`}
          tone={summary.criticalSignals > 0 ? "warning" : "default"}
        />
        <KpiCard label="Open Tasks" value={summary.openTasks} hint={`${summary.doneTasks} done`} />
      </div>

      {/* ============================================================ SECTION 1 */}
      <section id="inbox" className="mb-6 scroll-mt-20">
        <div className="mb-2 flex items-baseline gap-2">
          <span className="font-mono text-[10px] text-orange-500">01</span>
          <h2
            className="text-lg font-bold tracking-wide text-slate-100"
            style={{ fontFamily: "var(--font-display)", letterSpacing: "0.04em" }}
          >
            FROM THE SITE
          </h2>
        </div>
        <p className="mb-3 max-w-2xl text-xs leading-relaxed text-slate-500">
          Reports submitted by users from guide and vehicle pages. This outranks everything below it — someone
          telling you a torque value looks wrong is worth more than any metric on the dashboard.
        </p>

        <Panel padded={false} accent>
          <div className="flex flex-wrap items-center gap-1 border-b border-slate-800/80 px-4 py-3">
            {FEEDBACK_STATUSES.map((s) => (
              <Link
                key={s}
                href={`/admin/todo?inbox=${s}#inbox`}
                className={`rounded-md px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.12em] transition-colors ${
                  inboxFilter === s
                    ? "bg-orange-500 text-slate-950"
                    : "text-slate-400 hover:bg-slate-800 hover:text-slate-100"
                }`}
              >
                {s}
              </Link>
            ))}
          </div>

          {reports.length === 0 ? (
            <div className="p-4">
              <EmptyState
                title={inboxFilter === "new" ? "Waiting for data" : `Nothing ${inboxFilter}`}
                message={
                  inboxFilter === "new"
                    ? "No reports yet. A 'Spot something wrong on this page?' control now sits on every guide and vehicle page — anything users send lands here."
                    : undefined
                }
              />
            </div>
          ) : (
            <ul className="divide-y divide-slate-800/70">
              {reports.map((r) => (
                <li key={r.id} className="px-4 py-3">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge tone={r.kind === "data" ? "critical" : r.kind === "bug" ? "warning" : "muted"}>
                          {FEEDBACK_KIND_LABELS[r.kind] ?? r.kind}
                        </Badge>
                        {r.severity && <Badge tone="accent">{r.severity}</Badge>}
                        <span className="font-mono text-[10px] text-slate-600" title={formatDateTime(r.createdAt)}>
                          {relativeTime(r.createdAt)}
                        </span>
                      </div>

                      <p className="mt-1.5 whitespace-pre-wrap text-sm leading-relaxed text-slate-200">
                        {r.message}
                      </p>

                      <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5 font-mono text-[10px] text-slate-600">
                        {r.userId ? (
                          <Link href={`/admin/users/${r.userId}`} className="hover:text-orange-400">
                            {r.userEmail}
                          </Link>
                        ) : (
                          <span>deleted account</span>
                        )}
                        {r.guideId && (
                          <Link href={`/admin/guides/${r.guideId}`} className="hover:text-orange-400">
                            guide: {r.guideId}
                          </Link>
                        )}
                        {r.path && <span>{r.path}</span>}
                      </div>

                      {r.adminNote && (
                        <p className="mt-1.5 rounded border-l-2 border-slate-700 pl-2 text-[11px] text-slate-500">
                          {r.adminNote}
                        </p>
                      )}
                    </div>

                    {canManage && (
                      <form action="/api/admin/feedback" method="post" className="flex shrink-0 flex-wrap gap-1.5">
                        <input type="hidden" name="id" value={r.id} />
                        {r.status !== "triaged" && (
                          <AdminButton variant="secondary" name="status" value="triaged">
                            Triage
                          </AdminButton>
                        )}
                        {r.status !== "resolved" && (
                          <AdminButton variant="primary" name="status" value="resolved">
                            Resolve
                          </AdminButton>
                        )}
                        {r.status !== "wontfix" && (
                          <AdminButton variant="secondary" name="status" value="wontfix">
                            Won&apos;t fix
                          </AdminButton>
                        )}
                      </form>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </section>

      {/* ============================================================ SECTION 2 */}
      <section id="queue" className="mb-6 scroll-mt-20">
        <div className="mb-2 flex items-baseline gap-2">
          <span className="font-mono text-[10px] text-orange-500">02</span>
          <h2
            className="text-lg font-bold tracking-wide text-slate-100"
            style={{ fontFamily: "var(--font-display)", letterSpacing: "0.04em" }}
          >
            BUILD QUEUE
          </h2>
        </div>
        <p className="mb-3 max-w-2xl text-xs leading-relaxed text-slate-500">
          Computed live from the catalog, the database and the Open Labor Project cache — not from a document
          anyone has to remember to update. Close a gap and the item disappears on its own.
        </p>

        <Panel padded={false} accent>
          {signals.length === 0 ? (
            <div className="p-4">
              <EmptyState
                title="Nothing outstanding"
                message="Every derived check passes: full guide coverage, no unresolved data lookups, no untriaged reports."
              />
            </div>
          ) : (
            <ul className="divide-y divide-slate-800/70">
              {signals.map((s) => (
                <li key={s.id} className="px-4 py-3">
                  <div className="flex items-start gap-3">
                    <span
                      className={`mt-0.5 shrink-0 ${
                        s.severity === "critical"
                          ? "text-rose-400"
                          : s.severity === "warning"
                            ? "text-amber-400"
                            : "text-slate-600"
                      }`}
                    >
                      <Icon name="alert" className="h-4 w-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-medium text-slate-100">{s.title}</span>
                        <Badge tone={severityTone[s.severity]}>{s.category}</Badge>
                        {s.count !== null && (
                          <span className="font-mono text-[11px] tabular-nums text-slate-500">
                            {formatNumber(s.count)}
                          </span>
                        )}
                      </div>
                      <p className="mt-0.5 text-xs leading-relaxed text-slate-500">{s.detail}</p>
                      {s.href && (
                        <Link
                          href={s.href}
                          className="mt-1 inline-block text-[11px] font-medium text-orange-400 hover:text-orange-300"
                        >
                          Go there →
                        </Link>
                      )}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </section>

      {/* ============================================================ SECTION 3 */}
      <section id="tasks" className="scroll-mt-20">
        <div className="mb-2 flex items-baseline gap-2">
          <span className="font-mono text-[10px] text-orange-500">03</span>
          <h2
            className="text-lg font-bold tracking-wide text-slate-100"
            style={{ fontFamily: "var(--font-display)", letterSpacing: "0.04em" }}
          >
            YOUR LIST
          </h2>
        </div>
        <p className="mb-3 max-w-2xl text-xs leading-relaxed text-slate-500">
          Anything the queue above can&apos;t infer. Kept small on purpose — the derived half is what stays
          accurate, this is for the rest.
        </p>

        <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
          <Panel padded={false} accent>
            <div className="flex items-center justify-between border-b border-slate-800/80 px-4 py-3">
              <MicroLabel>
                {tasks.length} {showDone ? "total" : "active"}
              </MicroLabel>
              <Link
                href={showDone ? "/admin/todo#tasks" : "/admin/todo?done=1#tasks"}
                className="text-[11px] text-slate-500 hover:text-orange-300"
              >
                {showDone ? "Hide completed" : "Show completed"}
              </Link>
            </div>

            {tasks.length === 0 ? (
              <div className="p-4">
                <EmptyState title="Nothing here yet" message="Add something using the form beside this." />
              </div>
            ) : (
              <ul className="divide-y divide-slate-800/70">
                {tasks.map((t) => (
                  <li key={t.id} className="flex items-start gap-3 px-4 py-2.5">
                    {canManage ? (
                      <form action="/api/admin/tasks" method="post" className="mt-0.5 shrink-0">
                        <input type="hidden" name="id" value={t.id} />
                        <input type="hidden" name="action" value={t.status === "done" ? "reopen" : "complete"} />
                        <button
                          type="submit"
                          aria-label={t.status === "done" ? "Reopen" : "Mark done"}
                          className={`flex h-4 w-4 items-center justify-center rounded border text-[10px] ${
                            t.status === "done"
                              ? "border-emerald-500/50 bg-emerald-500/20 text-emerald-400"
                              : "border-slate-600 text-transparent hover:border-orange-500"
                          }`}
                        >
                          ✓
                        </button>
                      </form>
                    ) : (
                      <span className="mt-0.5 h-4 w-4 shrink-0 rounded border border-slate-700" />
                    )}

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={`text-sm ${
                            t.status === "done" ? "text-slate-600 line-through" : "text-slate-200"
                          }`}
                        >
                          {t.title}
                        </span>
                        <Badge tone="muted">{CATEGORY_LABELS[t.category] ?? t.category}</Badge>
                        {t.status === "doing" && <Badge tone="accent">in progress</Badge>}
                      </div>
                      {t.detail && <p className="mt-0.5 text-xs text-slate-500">{t.detail}</p>}
                    </div>

                    {canManage && t.status !== "done" && (
                      <form action="/api/admin/tasks" method="post" className="shrink-0">
                        <input type="hidden" name="id" value={t.id} />
                        <input type="hidden" name="action" value="delete" />
                        <button
                          type="submit"
                          aria-label="Delete task"
                          className="text-slate-700 hover:text-rose-400"
                        >
                          ✕
                        </button>
                      </form>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          {canManage && (
            <Panel title="Add a task" eyebrow="Manual">
              <form action="/api/admin/tasks" method="post" className="space-y-3">
                <input type="hidden" name="action" value="create" />
                <div>
                  <label htmlFor="task-title" className="mb-1 block">
                    <MicroLabel>Title *</MicroLabel>
                  </label>
                  <input
                    id="task-title"
                    name="title"
                    required
                    maxLength={200}
                    className="w-full rounded-md border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-slate-200 focus:border-orange-500/50 focus:outline-none"
                  />
                </div>
                <div>
                  <label htmlFor="task-detail" className="mb-1 block">
                    <MicroLabel>Detail</MicroLabel>
                  </label>
                  <textarea
                    id="task-detail"
                    name="detail"
                    rows={2}
                    maxLength={1000}
                    className="w-full rounded-md border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-slate-200 focus:border-orange-500/50 focus:outline-none"
                  />
                </div>
                <div>
                  <label htmlFor="task-category" className="mb-1 block">
                    <MicroLabel>Category</MicroLabel>
                  </label>
                  <select
                    id="task-category"
                    name="category"
                    defaultValue="product"
                    className="w-full rounded-md border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-slate-200 focus:border-orange-500/50 focus:outline-none"
                  >
                    {TASK_CATEGORIES.map((c) => (
                      <option key={c} value={c}>
                        {CATEGORY_LABELS[c]}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="task-priority" className="mb-1 block">
                    <MicroLabel>Priority (lower sorts first)</MicroLabel>
                  </label>
                  <input
                    id="task-priority"
                    name="priority"
                    type="number"
                    defaultValue={100}
                    className="w-full rounded-md border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-slate-200 focus:border-orange-500/50 focus:outline-none"
                  />
                </div>
                <AdminButton variant="primary">Add task</AdminButton>
              </form>
            </Panel>
          )}
        </div>
      </section>
    </div>
  );
}
