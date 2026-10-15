// Device-local Wrench Mode progress (localStorage). Pure functions with an injectable storage so they can be unit tested
// without a browser. Nothing here touches guide content: it only READS a plan to fingerprint it.
//
// WHAT IS SAVED, per (garage vehicle id, guide id): the configuration the guide was resolved under, a signature of the whole
// step plan, the identity (content fingerprint) of the step the customer was on, and its position. WHAT IS REJECTED: anything
// that is not exactly the same job on exactly the same build -- a different configuration, a guide whose content changed in any
// step (so a saved position can never land on a different step than the customer left), an unreadable or foreign record, or one
// older than PROGRESS_TTL_MS. A rejected record is deleted, so it is never retried.
//
// SCOPE. The key carries the garage id. Only a composite garage id ("<catalog>~<rowId>") is used: the row id is permanent and
// unique to one customer's car, so two accounts on one device can never see each other's progress. A bare catalog id is a legacy
// alias shared by every account that owns that model, so it is never persisted (see persistableGarageId).

import { rowIdOf } from "@/lib/garageId";
import type { WrenchPlan, WrenchStep } from "@/lib/wrenchSteps";

export const PROGRESS_VERSION = 1;
export const PROGRESS_TTL_MS = 14 * 24 * 60 * 60 * 1000;
const PREFIX = "crankcase:wrench:v1:";

export type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;

export interface SavedProgress {
  v: number;
  garageId: string;
  guideId: string;
  configKey: string;
  planSignature: string;
  stepId: string;
  index: number;
  total: number;
  savedAt: number;
}

export type ProgressContext = { garageId: string; guideId: string; configKey: string; plan: WrenchPlan; now?: number };

export type LoadResult =
  | { status: "none" }
  | { status: "resume"; index: number }
  | { status: "rejected"; reason: RejectReason };

export type RejectReason = "unreadable" | "version" | "scope" | "expired" | "configuration" | "content-changed" | "step-mismatch";

/** 53-bit string hash (cyrb53). Not cryptographic: it only has to notice that content changed. */
function hash(str: string): string {
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36);
}

/** Identity of one step: everything a customer reads or is told to do in it. Position is NOT part of it, content is. */
export function stepFingerprint(ws: WrenchStep): string {
  const s = ws.step;
  return hash(
    JSON.stringify([s.title, s.instructions, s.warning ?? null, s.torque ?? null, s.onlyFor ?? null, s.rotorsOnly ?? null, s.forConfig ?? null]),
  );
}

/** Identity of the whole plan: the ordered step identities. Any edit, insertion, removal or reorder changes it. */
export function planSignature(plan: WrenchPlan): string {
  return hash(plan.steps.map(stepFingerprint).join("|"));
}

/** The garage id to persist under, or null when this host must stay in memory (no id, or a shared legacy alias). */
export function persistableGarageId(garageId: string | undefined | null): string | null {
  return garageId && rowIdOf(garageId) !== null ? garageId : null;
}

export const progressKey = (garageId: string, guideId: string) => `${PREFIX}${garageId}:${guideId}`;

/** localStorage, or null when the browser denies it (private mode, blocked site data). Never throws. */
export function safeStorage(): StorageLike | null {
  try {
    if (typeof window === "undefined" || !window.localStorage) return null;
    const probe = "crankcase:wrench:probe";
    window.localStorage.setItem(probe, "1");
    window.localStorage.removeItem(probe);
    return window.localStorage;
  } catch {
    return null;
  }
}

export function saveProgress(storage: StorageLike | null, ctx: ProgressContext, index: number): void {
  if (!storage || ctx.plan.steps.length === 0) return;
  const i = Math.min(Math.max(index, 0), ctx.plan.steps.length - 1);
  const record: SavedProgress = {
    v: PROGRESS_VERSION,
    garageId: ctx.garageId,
    guideId: ctx.guideId,
    configKey: ctx.configKey,
    planSignature: planSignature(ctx.plan),
    stepId: stepFingerprint(ctx.plan.steps[i]),
    index: i,
    total: ctx.plan.steps.length,
    savedAt: ctx.now ?? Date.now(),
  };
  try {
    storage.setItem(progressKey(ctx.garageId, ctx.guideId), JSON.stringify(record));
  } catch {
    /* quota or denied: progress simply stays in memory */
  }
}

export function clearProgress(storage: StorageLike | null, garageId: string, guideId: string): void {
  if (!storage) return;
  try {
    storage.removeItem(progressKey(garageId, guideId));
  } catch {
    /* nothing to do */
  }
}

export function loadProgress(storage: StorageLike | null, ctx: ProgressContext): LoadResult {
  if (!storage) return { status: "none" };
  const key = progressKey(ctx.garageId, ctx.guideId);
  let raw: string | null;
  try {
    raw = storage.getItem(key);
  } catch {
    return { status: "none" };
  }
  if (raw === null) return { status: "none" };

  const reject = (reason: RejectReason): LoadResult => {
    clearProgress(storage, ctx.garageId, ctx.guideId);
    return { status: "rejected", reason };
  };

  let r: Partial<SavedProgress>;
  try {
    r = JSON.parse(raw);
  } catch {
    return reject("unreadable");
  }
  if (typeof r !== "object" || r === null) return reject("unreadable");
  if (r.v !== PROGRESS_VERSION) return reject("version");
  if (
    typeof r.garageId !== "string" || typeof r.guideId !== "string" || typeof r.configKey !== "string" ||
    typeof r.planSignature !== "string" || typeof r.stepId !== "string" ||
    !Number.isInteger(r.index) || !Number.isInteger(r.total) || typeof r.savedAt !== "number"
  ) {
    return reject("unreadable");
  }
  if (r.garageId !== ctx.garageId || r.guideId !== ctx.guideId) return reject("scope");
  if ((ctx.now ?? Date.now()) - r.savedAt > PROGRESS_TTL_MS || r.savedAt > (ctx.now ?? Date.now()) + 60_000) return reject("expired");
  if (r.configKey !== ctx.configKey) return reject("configuration");
  if (r.total !== ctx.plan.steps.length || r.planSignature !== planSignature(ctx.plan)) return reject("content-changed");
  const index = r.index as number;
  if (index < 0 || index >= ctx.plan.steps.length) return reject("step-mismatch");
  if (stepFingerprint(ctx.plan.steps[index]) !== r.stepId) return reject("step-mismatch");
  return { status: "resume", index };
}
