# Black Betty

Standalone merchandising operations application for Cascadia Liquor.

This application manages persistent high-value merchandising spaces such as endcaps, feature tables, cooler-door groups, seasonal areas, and floor displays. It is intentionally separate from `Cascadia376/ursus-major`, but is designed to integrate with Ursus Major authentication, Supabase-backed data, navigation, and shared package boundaries later.

## Current Scope

The MVP supports the workflow:

Scope -> Import -> Allocate -> Publish -> Order -> Execute -> Verify -> Measure -> Improve

Routes included:

- `/`
- `/campaigns`
- `/campaigns/:campaignId`
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
