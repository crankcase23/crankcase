# VIN decode (2010 BMW 328i, E90)

Decoded remotely on 2026-10-10. **One free decoder (bimmer.work option list) plus RealOEM and NHTSA vPIC.** Everything marked *inferred* comes from an option code being absent from that list, which is strong but is not proof. Nothing here is certified; verify the probable items at the car (list at the bottom).

VIN: `WBAPH7C58AA175760`

| Item | Value | Confidence | Note |
|---|---|---|---|
| Build date | Start of production 2009-09-07 (09/2009), Munich plant | decoded (bimmer.work vehicle page; RealOEM production month 09/2009) | NHTSA: plant Munich, MY2010, 230 hp 3.0L I6. |
| Model/body | E90 LCI sedan, type code PH73, USA market, left-hand drive | decoded |  |
| Engine | 3.0L I6, 172 kW (230 hp). bimmer.work says N52K; RealOEM says N52N | decoded | Engine family label differs between sources (N52K vs N52N); treat as N52 3.0L either way, confirm from engine code on block/ISTA if parts differ. |
| Transmission | Automatic (S205A; base list 205) | decoded option code | Exact unit (GA6L45R 6-speed) inferred, not stated. |
| Drive | RWD (not xDrive); PH73 is the RWD 328i type code | decoded | bimmer.work Drivetrain: Rear-Wheel Drive. |
| Comfort Access (S322A) | Not present: no 322 in option list; standard key | decoded (absence of code) | Absence in a decoder list is strong but not proof; verify at car (keyless start button vs key slot). |
| Headlights | Halogen (no xenon). Option 522 Xenon and 524 Adaptive not listed. 5AC high-beam assistant, 520 fog lights, 563 Lights Package present | inferred from absence of 522/524 | No angel-eye halo coding in list; US halogen E90 LCI has no halo ring on halogen... verify visually. |
| Fog lights | Yes (520) | decoded option code |  |
| Lights package | 563 Lights Package, 5AC automatic high-beam control, 521 rain sensor | decoded option code |  |
| Limited-slip diff | Not found: no 258 / LSD option code listed | inferred (absence) | US 328i never offered LSD as an option. |
| Wheels | 2KU alloy wheels V-spoke style 285 | decoded option code | Size (17 inch) is from general E90 style 285 knowledge, not stated by retrieved pages; inferred. |
| Tire type / run-flats | Not stated. Tire type not coded in list | not found | US E90 328i came with run-flat tires on most wheel packages; inferred only. Check sidewall for RSC/RFT/DSST. |
| Brake package / sport brakes | No sport/M brake option code in list | inferred (absence) | Standard 328i brakes assumed. |
| Rear differential ratio | Not obtainable from decoders retrieved | not found | Read from rear diff tag or ISTA/part number. |
| iDrive / navigation | 609 Navigation System Professional; 615 extended BMW Online, 620 voice input, 6UH traffic, 6FL USB/audio, 6AA/6AB Teleservices, 639 phone prep, 653 HD radio, 655 satellite radio | decoded option code | 09/2009 LCI Professional nav implies CIC iDrive (inferred; generation not stated by page). |
| Sunroof | 403 glass roof, electric | decoded option code |  |
| TPMS | 2VB tire pressure indicator; direct TPMS | decoded option code | NHTSA TPMS: Direct. |
| Battery / AGM | 570 Stronger electricity supply (larger battery/alternator). AGM not indicated; no start-stop in US E90 | inferred | 570 confirms heavy-duty electrics; AGM not stated. Battery size not decoded. Verify under-trunk battery label. |
| Seats / comfort | 459 electric seats with memory, 488 lumbar, 534 automatic AC, 544 cruise with brake function, 4AB walnut burl trim, 4NA compass mirror, 431 auto-dim mirror, 430 mirror package, 249 multifunction wheel, 240 leather wheel | decoded option code |  |
| Heated seats | Not found: no 494 in list | inferred (absence) |  |
| Paint / interior | Schwarz 2 (668), Dakota leather beige LCB4 | decoded |  |
| Other | 823 hot climate, 876 315 MHz remote frequency, 319 universal remote (HomeLink), 925 shipping protection, 1CA, 850 export tank fill, 853 English | decoded option code |  |

## Option codes decoded (43)



## Known conflicts and gaps

- Engine label: bimmer.work says N52K, RealOEM says N52N. Same 3.0 L N52 family either way; the PCV guide and parts notes treat the cover as the later plastic design and ask for the engine label to be read.

- Rear differential ratio
- Run-flat tire status and tire size (not coded)
- Battery size/AGM
- Exact headlight halo coding
- Other decoders (bmwvin.com, mdecoder, vindecoderz, autodna): blocked by robots/proxy or error page, not retrieved
- Last option 'B080' truncated/empty on page, meaning unknown

## What changed in the guides

- Guide 2 (fuse and bulb): halogen headlights probable, so the halo-cap visual was withdrawn (recorded under `withdrawnVisuals` in the ledger).
- Guide 3 (key fob): standard rechargeable key probable (no Comfort Access), so the Comfort Access key-opening visual was withdrawn; CR2032 steps flagged as probably not applicable.
- Guides 7, 13, 15: decoded-configuration note added to the configuration step (battery size not decoded, tire size not coded, open differential probable).

## Verify at the car (these turn probable into proven)

1. Key: does it have a side tab and battery cover, and does the car have a start button? (standard key vs Comfort Access)
2. Headlights: halogen or xenon lens, any halo ring.
3. Rear differential tag: ratio and any limited-slip marking.
4. Tire sidewall: size, run-flat marking, direction arrow.
5. Battery label in the trunk: Ah, flooded or AGM, group size.
6. Engine label or cover: N52K vs N52N, and whether the valve cover is plastic.
