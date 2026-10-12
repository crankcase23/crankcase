import { defineConfig, devices } from "@playwright/test";

// Transition rehearsal config: NO web server is started. APP_URL points at an already-running app (the OLD main build or the
// NEW build), PHASE selects which part of tests/transition/transition.spec.ts runs. Driven by scripts/release/transition-rehearsal.sh.
export default defineConfig({
  testDir: "./",
  timeout: 120_000,
  workers: 1,
  fullyParallel: false,
  retries: 0,
  reporter: [["list"]],
  use: { baseURL: process.env.APP_URL ?? "http://localhost:3201", trace: "off" },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"], launchOptions: { executablePath: "/opt/pw-browsers/chromium" } } }],
});
