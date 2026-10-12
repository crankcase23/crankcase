import { test, expect } from "@playwright/test";
import path from "node:path";
import { signUpNewUser } from "./helpers";

// REGRESSION for the real customer bug: a clear BMW door-jamb label was read as SINEFFECTONTHEDAT (legal warning text).
// This drives the real browser pipeline (canvas grey/contrast/binarize passes + the OCR engine + candidate ranking) on a
// reconstructed US-market BMW label and its variants (scripts/vin/ocr-tests/fixtures). The customer's own photo is not in
// the repo; if scripts/vin/ocr-tests/fixtures/customer-bmw-label.(jpg|png) is added, add it to LABELS below.
// Whatever happens, the VIN box must never receive label text, and a scan must still need the customer's confirmation.
const FIX = (n: string) => path.join(__dirname, "..", "..", "scripts", "vin", "ocr-tests", "fixtures", n);
const BMW_VIN = "WBAPH7C58AA175760";
const LABELS: { file: string; exact: boolean }[] = [
  { file: "bmw-label-clean.png", exact: true },
  { file: "bmw-label-cropped.png", exact: true },
  { file: "bmw-label-vin-strip.png", exact: true },
  { file: "bmw-label-lowcontrast.png", exact: true },
  { file: "bmw-label-glare.png", exact: false },
  { file: "bmw-label-rotated-7.png", exact: false },
  { file: "bmw-label-rotated-minus12.png", exact: false },
];

test.describe("BMW door-jamb label photo scan", () => {
  for (const { file, exact } of LABELS) {
    test(`${file}: never label text; ${exact ? "the exact VIN is prefilled" : "any read is VIN-shaped and unaltered"}; confirmation is required`, async ({ page }) => {
      test.setTimeout(150_000);
      await signUpNewUser(page);
      await page.goto("/decode");
      const chooser = page.waitForEvent("filechooser");
      await page.getByTestId("vin-upload-photo").click();
      await (await chooser).setFiles(FIX(file));
      const status = page.getByTestId("vin-scan-status");
      await expect(status).not.toHaveText(/Reading the photo/, { timeout: 120_000 });
      const value = (await page.getByTestId("vin-input").inputValue()).trim();
      expect(value, "label text must never reach the VIN box").not.toMatch(/EFFECT|STANDARD|MANUFACT|VEHICLE|DATE|GVWR|GAWR|^[A-Z]{17}$/);
      if (exact) {
        expect(value).toBe(BMW_VIN);
        await expect(page.getByTestId("vin-confirm-scan")).toBeVisible();
        await expect(page.getByTestId("vin-lookup")).toBeDisabled(); // not until the customer ticks the box
      } else if (value) {
        expect(value).toHaveLength(17);
        expect(value.replace(/[^0-9]/g, "").length).toBeGreaterThanOrEqual(4);
        await expect(status).toContainText(/Check every character|does not pass the VIN check/);
      } else {
        await expect(status).toContainText(/couldn't find a 17-character VIN/);
      }
    });
  }
});
