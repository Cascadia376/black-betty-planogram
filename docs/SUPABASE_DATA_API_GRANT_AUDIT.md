# Supabase explicit Data API grant audit — 20 October 2026

PR #13 was audited offline against the announced default-grant change. Two narrow migration-source corrections and a fresh/reset regression are included. No hosted permissions, migrations, credentials, deployment or application code changed in this audit; staging approval remains pending.

## Official scope verified

Supabase's [official changelog](https://supabase.com/changelog/45329-breaking-change-tables-not-exposed-to-data-and-graphql-api-automatically) schedules the new default for existing projects on **30 October 2026**; new-project rollout began **30 May 2026**. Newly created `public` tables require explicit role privileges. Existing tables retain their grants. The notice also describes removing automatic sequence privileges; this application uses UUID/boolean keys, so it needs no new sequence grant.

Grants allow access to an object; RLS restricts permitted rows. A policy alone cannot repair a missing object privilege. See [Supabase Data API security](https://supabase.com/docs/guides/api/securing-your-api).

The [migration guide](https://supabase.com/docs/guides/deployment/database-migrations) and [branch troubleshooting guide](https://supabase.com/docs/guides/deployment/branching/troubleshooting) describe replaying migrations during resets. A replay recreates tables, so its access must be declared in source rather than inherited from an older hosted database.

## Repository access contract

| Object | Explicit caller privileges after replay | Row/security boundary |
| --- | --- | --- |
| `black_betty_user_access` | authenticated SELECT/INSERT/UPDATE/DELETE | Existing policies allow own-record reads and admin access management; no anonymous table privileges |
| `black_betty_planning_snapshot` | authenticated SELECT and UPDATE(planning); service_role SELECT for the established Ursus server reader | Existing buyer/admin policies and server-maintained version/audit columns; no client table-wide UPDATE or INSERT/DELETE |
| `black_betty_physical_snapshot` | authenticated SELECT and UPDATE(physical) | Existing buyer/admin policies; version/audit columns protected; no client INSERT/DELETE |
| `black_betty_promotion_intelligence` | authenticated SELECT and UPDATE(workspace) | Buyer/admin policies; no anonymous or unused service_role access; version/audit/handoff marker protected |

The new guard remains SECURITY INVOKER in `private`, with authenticated execution and existing private-schema access. No broad `GRANT ALL`, schema-wide table grant, RLS disablement, public policy or default-privilege restoration was added to application migrations. Whole-table SELECT includes the non-secret handoff capability marker; UPDATE remains column-limited.

## Findings and source corrections

1. **No missing buyer/browser grants.** The access, planning, physical and promotion migrations already declare role grants and RLS. The physical-boundary migration narrows planning/physical UPDATE privileges to their respective document columns.
2. **Fresh Ursus server read depended on legacy defaults.** Read-only inspection of the unchanged related Ursus checkout (`fe8ed0ea12c6bcb2629bc24eed3458ce8e8c2d79`) established the chain `PurchasingService` → `PurchasingSource.planning()` → repository client → `SupabaseService`, which uses the configured server service-role key. `black_betty_planning_snapshot` had no explicit service-role SELECT grant. The new unapplied `20261020062604_explicit_data_api_privileges.sql` grants **SELECT on that table only**. This declares the existing read integration for fresh/reset databases; it adds no server write grant, buyer role or credential.
3. **New inbox ACL differed under legacy defaults.** Its original revoke covered PUBLIC, anon and authenticated, leaving the unused automatically granted service role in older-default databases. The still-unapplied inbox migration now also revokes service_role before adding the required authenticated privileges. This feature uses caller JWTs and needs no service-role inbox access.

Historical planning service-role privileges in older databases are not bulk-cleaned by the new read grant. Other objects—including the externally owned Product Master—remain under their existing owners' permission contracts. The regression supplies an explicitly granted Product Master fixture rather than pretending this repository provisions the full Ursus schema.

## Fresh/reset regression and results

Run with the isolated PGlite dependency already documented for database tests:

```bash
PGLITE_MODULE=/tmp/betty-sql/node_modules/@electric-sql/pglite/dist/index.js node scripts/test-migration-grants.mjs
```

The script creates a separate in-memory PostgreSQL/WASM instance for each of three profiles:

- legacy automatic table/sequence grants;
- fresh database with those defaults explicitly revoked;
- another empty reset/replay with the revoked defaults.

All **nine actual repository migrations** replay in each instance, with synthetic platform/auth/Product Master fixtures. A sentinel verifies that automatic grants are truly absent in the fresh profiles and that RLS without a table grant produces SQLSTATE 42501. Assertions inspect resulting ACL/RLS metadata and perform actual role-scoped reads, document-column writes, denial of audit/marker mutations, buyer self-promotion denial, inactive/unrelated-user filtering, the real handoff trigger and the read-only server integration.

**Before correction:** all three profiles failed: the legacy profile exposed the inbox to its unused service role, while fresh/reset profiles lacked the Ursus server read.

**After correction:** **155 checks passed, zero profile failures.** Existing **32** database regressions and **13** genuine PostgreSQL overlapping-session checks also pass. Full lint/typecheck/unit/build results and raw sanitized logs are in [the audit evidence](evidence/supabase-data-api-grant-audit.txt).

These exercise PostgreSQL privilege/RLS behaviour offline. They do not claim hosted PostgREST schema-cache, full Supabase Auth or preview acceptance. No hosted project was queried or altered for this audit. No GitHub Actions was invoked.

## Review and rollback

Review the third additive migration with the inbox and guard migrations before any authorized staging application. The edited inbox source is an unapplied PR migration; applied historical migrations were not rewritten. Ordinary code rollback does not require touching hosted permissions or correspondence. For an approved migration rollback, first record prior per-object ACLs: an unconditional server-read revoke could remove pre-existing integration access. Do not restore global automatic grants or grant unrelated tables merely to suppress a permission error.
