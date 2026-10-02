# Production rollback

## Scope

The consolidated application changes do not add a database migration, rewrite production data, change RLS or create supplier commitments. The primary rollback is therefore an application/deployment rollback, not a data rollback.

## Trigger conditions

Rollback or disable the affected integration when the deployed build cannot load saved planning safely, acknowledged edits cannot be reopened, frozen releases render different instructions, authorization scope is broader than intended, or purchasing evidence is shown as Ready without satisfying the verified contract.

An unavailable/denied Ursus readiness request is designed to remain **Unknown** and does not by itself corrupt planning. If the failure is operationally distracting, remove `VITE_URSUS_MAJOR_BASE_URL` from the affected deployment and redeploy; do not add a permissive fallback.

## Procedure

1. Stop promotion and manual distribution of newly generated packs. Identify the deployed commit and the last known-good deployment.
2. Preserve browser/network errors, affected campaign/release IDs and version-conflict details without copying access tokens or customer data into tickets.
3. Roll the application deployment back to the last known-good commit or revert the consolidation PR and deploy that revert. Do not reset shared planning/physical documents and do not re-seed verified floorplans.
4. Leave Ursus purchasing data and supplier workflows untouched. The Black Betty consumer is read-only; no compensating order or inventory transaction is expected.
5. If only the readiness integration is affected, remove its public base URL and redeploy. Confirm the panel reports Unknown/unavailable and that campaign planning/release behavior is unchanged.
6. Withdraw any incorrectly distributed manager pack through the named manual distribution owner. Existing frozen release records are not silently edited by an application rollback.

## Post-rollback verification

- Sign in with an authorized non-production account and reopen an existing staging campaign without saving over it.
- Confirm planning and physical document versions/load paths remain separate and a stale test write still fails in isolated staging.
- Confirm verified physical geometry was not replaced and an existing frozen release still displays its stored instructions.
- Confirm no BDL/LDB file was submitted and no supplier commitment was created as part of rollback testing.
- Record the reverted/deployed SHA, reason, affected scope and owner decision before resuming the pilot.

Production record repair, floorplan replacement, role changes or supplier communication require separate explicit authorization; they are not part of this rollback runbook.
