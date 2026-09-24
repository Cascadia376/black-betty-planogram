# Black Betty operational release gate

Current review: **2026-09-21**. This replaces the 17 September gate as the current readiness document. Earlier test counts, empty-database assumptions and admin-only physical-write claims are historical, not current instructions.

## Current decision

**Conditional go for an isolated buyer pilot after the checks below; not an unconditional production rollout.** The hardening branch implements a durable planning-to-manager-pack path. The default test suite exercises isolated mock state, not real authenticated store execution.

The run did not publish a production campaign, migrate a schema, reset data, change access or promote a deployment. The engineering PR must be reviewed and its checks inspected before deployment. Exact automated results belong in [the hardening record](HARDENING_RUN_2026-09-21.md), not copied across documents.

## Evidence established

- Fresh audit of main `f6034badac4d89b5286d08a76ff316283c68637c`, code, repository history, the unrelated open sandbox PR and Vercel deployment metadata.
- Read-only inspection of shared document versions and aggregate counts: planning version 22 with 8 campaigns, 6 imports and 286 planning assignments; physical version 313 with 13 store layouts and 301 area records. These are all-record counts, not claims that every area is active/verified.
- Existing buyer/admin SELECT/UPDATE policies on shared planning and physical documents and active access-role counts. Policy inspection is not a substitute for secured browser authorization tests.
- Local regression checks for rollback/reopen, concurrency, no-op replay, changed workbook preservation, released-copy stability, publish blockers, mouse/touch/keyboard floorplan editing and printable store instructions.
- Vercel production main was READY at the audited SHA. Engineering branch previews are not production promotions.

## Conditions before normal buyer use

| Condition | Owner | When | Evidence required | If unmet |
| --- | --- | --- | --- | --- |
| Review/merge the engineering PR and pass all CI checks | Engineering/repository maintainer | Before promotion | Reviewed diff and passing lint/type/unit/build/browser jobs | Leave production on the existing revision |
| Confirm target environment and access scope | System owner | Before authenticated pilot | Intended buyer/admin accounts and isolated staging project/campaign identified | Do not run synthetic write tests against production |
| Exercise two authenticated users end-to-end | Engineering + authorized buyers | In staging before rollout | A saves; B reloads; stale B save is rejected; no silent loss; reopen verified | Shared readiness remains unverified |
| Reconcile a real reviewed workbook to output | Buyer/merchandising owner | Before first operational release | Representative source-row checks across stores, exact SKUs, cases, placements, exceptions and months | Do not distribute that plan as approved |
| Approve a manager pack on the floor | Buyer + pilot store manager | Before broad distribution | Legible map/location, dates, products, cases/facings, signage and store notes; PDF checked | Revise the pack before rollout |
| Confirm manual release/distribution ownership | Merchandising/Operations | Before store handoff | Named person prints/shares the correct release and withdraws superseded copies | Do not imply automatic delivery or store-system access |

No target dates, approval owners' names or sign-offs were invented during this run.

## Safe verification commands

Use a local build with all Supabase URL/key variables empty for default synthetic tests:

```bash
npm ci
npm run lint
npm run typecheck
npm test
npm run build
E2E_LOCAL_TRANSPORT=0 npm run test:e2e
```

The opt-in collaboration browser test requires an **isolated staging target** with disposable campaign data and the following secured variables:

```text
E2E_ALLOW_SHARED_TEST_WRITES=1
E2E_BASE_URL=<staging application URL>
E2E_EXTERNAL_SERVER=1
E2E_JEREMY_EMAIL
E2E_JEREMY_PASSWORD
E2E_CHERIE_EMAIL
E2E_CHERIE_PASSWORD
E2E_SHARED_CAMPAIGN_ID=<disposable staging campaign ID>
```

Then run `npx playwright test tests/e2e/shared-supabase.spec.ts`. Credentials and URLs with tokens do not belong in source or screenshots. Account variable names are historical test labels, not a requirement to use production accounts. Do not run old bootstrap SQL or production-write verification scripts as part of a generic CI check.

## Not included in this gate

Store-scoped manager authorization, automatic messaging, purchasing/inbound integrations, executed/verified status workflows and performance measurement remain separate work. A released PDF is a useful operational handoff, not proof that a store executed the plan. Catalog freshness at publish and immutable image-asset retention require follow-up. Campaign-specific display geometry requires an explicit new ownership model; current physical edits are store-wide.
