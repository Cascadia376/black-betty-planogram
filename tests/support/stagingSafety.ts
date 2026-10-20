/** Guard for opt-in shared browser tests, not an application auth bypass. */
export function sharedStagingTarget(env: Record<string, string | undefined>): { appOrigin: string; supabaseOrigin: string } | undefined {
  if (env.E2E_ALLOW_SHARED_TEST_WRITES !== "1") return undefined;
  for (const key of ["E2E_BASE_URL", "E2E_SHARED_SUPABASE_URL", "E2E_SHARED_CAMPAIGN_ID", "E2E_JEREMY_EMAIL", "E2E_JEREMY_PASSWORD", "E2E_CHERIE_EMAIL", "E2E_CHERIE_PASSWORD"]) {
    if (!env[key]?.trim()) throw new Error(`Shared staging pilot requires ${key}; no shared writes authorized by incomplete configuration.`);
  }
  const app = new URL(env.E2E_BASE_URL!), database = new URL(env.E2E_SHARED_SUPABASE_URL!);
  const productionHosts = new Set(["black-betty-planogram.vercel.app", "black-betty-planogram-ursus-majors-projects.vercel.app", "black-betty-planogram-git-main-ursus-majors-projects.vercel.app"]);
  if (productionHosts.has(app.hostname) || app.username || app.password || (app.protocol !== "https:" && !(app.protocol === "http:" && app.hostname === "127.0.0.1"))) throw new Error("Shared pilot requires an explicitly isolated HTTPS staging app or cloud loopback; production app targets are prohibited.");
  if (database.protocol !== "https:" || !/^[a-z0-9]+\.supabase\.co$/.test(database.hostname) || database.username || database.password || database.pathname !== "/" || database.search || database.hash || database.hostname === "wobndqnfqtumbyxxtojl.supabase.co") throw new Error("Shared pilot requires an isolated Supabase project URL; the known production project is prohibited.");
  if (env.E2E_JEREMY_EMAIL!.trim().toLowerCase() === env.E2E_CHERIE_EMAIL!.trim().toLowerCase()) throw new Error("Shared pilot requires two distinct existing authorized test identities.");
  return { appOrigin: app.origin, supabaseOrigin: database.origin };
}
export function allowSharedPilotRequest(url: string, expectedSupabaseOrigin: string): boolean {
  const target = new URL(url);
  return !target.hostname.endsWith(".supabase.co") || target.origin === expectedSupabaseOrigin;
}
export function assertDisposablePilotCampaign(name: string): void {
  if (!/^Synthetic (?:pilot|QA|staging)\b/i.test(name.trim())) throw new Error("Shared pilot refuses to modify this campaign. Provision an approved disposable campaign named Synthetic pilot / QA / staging first.");
}
