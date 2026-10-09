// RECONSTRUCTED-V1 | NOT the lost original.
// CORRECTION-CYCLE POLICY — LOCKED IN C-4 (Andy): "Use ARCHITECTURE_V1 as canonical. A provenance-rejected generation does NOT consume a correction cycle."
//
//  ARCHITECTURE_V1  — CANONICAL (locked). Source: VD architecture doc §3: "PROVENANCE_CHECK -(reject)-> GEN_REQUESTED (same cycle,
//    no cycle burned if provenance is only missing/invalid metadata)".
//    - Provenance-rejected generation does NOT consume a correction cycle; a new generation is requested in the same cycle.
//    - SUBSTANTIVE provenance failures (image inputs / tracing / compositing flags false): the doc is silent. INFERRED fail-closed:
//      NEEDS_ANDY, no cycle burned, no resubmit. (Kept from C-3; not a C-4 decision.)
//    - METADATA RETRY CAP — **NEW RECONSTRUCTED BEHAVIOR. NOT RECOVERED ORIGINAL BEHAVIOR.** (Andy C-4 lock #3.) No surviving document
//      bounds resubmissions. Rule: maximum 3 metadata/resubmission attempts; after the third unsuccessful resubmission the next
//      rejection goes to NEEDS_ANDY. Exact counting: initial submission + 3 resubmissions; the 4th consecutive rejected submission escalates.
//      (Whether Andy meant "3 rejections total" is an OPEN interpretation question; see docs/UNRESOLVED-DECISIONS.md U-22.)
//
//  BRICK_C_REPORT — REJECTED NON-CANONICAL ALTERNATIVE. Source: VD Brick C report "Deviations / risks": "provenance-rejected generation
//    consumes a cycle and goes to NEEDS_ANDY". Kept ONLY so the conflict stays executable in tests. A run under it (or under any
//    per-field override) needs allowNonCanonical:true, records policy.json as non-canonical, and can NEVER be approved.
export const POLICIES = Object.freeze({
  ARCHITECTURE_V1: Object.freeze({ name: "ARCHITECTURE_V1", provisional: false, locked: "Andy C-4 decision 1 (2026-10-04)", source: "VD architecture doc §3",
    provenanceRejection: "no-cycle-burn-resubmit", substantiveProvenanceRejection: "needs-andy", provenanceRetryCap: 3,
    retryCapLabel: "NEW reconstructed behavior (Andy C-4 lock #3); CANONICAL per Andy C-5 lock #1 (initial submission + up to 3 resubmissions; the 4th rejection escalates to NEEDS_ANDY) — NOT recovered original behavior" }),
  BRICK_C_REPORT: Object.freeze({ name: "BRICK_C_REPORT", provisional: false, locked: "REJECTED as non-canonical by Andy C-4 decision 1", source: "VD Brick C report (deviations)",
    provenanceRejection: "burn-cycle-needs-andy", substantiveProvenanceRejection: "burn-cycle-needs-andy", provenanceRetryCap: 0 }),
});
export const DEFAULT_POLICY = "ARCHITECTURE_V1";
export const BEHAVIOR_FIELDS = ["provenanceRejection", "substantiveProvenanceRejection", "provenanceRetryCap"];

/** Canonical = the three behavior fields equal ARCHITECTURE_V1's. The NAME is irrelevant (renaming an override does not make it canonical). */
export const isCanonical = (p) => BEHAVIOR_FIELDS.every((f) => p?.[f] === POLICIES.ARCHITECTURE_V1[f]);

export function resolvePolicy(p = DEFAULT_POLICY, { allowNonCanonical = false } = {}) {
  const base = typeof p === "string" ? POLICIES[p] : { ...(POLICIES[p?.base ?? DEFAULT_POLICY] ?? {}), ...p };
  if (!base || !base.name) throw new Error(`unknown correction-cycle policy: ${JSON.stringify(p)}`);
  const okRej = ["no-cycle-burn-resubmit", "burn-cycle-needs-andy"];
  const okSub = ["needs-andy", "burn-cycle-needs-andy"];
  if (!okRej.includes(base.provenanceRejection)) throw new Error(`bad provenanceRejection: ${base.provenanceRejection}`);
  if (!okSub.includes(base.substantiveProvenanceRejection)) throw new Error(`bad substantiveProvenanceRejection: ${base.substantiveProvenanceRejection}`);
  if (!(base.provenanceRetryCap >= 0)) throw new Error("bad provenanceRetryCap");
  const canonical = isCanonical(base);
  if (!canonical && !allowNonCanonical) throw new Error(`NON_CANONICAL_POLICY: ${base.name} deviates from the locked ARCHITECTURE_V1 behavior; pass allowNonCanonical:true (test/diagnostic use only — such a run can never be approved)`);
  return Object.freeze({ ...base, canonical });
}
