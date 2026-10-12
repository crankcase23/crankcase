# VIN-required garage + photo VIN scan

Stacked on Vehicle Configuration V1 (PR #42). Merge #42 first; the diff after that is this change alone.

## Rules
1. **A valid VIN is required to add a vehicle.** Enforced in `POST /api/garage` for both catalog and custom adds, before anything else. The screens ask for it too, but the API does not depend on them.
2. **Browsing never creates a vehicle.** The year/make/model picker only shows what we have and says a VIN is needed. Logging service history or an odometer reading no longer auto-creates a garage row (that was a back door); those routes return 404 `NOT_IN_GARAGE` for a vehicle that is not in the customer's garage.
3. **Sequence stays VIN -> Confirm Your Ride -> Add to Garage.**
4. **Older records are kept.** A record with no valid VIN stays exactly as it is, shows "Add your VIN" on its garage card and a completion panel on its page. `POST /api/garage/[id]/vin` attaches a VIN to the customer's own row only, never replaces a valid VIN, and never touches another account.
5. **A VIN is not proof of ownership.** Typing or scanning one never grants access to anything.

## VIN validity (`src/lib/vin.ts`, used by browser and server)
17 characters, A-Z and 0-9 except I/O/Q, and the position-9 check digit. The check digit is enforced for **every** VIN: every vehicle sold in the US carries one, imports included (the project owner's own BMW passes). Known limitation: a non-US-market VIN that fails it cannot be added until there is a support path. Only text counts as a VIN (a number that stringifies to 17 digits is refused). `normalizeVin` changes case and strips spaces/dashes only; it never swaps a character.

## Identity and collisions (future transfer compatibility)
- The canonical identity is `canonicalVin()` (upper-case VIN). Accounts relate to a vehicle through their own `garage_entries` rows; the VIN names the vehicle. No new table or migration is needed now. When the transfer workflow is built, a canonical `vehicles` table and an `ownership` relation can replace the case-insensitive VIN match in `ownRowForVin()`, the only place that knows.
- Same VIN already in the customer's own garage: the existing row is returned (no duplicate), in any spelling.
- VIN held by another account: **irrelevant** (changed 2026-10-12, owner decision, to remove VIN squatting). Each account that adds a VIN gets its own garage row with its own Service History, odometer and configuration; nothing is shared and the response is identical whether or not anyone else holds the VIN, so it is not an ownership oracle. The database has only per-account unique indexes (`garage_entries_user_vin_uq`, `garage_entries_user_catalog_novin_uq`); there is no global VIN constraint to change. The same VIN twice in ONE account is refused on completion (`409 VIN_IN_GARAGE`) and is idempotent on add. Real ownership/transfer remains future work and is what would, later, gate shared access.
- Same catalog model with a different VIN: a second car. Crankcase allows unlimited vehicles; each VIN is its own garage row with its own Service History, odometer, configuration and unlock identity. The customer's oldest car of a model keeps the plain id (`<catalogId>`), additional cars use `<catalogId>~<rowId>`. A VIN-less older record of that model is completed by the first VIN rather than duplicated.
- No VIN-existence oracle: adds never reveal whether another account holds a VIN. Probe rate limits (next section) still apply to bound VIN-guessing against the decoder.

## Probe protection (`src/lib/vinGuard.ts`)
Free, no new service or table: counts are rows in the existing `app_events` table (`vin.attempt`, `vin.collision`). The VIN is never stored there; the network address (`x-forwarded-for`) is stored only as a salted hash.
- Every add and every VIN completion that passes the format rules is counted before the lookup; a collision (the generic claim-required answer) is counted separately.
- Limits (rolling): 5 collisions/hour and 10/day per account; 20 attempts/hour per account; 150 attempts/hour per address (loose on purpose: carrier and office networks share addresses).
- Over a limit the answer is `429 {code:"VIN_RATE_LIMITED", error}` with `Retry-After`. It says nothing about the VIN and is identical for held and free VINs, so the limit cannot be used to tell them apart. Malformed VINs are refused earlier and cost no budget.
- Windows are evaluated on the database clock (the column is a timestamp without time zone).
- Not covered: many accounts on many addresses (account creation is not throttled here); a parallel burst can slip a few extra attempts past the counters (no lock); `x-forwarded-for` is trustworthy on Vercel (the platform sets it) but only as trustworthy as the proxy anywhere else. The structural fix is the verified-claim workflow plus an edge/CAPTCHA limit, both separate work.

## Photo scan (`src/lib/vinOcr.ts`, `src/components/vin/VinField.tsx`)
- **Free, in the browser.** Open-source Tesseract (tesseract.js, Apache-2.0) with its English model, served from our own `/ocr` folder (copied from `node_modules` by `scripts/ocr/copy-assets.mjs`, run by `predev`/`prebuild`; output git-ignored). No paid API, no CDN, no third party request.
- **Take photo** = file input with `capture="environment"`; **Upload photo** = plain file input. Both accept JPEG/PNG/WebP only.
- **Never uploaded, never stored.** The image is read in memory, drawn to a canvas (pixels only, so EXIF/location is dropped), recognized, and the canvases and OCR worker are torn down. The file input is cleared immediately. No fetch, storage, data URL or blob export exists on this path (a unit test greps for it).
- **Malicious/oversized files:** type is decided from the file's first bytes (not name or MIME claim), so SVG, PDF, executables and renamed text are refused; 15 MB cap; PNG/JPEG header dimensions are checked against a 50-megapixel cap before decode (decompression-bomb guard).
- **Never silently changes characters.** The OCR read is shown verbatim, including I/O/Q. Characters that are illegal, low-confidence, or lookalikes whose swap would fix a failed check digit are highlighted. Single-character corrections are offered as buttons and applied only on a tap. A scanned VIN needs an explicit "I checked this VIN against my vehicle" box before lookup, and the server validates it again on add.
- Several looks at the same photo (thresholded and plain, three layouts); the first read that passes the check digit wins, otherwise the most repeated read is shown flagged.

## Deployment prerequisites
1. **Nothing new in the database.** No migration for this PR. (PR #42's migration must still run before #42 deploys.)
2. `package.json` gains a dependency (`tesseract.js`, `@tesseract.js-data/eng`) and `predev`/`prebuild` scripts. The Vercel build must keep running `npm run build` so the `/ocr` assets are copied (about 11 MB of static files, loaded only when someone presses Take/Upload photo).
3. Merge order: #42, then this PR.

## Limitations
- OCR accuracy on real dash plates, door-jamb stickers and registration paper in real light is **not proven**: tests use clean synthetic photos. The check digit, highlighting and confirmation are the safety net, and typing always works. Tesseract can itself pick 0 for an O; the check digit usually catches that.
- No camera hardware is driven in tests; the camera button's file input and the mobile viewport are.
- NHTSA is mocked in browser tests (unreachable from the build sandbox).
- Probe protection (below) is per account and per address; an attacker with many accounts on many addresses can still probe slowly.
