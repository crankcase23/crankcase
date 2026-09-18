import { auth } from "@/auth";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users, adminRoles } from "@/db/schema";

// ---------------------------------------------------------------------------
// Admin role / permission model.
//
// Two independent gates, both enforced server-side:
//
//   1. users.isAdmin  -- can this account reach /admin at all? Flipped by
//                        hand in the database, exactly as before. Nothing in
//                        the UI grants it.
//   2. admin_roles    -- what may this admin DO once inside?
//
// Gate 1 is unchanged from the original build (src/lib/adminAuth.ts still
// works and is still used by the layout). Gate 2 is additive: an admin with
// no role row is treated as SUPPORT_ADMIN, the least-privileged role, so
// nothing silently escalates when this ships.
//
// IMPORTANT: hiding a nav item is not security. Every page and every route
// handler calls requireAdmin(...) with the permission it needs and acts on
// the returned context -- never on what the client sent.
// ---------------------------------------------------------------------------

export const ROLES = ["super_admin", "content_admin", "support_admin", "analytics_admin"] as const;
export type AdminRole = (typeof ROLES)[number];

export const ROLE_LABELS: Record<AdminRole, string> = {
  super_admin: "Super Admin",
  content_admin: "Content Admin",
  support_admin: "Support Admin",
  analytics_admin: "Analytics Admin",
};

export const ROLE_DESCRIPTIONS: Record<AdminRole, string> = {
  super_admin: "Full control, including destructive account actions and role management.",
  content_admin: "Guides and CMS content. Can publish. No account or revenue access.",
  support_admin: "Read user and vehicle records, grant and revoke unlocks. Cannot delete or publish.",
  analytics_admin: "Read-only analytics, revenue and system health. No user records.",
};

// Every distinct thing an admin can do. Add a permission here, grant it to
// the roles that should have it below, and check it at the call site.
export type Permission =
  | "command.view"
  | "users.view"
  | "users.edit"
  | "users.disable"
  | "users.delete"
  | "unlocks.manage"
  | "vehicles.view"
  | "guides.view"
  | "content.view"
  | "content.edit"
  | "content.publish"
  | "revenue.view"
  | "analytics.view"
  | "system.view"
  | "system.manage"
  | "audit.view"
  | "roles.manage";

const ROLE_PERMISSIONS: Record<AdminRole, Permission[]> = {
  // Deliberately the only role with delete, role management and system
  // mutation. "Do not grant every role full administrative access."
  super_admin: [
    "command.view",
    "users.view",
    "users.edit",
    "users.disable",
    "users.delete",
    "unlocks.manage",
    "vehicles.view",
    "guides.view",
    "content.view",
    "content.edit",
    "content.publish",
    "revenue.view",
    "analytics.view",
    "system.view",
    "system.manage",
    "audit.view",
    "roles.manage",
  ],
  content_admin: [
    "command.view",
    "vehicles.view",
    "guides.view",
    "content.view",
    "content.edit",
    "content.publish",
    "analytics.view",
  ],
  support_admin: [
    "command.view",
    "users.view",
    "users.edit",
    "unlocks.manage",
    "vehicles.view",
    "guides.view",
    "content.view",
  ],
  analytics_admin: ["command.view", "vehicles.view", "guides.view", "revenue.view", "analytics.view", "system.view"],
};

export interface AdminContext {
  userId: string;
  email: string;
  roles: AdminRole[];
  permissions: Set<Permission>;
}

export function can(ctx: AdminContext | null, permission: Permission): boolean {
  return ctx?.permissions.has(permission) ?? false;
}

// Resolves the signed-in admin and their effective permissions, or null if
// the visitor is logged out, not flagged isAdmin, or disabled. One query
// joined in memory -- cheap, and this runs once per admin request.
export async function getAdminContext(): Promise<AdminContext | null> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return null;

  const rows = await db
    .select({ id: users.id, email: users.email, isAdmin: users.isAdmin, status: users.status })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  const user = rows[0];
  if (!user?.isAdmin) return null;
  if (user.status === "disabled") return null;

  const roleRows = await db.select({ role: adminRoles.role }).from(adminRoles).where(eq(adminRoles.userId, userId));

  const roles = roleRows
    .map((r) => r.role)
    .filter((r): r is AdminRole => (ROLES as readonly string[]).includes(r));

  // No explicit grant => least privilege, never most.
  const effective: AdminRole[] = roles.length > 0 ? roles : ["support_admin"];

  const permissions = new Set<Permission>();
  for (const role of effective) {
    for (const p of ROLE_PERMISSIONS[role]) permissions.add(p);
  }

  return { userId: user.id, email: user.email, roles: effective, permissions };
}

// The one call every admin page and API route makes. Returns null when the
// caller is not permitted -- pages redirect, route handlers return 403.
// Never trust a hidden nav item to have done this for you.
export async function requireAdmin(permission: Permission): Promise<AdminContext | null> {
  const ctx = await getAdminContext();
  if (!ctx) return null;
  if (!ctx.permissions.has(permission)) return null;
  return ctx;
}
