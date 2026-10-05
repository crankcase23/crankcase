import { recordEvent, EVENT_TYPES } from "@/lib/events";

// ---------------------------------------------------------------------------
// Access log for integration endpoints.
//
// WHY app_events AND NOT A NEW TABLE: an `integration_access` table would be
// the tidy answer, but it needs a migration, and the whole point of the
// Phase 1 work was to stop touching the schema casually. app_events already
// exists, is append-only, is nullable on user_id, and was designed as "facts
// about things that happened" - a read of the ops snapshot is exactly that.
// So each call becomes one row of type "integration.access" with the useful
// metadata in jsonb. Query it with:
//
//   select created_at, metadata from app_events
//   where type = 'integration.access' order by created_at desc;
//
// WHAT IS RECORDED: which integration, which token *label* (never the token
// or any part of it), the outcome and HTTP status, the client IP as Vercel
// reports it, a truncated user agent, payload size and timing.
//
// WHAT IS NOT RECORDED: unauthenticated attempts. A 401 writes nothing to the
// database, because letting strangers append rows by spraying bad tokens is
// a write-amplification hole. Those go to the platform log stream instead
// (console.warn), which Vercel retains and which costs nothing to fill.
// ---------------------------------------------------------------------------

export type IntegrationOutcome = "ok" | "rate_limited" | "error";

interface IntegrationAccessInput {
  integration: string;
  tokenLabel: string;
  outcome: IntegrationOutcome;
  status: number;
  request: Request;
  path: string;
  bytes?: number;
  ms?: number;
}

export function clientIp(request: Request): string | null {
  // x-forwarded-for is set by Vercel's edge; the first entry is the client.
  const xff = request.headers.get("x-forwarded-for");
  const first = xff?.split(",")[0]?.trim();
  return first && first.length <= 64 ? first : null;
}

export function clientUserAgent(request: Request): string | null {
  const ua = request.headers.get("user-agent");
  return ua ? ua.slice(0, 200) : null;
}

export async function recordIntegrationAccess(input: IntegrationAccessInput): Promise<void> {
  await recordEvent({
    type: EVENT_TYPES.INTEGRATION_ACCESS,
    objectType: "integration",
    objectId: input.integration,
    path: input.path,
    metadata: {
      integration: input.integration,
      tokenLabel: input.tokenLabel,
      outcome: input.outcome,
      status: input.status,
      ip: clientIp(input.request),
      userAgent: clientUserAgent(input.request),
      bytes: input.bytes ?? null,
      ms: input.ms ?? null,
    },
  });
}

/** Unauthenticated attempts go to the platform log, never the database. */
export function noteRejectedAccess(integration: string, request: Request): void {
  console.warn("[integrations] rejected", integration, clientIp(request) ?? "ip?", clientUserAgent(request) ?? "ua?");
}
