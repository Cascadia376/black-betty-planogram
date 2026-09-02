# Black Betty

Standalone merchandising operations application for Cascadia Liquor.

This application manages persistent high-value merchandising spaces such as endcaps, feature tables, cooler-door groups, seasonal areas, and floor displays. It is intentionally separate from `Cascadia376/ursus-major`, but is designed to integrate with Ursus Major authentication, Supabase-backed data, navigation, and shared package boundaries later.

It also models regular category homes through versioned `StoreLayout` and `CategorySpace` records. A category home is never a promotional `DisplayArea`; both layers can be viewed together on the store floorplan.

## Current Scope

The MVP supports the broader merchandising workflow:

Plan -> Publish -> Order -> Execute -> Verify -> Measure -> Improve

Campaign planning now begins with a guided Phase 1 flow:

Create Campaign -> Build Product Assortment -> Build Displays -> Continue to Stores

Product intake supports four paths:

- Product Master search for known products.
- Bulk SKU paste from Excel, email, or another source.
- Known-format campaign spreadsheet import.
- Controlled pending-product creation when a valid SKU is new to Product Master.

Product Master remains authoritative for known product attributes such as SKU, name, category, case pack, and active status. Campaign records store campaign-specific metadata such as role, required/optional state, and notes. Pending products can continue through planning, but remain clearly flagged for Product Master review.

Campaign product spreadsheet import is intentionally separate from OND allocation import. The campaign Products workspace accepts the documented `campaign-product-v1` format and applies rows only after review and approval.

## Phase 2 Display Planning

`CampaignDisplay` is a campaign-level merchandising concept (for example, a Feature Display or RTD Endcap). It is deliberately distinct from `DisplayArea`, which is a persistent physical location in a store. A display can be **STANDARD**, a reusable concept whose compatible locations are chosen later, or **STORE_SPECIFIC**, a named setup whose physical location will be selected per store in Phase 3.

Campaign products are explicitly **unassigned**, **display assigned**, or **shelf supported**. Shelf-supported products remain in the campaign assortment without requiring a dedicated display. A display may have zero or one **Hero** product; setting a new Hero demotes the prior Hero to Supporting. Minimum facings and quantity are display-specific guidance. Campaign display ordering represents planning priority, not shelf coordinates or physical location. Buyers may continue to Stores with unassigned-product or empty-display warnings; physical store placement remains a Phase 3 responsibility.

The display-product pool supports category, campaign role, requirement, brand, package/size, and merchandising-state filters. Supplier is intentionally not exposed there yet: the current Product/SupplierProductOption data does not provide a dependable campaign-product supplier resolution rule. That remains a real-data integration decision for Phase 3.

## Phase 3 Store Allocation

`CampaignDisplay` describes what should be built. `DisplayArea` is the persistent physical asset in one store. `CampaignDisplayAssignment` is the planning-layer mapping between them for a participating store, and `CampaignDisplayAssignmentProduct` records store-specific product quantities and buyer overrides. A STANDARD display receives an explainable suggestion per store and must be accepted; it never assumes matching display numbers across stores. STORE_SPECIFIC displays require buyer placement per store. At Publish, approved planning allocations will be converted into canonical `DisplayAssignment` records for operational ordering and execution; that conversion remains a later phase.

## Physical Store Layouts

`/stores/:storeId/floorplan` is the primary physical-layout view. It layers a data-owned PNG/WebP background, optional `CategorySpace` outlines, and persistent `DisplayArea` markers. Crown Isle is the first real reference implementation and uses `public/floorplans/crown-isle.png` plus capacity metadata transcribed from the June 2026 planogram workbook. The cooler summary is used as validation and retained alongside detailed records when classifications differ.

Category spaces support optional normalized geometry, fixture type, shelf dimensions, shelf count, maximum facings, fractional cooler-door equivalents, source notes, and lightweight irregular sections. Users can edit the category metadata in a form. A current layout can be duplicated into a draft and later made current; the prior current version becomes archived and remains readable.

This foundation does not include OCR ingestion, individual shelves, drag/resize editing, automated reset optimization, or production database migrations. Additional stores can be added by placing an appropriately sized image in `public/floorplans/`, creating a `StoreLayout` record with its aspect ratio, and adding source-backed category spaces through the repository boundary.

## Phase 1 Campaign Workflow

Create Campaign -> Build Product Assortment -> Continue to Displays

Campaign product intake supports Product Master search, bulk SKU paste, known-format spreadsheet import, and controlled pending new-product intake. Product Master is authoritative for known SKU, name, category, case pack, and active-state details. Pending new products may continue through planning, but remain visibly flagged for Product Master review.

The known campaign product workbook format is documented in `docs/campaign-product-import.md`.

Routes included:

- `/`
- `/campaigns`
- `/campaigns/new`
- `/campaigns/:campaignId`
- `/campaigns/:campaignId/products`
- `/campaigns/:campaignId/display`
- `/campaigns/:campaignId/assign`
- `/imports`
- `/programs/:programId`
- `/programs/:programId/allocations`
- `/programs/:programId/import`
- `/stores/:storeId`
- `/stores/:storeId/floorplan`
- `/stores/:storeId/workspace`
- `/stores/:storeId/orders`
- `/executions/:executionId`
- `/compliance/:executionId`
- `/performance`
- `/display-areas/:displayAreaId`

## Architecture

UI components do not call Supabase directly. They read and mutate data through the domain-facing `MerchandisingRepository` exposed by `src/services/PlatformProvider.tsx`.

Primary boundaries:

- `src/domain`: domain types, repository interfaces, validation, scoring, and recommendation rules.
- `src/adapters/mock`: deterministic mock/local seed adapter used by the MVP.
- `src/adapters/supabase`: Supabase adapter skeleton for future implementation.
- `src/features`: screen-level components grouped by merchandising domain.
- `src/components`: reusable application shell and UI primitives.
- `docs`: architecture and Ursus Major integration notes.

The table-level schema contract is documented in `docs/DATA_MODEL.md`. No production database migration is included or applied in the mock-first MVP.

OND programs use `DisplayAssignment` as the canonical operational allocation. Publishing creates a versioned mock release, direct initial-set/reset execution tasks, and explainable order recommendations. Supplier order batches create mock purchase orders and inbound records. Legacy campaign assignments remain supported for existing campaign screens.

The deterministic mock business clock is centralized in `src/services/clock.ts`. A production repository should inject the system/business date rather than copy the mock date into UI code.

## Development

```bash
npm install
npm run dev
```

Run validation:

```bash
npm run lint
npm test
npm run build
npm run test:e2e
```

## Vercel Deployment

This repository is a Vite single-page application using `BrowserRouter`. The root-level `vercel.json` rewrites direct route requests to `index.html`, allowing React Router to resolve deep links and browser refreshes.

Use these Vercel project settings:

- Framework Preset: `Vite`
- Root Directory: `.` (repository root)
- Install Command: `npm install` (Vercel default)
- Build Command: `npm run build`
- Output Directory: `dist`
- Node.js Version: `22.x`

No environment variables are required for the prototype. Leave `VITE_DATA_ADAPTER` unset so the application continues to use its mock repository and browser `localStorage`.

After deployment, verify at least one parameterized route by opening it directly in a new browser tab and refreshing it. The rewrite should return the application shell while preserving the requested URL.

## Environment

The MVP defaults to mock data. Supabase configuration is optional until the adapter is implemented.

```bash
VITE_DATA_ADAPTER=mock
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
VITE_URSUS_MAJOR_BASE_URL=
```

Never put service-role Supabase keys in browser-accessible environment variables.
