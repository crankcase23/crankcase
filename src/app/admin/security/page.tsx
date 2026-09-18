import Link from "next/link";
import { redirect } from "next/navigation";
import { requireAdmin, ROLES, ROLE_LABELS, ROLE_DESCRIPTIONS, type AdminRole } from "@/lib/admin/rbac";
import { getLoginBursts, getRecentLogins, listAdmins } from "@/lib/admin/security";
import { listAuditLog, listAuditActions, countAuditLog, AUDIT_ACTION_LABELS, SENSITIVE_ACTIONS } from "@/lib/admin/audit";
import { formatDateTime, relativeTime, formatNumber } from "@/lib/admin/format";
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
  Pagination,
  MicroLabel,
} from "@/components/admin/ui";

export const metadata = { title: "Security / Audit" };

const PAGE_SIZE = 40;

export default async function AdminSecurityPage({
  searchParams,
}: {
  searchParams: Promise<{ action?: string; page?: string }>;
}) {
  const ctx = await requireAdmin("audit.view");
  if (!ctx) redirect("/admin");

  const params = await searchParams;
  const action = params.action || undefined;
  const page = Math.max(1, Number.parseInt(params.page ?? "1", 10) || 1);

  const [entries, actions, total, admins, recentLogins, loginBursts] = await Promise.all([
    listAuditLog({ limit: PAGE_SIZE, offset: (page - 1) * PAGE_SIZE, action }),
    listAuditActions(),
    countAuditLog(action),
    listAdmins(),
    getRecentLogins(25),
    getLoginBursts(),
  ]);

  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));

  function buildHref(overrides: Record<string, string | undefined>) {
    const sp = new URLSearchParams();
    const merged = { action, page: String(page), ...overrides };
    for (const [k, v] of Object.entries(merged)) if (v && !(k === "page" && v === "1")) sp.set(k, v);
    const qs = sp.toString();
    return `/admin/security${qs ? `?${qs}` : ""}`;
  }

  return (
    <div>
      <PageHeader
        title="SECURITY / AUDIT"
        description="Who did what, when, and from where. The audit log is append-only — nothing in the app can edit or delete an entry."
      />

      {/* -------------------------------------------- suspicious activity */}
      {loginBursts.length > 0 && (
        <div className="mb-5">
          <Panel title="Unusual sign-in activity" eyebrow="Last hour" accent>
            <ul className="space-y-1.5">
              {loginBursts.map((b) => (
                <li key={b.userId} className="flex items-center justify-between gap-3 text-sm">
                  <Link href={`/admin/users/${b.userId}`} className="text-slate-200 hover:text-orange-300">
                    {b.email}
                  </Link>
                  <Badge tone="warning">{b.n} sign-ins in the last hour</Badge>
                </li>
              ))}
            </ul>
            <p className="mt-2 text-[11px] leading-relaxed text-slate-600">
              A deliberately simple, explainable rule: ten or more sign-ins for one account within an hour. It is not a
              scoring model, so it will not quietly flag people for reasons nobody can explain.
            </p>
          </Panel>
        </div>
      )}

      <div className="grid gap-4 xl:grid-cols-[1fr_360px]">
        {/* --------------------------------------------------------- audit log */}
        <div className="min-w-0 space-y-4">
          <Panel title="Administrative audit log" eyebrow={`${formatNumber(total)} entries`} padded={false} accent>
            <div className="flex flex-wrap items-center gap-1 border-b border-slate-800/80 px-4 py-3">
              <Link
                href={buildHref({ action: undefined, page: undefined })}
                className={`rounded-md px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.12em] transition-colors ${
                  !action ? "bg-orange-500 text-slate-950" : "text-slate-400 hover:bg-slate-800 hover:text-slate-100"
                }`}
              >
                All
              </Link>
              {actions.map((a) => (
                <Link
                  key={a}
                  href={buildHref({ action: a, page: undefined })}
                  className={`rounded-md px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.12em] transition-colors ${
                    action === a ? "bg-orange-500 text-slate-950" : "text-slate-400 hover:bg-slate-800 hover:text-slate-100"
                  }`}
                >
                  {AUDIT_ACTION_LABELS[a] ?? a}
                </Link>
              ))}
            </div>

            {entries.length === 0 ? (
              <div className="p-4">
                <EmptyState
                  title={action ? "No entries" : "Waiting for data"}
                  message={
                    action
                      ? "No administrative actions of this type have been recorded."
                      : "No administrative actions recorded yet. Every user change, unlock, publish and role grant lands here automatically."
                  }
                />
              </div>
            ) : (
              <Table minWidth={760}>
                <THead>
                  <tr>
                    <TH>When</TH>
                    <TH>Admin</TH>
                    <TH>Action</TH>
                    <TH>Detail</TH>
                    <TH>IP</TH>
                  </tr>
                </THead>
                <TBody>
                  {entries.map((e) => (
                    <TR key={e.id}>
                      <TD mono muted>
                        <span title={formatDateTime(e.createdAt)}>{relativeTime(e.createdAt)}</span>
                      </TD>
                      <TD>{e.adminEmail ?? <span className="text-slate-600">deleted admin</span>}</TD>
                      <TD>
                        <Badge tone={SENSITIVE_ACTIONS.has(e.action) ? "critical" : "muted"}>
                          {AUDIT_ACTION_LABELS[e.action] ?? e.action}
                        </Badge>
                      </TD>
                      <TD muted>{e.summary ?? "—"}</TD>
                      <TD mono muted>
                        {e.ip ?? <span className="text-slate-700">—</span>}
                      </TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
            )}

            <Pagination page={page} pageCount={pageCount} total={total} hrefFor={(p) => buildHref({ page: String(p) })} />
          </Panel>

          {/* ---------------------------------------------------- sign-ins */}
          <section id="logins" className="scroll-mt-20">
            <Panel title="Recent sign-ins" eyebrow="Last 25" padded={false}>
              {recentLogins.length === 0 ? (
                <div className="p-4">
                  <EmptyState
                    title="Waiting for data"
                    message="Sign-in history only covers logins recorded after tracking shipped."
                  />
                </div>
              ) : (
                <ul className="divide-y divide-slate-800/70">
                  {recentLogins.map((l) => (
                    <li key={l.id} className="flex items-center justify-between gap-3 px-4 py-2 text-xs">
                      {l.userId ? (
                        <Link href={`/admin/users/${l.userId}`} className="truncate text-slate-300 hover:text-orange-300">
                          {l.email}
                        </Link>
                      ) : (
                        <span className="text-slate-600">deleted account</span>
                      )}
                      <span className="shrink-0 font-mono text-[10px] text-slate-600" title={formatDateTime(l.loggedInAt)}>
                        {relativeTime(l.loggedInAt)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
          </section>
        </div>

        {/* ------------------------------------------------------------- rail */}
        <div className="space-y-4">
          <Panel title="Administrators" eyebrow={`${admins.length}`} accent>
            <ul className="space-y-3">
              {admins.map((a) => {
                const roleList = a.roles ? a.roles.split(",").filter(Boolean) : [];
                return (
                  <li key={a.id} className="border-b border-slate-800/70 pb-2.5 last:border-0 last:pb-0">
                    <div className="flex items-start justify-between gap-2">
                      <Link href={`/admin/users/${a.id}`} className="min-w-0 truncate text-sm text-slate-200 hover:text-orange-300">
                        {a.email}
                      </Link>
                      {a.status === "disabled" && <Badge tone="critical">disabled</Badge>}
                    </div>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {roleList.length === 0 ? (
                        <Badge tone="muted">support admin (default)</Badge>
                      ) : (
                        roleList.map((r) => (
                          <Badge key={r} tone="accent">
                            {ROLE_LABELS[r as AdminRole] ?? r}
                          </Badge>
                        ))
                      )}
                    </div>
                    <div className="mt-1 font-mono text-[10px] text-slate-600">
                      {a.lastLoginAt ? `last seen ${relativeTime(a.lastLoginAt)}` : "never signed in"}
                    </div>
                  </li>
                );
              })}
            </ul>
            <p className="mt-3 text-[11px] leading-relaxed text-slate-600">
              Admin access itself is granted by the <span className="font-mono">users.is_admin</span> flag, set by hand
              in the database — there is deliberately no UI for it. Roles below decide what an admin may do once past
              that gate.
            </p>
          </Panel>

          <Panel title="Roles" eyebrow="Permission model">
            <ul className="space-y-3">
              {ROLES.map((r) => (
                <li key={r}>
                  <div className="flex items-center gap-2">
                    <Badge tone={r === "super_admin" ? "accent" : "muted"}>{ROLE_LABELS[r]}</Badge>
                  </div>
                  <p className="mt-1 text-[11px] leading-relaxed text-slate-500">{ROLE_DESCRIPTIONS[r]}</p>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-[11px] leading-relaxed text-slate-600">
              Roles are assigned on an admin&apos;s own user page. Every page and API route re-checks the permission it
              needs server-side — hiding a nav item is not what protects it.
            </p>
          </Panel>

          <Panel title="What gets logged" eyebrow="Coverage">
            <ul className="space-y-1 text-[11px] text-slate-500">
              {[
                "Account edits, disables and deletions",
                "Unlock grants and revocations",
                "Content created, published, unpublished, archived, deleted",
                "Role grants and revocations",
                "Error resolutions",
              ].map((line) => (
                <li key={line} className="flex gap-1.5">
                  <span className="text-orange-500">·</span>
                  {line}
                </li>
              ))}
            </ul>
            <p className="mt-2 text-[11px] leading-relaxed text-slate-600">
              Each entry records the admin, the action, the object, a timestamp, the originating IP and action-specific
              metadata.
            </p>
          </Panel>
        </div>
      </div>

      <p className="mt-4 max-w-3xl">
        <MicroLabel>
          The audit log is append-only by design — this module exposes no update or delete path.
        </MicroLabel>
      </p>
    </div>
  );
}
