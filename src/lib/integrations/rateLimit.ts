// ---------------------------------------------------------------------------
// Small in-memory rate limiter for machine-to-machine endpoints.
//
// WHAT IT IS: a sliding-window counter per key, held in module memory. No
// database, no Redis, no extra dependency. A consumer that is only supposed
// to call a few times an hour gets a generous ceiling and a 429 with
// Retry-After above it.
//
// WHAT IT IS NOT: a hard guarantee. On Vercel each serverless instance has
// its own memory, so a burst spread across instances can exceed the limit by
// roughly the number of warm instances, and a cold start resets the count.
// That is an accepted trade-off for a read-only endpoint whose legitimate
// caller runs on a cron - the limit exists to bound runaway retry loops and
// accidental hammering, not to withstand a determined flood. Anything
// stronger needs a shared store, which is a real infrastructure decision and
// is documented as deferred rather than improvised here.
//
// Keyed by the caller's *label* (which token), never by the token itself, so
// nothing secret is ever held in memory longer than the request.
// ---------------------------------------------------------------------------

export interface RateLimitRule {
  /** Window length in milliseconds. */
  windowMs: number;
  /** Requests allowed inside one window. */
  max: number;
}

export interface RateLimitDecision {
  allowed: boolean;
  /** Seconds until the caller may try again; 0 when allowed. */
  retryAfterSeconds: number;
  /** Requests remaining in the tightest window; 0 when blocked. */
  remaining: number;
}

const buckets = new Map<string, number[]>();

// Keep the map from growing without bound if keys churn (they shouldn't -
// there are a handful of labels - but a Map that only ever grows is a leak).
const MAX_KEYS = 256;

export function checkRateLimit(key: string, rules: RateLimitRule[], now = Date.now()): RateLimitDecision {
  const longest = Math.max(...rules.map((r) => r.windowMs));
  let stamps = buckets.get(key);
  if (!stamps) {
    if (buckets.size >= MAX_KEYS) buckets.clear();
    stamps = [];
    buckets.set(key, stamps);
  }

  // Drop anything older than the longest window; every rule is a suffix of
  // the same list.
  const cutoff = now - longest;
  while (stamps.length > 0 && stamps[0] <= cutoff) stamps.shift();

  let retryAfterMs = 0;
  let remaining = Number.POSITIVE_INFINITY;

  for (const rule of rules) {
    const start = now - rule.windowMs;
    let count = 0;
    let oldestInWindow = Number.NaN;
    for (const t of stamps) {
      if (t > start) {
        count++;
        if (Number.isNaN(oldestInWindow)) oldestInWindow = t;
      }
    }
    remaining = Math.min(remaining, Math.max(0, rule.max - count));
    if (count >= rule.max) {
      retryAfterMs = Math.max(retryAfterMs, oldestInWindow + rule.windowMs - now);
    }
  }

  if (retryAfterMs > 0) {
    return { allowed: false, retryAfterSeconds: Math.max(1, Math.ceil(retryAfterMs / 1000)), remaining: 0 };
  }

  stamps.push(now);
  return { allowed: true, retryAfterSeconds: 0, remaining: Math.max(0, remaining - 1) };
}

/** Test hook. Not used by any route. */
export function resetRateLimits(): void {
  buckets.clear();
}
