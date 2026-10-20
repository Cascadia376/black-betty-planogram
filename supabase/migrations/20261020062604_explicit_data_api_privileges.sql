-- Explicit per-object access for fresh databases and preview/reset replays when
-- automatic public-table Data API grants are disabled. Reviewed source only;
-- do not apply to a hosted environment without the deployment/migration approval.
-- Official change: https://supabase.com/changelog/45329-breaking-change-tables-not-exposed-to-data-and-graphql-api-automatically
--
-- Ursus PurchasingSource.planning() uses its established server service-role
-- client for a read-only planning query. It must not depend on historical
-- automatic grants. The browser and extraction server continue using caller JWTs.
grant select on public.black_betty_planning_snapshot to service_role;
