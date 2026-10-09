**THIS GUIDE FACTORY IMPLEMENTATION IS RECONSTRUCTED FROM SURVIVING EVIDENCE. IT IS NOT THE LOST ORIGINAL IMPLEMENTATION.**

# Reconstructed architecture map

Tags: **VD** documentation · **VC** recovered code · **INF** inferred · **UNK** unknown/not reconstructed.

## Pipeline (event-sourced; state = pure function of events.jsonl)

```
 visual spec intake ──┐                                                    (spec-intake.mjs)      VD (prompt format) / INF (parser)
 reference evidence ─▶ EP DRAFT ─▶ objective sufficiency gate ─▶ EP SUFFICIENT | EP INSUFFICIENT(terminal)   (evidence.mjs, machine.evaluateEP)  VD
                                         │ + template criticality rule                                     (contract.mjs)           INF
                                         ▼
 EP SUFFICIENT ─▶ compile VC ─▶ VC LOCKED                                                  (contract.mjs)           VD
        ▼
 GEN_REQUESTED ─▶ actor/generator adapter ─▶ GEN_SUBMITTED (GR built by CODE from real bytes)   (actors.mjs, machine)  VD (+UNK adapters)
        ▼
 provenance checks + no-source-pixels / generator attestation                            (provenance.mjs)         VD+VC
   ├─ VALID ─▶ QA_PENDING
   └─ REJECTED ─▶ [CYCLE POLICY SWITCH]  ARCHITECTURE_V1 (default, provisional) | BRICK_C_REPORT   (policy.mjs)  UNRESOLVED
        ▼
 content QA (QR; verdict computed by code; independence enforced)                        (qa.mjs)                 VD+rubric
   ├─ PASS_FOR_OVERLAY_QA ─▶ ADMISSION GATE ─▶ GEN_ACCEPTED ─▶ NORMALIZE ─▶ [overlay QA if callouts] ─▶ APPROVED
   ├─ CORRECTIONS_REQUIRED ─▶ CD (1:1 findings, protected ⟂ mayChange) ─▶ GEN_REQUESTED (cycle+1, ≤3 corrections)
   ├─ EVIDENCE_DEFICIENT ─▶ superseding EP (needs deficiencyRef) ─▶ new VC ─▶ GEN_REQUESTED (cycles NOT reset)
   └─ ESCALATE / any cap ─▶ NEEDS_ANDY (terminal)
        ▼
 APPROVED: approved.json (AA) + registry-entry.preview.json (generatedRaster record in the RECOVERED type shape). INTEGRATED/REVOKED: UNK, not built.
```

## Modules
| module | role | notes |
|---|---|---|
| canon.mjs | canonical JSON, SHA-256, contentHash | INF rules |
| enums.mjs | actors, enums, constants, banner | per-constant source tags in comments |
| policy.mjs | **correction-cycle policy switch** | two presets + per-field overrides |
| eventlog.mjs | append-only hash-chained events.jsonl | chain construction INF |
| objects.mjs | common envelope + generic validation | VD arch §0 |
| evidence.mjs | reference intake, ledger rules, EP validation + sufficiency | VD §1.1 + VC lib |
| spec-intake.mjs | visual spec intake (parses the surviving Step 10 prompt format) | original spec format LOST |
| contract.mjs | template + VC compiler + prompt | template content LOST (INF) |
| actors.mjs | generator adapters (FileDrop, Scripted, Unavailable) | original adapters LOST |
| provenance.mjs | GR checks, attestation, no-source-pixels | VD §1.3 + VC lib |
| png.mjs / normalize.mjs | dependency-free PNG codec; downscale-only normalizer, metadata strip, C2PA record | original used sharp (INF) |
| qa.mjs | QR validation/verdict, CD compile, overlay verdict | VD §1.4/1.5 + rubric |
| artifact.mjs | AA + registry-entry preview in the recovered type shape | VD §1.6 + VC types |
| store.mjs / verify.mjs | on-disk layout, immutability, read-only integrity verifier | VD §2 |
| machine.mjs | commands + reducer (registerEP, evaluateEP, compileContract, requestGeneration, submitGeneration, submitQA, admit, normalize, overlayCheck, approve) | command names INF (CLI names LOST) |

## Storage layout (per visual) — VD arch §2
evidence-packet.vN.json · visual-contract.vN.json · template.json · generations/GR-…{.record.json,.png} + prompts/ · qa/QR-… · deltas/CD-… · normalized/ · approved.json · registry-entry.preview.json · events.jsonl

## Invariants enforced (each has a test)
code decides/actors propose · objects immutable (write-once) · every ref carries a hash recomputed from content · refused commands write nothing (byte-identical dir) · a rejected GR is recorded but can never be admitted · QA reviewer independent of generator · cycle cap = initial + 3 corrections · verified status only with a human (Andy) sign-off.
