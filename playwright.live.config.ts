import { defineConfig } from "@playwright/test";

// Explicit opt-in public-demo checks. No local server, database URL, SQL, or
// test-database reset is used. Each test creates its own fictional workspace.
export default defineConfig({
  testDir: "tests/live",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 240000,
  expect: { timeout: 30000 },
  outputDir: "test-results/live",
  use: {
    baseURL: "https://ping-davidg214.onrender.com",
    browserName: "chromium",
    actionTimeout: 30000,
    navigationTimeout: 90000,
    screenshot: "only-on-failure",
    // Do not record session cookies or network payloads in trace artifacts.
    trace: "off",
  },
  projects: [
    { name: "live-desktop", use: { viewport: { width: 1440, height: 1000 } } },
    { name: "live-tablet", use: { viewport: { width: 1024, height: 768 } } },
  ],
  reporter: [["list"]],
});
