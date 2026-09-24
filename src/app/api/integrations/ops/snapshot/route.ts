import { NextResponse } from "next/server";
import { bearerAccepted } from "@/lib/integrations/bearerAuth";
import { checkRateLimit } from "@/lib/integrations/rateLimit";
import { recordIntegrationAccess, noteRejectedAccess } from "@/lib/integrations/access";
import { buildOpsSnapshot, INTEGRATION_ID, SCHEMA_VERSION } from "@/lib/integrations/opsSnapshot";
import { recordError } from "@/lib/errors";

// ---------------------------------------------------------------------------
// GET /api/integrations/ops/snapshot
//
// Read-only operational snapshot for an EXTERNAL consumer (first one:
// ChatGPT, authoring the Shop Rag briefing). This is the whole surface that
// consumer gets: one GET, one bearer token, one JSON document.
//
// WHY A SEPARATE ROUTE from /api/admin/report:
//   * Separate secret. The report token already lives in a Claude routine
//     prompt; sharing it with a second system means one leak is two
//     consumers and rotation breaks both. OPS_SNAPSHOT_TOKEN is its own env
//     var and nothing else accepts it.
//   * Separate contract. This payload is versioned (schemaVersion), capped,
//     and stripped of admin notes and user ids. The report feed is Andy's
//     own assistant's queue and keeps its shape.
//   * Separate accounting. Every successful call here writes an
//     integration.access row (see src/lib/integrations/access.ts).
//
// STRICTLY READ-ONLY. Only GET is exported. Next.js answers every other
// method with 405 and there is nothing here for a POST to reach. If this
// route ever needs a write verb, it needs a different design, not an edit.
//
// AUTH ORDER: token first, then rate limit. A stranger without the token
// cannot spend the legitimate caller's quota, and an unauthenticated flood
// is the platform's problem (WAF), not this file's.
// ---------------------------------------------------------------------------

export const runtime = "nodejs"; // node:crypto
export const dynamic = "force-dynamic"; // never cache an authed payload

const PATH = "/api/integrations/ops/snapshot";
const NO_STORE = { "Cache-Control": "no-store, max-age=0" };

// One label per issued token. When a second consumer arrives it gets its own
// env var and its own label here - never a shared token.
const TOKEN_LABEL = "chatgpt";
const MIN_TOKEN_LENGTH = 32;

// A scheduler needs a handful of reads an hour. Generous enough for a retry
// storm to be visible, tight enough that a runaway loop is stopped.
const RATE_RULES = [
  { windowMs: 60_000, max: 10 },
  { windowMs: 60 * 60_000, max: 60 },
];

export async function GET(request: Request) {
  const started = Date.now();

  if (
    !bearerAccepted(request.headers.get("authorization"), {
      expected: process.env.OPS_SNAPSHOT_TOKEN,
      minLength: MIN_TOKEN_LENGTH,
    })
  ) {
    // Deliberately identical whether the token is absent, malformed, wrong,
    // or the server has none configured. Distinguishing them is free
    // reconnaissance. Not written to the database - see access.ts.
    noteRejectedAccess(INTEGRATION_ID, request);
    return NextResponse.json({ error: "Unauthorized." }, { status: 401, headers: NO_STORE });
  }

  const limit = checkRateLimit(`${INTEGRATION_ID}:${TOKEN_LABEL}`, RATE_RULES);
  if (!limit.allowed) {
    await recordIntegrationAccess({
      integration: INTEGRATION_ID,
      tokenLabel: TOKEN_LABEL,
      outcome: "rate_limited",
      status: 429,
      request,
      path: PATH,
      ms: Date.now() - started,
    });
    return NextResponse.json(
      { error: "Too many requests." },
      { status: 429, headers: { ...NO_STORE, "Retry-After": String(limit.retryAfterSeconds) } },
    );
  }

  try {
    const snapshot = await buildOpsSnapshot();
    const body = JSON.stringify(snapshot);

    await recordIntegrationAccess({
      integration: INTEGRATION_ID,
      tokenLabel: TOKEN_LABEL,
      outcome: "ok",
      status: 200,
      request,
      path: PATH,
      bytes: Buffer.byteLength(body, "utf8"),
      ms: Date.now() - started,
    });

    return new NextResponse(body, {
      status: 200,
      headers: {
        ...NO_STORE,
        "Content-Type": "application/json; charset=utf-8",
        "X-Schema-Version": String(SCHEMA_VERSION),
        "X-RateLimit-Remaining": String(limit.remaining),
      },
    });
  } catch (error) {
    await recordError({ source: "api/integrations/ops/snapshot", error, path: PATH });
    await recordIntegrationAccess({
      integration: INTEGRATION_ID,
      tokenLabel: TOKEN_LABEL,
      outcome: "error",
      status: 500,
      request,
      path: PATH,
      ms: Date.now() - started,
    });
    return NextResponse.json({ error: "Something went wrong." }, { status: 500, headers: NO_STORE });
  }
}
