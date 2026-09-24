import { randomUUID } from "node:crypto";
import { db } from "@/db";
import { appEvents } from "@/db/schema";

// ---------------------------------------------------------------------------
// First-party event capture.
//
// This is the only source of "what happened" data in the app. There is no
// third-party analytics provider -- nothing leaves the database, which keeps
// the project's anonymity constraint intact and means no account, script tag
// or cookie banner is required.
//
// Design notes:
//   * Fire-and-forget. recordEvent() NEVER throws and NEVER blocks a render
//     path in a way the user can feel -- a broken analytics write must not be
//     able to take down a vehicle page.
//   * One wide append-only table (app_events). The admin UI always queries it
//     the same way: filter by type, bound by date, order by createdAt.
//   * Events are facts about things that happened, not derived metrics.
//     Everything on /admin/analytics is computed from these rows at read
//     time, so there are no counters to drift out of sync.
// ---------------------------------------------------------------------------

export const EVENT_TYPES = {
  USER_SIGNED_UP: "user.signed_up",
  USER_SIGNED_IN: "user.signed_in",
  VEHICLE_ADDED: "vehicle.added",
  VEHICLE_REMOVED: "vehicle.removed",
  SERVICE_LOGGED: "service.logged",
  GUIDE_VIEWED: "guide.viewed",
  VEHICLE_VIEWED: "vehicle.viewed",
  VIN_DECODED: "vin.decoded",
  GUIDE_PURCHASED: "guide.purchased",
  SUBSCRIPTION_CREATED: "subscription.created",
  SUBSCRIPTION_CANCELLED: "subscription.cancelled",
  PAYMENT_FAILED: "payment.failed",
  CONTENT_PUBLISHED: "content.published",
  ADMIN_ACTION: "admin.action",
  SYSTEM_ERROR: "system.error",
  // A machine-to-machine read of an integration endpoint. Recorded per call
  // so every external consumer of operational data leaves an auditable row -
  // see src/lib/integrations/access.ts. Never carries a credential.
  INTEGRATION_ACCESS: "integration.access",
} as const;

export type EventType = (typeof EVENT_TYPES)[keyof typeof EVENT_TYPES];

export const EVENT_LABELS: Record<string, string> = {
  "user.signed_up": "New account",
  "user.signed_in": "Sign-in",
  "vehicle.added": "Vehicle added",
  "vehicle.removed": "Vehicle removed",
  "service.logged": "Service logged",
  "guide.viewed": "Guide viewed",
  "vehicle.viewed": "Vehicle viewed",
  "vin.decoded": "VIN decoded",
  "guide.purchased": "Guide purchased",
  "subscription.created": "Subscription created",
  "subscription.cancelled": "Subscription cancelled",
  "payment.failed": "Payment failed",
  "content.published": "Content published",
  "admin.action": "Admin action",
  "system.error": "System error",
  "integration.access": "Integration read",
};

interface RecordEventInput {
  type: EventType;
  userId?: string | null;
  objectType?: string;
  objectId?: string;
  path?: string;
  metadata?: Record<string, unknown>;
}

export async function recordEvent(input: RecordEventInput): Promise<void> {
  try {
    await db.insert(appEvents).values({
      id: randomUUID(),
      type: input.type,
      userId: input.userId ?? null,
      objectType: input.objectType ?? null,
      objectId: input.objectId ?? null,
      path: input.path ?? null,
      metadata: input.metadata ?? null,
    });
  } catch (err) {
    // Analytics is never load-bearing. Log and move on.
    console.error("[events] failed to record", input.type, err);
  }
}

// Convenience wrapper for call sites inside a render path: starts the write
// and returns immediately, so a slow insert can't add latency to the page.
// The floating promise is intentional and handled -- recordEvent swallows
// its own errors.
export function recordEventAsync(input: RecordEventInput): void {
  void recordEvent(input);
}
