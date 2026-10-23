import { request, type FullConfig } from "@playwright/test";
import { randomIp, validVin } from "./helpers";

// Route warm-up before the suite (Build 104-AO). Under `next dev` a route is compiled on its FIRST request, and the slow ones take 4 to 12 s
// (`/garage/add` 12.5 s, `/vehicles/<id>` 4 to 6 s, and the API routes the pages call, 5 to 7 s each: /api/events/view, /api/vehicle-data/lookup,
// /api/garage/<id>/service and /odometer), which is longer than the 5 s expectations in the garage and vehicle-config specs. The same specs pass
// 12 of 12 against a production build, so those failures were cold-compile timing in the harness, not application logic (104-AN). Warming only the
// pages left 4 of 6 cold starts failing; warming the API routes too took 8 of 8 cold starts to green.
//
// This warms the routes those specs depend on BEFORE the first test, waiting on an observable signal: the HTTP response itself. It does not
// sleep, and it does NOT touch any test or timeout: the specs keep their original 5 s / 20 s expectations. It fails the whole run, loudly, if a
// route answers 5xx, never answers, or the warm-up runs past its budget, or if the sign-in it depends on did not produce a session, so a real route
// failure or a real performance regression is reported here with its timing instead of being absorbed. Timings are printed so a slow route is
// visible in every run.
//
// Redirects are NOT followed: a signed-out request to a signed-in page is a 307 to /login, and following it would answer 200 from /login and look
// like success while compiling nothing. Pages that need a session are probed with one, and must answer for themselves.
//
// Skip with CC_E2E_WARM=0. A throwaway account is created (the suite's scratch database; every spec makes its own accounts anyway).

const ROUTE_BUDGET_MS = Number(process.env.CC_WARM_BUDGET_MS ?? 120_000); // one request
const TOTAL_BUDGET_MS = Number(process.env.CC_WARM_TOTAL_MS ?? 300_000); // the whole warm-up
const BMW = "2010-bmw-328i-3.0l";
const SLUG = "bmw-2010-328i-oil-change";
const JEEP = "2014-jeep-grand-cherokee-3.6l";
const NO_ROW = "00000000-0000-4000-8000-000000000000"; // an id that exists nowhere: compiles the dynamic route, answers 404

type Warm = { path: string; ok: (status: number) => boolean; why: string; method?: "GET" | "POST" };
const PAGE_200 = (s: number) => s === 200;
const DYNAMIC_PAGE = (s: number) => s === 200 || s === 307 || s === 404; // a dynamic route probed with an id that does not exist
const API_OK = (s: number) => s > 0 && s < 500; // an API probed with a bare request: any answer below 5xx proves the route compiled and ran (400, 401, 404 and 405 are fine)
const page = (path: string): Warm => ({ path, ok: PAGE_200, why: "200" });
const dynamic = (path: string): Warm => ({ path, ok: DYNAMIC_PAGE, why: "200, 307 or 404" });
const api = (path: string, method: "GET" | "POST" = "GET"): Warm => ({ path, ok: API_OK, why: "below 500", method });

// Public pages first, then everything that needs the session. Not warmed: the ANONYMOUS repair URL. On about 1 in 4 cold `next dev` starts it answered 404
// for minutes (no "Compiling" line, no generate-params step) instead of the usual 307 to /login, and the specs never request it logged out. Only the
// warm-up's own probe triggered it (104-AO O-3: cause UNKNOWN, dev server only).
const PUBLIC: Warm[] = [page("/"), page("/login"), page("/signup"), api("/api/events/view", "POST")];
const SIGNED_IN: Warm[] = [
  page("/garage"),
  page("/garage/add"),
  dynamic(`/garage/custom/${NO_ROW}`),
  dynamic(`/vehicles/${BMW}`),
  dynamic(`/vehicles/${BMW}/repairs/${SLUG}`),
  dynamic(`/vehicles/${BMW}~${NO_ROW}`),
  dynamic(`/vehicles/${BMW}~${NO_ROW}/repairs/${SLUG}`),
  api("/api/garage"),
  api(`/api/garage/${NO_ROW}`),
  api(`/api/garage/${NO_ROW}/service`),
  api(`/api/garage/${NO_ROW}/odometer`),
  api(`/api/garage/${BMW}~${NO_ROW}/service`),
  api(`/api/garage/${BMW}~${NO_ROW}/odometer`),
  api(`/api/garage/${NO_ROW}/details`),
  api(`/api/garage/${NO_ROW}/keys`),
  api(`/api/garage/${NO_ROW}/verify`),
  api(`/api/garage/${NO_ROW}/vin`),
  api("/api/vehicle-data/lookup", "POST"),
];

export default async function globalSetup(config: FullConfig) {
  if (process.env.CC_E2E_WARM === "0") return;
  const baseURL = config.projects[0]?.use?.baseURL ?? "http://localhost:3100";
  // The warm-up signs up an account and adds two vehicles: only ever against a server on this machine.
  if (!["localhost", "127.0.0.1", "[::1]"].includes(new URL(baseURL).hostname) && process.env.CC_E2E_ALLOW_REMOTE !== "1") {
    throw new Error(`e2e warm-up refuses ${baseURL}: it creates an account and vehicles, so it only runs against localhost (CC_E2E_WARM=0 to skip it, CC_E2E_ALLOW_REMOTE=1 to allow it on purpose)`);
  }
  const ip = randomIp();
  const started = Date.now();
  const anon = await request.newContext({ baseURL, extraHTTPHeaders: { "x-forwarded-for": ip } });
  const authed = await request.newContext({ baseURL, extraHTTPHeaders: { "x-forwarded-for": ip } });
  const problems: string[] = [];
  const lines: string[] = [];
  try {
    // sign up and sign in the same way the browser does (Auth.js credentials, CSRF token first)
    const email = `warm-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`;
    const password = "testpassword123";
    const su = await authed.post("/api/signup", { data: { email, password }, timeout: ROUTE_BUDGET_MS });
    if (!su.ok()) problems.push(`warm-up signup answered ${su.status()}`);
    const csrf = (await (await authed.get("/api/auth/csrf", { timeout: ROUTE_BUDGET_MS })).json()) as { csrfToken?: string };
    const si = await authed.post("/api/auth/callback/credentials", { form: { csrfToken: csrf.csrfToken ?? "", email, password, json: "true" }, maxRedirects: 0, timeout: ROUTE_BUDGET_MS });
    if (si.status() >= 400) problems.push(`warm-up sign-in answered ${si.status()}`);
    // the callback can answer 200 for a rejected sign-in, so the evidence that it worked is the session cookie
    const cookies = (await authed.storageState()).cookies.map((c) => c.name);
    if (!cookies.some((n) => /session-token/.test(n))) problems.push("warm-up sign-in produced no session cookie: signed-in routes would be probed signed out");

    // The pages above are probed with an id that does not exist, which answers 404 before the vehicle page renders anything. The FIRST render of a real
    // vehicle page (its data, guides and images) took 4 s on a cold dev server, and with the add flow's own requests ahead of it that was past the 5 s
    // expectations (a Jeep add and a BMW walkthrough, 104-AO). So add one real BMW and one real Jeep to the throwaway account and render their pages.
    const signedIn: Warm[] = [...SIGNED_IN];
    const real: Array<[string, Record<string, string>, string]> = [
      [BMW, { transmission: "automatic", drivetrain: "rwd" }, "WBA"],
      [JEEP, { transmission: "automatic", drivetrain: "4wd" }, "1C4"],
    ];
    for (const [vehicleId, config, prefix] of real) {
      const t0 = Date.now();
      const add = await authed.post("/api/garage", { data: { kind: "catalog", vin: validVin(prefix), vehicleId, config }, maxRedirects: 0, timeout: ROUTE_BUDGET_MS });
      lines.push(`  warm ${String(add.status()).padStart(3)} ${String(Date.now() - t0).padStart(6)} ms  in  POST /api/garage (add ${vehicleId})`);
      if (!add.ok()) problems.push(`warm-up could not add ${vehicleId} to the garage: answered ${add.status()}`);
    }
    if (problems.length === 0) {
      const list = (await (await authed.get("/api/garage", { timeout: ROUTE_BUDGET_MS })).json()) as { entries?: Array<{ id: string }> } | Array<{ id: string }>;
      const entries = Array.isArray(list) ? list : (list.entries ?? []);
      for (const [vehicleId] of real) {
        const entry = entries.find((e) => e.id.startsWith(`${vehicleId}~`));
        if (!entry) { problems.push(`warm-up added ${vehicleId} but it is not in the garage list`); continue; }
        signedIn.push(page(`/vehicles/${entry.id}`));
        if (vehicleId === BMW) signedIn.push(page(`/vehicles/${entry.id}/repairs/${SLUG}`));
      }
    }

    const probes: Array<[Warm, boolean]> = [...PUBLIC.map((w): [Warm, boolean] => [w, false]), ...signedIn.map((w): [Warm, boolean] => [w, true])];
    if (problems.length === 0) {
      for (const [r, signedIn] of probes) {
        const left = TOTAL_BUDGET_MS - (Date.now() - started);
        if (left <= 0) {
          problems.push(`warm-up ran past its ${TOTAL_BUDGET_MS} ms total budget before ${r.path}`);
          break;
        }
        const ctx = signedIn ? authed : anon;
        const timeout = Math.max(1000, Math.min(ROUTE_BUDGET_MS, left));
        const t0 = Date.now();
        let status = 0;
        try {
          const res = r.method === "POST" ? await ctx.post(r.path, { data: {}, maxRedirects: 0, timeout }) : await ctx.get(r.path, { maxRedirects: 0, timeout });
          status = res.status();
        } catch (e) {
          problems.push(`${r.path}: no answer within ${timeout} ms (${String((e as Error).message).split("\n")[0]})`);
          continue;
        }
        const ms = Date.now() - t0;
        lines.push(`  warm ${String(status).padStart(3)} ${String(ms).padStart(6)} ms  ${signedIn ? "in " : "out"} ${r.method === "POST" ? "POST" : "GET "} ${r.path}`);
        if (!r.ok(status)) problems.push(`${r.path}: answered ${status} after ${ms} ms (expected ${r.why})`);
      }
    }
  } finally {
    await anon.dispose();
    await authed.dispose();
    console.log(`e2e warm-up (${baseURL}, ${Date.now() - started} ms):\n${lines.join("\n")}`);
  }
  if (problems.length) throw new Error(`e2e warm-up failed, the suite did not start:\n  ${problems.join("\n  ")}`);
}
