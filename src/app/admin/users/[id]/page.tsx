import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireAdmin, ROLES, ROLE_LABELS, type AdminRole } from "@/lib/admin/rbac";
import { getUserDetail } from "@/lib/admin/users";
import { getUserActivity, activityLabel } from "@/lib/admin/activity";
import { findVehicle } from "@/lib/data";
import {
  formatDate,
  formatDateTime,
  relativeTime,
  displayName,
  initialsFor,
  formatNumber,
  formatCurrency,
} from "@/lib/admin/format";
import {
  Panel,
  Table,
  THead,
  TBody,
  TR,
  TH,
  TD,
  Badge,
  EmptyState,
  FieldList,
  MicroLabel,
  AdminButton,
} from "@/components/admin/ui";

export const metadata = { title: "User detail" };

const TABS = ["overview", "garage", "service", "guides", "activity"] as const;
type Tab = (typeof TABS)[number];

const TAB_LABELS: Record<Tab, string> = {
  overview: "Overview",
  garage: "Garage",
  service: "Service History",
  guides: "Guides & Billing",
  activity: "Activity",
};

export default async function AdminUserDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string; error?: string; ok?: string }>;
}) {
  const ctx = await requireAdmin("users.view");
  if (!ctx) redirect("/admin");

  const { id } = await params;
  const { tab: tabParam, ok, error } = await searchParams;
  const tab: Tab = (TABS as readonly string[]).includes(tabParam ?? "") ? (tabParam as Tab) : "overview";

  const detail = await getUserDetail(id);
  if (!detail) notFound();

  const { user, roles, vehicles, services, logins, purchases, subscriptions } = detail;
  const activity = tab === "activity" ? await getUserActivity(id) : [];

  const canEdit = ctx.permissions.has("users.edit");
  const canDisable = ctx.permissions.has("users.disable");
  const canDelete = ctx.permissions.has("users.delete");
  const canManageUnlocks = ctx.permissions.has("unlocks.manage");
  const canManageRoles = ctx.permissions.has("roles.manage");
  const isSelf = ctx.userId === user.id;

  const vehicleLabel = (v: (typeof vehicles)[number]) => {
    if (v.kind === "catalog" && v.vehicleId) {
      const cat = findVehicle(v.vehicleId);
      if (cat) return `${cat.year} ${cat.make} ${cat.model}`;
      return v.vehicleId;
    }
    return [v.year, v.make, v.model].filter(Boolean).join(" ") || "Unnamed vehicle";
  };

  return (
    <div>
      {/* ------------------------------------------------------------- header */}
      <div className="mb-4">
        <Link href="/admin/users" className="text-xs text-slate-500 hover:text-orange-300">
          ← All users
        </Link>
      </div>

      <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="flex h-12 w-12 items-center justify-center rounded-lg border border-slate-700 bg-slate-800/60 font-mono text-sm text-slate-300">
            {initialsFor(user.name, user.email)}
          </span>
          <div className="min-w-0">
            <h1
              className="truncate text-2xl font-bold tracking-wide text-slate-50"
              style={{ fontFamily: "var(--font-display)", letterSpacing: "0.03em" }}
            >
              {displayName(user.name, user.email)}
            </h1>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <span className="text-sm text-slate-500">{user.email}</span>
              {user.status === "disabled" ? <Badge tone="critical">disabled</Badge> : <Badge tone="positive">active</Badge>}
              {user.isAdmin && <Badge tone="accent">admin</Badge>}
              {roles.map((r) => (
                <Badge key={r} tone="accent">
                  {ROLE_LABELS[r as AdminRole] ?? r}
                </Badge>
              ))}
            </div>
          </div>
        </div>
      </div>

      {ok && (
        <div className="mb-4 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-2.5 text-sm text-emerald-300">
          {decodeURIComponent(ok)}
        </div>
      )}
      {error && (
        <div className="mb-4 rounded-lg border border-rose-500/30 bg-rose-500/10 px-4 py-2.5 text-sm text-rose-300">
          {decodeURIComponent(error)}
        </div>
      )}

      {/* --------------------------------------------------------------- tabs */}
      <div className="mb-4 flex flex-wrap gap-1 border-b border-slate-800">
        {TABS.map((t) => (
          <Link
            key={t}
            href={`/admin/users/${id}?tab=${t}`}
            className={`-mb-px border-b-2 px-3 py-2 text-xs transition-colors ${
              tab === t
                ? "border-orange-500 text-orange-300"
                : "border-transparent text-slate-500 hover:text-slate-200"
            }`}
          >
            {TAB_LABELS[t]}
          </Link>
        ))}
      </div>

      {/* ----------------------------------------------------------- overview */}
      {tab === "overview" && (
        <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
          <div className="space-y-4">
            <Panel title="Account" eyebrow="Record" accent>
              <FieldList
                rows={[
                  { label: "Account ID", value: <span className="font-mono text-xs text-slate-400">{user.id}</span> },
                  { label: "Email", value: user.email },
                  { label: "Name", value: user.name || <span className="text-slate-600">not set</span> },
                  { label: "Created", value: formatDateTime(user.createdAt) },
                  {
                    label: "Last active",
                    value: user.lastLoginAt ? (
                      <span title={formatDateTime(user.lastLoginAt)}>{relativeTime(user.lastLoginAt)}</span>
                    ) : (
                      <span className="text-slate-600">never signed in</span>
                    ),
                  },
                  { label: "Status", value: user.status },
                  {
                    label: "Reminder emails",
                    value: user.emailRemindersOptOut ? (
                      <span className="text-slate-500">opted out</span>
                    ) : (
                      <span className="text-emerald-400">on</span>
                    ),
                  },
                ]}
              />
              <p className="mt-3 text-[11px] leading-relaxed text-slate-600">
                Password hashes, session tokens and reset tokens are never displayed here or sent to the browser.
              </p>
            </Panel>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                { label: "Vehicles", value: user.vehicleCount },
                { label: "Services logged", value: user.serviceCount },
                { label: "Unlocks", value: user.unlockCount },
                { label: "Sign-ins", value: logins.length },
              ].map((s) => (
                <div key={s.label} className="rounded-lg border border-slate-800 bg-slate-900/40 p-3">
                  <MicroLabel>{s.label}</MicroLabel>
                  <div
                    className="mt-1 text-2xl font-semibold tabular-nums text-slate-100"
                    style={{ fontFamily: "var(--font-display)" }}
                  >
                    {formatNumber(s.value)}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* ------------------------------------------------------- actions */}
          <div className="space-y-4">
            {canEdit && (
              <Panel title="Edit account" eyebrow="Details">
                <form action="/api/admin/users" method="post" className="space-y-3">
                  <input type="hidden" name="userId" value={user.id} />
                  <input type="hidden" name="action" value="update" />
                  <div>
                    <label htmlFor="name" className="mb-1 block">
                      <MicroLabel>Display name</MicroLabel>
                    </label>
                    <input
                      id="name"
                      name="name"
                      type="text"
                      defaultValue={user.name ?? ""}
                      placeholder="Not set"
                      className="w-full rounded-md border border-slate-800 bg-slate-950 px-3 py-1.5 text-sm text-slate-200 placeholder:text-slate-600 focus:border-orange-500/50 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="flex items-center gap-2 text-xs text-slate-400">
                      <input
                        type="checkbox"
                        name="emailRemindersOptOut"
                        defaultChecked={user.emailRemindersOptOut}
                        className="h-3.5 w-3.5 accent-orange-500"
                      />
                      Opted out of reminder emails
                    </label>
                  </div>
                  <AdminButton variant="primary">Save changes</AdminButton>
                </form>
              </Panel>
            )}

            {canManageRoles && user.isAdmin && (
              <Panel title="Admin roles" eyebrow="Permissions">
                <form action="/api/admin/users" method="post" className="space-y-2.5">
                  <input type="hidden" name="userId" value={user.id} />
                  <input type="hidden" name="action" value="setRoles" />
                  {ROLES.map((r) => (
                    <label key={r} className="flex items-start gap-2 text-xs text-slate-300">
                      <input
                        type="checkbox"
                        name="roles"
                        value={r}
                        defaultChecked={roles.includes(r)}
                        className="mt-0.5 h-3.5 w-3.5 accent-orange-500"
                      />
                      <span>
                        <span className="block">{ROLE_LABELS[r]}</span>
                      </span>
                    </label>
                  ))}
                  <p className="text-[11px] leading-relaxed text-slate-600">
                    An admin with no role is treated as Support Admin. Role changes are written to the audit log.
                  </p>
                  <AdminButton variant="primary">Update roles</AdminButton>
                </form>
              </Panel>
            )}

            {(canDisable || canDelete) && (
              <Panel title="Danger zone" eyebrow="Destructive">
                <div className="space-y-3">
                  {canDisable && !isSelf && (
                    <form action="/api/admin/users" method="post">
                      <input type="hidden" name="userId" value={user.id} />
                      <input type="hidden" name="action" value={user.status === "disabled" ? "enable" : "disable"} />
                      <p className="mb-2 text-[11px] leading-relaxed text-slate-500">
                        {user.status === "disabled"
                          ? "Re-enabling restores sign-in immediately. No data was lost while disabled."
                          : "Disabling blocks sign-in but keeps every vehicle, service entry and unlock intact."}
                      </p>
                      <AdminButton variant={user.status === "disabled" ? "secondary" : "danger"}>
                        {user.status === "disabled" ? "Re-enable account" : "Disable account"}
                      </AdminButton>
                    </form>
                  )}

                  {canDelete && !isSelf && (
                    <form action="/api/admin/users" method="post" className="border-t border-slate-800 pt-3">
                      <input type="hidden" name="userId" value={user.id} />
                      <input type="hidden" name="action" value="delete" />
                      <p className="mb-2 text-[11px] leading-relaxed text-slate-500">
                        Permanently deletes the account and cascades to {formatNumber(user.vehicleCount)} vehicle(s),{" "}
                        {formatNumber(user.serviceCount)} service entr{user.serviceCount === 1 ? "y" : "ies"}, odometer
                        readings and unlocks. This cannot be undone. Type the email to confirm.
                      </p>
                      <input
                        name="confirmEmail"
                        type="text"
                        required
                        placeholder={user.email}
                        className="mb-2 w-full rounded-md border border-rose-500/30 bg-slate-950 px-3 py-1.5 text-sm text-slate-200 placeholder:text-slate-700 focus:border-rose-500/60 focus:outline-none"
                      />
                      <AdminButton variant="danger">Delete permanently</AdminButton>
                    </form>
                  )}

                  {isSelf && (
                    <p className="text-[11px] text-slate-500">
                      This is your own account — disable and delete are unavailable here by design.
                    </p>
                  )}
                </div>
              </Panel>
            )}

            <Panel title="Impersonation" eyebrow="Not enabled">
              <p className="text-[11px] leading-relaxed text-slate-500">
                Sign-in-as is deliberately not implemented. This app uses stateless JWT sessions with no server-side
                session store, so impersonation would mean minting a token indistinguishable from the user&apos;s own —
                which would also make the audit log unable to prove who really acted. The tabs here already show every
                record that user can see.
              </p>
            </Panel>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- garage */}
      {tab === "garage" && (
        <Panel
          title="Garage"
          eyebrow={`${vehicles.length} vehicle${vehicles.length === 1 ? "" : "s"}`}
          padded={false}
          accent
        >
          {vehicles.length === 0 ? (
            <div className="p-4">
              <EmptyState title="No vehicles" message="This account hasn't added a vehicle yet." />
            </div>
          ) : (
            <ul className="divide-y divide-slate-800/70">
              {vehicles.map((v) => (
                <li key={v.id} className="px-4 py-3">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <Link href={`/admin/vehicles/${v.id}`} className="text-sm text-slate-100 hover:text-orange-300">
                          {vehicleLabel(v)}
                        </Link>
                        <Badge tone={v.kind === "catalog" ? "accent" : "muted"}>{v.kind}</Badge>
                        {v.unlocked && <Badge tone="positive">unlocked · {v.unlockSource}</Badge>}
                      </div>
                      <div className="mt-1 flex flex-wrap gap-x-4 gap-y-0.5 font-mono text-[10px] text-slate-500">
                        {v.trim && <span>{v.trim}</span>}
                        {v.engine && <span>{v.engine}</span>}
                        {v.vin && <span>VIN {v.vin}</span>}
                        <span>{v.serviceCount} service entries</span>
                        {v.odometer !== null && <span>{formatNumber(v.odometer)} mi</span>}
                        <span>added {formatDate(v.createdAt)}</span>
                      </div>
                    </div>

                    {canManageUnlocks && (
                      <form action="/api/admin/unlocks" method="post" className="shrink-0">
                        <input type="hidden" name="userId" value={user.id} />
                        <input type="hidden" name="garageEntryId" value={v.id} />
                        <input type="hidden" name="action" value={v.unlocked ? "revoke" : "grant"} />
                        <AdminButton variant={v.unlocked ? "secondary" : "primary"}>
                          {v.unlocked ? "Revoke unlock" : "Gift unlock"}
                        </AdminButton>
                      </form>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      )}

      {/* ------------------------------------------------------ service history */}
      {tab === "service" && (
        <Panel
          title="Service history"
          eyebrow={`${services.length} entr${services.length === 1 ? "y" : "ies"}`}
          padded={false}
          accent
        >
          {services.length === 0 ? (
            <div className="p-4">
              <EmptyState title="No service entries" message="Nothing has been logged on this account yet." />
            </div>
          ) : (
            <Table minWidth={640}>
              <THead>
                <tr>
                  <TH>Date</TH>
                  <TH>Vehicle</TH>
                  <TH>Service performed</TH>
                  <TH align="right">Mileage</TH>
                  <TH>Logged</TH>
                </tr>
              </THead>
              <TBody>
                {services.map((s) => {
                  const v = vehicles.find((x) => x.id === s.garageEntryId);
                  return (
                    <TR key={s.id}>
                      <TD mono>{s.date}</TD>
                      <TD muted>
                        {v ? (
                          <Link href={`/admin/vehicles/${v.id}`} className="hover:text-orange-300">
                            {vehicleLabel(v)}
                          </Link>
                        ) : (
                          <span className="text-slate-600">deleted vehicle</span>
                        )}
                      </TD>
                      <TD>
                        {s.title}
                        {s.notes && <div className="mt-0.5 text-[11px] text-slate-500">{s.notes}</div>}
                      </TD>
                      <TD align="right" mono>
                        {formatNumber(s.mileage)}
                      </TD>
                      <TD mono muted>
                        {relativeTime(s.loggedAt)}
                      </TD>
                    </TR>
                  );
                })}
              </TBody>
            </Table>
          )}
        </Panel>
      )}

      {/* ----------------------------------------------------- guides & billing */}
      {tab === "guides" && (
        <div className="space-y-4">
          <Panel title="Unlocked vehicles" eyebrow="Access" accent>
            {vehicles.filter((v) => v.unlocked).length === 0 ? (
              <EmptyState
                title="No unlocks"
                message="This account has no premium vehicle unlocks. Grant one from the Garage tab."
              />
            ) : (
              <ul className="space-y-2">
                {vehicles
                  .filter((v) => v.unlocked)
                  .map((v) => (
                    <li key={v.id} className="flex items-center justify-between gap-3 text-sm">
                      <span className="truncate text-slate-200">{vehicleLabel(v)}</span>
                      <Badge tone={v.unlockSource === "gift" ? "accent" : "positive"}>{v.unlockSource}</Badge>
                    </li>
                  ))}
              </ul>
            )}
          </Panel>

          <Panel title="Purchases" eyebrow="Billing">
            {purchases.length === 0 ? (
              <EmptyState
                title="Waiting for data"
                message="No purchases recorded. There is no checkout connected yet — this fills in once payments ship."
              />
            ) : (
              <Table minWidth={520}>
                <THead>
                  <tr>
                    <TH>Date</TH>
                    <TH>Description</TH>
                    <TH>Status</TH>
                    <TH align="right">Amount</TH>
                  </tr>
                </THead>
                <TBody>
                  {purchases.map((p) => (
                    <TR key={p.id}>
                      <TD mono muted>
                        {formatDate(p.createdAt)}
                      </TD>
                      <TD>{p.description ?? "—"}</TD>
                      <TD>
                        <Badge tone={p.status === "succeeded" ? "positive" : "warning"}>{p.status}</Badge>
                      </TD>
                      <TD align="right" mono>
                        {formatCurrency(p.amountCents)}
                      </TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
            )}
          </Panel>

          <Panel title="Subscription" eyebrow="Billing">
            {subscriptions.length === 0 ? (
              <EmptyState
                title="Waiting for data"
                message="No subscription on this account. No plans are sold yet."
              />
            ) : (
              <ul className="space-y-2">
                {subscriptions.map((s) => (
                  <li key={s.id} className="flex flex-wrap items-center justify-between gap-2 text-sm">
                    <span className="text-slate-200">{s.plan}</span>
                    <span className="flex items-center gap-2">
                      <Badge tone={s.status === "active" ? "positive" : "muted"}>{s.status}</Badge>
                      <span className="font-mono text-xs text-slate-400">{formatCurrency(s.priceCents)}</span>
                      {s.currentPeriodEnd && (
                        <span className="font-mono text-[10px] text-slate-600">
                          renews {formatDate(s.currentPeriodEnd)}
                        </span>
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>
      )}

      {/* ----------------------------------------------------------- activity */}
      {tab === "activity" && (
        <div className="grid gap-4 lg:grid-cols-2">
          <Panel title="Activity" eyebrow="Timeline" padded={false} accent>
            {activity.length === 0 ? (
              <div className="p-4">
                <EmptyState title="No activity" message="Nothing recorded for this account yet." />
              </div>
            ) : (
              <ul className="divide-y divide-slate-800/70">
                {activity.map((item) => (
                  <li key={item.id} className="px-4 py-2.5">
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-slate-500">
                        {activityLabel(item.type)}
                      </span>
                      <span className="shrink-0 font-mono text-[10px] text-slate-600" title={formatDateTime(item.createdAt)}>
                        {relativeTime(item.createdAt)}
                      </span>
                    </div>
                    <div className="mt-0.5 truncate text-sm text-slate-200">{item.title}</div>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <Panel title="Sign-in history" eyebrow="Last 20" padded={false}>
            {logins.length === 0 ? (
              <div className="p-4">
                <EmptyState
                  title="No sign-ins recorded"
                  message="Login history only covers sign-ins after tracking shipped."
                />
              </div>
            ) : (
              <ul className="divide-y divide-slate-800/70">
                {logins.map((l) => (
                  <li key={l.id} className="flex items-center justify-between gap-3 px-4 py-2 text-xs">
                    <span className="text-slate-300">{formatDateTime(l.loggedInAt)}</span>
                    <span className="font-mono text-[10px] text-slate-600">{relativeTime(l.loggedInAt)}</span>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>
      )}
    </div>
  );
}
