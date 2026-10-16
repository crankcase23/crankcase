import { createHash } from "node:crypto";

// SERVER ONLY (node:crypto). The opaque per-account token that scopes device-local Wrench progress (see wrenchProgress.ts).
// It is a digest, so storage never holds the user id itself, and it contains only [A-Za-z0-9_-] so it can sit in a storage key.
// It is a partition key, not a secret: it is only ever handed to the browser of the signed-in account it names.
export function wrenchProgressScope(userId: string): string {
  return createHash("sha256").update(`crankcase-wrench-scope:${userId}`).digest("base64url").slice(0, 22);
}
