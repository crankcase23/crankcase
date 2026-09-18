import { sql } from "drizzle-orm";
import { db } from "@/db";

// ---------------------------------------------------------------------------
// The Command Center activity feed.
//
// Design decision worth knowing: this does NOT read only from app_events.
// Event capture started the day the command center shipped, so a feed built
// on it alone would show an empty screen on a database that already holds
// real accounts, vehicles and service logs.
//
// Instead the feed is a UNION over the tables that already record when things
// happened -- signups, vehicles added, services logged, sign-ins, admin
// actions, errors, payment events, content publishes -- plus app_events for
// the event types that have no other home (guide views). Every row carries a
// type, an actor, a timestamp and a link to inspect the object.
//
// It is ordered and limited in Postgres, so the cost is one indexed scan per
// source regardless of table size -- not a full load into Node.
// ---------------------------------------------------------------------------

export interface ActivityItem {
  id: string;
  type: string;
  title: string;
  actorEmail: string | null;
  actorId: string | null;
  objectLabel: string | null;
  href: string | null;
  createdAt: Date;
  severity: "info" | "success" | "warning" | "critical";
}

interface RawRow {
  // Index signature required by drizzle's db.execute<T> generic constraint.
  [key: string]: unknown;
  id: string;
  kind: string;
  title: string;
  actor_email: string | null;
  actor_id: string | null;
  object_label: string | null;
  object_id: string | null;
  created_at: string | Date;
}

const SEVERITY: Record<string, ActivityItem["severity"]> = {
  signup: "success",
  vehicle_added: "info",
  service_logged: "info",
  login: "info",
  guide_view: "info",
  purchase: "success",
  subscription_created: "success",
  subscription_cancelled: "warning",
  payment_failed: "critical",
  content_published: "success",
  admin_action: "warning",
  system_error: "critical",
};

const LABELS: Record<string, string> = {
  signup: "New account",
  vehicle_added: "Vehicle added",
  service_logged: "Service logged",
  login: "Sign-in",
  guide_view: "Guide viewed",
  purchase: "Guide purchased",
  subscription_created: "Subscription created",
  subscription_cancelled: "Subscription cancelled",
  payment_failed: "Payment failed",
  content_published: "Content published",
  admin_action: "Admin action",
  system_error: "System error",
};

export function activityLabel(kind: string): string {
  return LABELS[kind] ?? kind;
}

function hrefFor(kind: string, objectId: string | null, actorId: string | null): string | null {
  switch (kind) {
    case "signup":
    case "login":
      return actorId ? `/admin/users/${actorId}` : null;
    case "vehicle_added":
    case "service_logged":
      return objectId ? `/admin/vehicles/${objectId}` : null;
    case "guide_view":
      return objectId ? `/admin/guides/${objectId}` : null;
    case "purchase":
    case "subscription_created":
    case "subscription_cancelled":
    case "payment_failed":
      return "/admin/revenue";
    case "content_published":
      return objectId ? `/admin/content/${objectId}` : "/admin/content";
    case "admin_action":
      return "/admin/security";
    case "system_error":
      return "/admin/system";
    default:
      return null;
  }
}

export async function getActivityFeed(limit = 25): Promise<ActivityItem[]> {
  // Each branch selects the same shape so they can be UNIONed. Each is
  // individually ordered+limited before the union so Postgres can use the
  // per-table index rather than sorting everything.
  const result = await db.execute<RawRow>(sql`
    with feed as (
      (select u.id as id, 'signup' as kind,
              u.email as title, u.email as actor_email, u.id as actor_id,
              null::text as object_label, u.id as object_id, u.created_at as created_at
         from users u order by u.created_at desc limit ${limit})
      union all
      (select g.id, 'vehicle_added',
              coalesce(nullif(concat_ws(' ', g.year, g.make, g.model), ''), g.vehicle_id, 'Vehicle'),
              u.email, u.id, g.kind, g.id, g.created_at
         from garage_entries g left join users u on u.id = g.user_id
        order by g.created_at desc limit ${limit})
      union all
      (select s.id, 'service_logged', s.title, u.email, u.id,
              null::text, s.garage_entry_id, s.logged_at
         from service_entries s left join users u on u.id = s.user_id
        order by s.logged_at desc limit ${limit})
      union all
      (select l.id, 'login', u.email, u.email, u.id, null::text, u.id, l.logged_in_at
         from login_events l left join users u on u.id = l.user_id
        order by l.logged_in_at desc limit ${limit})
      union all
      (select e.id, 'guide_view', coalesce(e.object_id, 'Guide'), u.email, u.id,
              e.path, e.object_id, e.created_at
         from app_events e left join users u on u.id = e.user_id
        where e.type = 'guide.viewed'
        order by e.created_at desc limit ${limit})
      union all
      (select p.id, 'purchase', coalesce(p.description, 'Purchase'), u.email, u.id,
              null::text, p.id, p.created_at
         from purchases p left join users u on u.id = p.user_id
        where p.status = 'succeeded'
        order by p.created_at desc limit ${limit})
      union all
      (select s.id, 'subscription_created', s.plan, u.email, u.id, s.status, s.id, s.created_at
         from subscriptions s left join users u on u.id = s.user_id
        order by s.created_at desc limit ${limit})
      union all
      (select pe.id, 'payment_failed', coalesce(pe.message, 'Payment failed'), u.email, u.id,
              pe.status, pe.id, pe.created_at
         from payment_events pe left join users u on u.id = pe.user_id
        where pe.type = 'payment_failed'
        order by pe.created_at desc limit ${limit})
      union all
      (select c.id, 'content_published', c.title, null::text, null::text, c.kind, c.id, c.published_at
         from content_blocks c
        where c.status = 'published' and c.published_at is not null
        order by c.published_at desc limit ${limit})
      union all
      (select a.id, 'admin_action', coalesce(a.summary, a.action), u.email, u.id,
              a.action, a.object_id, a.created_at
         from admin_audit_log a left join users u on u.id = a.admin_user_id
        order by a.created_at desc limit ${limit})
      union all
      (select er.id, 'system_error', er.message, null::text, null::text,
              er.source, er.id, er.created_at
         from error_events er
        where er.status = 'open'
        order by er.created_at desc limit ${limit})
    )
    select * from feed order by created_at desc limit ${limit}
  `);

  const rows: RawRow[] = Array.isArray(result) ? (result as RawRow[]) : (result.rows ?? []);

  return rows.map((r) => ({
    id: `${r.kind}-${r.id}`,
    type: r.kind,
    title: r.title ?? "",
    actorEmail: r.actor_email,
    actorId: r.actor_id,
    objectLabel: r.object_label,
    href: hrefFor(r.kind, r.object_id, r.actor_id),
    createdAt: r.created_at instanceof Date ? r.created_at : new Date(r.created_at),
    severity: SEVERITY[r.kind] ?? "info",
  }));
}

/** Per-user activity timeline for the user detail page. */
export async function getUserActivity(userId: string, limit = 30): Promise<ActivityItem[]> {
  const result = await db.execute<RawRow>(sql`
    with feed as (
      (select l.id, 'login' as kind, 'Signed in' as title, null::text as actor_email,
              ${userId}::text as actor_id, null::text as object_label,
              null::text as object_id, l.logged_in_at as created_at
         from login_events l where l.user_id = ${userId}
        order by l.logged_in_at desc limit ${limit})
      union all
      (select g.id, 'vehicle_added',
              coalesce(nullif(concat_ws(' ', g.year, g.make, g.model), ''), g.vehicle_id, 'Vehicle'),
              null::text, ${userId}::text, g.kind, g.id, g.created_at
         from garage_entries g where g.user_id = ${userId}
        order by g.created_at desc limit ${limit})
      union all
      (select s.id, 'service_logged', s.title, null::text, ${userId}::text,
              null::text, s.garage_entry_id, s.logged_at
         from service_entries s where s.user_id = ${userId}
        order by s.logged_at desc limit ${limit})
      union all
      (select e.id, 'guide_view', coalesce(e.object_id, 'Guide'), null::text, ${userId}::text,
              e.path, e.object_id, e.created_at
         from app_events e where e.user_id = ${userId} and e.type = 'guide.viewed'
        order by e.created_at desc limit ${limit})
    )
    select * from feed order by created_at desc limit ${limit}
  `);

  const rows: RawRow[] = Array.isArray(result) ? (result as RawRow[]) : (result.rows ?? []);

  return rows.map((r) => ({
    id: `${r.kind}-${r.id}`,
    type: r.kind,
    title: r.title ?? "",
    actorEmail: null,
    actorId: r.actor_id,
    objectLabel: r.object_label,
    href: hrefFor(r.kind, r.object_id, r.actor_id),
    createdAt: r.created_at instanceof Date ? r.created_at : new Date(r.created_at),
    severity: SEVERITY[r.kind] ?? "info",
  }));
}
