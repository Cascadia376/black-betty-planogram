# Shared/live pilot readiness — 20 October 2026

## Authorized staging preparation follow-up

Jay subsequently approved an isolated live staging pilot. This supersedes the earlier deployment prohibition **for staging only**. Production migrations, merge and production deployment remain prohibited. Added charges, credential generation/transmission/configuration, expanded access and security-setting changes still require explicit action-time approval. No hosted resource has yet been created or changed.

Read-only account discovery confirmed:

- Supabase organization `Flight376` (`usegafwbavwmamcvgkhp`), Pro; its only visible project remains production Ursus. An explicit organization-choice question is pending before requesting the organization-specific create-project quote. This is required by the Supabase cost tool; the organization is not assumed from visibility.
- Vercel team `ursus-majors-projects` (`team_gWaFZIn7wSnICibe3xkThST9`); only the existing Black Betty project matches. Its protection is enabled for all deployments except custom domains. The team response does not expose its plan, credits or spending cap. A read-only billing query returned usage charges, which does not establish the incremental cost of this pilot.
- Proposed new targets: a dedicated Supabase project and a separate Vercel project, each named `black-betty-promotion-pilot`, subject to availability and the specific approvals. Region and organization must be confirmed in the creation request. No production branch cloning, environment copying or Git auto-deployment is proposed.

Published Supabase Micro compute pricing is $0.01344/hour (about $10/month), billed for each started hour; paid organizations cannot launch free Nano instances. Existing organization compute credits are shared and their availability for this new project is unverified. This is **published reference pricing, not an account-specific quote or an approved charge**. [Supabase compute pricing](https://supabase.com/docs/guides/platform/manage-your-usage/compute). Vercel build/function usage and the selected model may also incur charges; plan allowance, model selection and a bounded budget require confirmation. [Vercel pricing](https://vercel.com/docs/pricing).

Independent preparation is now concrete:

1. `node scripts/prepare-promotion-pilot.mjs <approved-isolated-ref> <review.sql>` generates a review artifact only; it has no network, credential or SQL-execution capability. It rejects the production ref and refuses to overwrite its output file.
2. The artifact reuses the six historical schema/policy migrations while **omitting both historical company access seeding and historical snapshot contents**. It starts empty planning/physical collections, creates a staging-only two-product `PILOT-*` contract with buyer/admin SELECT RLS, and includes all three PR migrations. The third is the reviewed explicit planning-reader grant. It provisions no identities or access rows.
3. A transaction guard refuses existing Black Betty or Product Master tables. This is an additional empty-target check, **not proof of project identity**. Verify project ref/name through the management API immediately before any authorized execution. Never run the complete historical migration directory with `db push` against the pilot; its original seeds are unsuitable here. The artifact does not mark migration history or establish parity with the whole Ursus schema.
4. `PGLITE_MODULE=<installed PGlite entry> node scripts/test-promotion-pilot-bootstrap.mjs` passed **15 offline checks** against PostgreSQL/WASM: production/invalid-ref refusal, omitted company grants, zero users/access/campaigns/releases/layout contents, installed handoff marker, synthetic product records/RLS, and refusal to replay over existing tables. No hosted Auth or model verification is implied.

The next dependent actions remain pending, **not denied and not attempted**: choose the Supabase organization, obtain and confirm its quote, approve resource-created credentials and their staging-only configuration, approve two disposable test identities/access rows and any protected-preview automation credential, and approve the model configuration and bounded call cost. Credentials must be entered through approved secure configuration, never pasted into chat, committed or logged. Keep preview SSO protection enabled; any bypass-token generation requires its own approval. Once these are resolved, apply the reviewed artifact only to the verified new target and run the hosted sequence below.

The earlier readiness follow-up started from PR #13 commit `07a73bf`, after Jay's instruction to continue. Its inspected resources and executed checks are retained below; the authorization update above governs current staging work. This is not a claim that a cloud staging pilot ran.

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
| Initialize shared promotion storage/guard for a pilot | An explicitly approved isolated Supabase staging project/branch, not currently available | **Pending provisioning/approval; not attempted.** Need reviewed schema baseline and all three additive PR migrations in that isolated target. Applying them to `wobndqnfqtumbyxxtojl` is prohibited by this assignment. |
| Serve and verify the new authenticated function | A staging deployment of PR #13 in an isolated target/environment | **Staging deployment authorized in the subsequent follow-up; pending target/cost/credential approvals; not attempted.** No existing deployment contains this feature. |
| Exercise two authorized users | Two authorized staging test identities plus a disposable staging campaign | **Pending supplied existing access or explicit test-identity creation approval; not attempted.** No account/session credentials are available; no accounts, persistent credentials or grants were created. |
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

1. Record the exact staging Supabase ref and app deployment SHA; verify they differ from production. Review/apply the three PR migrations there, including the explicit Ursus planning-read grant. Confirm `handoff_protocol=1`, trigger installed and caller permissions unchanged. Use only approved synthetic fixtures and existing authorized test users.
2. First verify hosted dispatch without source data: GET `/api/promotion-extract` must return 405 JSON; unauthenticated POST must return 401; forged/unrelated/anonymous sessions must be rejected before model use. A 200 SPA HTML fallback is a failure.
3. Configure only server-side approved model settings. Make **one** bounded extraction request containing a synthetic SKU/reference and contradictory prices, November without exact dates, missing cost, an explicit Jeremy comment and an instruction-like quoted line. Check exact excerpts, preserved conflicts/gaps and no executable action. Do not log source/token/provider output or perform retries that incur unreviewed model calls.
4. With the same source, buyer A captures; buyer B reloads and sees it. Verify duplicate ingestion, buyer correction/history, rejection retention, stale inbox save, exact Product Master matching and insufficient-evidence behaviour. Choose a disposable campaign named `Synthetic pilot ...`, `Synthetic QA ...` or `Synthetic staging ...`.
5. Reproduce revoked approval between preflight and planning write, then both real overlapping transaction orders where permitted. Check no campaign/physical/release mutation after denial; reject stale planning and missing/inactive/ambiguous products.
6. Approve, add once and open the existing campaign editor. Retry/reopen the same link, including a simulated lost inbox acknowledgement, with one campaign product/campaign. Preserve the named synthetic records for review unless separately authorized retention/deletion controls apply; never reset shared snapshots or overwrite buyer campaigns.
7. Attach sanitized test results and retain the distinction between staging acceptance and production rollout. Production migration, merge and deployment remain separate approval steps.

The existing two-user browser configuration also requires `E2E_ALLOW_SHARED_TEST_WRITES=1`, `E2E_BASE_URL`, `E2E_SHARED_SUPABASE_URL`, both existing test-user credentials and `E2E_SHARED_CAMPAIGN_ID`. Never commit secret values, browser storageState, traces or account credentials. Shared-test traces/video are disabled to avoid persisting credential-bearing traffic.

The subsequent [Data API grant audit](SUPABASE_DATA_API_GRANT_AUDIT.md) replayed all nine repository migrations in legacy, fresh and reset profiles. Its source-only fixes and 155 passing offline checks do not satisfy the pending hosted staging gate.
