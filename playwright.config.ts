import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 60_000,
  expect: {
    timeout: 5_000,
  },
  use: {
    baseURL: "http://localhost:5173",
    trace: "on-first-retry",
    launchOptions: { args: ["--no-proxy-server"] },
  },
  webServer: {
    command: "npx vite --host ::",
    reuseExistingServer: !process.env.CI,
    url: "http://localhost:5173",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
