import { randomUUID } from "node:crypto";
import { desc, eq, and, gte, sql } from "drizzle-orm";
import { db } from "@/db";
import { adminAuditLog, users } from "@/db/schema";
import type { AdminContext } from "./rbac";

// ---------------------------------------------------------------------------
// Administrative audit trail.
//
// Append-only: this module deliberately exposes no update or delete. Every
// mutating admin action calls recordAudit() as part of the same request.
// Read back by /admin/security.
//
// Failures here never break the action that was being audited -- but they do
// get surfaced, because an audit log that silently stops recording is worse
// than one that's obviously broken. A failed write logs to the error stream.
// ---------------------------------------------------------------------------

export type AuditAction =
  | "admin.signin"
  | "user.update"
  | "user.disable"
  | "user.enable"
  | "user.delete"
  | "unlock.grant"
  | "unlock.revoke"
  | "content.create"
  | "content.update"
  | "content.publish"
  | "content.unpublish"
  | "content.archive"
  | "content.delete"
  | "error.resolve"
  | "error.ignore"
  | "role.grant"
  | "role.revoke"
  | "export.users"
  | "export.vehicles";

export const AUDIT_ACTION_LABELS: Record<string, string> = {
  "admin.signin": "Admin sign-in",
  "user.update": "User updated",
  "user.disable": "Account disabled",
  "user.enable": "Account re-enabled",
  "user.delete": "Account deleted",
  "unlock.grant": "Unlock granted",
  "unlock.revoke": "Unlock revoked",
  "content.create": "Content created",
  "content.update": "Content updated",
  "content.publish": "Content published",
  "content.unpublish": "Content unpublished",
  "content.archive": "Content archived",
  "content.delete": "Content deleted",
  "error.resolve": "Error resolved",
  "error.ignore": "Error ignored",
  "role.grant": "Role granted",
  "role.revoke": "Role revoked",
  "export.users": "Users exported",
  "export.vehicles": "Vehicles exported",
};

// Actions that change or remove account data, called out in the UI.
export const SENSITIVE_ACTIONS = new Set<string>([
  "user.delete",
  "user.disable",
  "role.grant",
  "role.revoke",
  "content.delete",
]);

interface RecordAuditInput {
  ctx: AdminContext;
  action: AuditAction;
  objectType?: string;
  objectId?: string;
  summary: string;
  metadata?: Record<string, unknown>;
  request?: Request;
}

export async function recordAudit(input: RecordAuditInput): Promise<void> {
  try {
    const headers = input.request?.headers;
    await db.insert(adminAuditLog).values({
      id: randomUUID(),
      adminUserId: input.ctx.userId,
      action: input.action,
      objectType: input.objectType ?? null,
      objectId: input.objectId ?? null,
      summary: input.summary,
      metadata: input.metadata ?? null,
      // x-forwarded-for is set by Vercel's edge; first entry is the client.
      ip: headers?.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
      userAgent: headers?.get("user-agent")?.slice(0, 500) ?? null,
    });
  } catch (err) {
    // Never let an audit failure swallow the user-visible action, but do not
    // let it pass silently either.
    console.error("[audit] failed to record admin action", input.action, err);
  }
}

export interface AuditRow {
  id: string;
  action: string;
  objectType: string | null;
  objectId: string | null;
  summary: string | null;
  metadata: unknown;
  ip: string | null;
  createdAt: Date;
  adminEmail: string | null;
}

export async function listAuditLog(options: {
  limit?: number;
  offset?: number;
  action?: string;
  since?: Date;
} = {}): Promise<AuditRow[]> {
  const { limit = 50, offset = 0, action, since } = options;

  const conditions = [];
  if (action) conditions.push(eq(adminAuditLog.action, action));
  if (since) conditions.push(gte(adminAuditLog.createdAt, since));

  const query = db
    .select({
      id: adminAuditLog.id,
      action: adminAuditLog.action,
      objectType: adminAuditLog.objectType,
      objectId: adminAuditLog.objectId,
      summary: adminAuditLog.summary,
      metadata: adminAuditLog.metadata,
      ip: adminAuditLog.ip,
      createdAt: adminAuditLog.createdAt,
      adminEmail: users.email,
    })
    .from(adminAuditLog)
    .leftJoin(users, eq(users.id, adminAuditLog.adminUserId))
    .orderBy(desc(adminAuditLog.createdAt))
    .limit(limit)
    .offset(offset);

  if (conditions.length > 0) {
    return query.where(conditions.length === 1 ? conditions[0] : and(...conditions));
  }
  return query;
}

export async function countAuditLog(action?: string): Promise<number> {
  const rows = action
    ? await db
        .select({ n: sql<number>`count(*)::int` })
        .from(adminAuditLog)
        .where(eq(adminAuditLog.action, action))
    : await db.select({ n: sql<number>`count(*)::int` }).from(adminAuditLog);
  return rows[0]?.n ?? 0;
}

// Distinct actions actually present in the log, for the filter dropdown --
// so the filter never offers an option that returns nothing.
export async function listAuditActions(): Promise<string[]> {
  const rows = await db
    .selectDistinct({ action: adminAuditLog.action })
    .from(adminAuditLog)
    .orderBy(adminAuditLog.action);
  return rows.map((r) => r.action);
}
