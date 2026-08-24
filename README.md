# Merchandising Platform

Standalone merchandising operations application for Cascadia Liquor.

This application manages persistent high-value merchandising spaces such as endcaps, feature tables, cooler-door groups, seasonal areas, and floor displays. It is intentionally separate from `Cascadia376/ursus-major`, but is designed to integrate with Ursus Major authentication, Supabase-backed data, navigation, and shared package boundaries later.

## Current Scope

The MVP supports the workflow:

Plan -> Design -> Assign -> Locate -> Execute -> Verify -> Measure -> Improve

Routes included:

- `/`
- `/campaigns`
- `/campaigns/:campaignId`
- `/campaigns/:campaignId/display`
- `/campaigns/:campaignId/assign`
- `/stores/:storeId`
- `/stores/:storeId/floorplan`
- `/stores/:storeId/workspace`
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

## Environment

The MVP defaults to mock data. Supabase configuration is optional until the adapter is implemented.

```bash
VITE_DATA_ADAPTER=mock
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
VITE_URSUS_MAJOR_BASE_URL=
```

Never put service-role Supabase keys in browser-accessible environment variables.
