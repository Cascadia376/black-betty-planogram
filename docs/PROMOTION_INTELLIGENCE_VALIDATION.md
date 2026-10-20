# Promotion Intelligence validation — 20 October 2026

Executed in the saved Linux cloud environment, target checkout `/workspace/black-betty-planogram`, based on main `ee1c26973be8870ce3b9db3c1f1923cce5d13d6e`. Runtime Node **24.19.0**, matching Vercel's current configured major (the older README recommends Node 22). Existing lockfile retained; no application dependency upgrades.

| Check | Result |
| --- | --- |
| `npm run lint` | Pass; no errors/warnings |
| `npm run typecheck` | Pass; includes the new server/function modules |
| `npm test` | **286 passed, 53 files** |
| `npm run build` | Pass; 1,849 modules; existing large source-backed app bundle remains ~4.14 MB uncompressed / 630.71 kB gzip |
| Full Playwright suite | **65 passed, 1 skipped**, 66 discovered, system Chromium, direct loopback networking |
| New Promotion Intelligence browser cases | **3 passed**: end-to-end buyer workflow/retry recovery at 1440×900 and 1280×720; duplicate capture, contradictory evidence, reviewed association and deletion |
| Isolated PostgreSQL/PGlite checks | **32 passed**: grants/RLS denials and buyer/admin access, audit stamps/version, stale update, client column restrictions document constraints and atomic handoff/revocation regressions |
| Real PostgreSQL overlapping-session checks | **13 passed**, synthetic isolated Docker database; both lock/revocation orders verified and container removed |
| `git diff --check` | Pass |

[Full command evidence](evidence/promotion-intelligence-validation.txt). Reviewed synthetic screenshots: [1280 px laptop](evidence/promotion-intelligence-1280.png), [1440 px desktop](evidence/promotion-intelligence-1440.png). The screenshot shows a completed handoff with original supplier claims, current catalog description, buyer decision and missing financial evidence. No production correspondence was captured in these images.

## Focused coverage

- Normalized source fingerprint/replay; identical content in differing supplier/date contexts remains separate.
- Missing and conflicting commercial values; literal November does not invent dates; misleading/unsupported model output rejected; source instructions never get an executable/tool path.
- Server denial before model execution, authorization outages, request/output schemas, body limits, sanitized model failures; server response validated against the exact client extraction schema.
- Exact Product Master matches, inactive/pending/ambiguous/unmatched cases; saved approval and refreshed authoritative lookup checked again by shared campaign handoff.
- Buyer corrections preserve original claims and before/after history; sparse correction maps can be saved without inventing absent terms.
- Duplicate candidate review and explicit evidence association; no automatic same-SKU offer merge; source redaction and replay tombstones.
- Insufficient Evidence for missing observations/priorities/classification; deterministic gross margin, observed lift fixture and weights; invalid duplicate/scope observations rejected.
- Existing draft/new draft handoff through current campaign commands; retry recovery and duplicate membership protection; blocked unapproved/inactive/non-draft/invalid-date attempts.
- Browser simulation of campaign save success followed by inbox-save failure, then safe retry into the same campaign; local persistence rollback, corrupt document rejection and shared stale/access-denied save errors.
- Existing full production-readiness, floorplan editing, imports, frozen releases, purchasing-readiness and order export regressions preserved. A new legacy-release-shape fixture verifies that the actual observed missing executionData shape fails closed.

## Limits and excluded live claims

All automated application/database fixtures are synthetic. PGlite tests create a disposable local authorization baseline and do not prove the exact inherited production helper/trigger or user session behaviour. The existing secured two-user staging test was intentionally skipped because no disposable authorized staging campaign and two test-user credentials were supplied. No shared buyer campaign writes were used as tests.

No approved model key/configuration was available in this checkout: the authenticated endpoint was exercised with deterministic injected model fixtures, while browser tests used the visibly labelled literal demo adapter. Live natural-language quality, gateway configuration/provider data handling, Vercel-hosted function dispatch and real shared multi-session writes need an authorized staging pilot. Both additive migrations were generated and locally tested, **not applied to production**.

Real read-only OND findings are in `OND_2026_RELEASE_VERIFICATION.md`. Those records include a legacy release without frozen executionData; neither synthetic test success nor Vercel READY establishes delivery, acknowledgement or physical execution.

The Playwright download CDN returned HTTP 403. Existing `/usr/bin/chromium` was used via `E2E_CHROMIUM_EXECUTABLE_PATH`; no desktop browser or user's workstation was used. The current Supabase CLI package could not initialize its read-only home-directory config, so the official v2.75.0 release binary generated the migration successfully; no cloud database CLI mutation was run.

Review refinements caught and fixed an extra extraction-response key and a sparse Zod correction-map validation issue. Final results above are from the corrected source. Historical incomplete runs are not counted as passes.

No merge/deployment was performed. Feature-branch Vercel Git deployment is disabled in `vercel.json`; commits use `[skip ci]` to avoid GitHub Actions. Deployment, production migration and live model use require separate approval and configuration.

## Approval-race follow-up validation

The final follow-up adds an unapplied planning-update trigger that locks and revalidates approval in the planning transaction; a read-only capability marker makes shared clients fail closed if this guard is absent. The isolated database suite now has **32 passing checks**, including a counterfactual reproduction of the former race in a rolled-back disposable transaction and rejection by the actual migration. No production schema/data was changed. Full lint/typecheck/unit/build checks and relevant browser cases were rerun; see `evidence/promotion-handoff-race-validation.txt`. The prior full browser run remains 65 pass/1 secured-staging skip; follow-up browser evidence is reported separately rather than implying a live shared race test.

## Continued staging discovery and concurrency verification

See [the exact resource/blocker record](PROMOTION_INTELLIGENCE_STAGING_PILOT.md). No isolated Supabase branch/project, PR #13 deployment, configured model gateway or existing two-user staging sessions were available. Production was inspected read-only and still lacks the new feature table/trigger; document versions remain 26/313. No live extraction or hosted-function acceptance is claimed.

Independent follow-up passed lint/typecheck/build, **286 unit/integration tests in 53 files**, the original **32** PostgreSQL/WASM checks, **13** genuine PostgreSQL 17 overlapping-session checks, and relevant browser cases **3 passed / 1 secured-staging skip**. Additional HTTP-fixture authorization coverage and shared-test production-target/disposable-campaign safeguards are included. [Continued verification logs](evidence/promotion-staging-readiness-validation.txt) distinguish these results from cloud staging.

The OND report now incorporates the parent's recovered distribution email, Nanoose/Courtenay draft PDF provenance, Nanoose version/hash metadata, PO-revision caveat and five matching master/PDF/persisted allocation samples. No source document or production campaign was edited.
