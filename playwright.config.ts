import { defineConfig, devices } from "@playwright/test";

// Managed Windows hosts can launch Chromium but deny its direct loopback
// sockets. Route browser requests through Playwright's Node request client by
// default; set E2E_LOCAL_TRANSPORT=0 to exercise direct browser networking.
process.env.E2E_LOCAL_TRANSPORT ??= "1";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  workers: process.env.E2E_LOCAL_TRANSPORT === "1" ? 1 : 4,
  timeout: 120_000,
  expect: {
    timeout: 5_000,
  },
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://127.0.0.1:5173",
    trace: "on-first-retry",
    launchOptions: { args: ["--no-proxy-server"] },
  },
  webServer: process.env.E2E_EXTERNAL_SERVER ? undefined : {
    command: "npx vite --host 127.0.0.1 --port 5173 --strictPort",
    reuseExistingServer: true,
    url: "http://127.0.0.1:5173",
    timeout: 120_000,
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
