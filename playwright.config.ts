import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  workers: process.env.E2E_LOCAL_TRANSPORT === "1" ? 1 : 4,
  timeout: 60_000,
  expect: {
    timeout: 5_000,
  },
  use: {
    baseURL: "http://127.0.0.1:5173",
    trace: "on-first-retry",
    launchOptions: { args: ["--no-proxy-server"] },
  },
  webServer: process.env.E2E_EXTERNAL_SERVER ? undefined : {
    command: "npx vite --host=127.0.0.1 --port=5173 --strictPort",
    reuseExistingServer: true,
    url: "http://127.0.0.1:5173",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
