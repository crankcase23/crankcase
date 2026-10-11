# Redaction log (audit trail)

Deliberate edits made to otherwise byte-frozen recovered files. Everything else under `recovered/` is unmodified.

## 2026-10-09: owner laptop path removed from `recovered/README-RECOVERED.md`

- **What:** line 5 contained an absolute path on the owner's laptop that included an OS account username. Replaced the parenthesised path with `<owner laptop path redacted>`. Nothing else in the file changed.
- **Why:** project rule: no personal names in committed copy. Found by the independent review of commit `124f561` (finding 4).
- **Authorization:** the owner approved the final cleanup pass covering this finding.
- **Original SHA256:** `27bf3bd0d97b073b77aa4bc7cfb6f39736cdb35c649a17c13bcec0c53234fce0` (the value recorded in `recovered/SHA256SUMS.txt` through commit `124f561`)
- **New SHA256:** `4bf0e6f287a40fab00a8db594056e06d4bfc18486ec403866410d1c383e64ed9` (now recorded in `recovered/SHA256SUMS.txt`)
- **Scope:** this file is documentation only. No recovered source, script, manifest, or contract file was touched. `README-RECOVERED.md` is not an original recovered artifact: it was written during reconstruction (C-3).
- **Limit:** commit `124f561` and earlier branch history still contain the original text. A normal commit cannot remove it. Scrubbing it needs a history rewrite and force-push, which has NOT been done and needs owner approval.
