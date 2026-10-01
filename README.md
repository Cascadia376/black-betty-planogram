# Black Betty

Merchandising planning and store instructions for Cascadia Liquor. Black Betty is a standalone React/Vite application designed to work alongside Ursus Major. It uses the existing Product Master and authenticated Supabase planning/physical reference documents when configured; without those credentials it runs an explicitly labelled local demo.

**Current scope and release evidence:** [21 September hardening record](docs/HARDENING_RUN_2026-09-21.md) and [production gate](docs/PRODUCTION_GATE.md). Older phase documents describe historical decisions, not the current deployment or readiness status.

## Buyer workflow

1. **Create a campaign.** Enter a name, owner, type and valid start/end dates. Save and reopen the same campaign rather than treating it as a temporary wizard.
2. **Select products.** Search Product Master, paste SKUs or review a supported workbook. Known products retain authoritative identities. Pending/inactive/unmatched products stay visible and must be resolved before release.
3. **Build displays.** Define the merchandising concept, products, signage, execution notes, minimum facings and default case quantities. Shelf-supported products do not require a promotional floor area.
4. **Assign stores.** Include stores, accept or select each physical location, and review store-specific quantities and instructions. Store adjustments remain separate from campaign defaults.
5. **Review.** Resolve blocking errors. Warnings require judgement but do not automatically prevent release. Draft store packs remain explicitly labelled as drafts.
6. **Release and distribute.** Finalize a versioned store pack, then print/share it manually. The release does not send email, grant manager access, submit a purchase order or record store execution.
7. **Continue editing.** Later edits change the planning copy, not an existing released pack. Publishing changed content creates a new version; publishing identical content is a no-op.

### Two workbook paths are intentionally different

- The consolidated OND importer reviews cross-store allocations and creates a new campaign draft. Its quick-import handoff retains the file and entered dates, but does not silently merge it into the originating campaign.
- Store-sheet imports apply reviewed records to the selected campaign. Retrying an applied fingerprint does not recreate records. A newly reviewed revision preserves buyer quantity overrides, exclusions and placement identities; conflicting instructions require confirmation. Absence from a later file does not delete an existing product.

Skipped/problematic source rows remain in review/provenance. Never assume that a successful partial import means every row was accepted. See [workbook contracts](docs/STORE_DISPLAY_WORKBOOK_MODEL.md) and [execution pack guide](docs/OCTOBER_STORE_EXECUTION_PACK.md).

## Floorplans

Open **Stores -> Floorplan -> Edit display positions** in physical-layout management. Drag/resize saves on pointer release. Keyboard arrows move a display; Shift+arrows resize; keyboard changes use **Save floorplan**. Escape cancels, and **Undo last saved change** reverses one acknowledged edit. Snapping is optional; overlaps are advisory, not an aisle-clearance or safety assessment.

Positions use normalized rectangles and stable DisplayArea/section IDs. Bounds are enforced; pan/zoom do not change stored geometry. A failed save retains a visible draft for retry/cancel. Navigation/reload protection warns about unsaved work. Save, leave, reopen and continue editing without duplicating a display.

Physical positions are **store-wide**, not campaign-owned. Only the current physical layout exposes the display editor. Campaign/program floorplans and category-layout drafts do not move canonical displays. CategorySpace and promotional DisplayArea layers remain independent. [Detailed controls and recovery](docs/FLOORPLAN_EDITING.md).

## Architecture and durable data

UI -> `PlatformProvider` -> `MerchandisingRepository` -> domain rules + persistence adapter.

| Boundary | Responsibility |
| --- | --- |
| `src/domain` | Typed records, readiness/validation, placement rules and manager-pack projection |
| `src/adapters/mock` | Deterministic demo/domain engine; versioned compressed browser snapshot, committed checkpoint and failed-write rollback |
| `src/adapters/supabase` | Authenticated, version-checked shared planning and physical reference documents; Product Master lookup |
| `src/features` | Campaign, import, store and output screens |
| `src/services` | Provider, business clock and explicitly prototype downstream services |

Shared planning and physical layouts remain separate singleton JSON documents with separate optimistic versions and existing database authorization. A single adapter queue serializes refreshes and writes. UI refresh after an acknowledged mutation uses its committed snapshot, not another fallible network request. Stale writes fail rather than overwriting another buyer's work.

A release includes the campaign, products, allocations, instructions and normalized geometry needed by its manager packs. Linked map URLs are retained, but image bytes are not archived. Legacy releases without complete execution data are not silently rebuilt from today's unpublished plan. The new optional JSON field requires **no SQL migration**. [Architecture decision](docs/ADR-0002-reliability-and-release-boundaries.md), [runtime data model](docs/DATA_MODEL.md), [adapter contract](src/adapters/supabase/README.md).

### Local and shared modes are not interchangeable

Local mode is a browser/device-specific demo, not a backup or collaboration service. It preserves old saved geometry, rejects corrupt snapshots without overwriting their bytes, and checks for stale tabs before writing. This local check is best-effort, not atomic cross-tab locking. Real collaboration relies on Supabase version checks.

The provider currently selects authenticated shared mode when **both a Supabase URL and a browser-safe key are configured**. `VITE_DATA_ADAPTER=mock` alone is not an isolation switch when those credentials exist. For isolated tests clear the URL and both key variables. Do not add a query-string bypass to production authentication.

## Supported live boundary

Authenticated buyers/admins can use campaigns, reviewed imports, store placements, canonical floorplan management and release-pack generation. Existing RLS remains the authorization boundary; hidden navigation is not security. Synthetic demo products cannot be published through shared mode.

Ordering, legacy OND program operations, supplier submission/opportunity management, execution/compliance entry and measurement are retained for isolated demo development, but their routes and unsupported mutations are blocked in shared mode. Their complete effects are not durably serialized or integrated. They must not be presented as live capabilities.

## Development and testing

Use Node 22 and the committed lockfile:

```bash
npm ci
npm run dev -- --host 127.0.0.1
```

For a local demo, leave `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY` and `VITE_SUPABASE_ANON_KEY` empty. For a deliberately configured shared/staging instance, use its URL plus publishable key (legacy anon key supported). Never put service-role keys in browser variables, source, screenshots or test fixtures.

```bash
npm run lint
npm run typecheck
npm test
npm run build
npx playwright install --with-deps chromium
E2E_LOCAL_TRANSPORT=0 npm run test:e2e
```

On managed hosts that deny Chromium direct loopback sockets, `E2E_LOCAL_TRANSPORT=1` uses the local-only request fixture. `E2E_EXTERNAL_SERVER=1` skips Playwright's server startup when the test server is already running. Default tests use isolated demo data and do not require Supabase credentials.

The secured two-user test is opt-in: it requires staging credentials, a disposable staging campaign, **`E2E_ALLOW_SHARED_TEST_WRITES=1`**, and the variables documented in [the production gate](docs/PRODUCTION_GATE.md). Never point it at the real buyer campaign. Default CI intentionally skips that test; a green demo suite is not proof of live authentication/RLS behaviour.

CI runs lint, TypeScript, unit/integration tests, build and Chromium tests independently, then fails if any required check fails. Screenshots/PDFs/failure evidence are retained as workflow artifacts. Vite build success alone does not prove type or test health.

## Deployment

Vercel: Vite preset, repository root, Node 22, `npm ci`, `npm run build`, output `dist`. `vercel.json` keeps parameterized deep links on the SPA route. Validate a direct campaign URL and refresh after deployment.

Keep preview/staging data isolated from production. Review the PR and quality evidence before promoting; this engineering run does not modify production records, migrate schemas, grant roles or promote its branch. Existing Supabase access policies and version triggers are prerequisites, not objects to recreate or reset. [Current release gate and remaining evidence](docs/PRODUCTION_GATE.md).
