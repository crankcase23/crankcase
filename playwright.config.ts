import { defineConfig, devices } from "@playwright/test";

// Smoke-test config. Uses the container's pre-installed Chromium (see repo
// environment notes) instead of downloading a Playwright-managed browser.
const PORT = 3100;

export default defineConfig({
  testDir: "./tests/e2e",
  // Warms the routes the slow specs depend on before the first test (cold `next dev` compile, build 104-AO). CC_E2E_WARM=0 skips it.
  globalSetup: "./tests/e2e/global-setup.ts",
  timeout: 60_000,
  fullyParallel: true,
  retries: 0,
  reporter: [["list"]],
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "retain-on-failure",
  },
  webServer: {
    command: `npm run dev -- --port ${PORT}`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        launchOptions: {
          executablePath: "/opt/pw-browsers/chromium",
        },
      },
    },
  ],
});
