# VIN-required garage + photo VIN scan

Stacked on Vehicle Configuration V1 (PR #42). Merge #42 first; the diff after that is this change alone.

## Rules
1. **A valid VIN is required to add a vehicle.** Enforced in `POST /api/garage` for both catalog and custom adds, before anything else. The screens ask for it too, but the API does not depend on them.
2. **Browsing never creates a vehicle.** The year/make/model picker only shows what we have and says a VIN is needed. Logging service history or an odometer reading no longer auto-creates a garage row (that was a back door); those routes return 404 `NOT_IN_GARAGE` for a vehicle that is not in the customer's garage.
3. **Sequence stays VIN -> Confirm Your Ride -> Add to Garage.**
4. **Older records are kept.** A record with no valid VIN stays exactly as it is, shows "Add your VIN" on its garage card and a completion panel on its page. `POST /api/garage/[id]/vin` attaches a VIN to the customer's own row only, never replaces a valid VIN, and never touches another account (and does not care whether other accounts hold the same VIN).
5. **A VIN is not proof of ownership.** Typing or scanning one never grants access to anything.

## VIN validity (`src/lib/vin.ts`, used by browser and server)
17 characters, A-Z and 0-9 except I/O/Q, and the position-9 check digit. The check digit is enforced for **every** VIN: every vehicle sold in the US carries one, imports included (the project owner's own BMW passes). Known limitation: a non-US-market VIN that fails it cannot be added until there is a support path. Only text counts as a VIN (a number that stringifies to 17 digits is refused). `normalizeVin` changes case and strips spaces/dashes only; it never swaps a character.

## Identity, isolation and exceptions (owner-approved design, 2026-10-11)
- **A VIN is a vehicle identity, not ownership.** Any number of accounts may keep a private garage record for the same VIN. Adding a VIN never depends on whether another account holds it, so there is no "VIN claim required" answer, no cross-account lookup, no squatting (nobody can block a VIN by adding it first) and no one-bit oracle. Identical inputs get identical outputs.
- Isolation is structural: every garage row, service history, odometer reading, configuration and (later) paid unlock belongs to one account's row. Nothing is shared between accounts that hold the same VIN; removing one account's record never touches another's.
- Canonical form: `canonicalVin()` (upper-case, no spaces/dashes). Every write stores it; `migrations/2026-10-11-vin-canonical.sql` upper-cases older rows (it STOPS if that would merge two rows of one customer) and adds a CHECK so the database refuses anything else. Lookups are plain equality on `(user_id, vin)` and use `garage_entries_user_vin_uq`, with no `upper()` on the column. The same VIN twice in ONE garage is the same car, in any spelling.
- Same catalog model with a different VIN: a second car (own row, own history, own odometer/config). A VIN-less older record is completed by the first VIN rather than duplicated. Every car is addressed by its own permanent garage id (next section).
- Ownership, verified claims and transfers are NOT decided by typing a VIN. They stay governed by the existing CLUTCH rules: one verified controlling owner per VIN, transfer pending/accept, former owner read-only history, $5 credit per party on a private transfer. That workflow is separate work; this change neither implements nor weakens it.
- **VIN exception process (documented, not built):** a VIN that fails validation (pre-1981, kit/custom/imported chassis with a non-standard check digit) is never accepted automatically. The customer contacts support; a staff member reviews evidence (title/registration), and an audited exception is recorded for that one account + VIN (who approved, when, why, evidence reference). The exception allows only that VIN for that account and is itself revocable; it creates no bypass for anyone else and no code path skips `validateVin` by default.
- Answers that remain: `409 VIN_ALREADY_IN_GARAGE` (this VIN is already on another of the customer's own rows when completing a record) and `409 VIN_ALREADY_SET` (a saved VIN is never swapped). Both concern only the customer's own garage.

## Garage ids: one permanent id per physical car
- A catalog car's id is always `<catalogId>~<rowId>` (a custom car's id is its row id). The row id never changes, so a car's id does not change when another car of the same model is added or deleted, and an id can never start pointing at a different car.
- Service history, odometer, configuration (Edit Configuration), VIN completion and delete all resolve that id to exactly one of THIS customer's rows (`findOwnRow`); another customer's id reaches nothing.
- A bare model id (`<catalogId>`, from an old link or bookmark) is a legacy alias: with exactly one car of that model it resolves to it (the vehicle page redirects to the permanent id); with two or more it is ambiguous. The API answers `409 VEHICLE_AMBIGUOUS` on every garage route and changes nothing; the vehicle, spec-sheet, service-history-print and guide pages show a "Which car?" chooser (last six VIN characters) instead of picking one.
- Wrench Mode reads the live configuration for the car's own id (it used to read it by the shared catalog id).
- Existing single-car customers lose nothing: their old links keep working through the alias.

## Abuse throttle (`src/lib/vinGuard.ts`)
Not an enumeration defence any more (there is nothing per-VIN to enumerate); a plain volume cap. Free, no new table: counts are rows in `app_events` (`vin.attempt`). The VIN is never stored; the network address (`x-forwarded-for`) is stored only as a salted hash.
- Every add and VIN completion that passes the format rules is counted. Limits (rolling): 20 attempts/hour per account, 150/hour per address (loose: carrier/office networks share addresses).
- Over a limit: `429 {code:"VIN_RATE_LIMITED", error}` with `Retry-After`, saying nothing about the VIN. Malformed VINs are refused earlier and cost no budget. Windows use the database clock.
- Not covered: a parallel burst can slip a few attempts past the counters (no lock); `x-forwarded-for` is only as trustworthy as the proxy outside Vercel.

## Photo scan (`src/lib/vinOcr.ts`, `src/components/vin/VinField.tsx`)
- **Free, in the browser.** Open-source Tesseract (tesseract.js, Apache-2.0) with its English model, served from our own `/ocr` folder (copied from `node_modules` by `scripts/ocr/copy-assets.mjs`, run by `predev`/`prebuild`; output git-ignored). No paid API, no CDN, no third party request.
- **Take photo** = file input with `capture="environment"`; **Upload photo** = plain file input. Both accept JPEG/PNG/WebP only.
- **Never uploaded, never stored.** The image is read in memory, drawn to a canvas (pixels only, so EXIF/location is dropped), recognized, and the canvases and OCR worker are torn down. The file input is cleared immediately. No fetch, storage, data URL or blob export exists on this path (a unit test greps for it).
- **Malicious/oversized files:** type is decided from the file's first bytes (not name or MIME claim), so SVG, PDF, executables and renamed text are refused; 15 MB cap; PNG/JPEG header dimensions are checked against a 50-megapixel cap before decode (decompression-bomb guard).
- **Never silently changes characters.** The OCR read is shown verbatim, including I/O/Q. Characters that are illegal, low-confidence, or lookalikes whose swap would fix a failed check digit are highlighted. Single-character corrections are offered as buttons and applied only on a tap. A scanned VIN needs an explicit "I checked this VIN against my vehicle" box before lookup, and the server validates it again on add.
- Several looks at the same photo (thresholded and plain, three layouts); the first read that passes the check digit wins, otherwise the most repeated read is shown flagged.

## Deployment prerequisites
1. **One small migration for this change:** `migrations/2026-10-11-vin-canonical.sql` (+ `-VERIFY`, `-ROLLBACK`). Run it after #42's migration and BEFORE the matching code deploys; owner approval required for any production run. It stops without changing anything if an account holds two rows whose VINs differ only by case.
2. `package.json` gains a dependency (`tesseract.js`, `@tesseract.js-data/eng`) and `predev`/`prebuild` scripts. The Vercel build must keep running `npm run build` so the `/ocr` assets are copied (about 11 MB of static files, loaded only when someone presses Take/Upload photo).
3. Merge order: #42, #43, then this VIN-isolation PR (it is stacked on #43).

## Limitations
- OCR accuracy on real dash plates, door-jamb stickers and registration paper in real light is **not proven**: tests use clean synthetic photos. The check digit, highlighting and confirmation are the safety net, and typing always works. Tesseract can itself pick 0 for an O; the check digit usually catches that.
- No camera hardware is driven in tests; the camera button's file input and the mobile viewport are.
- NHTSA is mocked in browser tests (unreachable from the build sandbox).
