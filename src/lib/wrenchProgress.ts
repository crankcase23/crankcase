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
//
// ACCOUNT ISOLATION. localStorage belongs to the browser, not to the account, so the garage id alone is not a boundary: it is
// readable from storage, and a car with an unconfirmed configuration has the same configuration key for everyone. Every record
// is therefore also scoped to the signed-in account (`scope`, an opaque server-computed digest of the user id, see
// wrenchScope.ts). The page hands the host a scope ONLY when the viewer owns the garage id in the URL. Records are removed on
// every sign-out path (purgeAll, via signOutAndClear) and any signed-in page load removes records of any other scope
// (purgeForeign), which covers session expiry, cleared cookies and sign-in from elsewhere. A load only ever reads or deletes
// the key of its own scope, so one account's code path never touches another account's record.

import { rowIdOf } from "@/lib/garageId";
import type { WrenchPlan, WrenchStep } from "@/lib/wrenchSteps";

export const PROGRESS_VERSION = 1;
export const PROGRESS_TTL_MS = 14 * 24 * 60 * 60 * 1000;
export const STORAGE_NAMESPACE = "crankcase:wrench:";
const PREFIX = `${STORAGE_NAMESPACE}v1:`;

export type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;
/** What the purge functions need on top: enumerating keys. */
export type EnumerableStorage = StorageLike & Pick<Storage, "key" | "length">;

export interface SavedProgress {
  v: number;
  scope: string;
  garageId: string;
  guideId: string;
  configKey: string;
  planSignature: string;
  stepId: string;
  index: number;
  total: number;
  savedAt: number;
}

export type ProgressContext = { scope: string; garageId: string; guideId: string; configKey: string; plan: WrenchPlan; now?: number };

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

export const progressKey = (scope: string, garageId: string, guideId: string) => `${PREFIX}${scope}:${garageId}:${guideId}`;

/** A scope is an opaque token with no ":" in it, so a key can never be re-read as another scope's. */
export const isValidScope = (scope: unknown): scope is string => typeof scope === "string" && /^[A-Za-z0-9_-]{8,64}$/.test(scope);

/** What a host persists under: its account scope AND a composite garage id, or null (stay in memory). */
export function persistTarget(scope: string | undefined | null, garageId: string | undefined | null): { scope: string; garageId: string } | null {
  const g = persistableGarageId(garageId);
  return g && isValidScope(scope) ? { scope, garageId: g } : null;
}

function wrenchKeys(storage: EnumerableStorage): string[] {
  const out: string[] = [];
  for (let i = 0; i < storage.length; i++) {
    const k = storage.key(i);
    if (k !== null && k.startsWith(STORAGE_NAMESPACE)) out.push(k);
  }
  return out;
}

/** Remove every Wrench progress record on this device (sign-out, and any signed-out page). Never throws. */
export function purgeAll(storage: EnumerableStorage | null): number {
  return purge(storage, () => true);
}

/** Remove every record that does not belong to `scope` (any signed-in page load). Never throws. */
export function purgeForeign(storage: EnumerableStorage | null, scope: string | null): number {
  const mine = isValidScope(scope) ? `${PREFIX}${scope}:` : null;
  return purge(storage, (k) => mine === null || !k.startsWith(mine));
}

function purge(storage: EnumerableStorage | null, doomed: (key: string) => boolean): number {
  if (!storage) return 0;
  let n = 0;
  try {
    for (const k of wrenchKeys(storage)) {
      if (!doomed(k)) continue;
      storage.removeItem(k);
      n++;
    }
  } catch {
    /* storage went away mid-purge: nothing more can be done */
  }
  return n;
}

/** localStorage, or null when the browser denies it (private mode, blocked site data). Never throws. */
export function safeStorage(): EnumerableStorage | null {
  try {
    if (typeof window === "undefined" || !window.localStorage) return null;
    const probe = `${STORAGE_NAMESPACE}probe`;
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
    scope: ctx.scope,
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
    storage.setItem(progressKey(ctx.scope, ctx.garageId, ctx.guideId), JSON.stringify(record));
  } catch {
    /* quota or denied: progress simply stays in memory */
  }
}

export function clearProgress(storage: StorageLike | null, scope: string, garageId: string, guideId: string): void {
  if (!storage) return;
  try {
    storage.removeItem(progressKey(scope, garageId, guideId));
  } catch {
    /* nothing to do */
  }
}

export function loadProgress(storage: StorageLike | null, ctx: ProgressContext): LoadResult {
  if (!storage) return { status: "none" };
  const key = progressKey(ctx.scope, ctx.garageId, ctx.guideId);
  let raw: string | null;
  try {
    raw = storage.getItem(key);
  } catch {
    return { status: "none" };
  }
  if (raw === null) return { status: "none" };

  const reject = (reason: RejectReason): LoadResult => {
    clearProgress(storage, ctx.scope, ctx.garageId, ctx.guideId);
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
    typeof r.scope !== "string" || typeof r.garageId !== "string" || typeof r.guideId !== "string" || typeof r.configKey !== "string" ||
    typeof r.planSignature !== "string" || typeof r.stepId !== "string" ||
    !Number.isInteger(r.index) || !Number.isInteger(r.total) || typeof r.savedAt !== "number"
  ) {
    return reject("unreadable");
  }
  if (r.scope !== ctx.scope || r.garageId !== ctx.garageId || r.guideId !== ctx.guideId) return reject("scope");
  if ((ctx.now ?? Date.now()) - r.savedAt > PROGRESS_TTL_MS || r.savedAt > (ctx.now ?? Date.now()) + 60_000) return reject("expired");
  if (r.configKey !== ctx.configKey) return reject("configuration");
  if (r.total !== ctx.plan.steps.length || r.planSignature !== planSignature(ctx.plan)) return reject("content-changed");
  const index = r.index as number;
  if (index < 0 || index >= ctx.plan.steps.length) return reject("step-mismatch");
  if (stepFingerprint(ctx.plan.steps[index]) !== r.stepId) return reject("step-mismatch");
  return { status: "resume", index };
}
