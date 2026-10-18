import { defineConfig, devices } from "@playwright/test";
export default defineConfig({
  testDir: "tests/browser",
  fullyParallel: false,
  workers: 1,
  timeout: 45000,
  webServer: {
    command: "node --import tsx scripts/e2e-server.ts",
    url: "http://localhost:41937/api/health",
    reuseExistingServer: false,
    timeout: 60000,
  },
  use: {
    baseURL: "http://localhost:41937",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  reporter: [["list"], ["html", { open: "never" }]],
});
