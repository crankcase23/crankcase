# VIN-required garage + photo VIN scan

**Rule:** a vehicle is added to a garage permanently only with a valid VIN. Browsing by year/make/model stays open.

## What changed
- `src/lib/vin.ts`: one VIN validator shared by browser and server. 17 chars, no I/O/Q, case/space/dash tolerant; check digit enforced for North American VINs (WMI 1-5), format-only for other markets (many have no valid check digit).
- `POST /api/garage` (catalog and custom): `400 {code:"VIN_REQUIRED"}` without a valid VIN. VIN is stored normalized (uppercase).
- `POST/PUT /api/garage/[id]/service|odometer`: no longer auto-create a garage row for a vehicle that isn't in the garage (that was a VIN-less back door). Now `409 VIN_REQUIRED`.
- Add flow: manual year/make/model form has a required VIN field (plus "Just browsing? Open the guides without adding it"); the VIN box and the manual form both have **Take Photo / Upload Photo**; `/decode` uses the same validator.
- Order stays: VIN -> Confirm Your Ride (transmission/drivetrain) -> Add to Garage.

## Photo scan
`src/lib/vinScan.ts`: browser-only. Native `BarcodeDetector` when the browser has it, else `@zxing/library` (lazy-loaded) for Code 39 / Code 128 / Data Matrix / PDF417 / QR. The image is never uploaded (the e2e test fails on any image upload request). A scan only fills the VIN box; the customer reviews/edits and continues; nothing is saved until Confirm Your Ride.
**Not covered:** VINs printed as plain text with no barcode (windshield plate, registration). Those are typed. OCR (needs a ~10 MB model; self-hosted to stay local) is a possible follow-up.

## Existing data
Nothing is migrated or deleted. Garage rows without a VIN stay, list, and keep service/odometer history. Adding the same vehicle later with its VIN fills the VIN into that row (no duplicate). No DB migration in this PR.

## Privacy / ownership-transfer compatibility
- Uniqueness stays per (user, VIN). Another account holding the same VIN is invisible: no lookup across accounts, identical error text whether or not anyone else holds a VIN, no shared history (tested with two accounts).
- VIN is identity, not ownership: nothing here asserts ownership, so the planned `vehicles` + `vehicle_access` / transfer design can layer on top; `garage_entries.vin` is already the join key.

## Tests
`npm run config:test` (7 new VIN unit tests), Playwright `vin-required-garage` (9), plus existing fixtures updated to supply synthetic VINs. Barcode fixtures in `tests/e2e/fixtures/` encode a published sample VIN and synthetic ones.

## Depends on
PR #42 (vehicle configuration). This branch is cut from `claude/vehicle-config-v1`; merge #42 first (its DB migration must run before deploy). This PR adds no migration of its own.
