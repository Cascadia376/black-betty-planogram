# Supabase adapter boundary

This directory is intentionally non-operational in the MVP. UI code depends on `MerchandisingRepository`, not `supabase-js`.

Before enabling this adapter:

- approve the shared store, SKU, and user identifier mapping;
- create reviewed migrations for the merchandising schema;
- explicitly grant Data API access where required;
- enable RLS on every exposed table and implement role/store-scoped policies;
- use authorization claims from `app_metadata`, never user-editable metadata;
- use only a publishable/anonymous browser key and never a service-role key;
- add contract tests that run against an isolated non-production project.

Supabase changed new-table Data API exposure defaults in 2026, so grants and RLS must be treated as separate, explicit controls.

