import { test as base } from "@playwright/test";
declare const process: { env: Record<string, string | undefined> };

/** Optional local-only transport for managed hosts whose Chromium cannot open loopback sockets. */
export const test = base.extend({
  page: async ({ page, request, baseURL }, runTest) => {
    if (process.env.E2E_LOCAL_TRANSPORT === "1") {
      if (!baseURL || new URL(baseURL).hostname !== "127.0.0.1") throw new Error("Local transport requires an explicit loopback test server.");
      await page.route(`${baseURL}/**`, async (route) => {
        const response = await request.fetch(route.request(), { maxRetries: 2 });
        await route.fulfill({ response });
      });
    }
    try { await runTest(page); }
    finally {
      // Finish routed asset requests before Playwright disposes the request client.
      await page.unrouteAll({ behavior: "wait" });
    }
  },
});
