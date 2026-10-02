# Black Betty operational release gate

Current review: **2026-10-01**. Candidate branch: `codex/production-readiness-consolidation`, based on `main` at `b9f9b70` and reconciling PRs #10 and #11. The detailed September evidence remains in [the hardening record](HARDENING_RUN_2026-09-21.md); this document is the current decision surface.

## Current decision

**Conditional go for an isolated buyer pilot; no evidence supports an unconditional production rollout.** The candidate preserves the current BDL/LDB export work while adding durable planning, guarded floorplan editing, safe workbook replay, frozen manager releases, manager-pack recovery and read-only Ursus purchasing readiness.

No production data, schema, role, physical layout, supplier commitment, campaign release or deployment was changed during consolidation. A green mock-data suite is engineering evidence, not operational acceptance.

## Engineering gates

The candidate must pass all of the following on the final commit:

- ESLint, TypeScript, the complete Vitest suite and the Vite production build;
- the complete Playwright browser suite, with the secured shared-staging test explicitly reported as skipped unless authorized staging credentials are supplied;
- regression coverage for failed/retried persistence, stale shared versions, workbook replay/revision preservation, floorplan save/retry/navigation, frozen release output and manager-pack image recovery;
- purchasing-readiness contract checks against current Ursus `main` (`414a491dfe247f956fc3c8109bc50735ff36d5f2`): exact store scope, per-store source fingerprints, ledger version, reconciled status counts, calculation issues, 0–90 day confirmation freshness and `stock_writes: false`;
- preservation of the existing BDL/LDB purchase-order export implementation and tests.

The full result and any exclusions are recorded in the hardening record. Do not infer a pass from build output alone.

## Runtime boundaries

- Shared planning and physical reference documents retain separate optimistic versions and existing RLS. Stale writes fail instead of silently overwriting acknowledged work.
- Canonical display geometry is store-wide. Campaign planning does not own or silently replace verified physical layouts.
- A released manager pack reads its frozen execution projection. Legacy releases without a complete frozen projection fail closed instead of borrowing current draft data.
- Purchasing readiness is a separate authenticated, read-only Ursus query. Missing configuration, access, mappings, source identity, dated evidence or contract fields remains **Unknown**. It does not publish merchandising, write inventory or create/approve/dispatch a purchase order.
- BDL/LDB CSV generation remains an explicit user download from an already-created local order batch. It is not supplier submission or proof of acceptance.

## Acceptance checklist Codex cannot prove

Only these external/operational checks remain:

- [ ] Two authorized users complete the isolated staging scenario: user A saves, user B observes/reloads, a stale save is rejected, and no acknowledged work is lost.
- [ ] An authorized buyer reconciles at least one representative real-store workbook to source rows, SKUs, cases, placements, exceptions and resulting manager packs.
- [ ] Intended staging/production identities prove Black Betty session compatibility, Ursus CORS, purchasing pilot authorization and every required Black Betty-to-Ursus store mapping.
- [ ] A buyer and pilot-store manager approve a generated frozen pack for legibility and physical accuracy on the actual store floor; mutable map assets or the approved PDF are retained appropriately.
- [ ] Named operational owners approve the deployment, manual release/distribution process, superseded-pack withdrawal and rollback decision.

If any applicable item is incomplete, keep the deployment in staging or limit it to the explicitly accepted pilot scope. Do not substitute synthetic fixtures for these checks.

## Verification commands

Run with Supabase credentials empty for isolated synthetic validation:

```bash
npm ci
npm run lint
npm run typecheck
npm test
npm run build
E2E_LOCAL_TRANSPORT=0 npm run test:e2e
```

The two-user test requires an approved disposable staging campaign and the opt-in variables documented in the repository README. Never aim it at a production buyer campaign.

Rollback and post-rollback checks are documented in [PRODUCTION_ROLLBACK.md](PRODUCTION_ROLLBACK.md).
