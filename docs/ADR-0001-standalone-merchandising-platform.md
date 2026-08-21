# ADR 0001: Standalone Merchandising Platform

## Status

Accepted

## Context

Cascadia Liquor needs a merchandising domain application focused on campaign planning, persistent display areas, store execution, compliance, and performance history. The existing Ursus Major repository is a React + TypeScript + Vite monorepo with Supabase authentication, app-role permissions, shared UI components, and semantic design tokens.

The merchandising product must not be built inside Ursus Major now, but it should remain compatible with a future integration or migration.

## Ursus Major Patterns Inspected

- Monorepo structure uses `apps/*` and `packages/*`.
- Web app uses React, TypeScript, Vite, React Router, React Query, Tailwind CSS, Radix/shadcn-style components, lucide icons, Vitest, React Testing Library, and Playwright.
- App shell uses a left navigation, constrained content width, light page canvas, compact cards/tables, and semantic Tailwind tokens.
- Design language is internal, operational, data-dense, and restrained.
- Auth is Supabase-based and expects browser-safe `VITE_SUPABASE_URL` plus `VITE_SUPABASE_ANON_KEY`.
- Authorization reads Supabase session metadata/JWT claims such as `app_roles` and `app_stores`.
- Route protection and navigation are role-aware.
- API calls generally flow through hooks/helpers and attach Supabase bearer tokens for protected API requests.
- Shared UI patterns include `PageShell`, `PageHeader`, `MetricCard`, status badges, tables, loading states, and empty states.

## Decision

Create `merchandising-platform` as a standalone Vite application with local equivalents of Ursus-compatible UI and auth/data boundaries.

The app will:

- keep all domain access behind repository interfaces;
- run against deterministic mock seed data for the MVP;
- define a Supabase adapter skeleton without connecting to production systems;
- use semantic design tokens equivalent to Ursus Major locally;
- model user roles and store scope locally in a way that can later map to Supabase `app_roles` and `app_stores`;
- preserve stable route paths and IDs that can be deep-linked from Ursus Major;
- avoid importing source code from Ursus Major.

## Consequences

- The MVP can ship independently and be demonstrated without production Supabase access.
- Future integration can replace mock repositories with Supabase-backed implementations without rewriting UI screens.
- Some UI primitives are recreated locally rather than imported from `packages/ui`; this avoids tight coupling while preserving design compatibility.
- Domain IDs and API contracts must be treated as stable from the start.

## Future Migration Path

If the app is absorbed into Ursus Major later, candidates for migration are:

- `src/domain` -> `packages/merchandising-domain`
- shared UI primitives -> `packages/ui`
- app routes -> `apps/merchandising` or `apps/web/src/modules/merchandising`
- Supabase SQL/policies -> `infra/sql` and `infra/policies`

