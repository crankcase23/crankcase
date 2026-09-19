import { redirect } from "next/navigation";
import AdminShell, { type NavItem } from "@/components/admin/AdminShell";
import { getAdminContext, ROLE_LABELS } from "@/lib/admin/rbac";
import { getAlertCount } from "@/lib/admin/alerts";

// Gates every route under /admin. Anyone signed in but not flagged
// users.isAdmin (src/db/schema.ts) gets bounced to /garage, same as before --
// the admin section's existence is never revealed to a non-admin poking at
// the URL, and there is still no nav link anywhere pointing here.
//
// What's new: the layout now also resolves the admin's ROLE and builds the
// navigation from the permissions that role actually has, then wraps
// everything in the command-center shell.
//
// This is not the security boundary. Every page and API route under /admin
// independently calls requireAdmin(permission) -- omitting a nav item only
// tidies the UI, it does not protect the route. See src/lib/admin/rbac.ts.

const NAV: { href: string; label: string; icon: NavItem["icon"]; permission: Parameters<typeof canShow>[1] }[] = [
  { href: "/admin", label: "Command Center", icon: "command", permission: "command.view" },
  { href: "/admin/todo", label: "To-Do", icon: "content", permission: "todo.view" },
  { href: "/admin/users", label: "Users", icon: "users", permission: "users.view" },
  { href: "/admin/vehicles", label: "Vehicles", icon: "vehicle", permission: "vehicles.view" },
  { href: "/admin/guides", label: "Service Guides", icon: "guide", permission: "guides.view" },
  { href: "/admin/coverage", label: "Guide Coverage", icon: "coverage", permission: "guides.view" },
  { href: "/admin/content", label: "Content", icon: "content", permission: "content.view" },
  { href: "/admin/revenue", label: "Revenue", icon: "revenue", permission: "revenue.view" },
  { href: "/admin/analytics", label: "Analytics", icon: "analytics", permission: "analytics.view" },
  { href: "/admin/system", label: "System", icon: "system", permission: "system.view" },
  { href: "/admin/security", label: "Security / Audit", icon: "shield", permission: "audit.view" },
];

function canShow(
  permissions: Set<import("@/lib/admin/rbac").Permission>,
  permission: import("@/lib/admin/rbac").Permission
) {
  return permissions.has(permission);
}

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const ctx = await getAdminContext();
  if (!ctx) redirect("/garage");

  const navItems: NavItem[] = NAV.filter((item) => canShow(ctx.permissions, item.permission)).map((item) => ({
    href: item.href,
    label: item.label,
    icon: item.icon,
  }));

  // The bell badge and the Command Center's own alert panel read the same
  // source, so the number in the nav always matches the list behind it.
  const alertCount = await getAlertCount();
  const commandCenter = navItems.find((n) => n.href === "/admin");
  if (commandCenter) commandCenter.badge = alertCount;

  const roleLabel = ctx.roles.map((r) => ROLE_LABELS[r]).join(" · ");

  return (
    <AdminShell navItems={navItems} adminEmail={ctx.email} roleLabel={roleLabel} alertCount={alertCount}>
      {children}
    </AdminShell>
  );
}
