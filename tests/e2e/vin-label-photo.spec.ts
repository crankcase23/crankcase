import { test, expect } from "@playwright/test";
import path from "node:path";
import { signUpNewUser } from "./helpers";

// REGRESSION for the real customer bug: a clear BMW door-jamb label was read as SINEFFECTONTHEDAT (legal warning text).
// This drives the real browser pipeline (canvas grey/contrast/binarize passes + the OCR engine + candidate ranking) on a
// the customer's original photo and a reconstructed US-market BMW label with its variants (scripts/vin/ocr-tests/fixtures). The customer's own photo is not in
// the repo, but the customer's ORIGINAL photo is (customer-bmw-label.jpg).
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

test.describe("The ORIGINAL customer photo (dusty BMW door jamb, 1440x1920) that exposed the bug", () => {
  // PRIMARY ACCEPTANCE TEST. The real photograph, through the real browser pipeline. The exact VIN must come out of the
  // photo by itself: no typing, no suggestion button, no manual correction. Safety rules still hold.
  test("the exact VIN is extracted from the photo itself; never label text; passes the check digit; the customer must still confirm", async ({ page }) => {
    test.setTimeout(240_000);
    await signUpNewUser(page);
    await page.goto("/decode");
    const chooser = page.waitForEvent("filechooser");
    await page.getByTestId("vin-upload-photo").click();
    await (await chooser).setFiles(FIX("customer-bmw-label.jpg"));
    const status = page.getByTestId("vin-scan-status");
    await expect(status).not.toHaveText(/Reading the photo/, { timeout: 200_000 });
    await expect(page.getByTestId("vin-input")).toHaveValue(BMW_VIN);
    await expect(status).toContainText(/Check every character/); // the read passes the VIN check digit
    await expect(status).not.toContainText(/does not pass the VIN check/);
    await expect(page.getByTestId("vin-suggestion")).toHaveCount(0); // nothing was guessed or offered to fix it
    await expect(page.getByTestId("vin-retake-tips")).toHaveCount(0);
    // A scan never goes straight to lookup: the customer ticks the confirmation first.
    await expect(page.getByTestId("vin-confirm-scan")).toBeVisible();
    await expect(page.getByTestId("vin-lookup")).toBeDisabled();
    await page.getByTestId("vin-confirm-scan").check();
    await expect(page.getByTestId("vin-lookup")).toBeEnabled();
    // Editing a single character after the scan drops the scan status: the edited VIN is the customer's own entry and is re-validated.
    await page.getByTestId("vin-input").fill(BMW_VIN.slice(0, 16) + "1");
    await page.getByTestId("vin-lookup").click();
    await expect(page.getByTestId("vin-error")).toContainText(/check-digit/i);
  });
});

test.describe("Scan speed and responsiveness on the ORIGINAL customer photo", () => {
  // Measured on the same 2-core container: 23.9 s before the speed work, about 5 s after. The budget leaves several times the
  // headroom for a loaded machine yet still fails if the scan slides back to the old multi-pass-first behaviour.
  const BUDGET_MS = 18_000;
  test("progress is on screen at once and never goes backwards; the page stays responsive; the exact VIN arrives inside the budget", async ({ page }) => {
    test.setTimeout(120_000);
    await signUpNewUser(page);
    await page.goto("/decode");
    await page.evaluate(() => {
      const w = window as unknown as { __lag: number };
      w.__lag = 0;
      let last = performance.now();
      setInterval(() => { const n = performance.now(); w.__lag = Math.max(w.__lag, n - last - 50); last = n; }, 50);
    });
    const chooser = page.waitForEvent("filechooser");
    await page.getByTestId("vin-upload-photo").click();
    const t0 = Date.now();
    await (await chooser).setFiles(FIX("customer-bmw-label.jpg"));
    const bar = page.getByTestId("vin-scan-progress");
    await expect(bar).toBeVisible({ timeout: 2_000 }); // immediate feedback: the customer is never staring at nothing
    await expect(page.getByTestId("vin-scan-stage")).not.toHaveText("");
    const seen: number[] = [];
    const stages = new Set<string>();
    const status = page.getByTestId("vin-scan-status");
    while (Date.now() - t0 < 60_000) {
      if (!(await bar.isVisible())) break;
      const v = Number(await bar.getAttribute("aria-valuenow").catch(() => null));
      if (Number.isFinite(v)) seen.push(v);
      const st = await page.getByTestId("vin-scan-stage").textContent({ timeout: 500 }).catch(() => null);
      if (st) stages.add(st.trim());
      await page.waitForTimeout(150);
    }
    const took = Date.now() - t0;
    await expect(status).not.toHaveText(/Reading the photo/);
    await expect(page.getByTestId("vin-input")).toHaveValue(BMW_VIN);
    for (let i = 1; i < seen.length; i++) expect(seen[i], `progress went backwards at sample ${i}: ${seen.join(",")}`).toBeGreaterThanOrEqual(seen[i - 1]);
    expect(new Set(seen).size, `progress moved while scanning: ${seen.join(",")}`).toBeGreaterThan(3);
    expect(seen.every((v) => v >= 0 && v <= 100)).toBe(true);
    expect(stages.size, `stages shown: ${[...stages].join(" | ")}`).toBeGreaterThanOrEqual(2);
    const lag = await page.evaluate(() => (window as unknown as { __lag: number }).__lag);
    test.info().annotations.push({ type: "scan-ms", description: String(took) }, { type: "longest-freeze-ms", description: String(Math.round(lag)) });
    console.log(`ORIGINAL PHOTO scan: ${took} ms, longest page freeze ${Math.round(lag)} ms, progress samples ${seen.length}, stages: ${[...stages].join(" > ")}`);
    expect(took, `scan took ${took} ms`).toBeLessThan(BUDGET_MS);
    expect(lag, `longest freeze of the page during the scan: ${lag} ms`).toBeLessThan(600);
    // The safety rules are unchanged by the speed work.
    await expect(status).toContainText(/Check every character/);
    await expect(page.getByTestId("vin-suggestion")).toHaveCount(0);
    await expect(page.getByTestId("vin-confirm-scan")).toBeVisible();
    await expect(page.getByTestId("vin-lookup")).toBeDisabled();
  });
});

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
        if (/does not pass the VIN check/.test((await status.textContent()) ?? "")) await expect(page.getByTestId("vin-retake-tips")).toContainText(/flash off/i);
      } else {
        await expect(status).toContainText(/couldn't find a 17-character VIN/);
        await expect(page.getByTestId("vin-retake-tips")).toContainText(/straight-on/i);
      }
    });
  }
});
