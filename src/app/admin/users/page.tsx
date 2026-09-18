import Link from "next/link";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/admin/rbac";
import { listUsers, USER_SORTS, type UserSort } from "@/lib/admin/users";
import { formatDate, relativeTime, displayName, initialsFor, formatNumber } from "@/lib/admin/format";
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

export const metadata = { title: "Users" };

const PAGE_SIZE = 25;

function parseSort(value: string | undefined): UserSort {
  return (USER_SORTS as readonly string[]).includes(value ?? "") ? (value as UserSort) : "created";
}

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    status?: string;
    role?: string;
    sort?: string;
    dir?: string;
    page?: string;
  }>;
}) {
  const ctx = await requireAdmin("users.view");
  if (!ctx) redirect("/admin");

  const params = await searchParams;
  const q = params.q?.trim() || undefined;
  const status = params.status === "active" || params.status === "disabled" ? params.status : undefined;
  const role = params.role === "admin" ? ("admin" as const) : undefined;
  const sort = parseSort(params.sort);
  const dir = params.dir === "asc" ? "asc" : "desc";
  const page = Math.max(1, Number.parseInt(params.page ?? "1", 10) || 1);

  const { rows, total, pageCount } = await listUsers({ q, status, role, sort, dir, page, pageSize: PAGE_SIZE });

  // Builds a URL preserving every active filter, changing only what's passed.
  function buildHref(overrides: Record<string, string | undefined>) {
    const sp = new URLSearchParams();
    const merged = { q, status, role, sort, dir, page: String(page), ...overrides };
    for (const [k, v] of Object.entries(merged)) {
      if (v && !(k === "page" && v === "1") && !(k === "sort" && v === "created" && !overrides.sort)) sp.set(k, v);
    }
    const qs = sp.toString();
    return `/admin/users${qs ? `?${qs}` : ""}`;
  }

  function sortHref(column: UserSort) {
    const nextDir = sort === column && dir === "desc" ? "asc" : "desc";
    return buildHref({ sort: column, dir: nextDir, page: undefined });
  }

  const filters: { label: string; href: string; active: boolean }[] = [
    { label: "All", href: buildHref({ status: undefined, role: undefined, page: undefined }), active: !status && !role },
    { label: "Active", href: buildHref({ status: "active", role: undefined, page: undefined }), active: status === "active" },
    { label: "Disabled", href: buildHref({ status: "disabled", role: undefined, page: undefined }), active: status === "disabled" },
    { label: "Admins", href: buildHref({ role: "admin", status: undefined, page: undefined }), active: role === "admin" },
  ];

  return (
    <div>
      <PageHeader
        title="USERS"
        description="Every account on Crankcase Garage. Search by email or name, then open a profile for the full record."
        action={
          <a
            href="/api/admin/export/users"
            className="inline-flex items-center gap-1.5 rounded-md border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs text-slate-200 hover:border-orange-500/50 hover:text-orange-300"
          >
            Export CSV
          </a>
        }
      />

      <Panel padded={false} accent>
        {/* ---------------------------------------------------------- toolbar */}
        <div className="flex flex-wrap items-center gap-3 border-b border-slate-800/80 px-4 py-3">
          <form action="/admin/users" method="get" className="flex min-w-0 flex-1 items-center gap-2">
            {status && <input type="hidden" name="status" value={status} />}
            {role && <input type="hidden" name="role" value={role} />}
            <input type="hidden" name="sort" value={sort} />
            <input type="hidden" name="dir" value={dir} />
            <input
              type="text"
              name="q"
              defaultValue={q ?? ""}
              placeholder="Search email or name..."
              className="min-w-0 flex-1 rounded-md border border-slate-800 bg-slate-950 px-3 py-1.5 text-sm text-slate-200 placeholder:text-slate-600 focus:border-orange-500/50 focus:outline-none sm:max-w-xs"
            />
            <button
              type="submit"
              className="rounded-md border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs text-slate-200 hover:border-orange-500/50 hover:text-orange-300"
            >
              Search
            </button>
            {q && (
              <Link href={buildHref({ q: undefined, page: undefined })} className="text-xs text-slate-500 hover:text-slate-300">
                Clear
              </Link>
            )}
          </form>

          <div className="flex items-center gap-1">
            {filters.map((f) => (
              <Link
                key={f.label}
                href={f.href}
                className={`rounded-md px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.12em] transition-colors ${
                  f.active ? "bg-orange-500 text-slate-950" : "text-slate-400 hover:bg-slate-800 hover:text-slate-100"
                }`}
              >
                {f.label}
              </Link>
            ))}
          </div>
        </div>

        {/* ------------------------------------------------------------ table */}
        {rows.length === 0 ? (
          <div className="p-4">
            <EmptyState
              title={q || status || role ? "No matches" : "Waiting for data"}
              message={
                q || status || role
                  ? "No accounts match these filters. Try clearing the search."
                  : "No accounts have been created yet. Signups will appear here."
              }
            />
          </div>
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden sm:block">
              <Table minWidth={880}>
                <THead>
                  <tr>
                    <TH sortHref={sortHref("email")} active={sort === "email"} direction={dir}>
                      Account
                    </TH>
                    <TH sortHref={sortHref("created")} active={sort === "created"} direction={dir}>
                      Created
                    </TH>
                    <TH sortHref={sortHref("lastLogin")} active={sort === "lastLogin"} direction={dir}>
                      Last active
                    </TH>
                    <TH align="right" sortHref={sortHref("vehicles")} active={sort === "vehicles"} direction={dir}>
                      Vehicles
                    </TH>
                    <TH align="right" sortHref={sortHref("services")} active={sort === "services"} direction={dir}>
                      Services
                    </TH>
                    <TH align="right">Unlocks</TH>
                    <TH>Subscription</TH>
                    <TH>Status</TH>
                  </tr>
                </THead>
                <TBody>
                  {rows.map((u) => (
                    <TR key={u.id}>
                      <TD>
                        <Link href={`/admin/users/${u.id}`} className="group flex items-center gap-2.5">
                          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-slate-700 bg-slate-800/60 font-mono text-[10px] text-slate-400">
                            {initialsFor(u.name, u.email)}
                          </span>
                          <span className="min-w-0">
                            <span className="block truncate text-slate-100 group-hover:text-orange-300">
                              {displayName(u.name, u.email)}
                            </span>
                            <span className="block truncate text-[11px] text-slate-500">{u.email}</span>
                          </span>
                        </Link>
                      </TD>
                      <TD mono muted>
                        {formatDate(u.createdAt)}
                      </TD>
                      <TD mono muted>
                        {u.lastLoginAt ? relativeTime(u.lastLoginAt) : "never"}
                      </TD>
                      <TD align="right" mono>
                        {formatNumber(u.vehicleCount)}
                      </TD>
                      <TD align="right" mono>
                        {formatNumber(u.serviceCount)}
                      </TD>
                      <TD align="right" mono>
                        {u.unlockCount > 0 ? formatNumber(u.unlockCount) : <span className="text-slate-600">—</span>}
                      </TD>
                      <TD>
                        {u.subscriptionStatus ? (
                          <Badge tone={u.subscriptionStatus === "active" ? "positive" : "muted"}>
                            {u.subscriptionStatus}
                          </Badge>
                        ) : (
                          <span className="text-[11px] text-slate-600">none</span>
                        )}
                      </TD>
                      <TD>
                        <span className="flex flex-wrap gap-1">
                          {u.status === "disabled" ? (
                            <Badge tone="critical">disabled</Badge>
                          ) : (
                            <Badge tone="positive">active</Badge>
                          )}
                          {u.isAdmin && <Badge tone="accent">admin</Badge>}
                        </span>
                      </TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
            </div>

            {/* Mobile card list -- the table becomes cards rather than breaking */}
            <ul className="divide-y divide-slate-800/70 sm:hidden">
              {rows.map((u) => (
                <li key={u.id}>
                  <Link href={`/admin/users/${u.id}`} className="block px-4 py-3 hover:bg-slate-800/30">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="truncate text-sm text-slate-100">{displayName(u.name, u.email)}</div>
                        <div className="truncate text-[11px] text-slate-500">{u.email}</div>
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-1">
                        {u.status === "disabled" ? (
                          <Badge tone="critical">disabled</Badge>
                        ) : (
                          <Badge tone="positive">active</Badge>
                        )}
                        {u.isAdmin && <Badge tone="accent">admin</Badge>}
                      </div>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 font-mono text-[10px] text-slate-500">
                      <span>{formatNumber(u.vehicleCount)} vehicles</span>
                      <span>{formatNumber(u.serviceCount)} services</span>
                      <span>{u.lastLoginAt ? relativeTime(u.lastLoginAt) : "never signed in"}</span>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          </>
        )}

        <Pagination page={page} pageCount={pageCount} total={total} hrefFor={(p) => buildHref({ page: String(p) })} />
      </Panel>

      <p className="mt-3">
        <MicroLabel>
          Sorted by {sort} ({dir}) · {formatNumber(total)} matching account{total === 1 ? "" : "s"}
        </MicroLabel>
      </p>
    </div>
  );
}
