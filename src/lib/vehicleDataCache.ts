// Orchestrates the "load a VIN, get all the data" feature: when a vehicle
// added to the garage isn't one of our hand-curated catalog entries
// (src/data/vehicles.ts), try to auto-populate real specs for it. Three
// tiers, cheapest/best first:
//   1. Catalog match - an exact curated vehicle already exists. Free,
//      instant, best data. No DB/API call at all.
//   2. Cache hit - vehicle_data_cache already has real Open Labor Project
//      data for this normalized make/model/year. Free, instant.
//   3. Live fetch - call Open Labor Project once, cache the result
//      (success OR failure/not_found) so we never spend a request twice on
//      the same real-world car.
//
// Graceful-fallback policy (Andy's call, 2026-09-16): if the live fetch
// fails or the shared 10/day quota is already spent (same key used by the
// daily backlog scheduled task), don't error out - just leave the vehicle
// "pending" and let the UI show a friendly "we're working on it" message.

import { eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { vehicleDataCache } from "@/db/schema";
import { listVehicles } from "@/lib/data";
import { getFluidSpecs } from "@/lib/openLaborProject";
import { FluidCapacity } from "@/types/vehicle";

export interface VehicleDataQuery {
    make?: string;
    model?: string;
    year?: string | number;
    engine?: string;
}

export type VehicleDataResult =
    | { status: "catalog"; vehicleId: string }
  | { status: "ok"; fluids: FluidCapacity[]; source: string; confidence?: string }
  | { status: "pending" }
  | { status: "not_found" }
  | { status: "unavailable" };

function norm(s?: string | number): string {
    return String(s ?? "").trim().toLowerCase();
}

function cacheKeyFor(make: string, model: string, year: string): string {
    return `${norm(make)}|${norm(model)}|${norm(year)}`;
}

function findCatalogMatch(make: string, model: string, year: string) {
    const y = norm(year);
    return listVehicles().find(
          (v) => norm(v.make) === norm(make) && norm(v.model) === norm(model) && String(v.year) === y,
        );
}

// Retry a "pending"/"not_found" row after this long, in case Open Labor
// Project's coverage has grown, or a prior attempt just hit the shared
// daily quota rather than a real "no data" answer.
const RETRY_AFTER_MS = 1000 * 60 * 60 * 24 * 3; // 3 days

// Best-effort extraction - Open Labor Project's exact JSON shape for
// /fluid-specs hasn't been nailed down against every make/model combo yet
// (see the open-labor-project-integration project doc), so this tries a
// handful of plausible shapes rather than assuming one rigid contract. The
// raw response is always cached alongside whatever we parsed here, so a
// smarter parser can be applied later without spending another request.
function extractFluids(
    raw: unknown,
    engineHint?: string,
  ): { fluids: FluidCapacity[]; confidence?: string } | null {
    if (!raw || typeof raw !== "object") return null;

  const asRecord = raw as Record<string, unknown>;
    const engineEntries: Record<string, unknown>[] = Array.isArray(raw)
      ? (raw as Record<string, unknown>[])
          : Array.isArray(asRecord.engines)
        ? (asRecord.engines as Record<string, unknown>[])
            : [asRecord];

  const hint = norm(engineHint);
    let chosen = engineEntries[0];
    if (hint && engineEntries.length > 1) {
          const match = engineEntries.find((e) => {
                  const engineName = norm((e.engine ?? e.engine_name ?? e.name) as string | undefined);
                  return engineName && (hint.includes(engineName) || engineName.includes(hint));
          });
          if (match) chosen = match;
    }
    if (!chosen) return null;

  const fluidList: Record<string, unknown>[] = Array.isArray(chosen.fluids)
      ? (chosen.fluids as Record<string, unknown>[])
        : Array.isArray(chosen.fluid_specs)
        ? (chosen.fluid_specs as Record<string, unknown>[])
          : Array.isArray(asRecord.fluids)
          ? (asRecord.fluids as Record<string, unknown>[])
            : [];

  if (!fluidList.length) return null;

  let confidence: string | undefined;
    const fluids: FluidCapacity[] = [];
    for (const f of fluidList) {
          const name = (f.name ?? f.type ?? f.fluid_type) as string | undefined;
          const capacityParts = [
                  f.capacity_qt ? `${f.capacity_qt} qt` : null,
                  f.capacity_l ? `(${f.capacity_l} L)` : null,
                ].filter(Boolean);
          const capacity = (f.capacity ?? f.capacity_text ?? (capacityParts.length ? capacityParts.join(" ") : undefined)) as
                  | string
            | undefined;
          const spec = (f.spec ?? f.viscosity ?? f.api_spec) as string | undefined;
          if (!name || !capacity) continue;
          const fluidConfidence = f.confidence as string | undefined;
          if (fluidConfidence) confidence = fluidConfidence;
          fluids.push({
                  name,
                  capacity,
                  spec: spec ?? "See factory service manual",
                  notes: f.notes as string | undefined,
                  provenance: { source: "open-labor-project", confidence: fluidConfidence },
          });
    }

  return fluids.length ? { fluids, confidence } : null;
}

async function upsertAttempt(
    cacheKey: string,
    make: string,
    model: string,
    year: string,
    engine: string | undefined,
    status: "ok" | "pending" | "not_found",
    fluids: FluidCapacity[] | null,
    rawResponse: unknown,
    confidence?: string,
  ) {
    const now = new Date();
    const values = {
          cacheKey,
          make,
          model,
          year,
          engine: engine ?? null,
          status,
          fluids: fluids ?? null,
          rawResponse: (rawResponse ?? null) as object | null,
          source: fluids ? "open-labor-project" : null,
          confidence: confidence ?? null,
          lastAttemptAt: now,
          fetchedAt: fluids ? now : null,
    };
    await db
      .insert(vehicleDataCache)
      .values({ ...values, attempts: 1 })
      .onConflictDoUpdate({
              target: vehicleDataCache.cacheKey,
              set: { ...values, attempts: sql`${vehicleDataCache.attempts} + 1` },
      });
}

export async function lookupVehicleData(query: VehicleDataQuery): Promise<VehicleDataResult> {
    const make = query.make?.trim();
    const model = query.model?.trim();
    const year = query.year != null ? String(query.year).trim() : undefined;
    if (!make || !model || !year) return { status: "unavailable" };

  const catalogMatch = findCatalogMatch(make, model, year);
    if (catalogMatch) return { status: "catalog", vehicleId: catalogMatch.id };

  const cacheKey = cacheKeyFor(make, model, year);
    const rows = await db
      .select()
      .from(vehicleDataCache)
      .where(eq(vehicleDataCache.cacheKey, cacheKey))
      .limit(1);
    const existing = rows[0];

  if (existing?.status === "ok" && existing.fluids) {
        return {
                status: "ok",
                fluids: existing.fluids as unknown as FluidCapacity[],
                source: existing.source ?? "open-labor-project",
                confidence: existing.confidence ?? undefined,
        };
  }

  const staleEnough =
        !existing?.lastAttemptAt ||
        Date.now() - new Date(existing.lastAttemptAt).getTime() > RETRY_AFTER_MS;

  if (existing && !staleEnough) {
        return existing.status === "not_found" ? { status: "not_found" } : { status: "pending" };
  }

  // Time to actually spend one of the shared 10/day requests.
  const result = await getFluidSpecs(make, model, year);

  if (result.error === "not_configured") {
        return { status: "pending" };
  }

  if (result.error) {
        await upsertAttempt(cacheKey, make, model, year, query.engine, "pending", null, null);
        return { status: "pending" };
  }

  const extracted = extractFluids(result.data, query.engine);
    if (!extracted) {
          await upsertAttempt(cacheKey, make, model, year, query.engine, "not_found", null, result.data);
          return { status: "not_found" };
    }

  await upsertAttempt(
        cacheKey,
        make,
        model,
        year,
        query.engine,
        "ok",
        extracted.fluids,
        result.data,
        extracted.confidence,
      );
    return {
    status: "ok",
          fluids: extracted.fluids,
          source: "open-labor-project",
          confidence: extracted.confidence,
    };
}
