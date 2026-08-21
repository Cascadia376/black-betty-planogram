# Ursus Major Integration Contract

## 1. Auth Integration Strategy

The standalone app should eventually accept the same Supabase Auth session used by Ursus Major. Until then, the MVP uses a mock session with role and store-scope claims shaped like Ursus Major concepts.

Expected future claims:

- `app_roles`: string array of role names.
- `app_stores`: string array of store IDs/codes available to the user.

The browser must only use the Supabase anon key. Service-role keys must never be exposed to client code.

## 2. Shared User Identity Assumptions

User identity should be the Supabase Auth user UUID. Operational records should store user IDs only where required for auditability, such as submission and review actions.

Avoid storing unnecessary employee personal information in merchandising records. Display names can be resolved by a user/profile service later.

## 3. Supabase Integration Points

Future Supabase-backed repositories should implement the interfaces in `src/domain/repositories`:

- `CampaignRepository`
- `StoreRepository`
- `DisplayAreaRepository`
- `ExecutionRepository`
- `ComplianceRepository`
- `PerformanceRepository`
- `RecommendationRepository`

UI components must continue to depend on repository interfaces through the service container rather than direct Supabase calls.

## 4. Required Shared IDs

- `store_id`: shared store UUID/code mapping with Ursus Major.
- `sku` / `product_id`: stable product identifier compatible with product master data.
- `user_id`: Supabase Auth user UUID.
- `campaign_id`: merchandising campaign UUID.
- `display_area_id`: persistent physical merchandising asset UUID.

## 5. API Boundaries

The app should expose or consume stable domain APIs around:

- campaign creation and campaign-product guidance;
- campaign assignment to stores and display areas;
- execution task status and submissions;
- compliance review outcomes;
- performance rollups by campaign, store, and display area;
- rule-based recommendation state transitions.

Do not expose Supabase table details directly to route components.

## 6. Environment Variables

```bash
VITE_DATA_ADAPTER=mock|supabase
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
VITE_URSUS_MAJOR_BASE_URL=
```

`VITE_DATA_ADAPTER=supabase` should fail fast if Supabase URL or anon key is missing.

## 7. Navigation / Deep-Link Strategy

Ursus Major can link into the standalone app with stable routes:

- `/campaigns/:campaignId`
- `/stores/:storeId/floorplan`
- `/stores/:storeId/workspace`
- `/executions/:executionId`
- `/compliance/:executionId`
- `/display-areas/:displayAreaId`

The standalone app should support return links through `VITE_URSUS_MAJOR_BASE_URL` once deployed.

## 8. Potential Future Migration Into `apps/*`

If absorbed into Ursus Major, the application can move to:

- `apps/merchandising`, preserving route-level app ownership; or
- `apps/web/src/modules/merchandising`, if Ursus Major wants a single web shell.

The repository interface boundary should make either option viable.

## 9. Potential Shared Packages For `packages/*`

Candidates:

- merchandising domain types and repository contracts;
- shared design tokens and UI primitives;
- auth/permission helpers;
- product/store ID mapping helpers.

## 10. What Must Remain Decoupled

- Do not import files directly from Ursus Major.
- Do not depend on Ursus internal folder paths.
- Do not use production Supabase without explicit approval.
- Keep recommendations explainable and rule-based until an approved AI strategy exists.
- Keep persistent display areas as first-class records independent of campaign assignments.

