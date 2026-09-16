// Server-side client for the Open Labor Project API (openlaborproject.com/api/v1).
// Free "Hobbyist" tier: 10 requests/day, 10/min, SHARED across every
// consumer that uses OPEN_LABOR_API_KEY — this live app's real user
// traffic (see src/lib/vehicleDataCache.ts) AND the daily backlog-backfill
// scheduled task (see the "open-labor-project-integration" Claude Project
// doc). Neither side tracks the other's usage, so we just treat
// quota-exhaustion/errors as "try again later," never as a hard failure to
// surface to the user.
//
// Auth: x-api-key header. Response envelope: { data, meta, error }.

const OLP_BASE = "https://openlaborproject.com/api/v1";

export type OlpError =
    | "not_configured"
  | "quota_exceeded"
  | "http_error"
  | "network_error"
  | "api_error";

export interface OlpResult<T> {
    data: T | null;
    remainingDaily: number | null;
    error: OlpError | null;
}

async function olpFetch<T>(
    path: string,
    params: Record<string, string | undefined>,
  ): Promise<OlpResult<T>> {
    const apiKey = process.env.OPEN_LABOR_API_KEY;
    if (!apiKey) {
          return { data: null, remainingDaily: null, error: "not_configured" };
    }

  const url = new URL(OLP_BASE + path);
    for (const [key, value] of Object.entries(params)) {
          if (value) url.searchParams.set(key, value);
    }

  let res: Response;
    try {
          res = await fetch(url.toString(), {
                  headers: { "x-api-key": apiKey },
                  cache: "no-store",
          });
    } catch {
          return { data: null, remainingDaily: null, error: "network_error" };
    }

  const remainingHeader = res.headers.get("X-RateLimit-Remaining-Daily");
    const remainingDaily = remainingHeader ? Number(remainingHeader) : null;

  if (res.status === 429) {
        return { data: null, remainingDaily: remainingDaily ?? 0, error: "quota_exceeded" };
  }
    if (!res.ok) {
          return { data: null, remainingDaily, error: "http_error" };
    }

  let json: { data?: T; error?: unknown } | null = null;
    try {
          json = await res.json();
    } catch {
          return { data: null, remainingDaily, error: "http_error" };
    }

  if (json?.error) {
        return { data: null, remainingDaily, error: "api_error" };
  }

  return { data: (json?.data ?? null) as T | null, remainingDaily, error: null };
}

// Fluid specs are the only endpoint this feature calls live for a
// not-yet-cached vehicle — one request per new vehicle, to make the shared
// 10/day quota stretch as far as possible. Torque specs need a `job` slug
// we don't have a generic way to discover per-vehicle yet (see the
// open-labor-project-integration doc); battery/maintenance-schedule data
// would be nice but isn't worth a second API call per lookup on a tier
// this tight. Shape of `data` is treated as unknown/flexible here and
  // normalized in src/lib/vehicleDataCache.ts — we're not 100% certain of
// their exact response schema for every make/model combo.
export function getFluidSpecs(make: string, model: string, year: string) {
    return olpFetch<unknown>("/fluid-specs", { make, model, year });
}
