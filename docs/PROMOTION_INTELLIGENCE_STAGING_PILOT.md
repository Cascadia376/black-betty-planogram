# Shared/live pilot readiness — 20 October 2026

Follow-up started from PR #13 commit `07a73bf`, after Jay's instruction to continue. This is an account of inspected resources and executed checks, not a claim that a cloud staging pilot ran.

## Actual resource discovery (read-only)

| Resource checked | Evidence | Result / impact |
| --- | --- | --- |
| Available Supabase projects | Authorized management list | Only `ursus_major`, `wobndqnfqtumbyxxtojl`, the existing production database. No isolated staging project was available. |
| Supabase branches | List for that project | Only default `main`, pointing to the same production project. No isolated development branch. |
| Production feature schema | SELECT-only catalog/document check | `black_betty_promotion_intelligence` absent; handoff trigger count 0. Planning/physical versions remain 26/313. No migrations were applied to inspect this. |
| Vercel project connected to repository ID 1342293670 | Project list | Only `black-betty-planogram`, `prj_4eJ4qosuDjGA9bz2MiRonzO07l0p`, under `ursus-majors-projects`. |
| Existing preview deployments | Latest 20 preview records | Pre-feature branches; newest is `dpl_EaAhKydJCH3vH6rqXJBE7LLAEAu2`, `codex/production-readiness-consolidation` at `e6839ef6b6a71fbc0fd9fd0680d5b2902969ebe2`. These are not PR #13 or evidence of an isolated promotion backend. |
| PR #13 feature deployment | Exact branch query | Zero deployments for `codex/promotion-intelligence`. Branch auto-deployment remains disabled. |
| Vercel environment configuration | Variable names/targets only, values not decrypted/logged | Five existing variables: VITE_SUPABASE_URL, VITE_SUPABASE_PUBLISHABLE_KEY (production targets), VITE_DATA_ADAPTER, VITE_SUPABASE_ANON_KEY, VITE_URSUS_MAJOR_BASE_URL (production/preview targets). No server-only SUPABASE_URL/SUPABASE_PUBLISHABLE_KEY or model gateway/model selection configuration for this feature. |
| Cloud checkout sessions/configuration | Environment-variable presence and target-repository env files | No existing pilot account credentials, model key or staging URL; only `.env.example`. Management connector authorization is not a pair of buyer sessions and was not used to mint credentials or widen access. |

Consequently **hosted function dispatch, actual two-user Supabase sessions and live model extraction remain unverified**. A preview label does not isolate its backing database. No synthetic test pass is substituted for those facts, and no request was sent to an obsolete preview and described as testing the new endpoint.

## Exact blocked actions and required approvals/resources

| Action | Target | Reason/status |
| --- | --- | --- |
| Initialize shared promotion storage/guard for a pilot | An explicitly approved isolated Supabase staging project/branch, not currently available | **Pending provisioning/approval; not attempted.** Need reviewed schema baseline and both additive PR migrations in that isolated target. Applying them to `wobndqnfqtumbyxxtojl` is prohibited by this assignment. |
| Serve and verify the new authenticated function | A staging deployment of PR #13 in a separately approved target/environment | **Pending deployment approval; not attempted.** No existing deployment contains this feature. Deployment was explicitly forbidden during this continuation. |
| Exercise two authorized users | Two existing authorized staging test identities plus a disposable staging campaign | **Pending supplied existing access; not attempted.** No account/session credentials are available; no accounts, persistent credentials or grants were created. |
| Run one bounded synthetic natural-language extraction | The approved hosted endpoint with server-only same-staging Supabase settings, approved AI_GATEWAY_API_KEY and PROMOTION_EXTRACTION_MODEL | **Pending approved configuration/access; not attempted.** Current Vercel metadata contains none of this feature's server/model settings. No gateway secret was extracted from another app. |

These are environment/authorization gaps, not automatic approval-review denials. No deployment, access expansion, production migration or persistent credential creation was attempted. The parent thread handles the separate Outlook/SharePoint OND evidence search.

## Independent verification completed

The saved cloud Docker service allowed a stronger isolated database test. `node scripts/test-promotion-postgres.mjs` launched its own PostgreSQL 17 container with **no external network, published ports, host mounts, persistent credentials or database volume**; synthetic authorization/planning fixtures and the actual two PR migrations were loaded only there. The container was removed in `finally` and a subsequent container query found none remaining.

**13 real PostgreSQL multi-session checks passed**, including both overlapping transaction orders:

1. Add transaction obtains the promotion row lock; concurrent revocation demonstrably waits with PostgreSQL `wait_event_type=Lock`. The other authorized session cannot see the uncommitted campaign. Add commits, then revocation completes.
2. Client reads APPROVED; another session stages a revocation; the prepared add demonstrably waits on that row lock. Revocation commits; add fails with approval changed; planning version and campaign count remain unchanged.
3. Stale planning and promotion versions change zero rows. A retry of an existing link retains one campaign; cross-user committed reads work. Inactive and anonymous fixture roles cannot read the inbox.

Engine: PostgreSQL 17.11, official image digest `postgres@sha256:2d2b8998d31037bf721cfdf764d76ba74171b4fab3431b7f72c27c56ddbdf9e3`. These are real PostgreSQL concurrency/row-policy checks against synthetic local identities, **not Supabase Auth, cloud staging, hosted routing or live extraction**. The original 32-check PostgreSQL/WASM suite also passes using the shared synthetic fixture file.

Additional server authorization tests exercise the production adapter against isolated HTTP fixtures: active buyer/admin, unrelated auth-user binding, anonymous sessions and user-editable metadata without an access row. They verify getUser and active access lookup use the caller's token. They do not claim live identity-provider verification.

The existing opt-in shared browser test now requires an explicit isolated Supabase URL and app target, refuses known production hosts/project, intercepts mismatched compiled Supabase requests before login/write, requires distinct users and checks the disposable campaign name before mutation. It does not provision users or campaigns. Default runs still skip it.

## Reviewable pilot sequence once authorized resources exist

1. Record the exact staging Supabase ref and app deployment SHA; verify they differ from production. Review/apply both migrations there. Confirm `handoff_protocol=1`, trigger installed and caller permissions unchanged. Use only approved synthetic fixtures and existing authorized test users.
2. First verify hosted dispatch without source data: GET `/api/promotion-extract` must return 405 JSON; unauthenticated POST must return 401; forged/unrelated/anonymous sessions must be rejected before model use. A 200 SPA HTML fallback is a failure.
3. Configure only server-side approved model settings. Make **one** bounded extraction request containing a synthetic SKU/reference and contradictory prices, November without exact dates, missing cost, an explicit Jeremy comment and an instruction-like quoted line. Check exact excerpts, preserved conflicts/gaps and no executable action. Do not log source/token/provider output or perform retries that incur unreviewed model calls.
4. With the same source, buyer A captures; buyer B reloads and sees it. Verify duplicate ingestion, buyer correction/history, rejection retention, stale inbox save, exact Product Master matching and insufficient-evidence behaviour. Choose a disposable campaign named `Synthetic pilot ...`, `Synthetic QA ...` or `Synthetic staging ...`.
5. Reproduce revoked approval between preflight and planning write, then both real overlapping transaction orders where permitted. Check no campaign/physical/release mutation after denial; reject stale planning and missing/inactive/ambiguous products.
6. Approve, add once and open the existing campaign editor. Retry/reopen the same link, including a simulated lost inbox acknowledgement, with one campaign product/campaign. Preserve the named synthetic records for review unless separately authorized retention/deletion controls apply; never reset shared snapshots or overwrite buyer campaigns.
7. Attach sanitized test results and retain the distinction between staging acceptance and production rollout. Production migration, merge and deployment remain separate approval steps.

The existing two-user browser configuration also requires `E2E_ALLOW_SHARED_TEST_WRITES=1`, `E2E_BASE_URL`, `E2E_SHARED_SUPABASE_URL`, both existing test-user credentials and `E2E_SHARED_CAMPAIGN_ID`. Never commit secret values, browser storageState, traces or account credentials. Shared-test traces/video are disabled to avoid persisting credential-bearing traffic.
