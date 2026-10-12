// Server-side NHTSA vPIC decode, used ONLY to decide the outage fallback (src/lib/vinFallbackServer.ts). The normal add
// path still decodes in the browser; this exists so the server, not the browser, is the judge of "NHTSA is down".

export const VPIC_SERVER_TIMEOUT_MS = 8_000;
const DEFAULT_BASE = "https://vpic.nhtsa.dot.gov/api/vehicles/decodevinvalues";

export interface DecodedIdentity {
  year: string;
  make: string;
  model: string;
  trim?: string;
  engine?: string;
}

/**
 *  ok       NHTSA answered and the VIN decodes to a year, make and model.
 *  unknown  NHTSA answered but does not know this VIN (error 7, empty or partial result). NOT an outage.
 *  outage   NHTSA could not be reached or did not give a usable answer (network error, timeout, HTTP error, bad body).
 */
export type ProbeResult = { kind: "ok"; decoded: DecodedIdentity } | { kind: "unknown" } | { kind: "outage"; reason: string };

// Tests point this at a local stub. Honored everywhere except Vercel Production, so a stray variable can never redirect
// the live site's identity check.
export function vpicBase(env: Record<string, string | undefined> = process.env): string {
  if (env.VERCEL_ENV !== "production" && env.VPIC_BASE_URL) return env.VPIC_BASE_URL.replace(/\/+$/, "");
  return DEFAULT_BASE;
}

const text = (v: unknown) => (typeof v === "string" ? v.trim() : "");

export async function probeVin(vin: string, fetchImpl: typeof fetch = fetch, timeoutMs = VPIC_SERVER_TIMEOUT_MS): Promise<ProbeResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetchImpl(`${vpicBase()}/${encodeURIComponent(vin)}?format=json`, { signal: controller.signal, cache: "no-store" });
    if (!res.ok) return { kind: "outage", reason: `http-${res.status}` };
    let json: { Results?: unknown };
    try {
      json = await res.json();
    } catch {
      return { kind: "outage", reason: controller.signal.aborted ? "timeout" : "bad-body" };
    }
    const row = Array.isArray(json?.Results) ? (json.Results[0] as Record<string, unknown> | undefined) : undefined;
    if (!row || typeof row !== "object") return { kind: "outage", reason: "bad-body" };
    const year = text(row.ModelYear);
    const make = text(row.Make);
    const model = text(row.Model);
    if (!year || !make || !model) return { kind: "unknown" };
    const disp = text(row.DisplacementL);
    const cyl = text(row.EngineCylinders);
    const engine = [disp && Number.isFinite(Number(disp)) ? `${Number(disp)}L` : "", cyl ? `${cyl}-cyl` : ""].filter(Boolean).join(" ");
    const trim = text(row.Trim);
    return { kind: "ok", decoded: { year, make, model, ...(trim ? { trim } : {}), ...(engine ? { engine } : {}) } };
  } catch (e) {
    return { kind: "outage", reason: (e as Error)?.name === "AbortError" ? "timeout" : "network" };
  } finally {
    clearTimeout(timer);
  }
}
