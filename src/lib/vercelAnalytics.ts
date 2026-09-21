// Server-side client for Vercel's Web Analytics query API
// (GET https://api.vercel.com/v1/query/web-analytics/visits/aggregate).
//
// WHY THIS EXISTS: the morning report can already say what people wrote in
// and what's queued to build, but it has no idea whether anyone is actually
// visiting. The @vercel/analytics script in src/app/layout.tsx only *sends*
// pageviews; reading them back is a separate authenticated API.
//
// STRICTLY READ-ONLY, and strictly best-effort. /api/admin/report has to keep
// answering whether or not this works, so every failure path here returns
// null rather than throwing. Null means "we don't know" - it is never
// rendered as zero, and nothing in here estimates or back-fills a number.
//
// Auth: Authorization: Bearer <VERCEL_ANALYTICS_TOKEN>. Andy sets that token
// himself; nothing here reads, logs or echoes its value.

const AGGREGATE_URL = "https://api.vercel.com/v1/query/web-analytics/visits/aggregate";

// Fixed for this deployment - one project, one team.
const PROJECT_ID = "prj_S2EPp4ey2mObSNlwlmMmYaM7l4d6";
const TEAM_SLUG = "crankcase";

const WINDOW_DAYS = 7;

// A hung upstream must not hold the whole report open. Eight seconds is
// generous for three small aggregate queries and still well inside any
// sensible client timeout on the report itself.
const TIMEOUT_MS = 8_000;

export type AnalyticsError = "not_configured" | "http_error" | "network_error" | "bad_payload";

// Rows come back as one object per group: the dimension we grouped by, plus
// the metric. Vercel's published schema doesn't pin down the metric's field
// name, so rows are passed through exactly as received rather than renamed
// into a shape we'd be guessing at. Inventing a key here is how a wrong
// number gets onto a dashboard.
export type AnalyticsRow = Record<string, unknown>;

export interface WebAnalytics {
  window: { since: string; until: string; days: number };
  byDay: AnalyticsRow[];
  byRoute: AnalyticsRow[];
  byReferrer: AnalyticsRow[];
}

export interface WebAnalyticsResult {
  data: WebAnalytics | null;
  error: AnalyticsError | null;
}

async function aggregate(
  token: string,
  by: string,
  since: Date,
  until: Date,
  limit?: number,
): Promise<{ rows: AnalyticsRow[] | null; error: AnalyticsError | null }> {
  const url = new URL(AGGREGATE_URL);
  url.searchParams.set("projectId", PROJECT_ID);
  url.searchParams.set("slug", TEAM_SLUG);
  // `by` is an array parameter; repeated keys is the encoding Vercel's REST
  // API uses for those. We only ever send one dimension per call.
  url.searchParams.append("by", by);
  url.searchParams.set("since", String(since.getTime()));
  url.searchParams.set("until", String(until.getTime()));
  if (limit !== undefined) url.searchParams.set("limit", String(limit));

  let res: Response;
  try {
    res = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch {
    return { rows: null, error: "network_error" };
  }

  if (!res.ok) return { rows: null, error: "http_error" };

  let json: unknown;
  try {
    json = await res.json();
  } catch {
    return { rows: null, error: "bad_payload" };
  }

  const rows = (json as { data?: unknown } | null)?.data;
  if (!Array.isArray(rows)) return { rows: null, error: "bad_payload" };

  return { rows: rows as AnalyticsRow[], error: null };
}

/**
 * Last seven days of traffic: totals per day, the ten busiest routes, and the
 * five biggest referrers.
 *
 * Returns `{ data: null }` - never partial, never zeroed - if the token isn't
 * set or any of the three queries fails. A half-populated traffic panel reads
 * like a real answer, and "the site got no referrals this week" is a very
 * different statement from "we couldn't ask".
 */
export async function getWebAnalytics(): Promise<WebAnalyticsResult> {
  const token = process.env.VERCEL_ANALYTICS_TOKEN;
  if (!token) return { data: null, error: "not_configured" };

  const until = new Date();
  const since = new Date(until.getTime() - WINDOW_DAYS * 24 * 60 * 60 * 1000);

  const [day, route, referrer] = await Promise.all([
    aggregate(token, "day", since, until),
    aggregate(token, "route", since, until, 10),
    aggregate(token, "referrerHostname", since, until, 5),
  ]);

  const failure = day.error ?? route.error ?? referrer.error;
  if (failure || !day.rows || !route.rows || !referrer.rows) {
    return { data: null, error: failure ?? "bad_payload" };
  }

  return {
    data: {
      window: { since: since.toISOString(), until: until.toISOString(), days: WINDOW_DAYS },
      byDay: day.rows,
      byRoute: route.rows,
      byReferrer: referrer.rows,
    },
    error: null,
  };
}
