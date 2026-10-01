# Ursus Major purchasing readiness consumer

Black Betty reads requirement-level purchasing and dated stock evidence separately from merchandising publication. The consumer does not create orders, modify inventory, change purchasing policy or write the merchandising plan.

## Verified contract

The consolidation was checked against Ursus `main` at `414a491dfe247f956fc3c8109bc50735ff36d5f2` (2026-09-29). Black Betty calls authenticated `POST /api/purchasing/readiness` with an exact campaign ID, canonical numeric store IDs and an explicit confirmation-freshness rule from 0 through 90 days.

The `purchasing-readiness-v1` response is accepted only when it includes:

- the exact requested campaign/store scope and one current source fingerprint per requested store;
- requirement source identities that match their store fingerprint;
- a non-negative purchasing ledger version and reconciled Ready/At risk/Critical/Unknown counts;
- current review facts, requirement dates, separated order lifecycle facts and `stock_writes: false`;
- explicit calculation issues when dated routine evidence could not be reused.

Malformed, cross-scope, duplicate, mixed-version or internally inconsistent responses fail closed. A row cannot be Ready without a current, conflict-free `target_stock` review, a dated target, usable stock evidence, eligible incoming evidence and zero uncovered units. Issued, dispatched, confirmed and received facts remain distinct; none alone turns readiness green.

## Authentication and transport

The browser uses the existing Supabase session and `VITE_URSUS_MAJOR_BASE_URL`. The bearer is sent only to a configured HTTPS origin (localhost HTTP is allowed for development), with cookies omitted and redirects refused. Service keys, role overrides, guessed endpoints and permission expansion are not used. Ursus remains responsible for current pilot and store authorization on every request.

An unmapped store, missing session/configuration, denied access, stale calculation, unavailable API or schema drift is shown as **Unknown**. Changing the selected store or freshness hides the previous result until a new scoped response succeeds.

## Deployment boundary

Deploy a compatible, authorized Ursus endpoint before enabling the Black Betty URL. Validate session issuer compatibility, CORS and canonical store coverage in the intended environment. Removing `VITE_URSUS_MAJOR_BASE_URL` and redeploying safely disables the read-only panel without changing saved merchandising work.

Automated tests cover mapping, request limits, bearer transport, scope and identity reconciliation, count reconciliation, fail-closed Ready parsing, calculation-issue display and denied/unavailable access. Real authenticated connectivity remains an operational acceptance item in [the production gate](PRODUCTION_GATE.md).
