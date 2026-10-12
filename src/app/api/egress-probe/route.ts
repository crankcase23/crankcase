// THROWAWAY diagnostic on a never-merged branch: can a Vercel server reach NHTSA vPIC? Returns no secrets.
export const dynamic = "force-dynamic";
export async function GET() {
  const out: Record<string, unknown> = { region: process.env.VERCEL_REGION ?? null, vercelEnv: process.env.VERCEL_ENV ?? null, runs: [] };
  for (const vin of ["1C4RJFAG8EC123456", "ZZZZZ5AG8EC123456"]) {
    const t0 = Date.now();
    try {
      const c = new AbortController();
      const timer = setTimeout(() => c.abort(), 8000);
      const r = await fetch(`https://vpic.nhtsa.dot.gov/api/vehicles/decodevinvalues/${vin}?format=json`, { signal: c.signal, cache: "no-store" });
      const j = await r.json();
      clearTimeout(timer);
      const row = j?.Results?.[0] ?? {};
      (out.runs as unknown[]).push({ vin, status: r.status, ms: Date.now() - t0, year: row.ModelYear, make: row.Make, model: row.Model, err: row.ErrorCode });
    } catch (e) {
      (out.runs as unknown[]).push({ vin, failed: String(e), ms: Date.now() - t0 });
    }
  }
  return Response.json(out);
}
