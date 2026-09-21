# ADR 0002: Incremental durability and release boundaries

Date: 2026-09-21. Status: implemented on the hardening branch; promotion remains gated.

## Context

Black Betty already uses a domain-facing repository, browser-local persistence and separately versioned Supabase planning/physical aggregates. A rewrite would increase near-term rollout risk. The audit instead found failed-save memory leakage, destructive workbook replay, refresh/write races, misleading live prototype routes and mutable manager outputs.

## Decisions

**Retain the domain engine and adapter boundary.** Harden transaction acknowledgement, rollback, validation and mutation allowlists rather than introducing a new state library or replacing the schema. Reads and writes share one queue in the Supabase adapter. The existing separate physical/planning versions are preserved.

**Use one versioned local envelope.** Schema metadata and data are compressed into the same localStorage item. Successful writes advance the committed checkpoint; failed writes roll back domain memory. Preserve old geometry rather than reapplying the published seed. Malformed snapshots remain untouched and require explicit recovery. Stale local tabs are detected by comparing serialized snapshots; this is not atomic cross-tab locking.

**Keep physical placement ownership explicit.** A DisplayArea is a store-wide asset. A CampaignDisplay is the intended build. Their association lives in a CampaignDisplayAssignment. Moving a physical display must not happen inside a campaign view or category-layout draft. No campaign geometry layer or new physical IDs were fabricated.

**Treat a release as a stable business handoff.** Freeze the campaign's manager-output projection: product details, store-specific quantities and notes, participating stores, current layout metadata and display geometry. `CampaignRelease.snapshot.executionData` is additive JSON. Legacy releases without it cannot safely render today's data under an old release label. The linked map URL is frozen, not the image bytes; preserve source assets or archive a PDF for an immutable visual artifact.

**Make retries safe, not destructive.** An already-applied matching import fingerprint is a no-op. Revised store workbooks retain buyer overrides/exclusions and placement identities; differing instructions become explicit conflicts. Unchanged publish returns the existing release; changed content produces a new version. Do not implicitly delete records missing from a newer workbook.

**Fail unsupported shared operations before mutation.** Only complete serialized operations are allowed. Demo ordering/measurement/execution workflows remain available for isolated development but are not live product claims. Manual printing/sharing is distinct from email delivery, manager authorization and execution verification.

## Consequences

No dependency upgrade, database migration, role change or production rewrite is needed. This is suitable for a reviewed buyer/merchandising pilot after staging authorization and real-workbook reconciliation. It is not a complete purchase-order, manager-access or execution-measurement rollout.

Whole-document concurrency remains coarse: unrelated buyers can conflict within the same planning aggregate. Local quota and corrupt-data recovery remain browser constraints. Catalog records need a future final-refresh workflow; image assets need stable/versioned retention. These limitations are explicit rather than hidden behind successful-looking controls.

## Evidence

Tests cover failed storage writes/reopen, stale tabs, shared refresh ordering and version conflicts, import replay and revision preservation, release immutability/idempotency, publication blockers, floorplan mouse/touch/keyboard recovery and manager output. Final counts and exclusions belong only in [the verification record](HARDENING_RUN_2026-09-21.md).
