# ADR 0003: Promotion Intelligence beside existing campaign planning

Date: 20 October 2026. Status: proposed implementation for review. Supersedes none; builds on ADR 0001/0002.

## Context

Black Betty uses React/Vite, domain repositories, a deterministic mock engine and independently versioned Supabase planning/physical documents. Supplier-submission opportunities already exist as demo-only records. PR #12 deliberately blocks their incomplete serialization in shared mode. The buyer has successfully used OND operationally; new work must feed the existing planner while preserving its release and physical-layout boundaries.

## Decision

Extend the existing `PromotionOpportunity` contract with typed intelligence evidence/history; do not create another Product, Campaign or DisplayArea model. Keep the legacy workbook prototype available at `/opportunities/workbooks` in demo mode. `/opportunities` is the functional Promotion Intelligence area.

Modules:

| Module | Responsibility |
| --- | --- |
| `src/domain/promotion/schema.ts` | Zod input/output contracts, opportunity extension, durable workspace envelope |
| `intake.ts` | Normalization/fingerprint, grounded claims, gaps/conflicts, exact-SKU reconciliation, review/history, reviewed association, deletion |
| `ranking.ts` | Deterministic observed values and configurable linear utility, explicit evidence gaps |
| `src/services/promotion` | Dedicated CAS repository, literal demo extractor, authorized sales-read adapter |
| `server/promotionExtraction.ts` / `api/promotion-extract.ts` | Authenticated Vercel Node fetch handler and bounded model call |
| Existing MerchandisingRepository | Atomic campaign handoff using existing create/product commands |
| Existing PlatformProvider and campaign editor | Auth/session, Product Master, acknowledged snapshot refresh, existing buyer workflow |

### Persistence

Create `public.black_betty_promotion_intelligence`: one bounded JSON workspace, separate optimistic version, server-maintained audit fields, buyer/admin SELECT/UPDATE RLS using `private.black_betty_role()`. Only the workspace column is writable by authenticated authorized users; no client insert/delete/version/audit privileges. Sources/opportunities/history/weights update together atomically. Existing planning and physical collections receive no correspondence and need no migration.

This deliberately uses the established snapshot approach for the smallest safe multi-session slice. It is dedicated access-controlled storage, not browser-only state. The 3 MB maximum, coarse conflicts, whole-workspace reads and unbounded-in-time history until manual retention are explicit scaling limitations. A later additive row-based source/opportunity/event store can migrate this versioned envelope. Demo storage uses a separate key and rejects stale/corrupt/failed writes; it is not shared-mode evidence.

The migration reuses the existing private audit trigger function; it neither changes its security-definer privileges nor broadens roles. Isolated PostgreSQL tests use synthetic baseline authorization fixtures, verify grants/RLS/audit/shape/CAS, and never connect to production. Real inherited policies/triggers still require the secured staging acceptance.

### Extraction

A standalone Vercel Node Function uses standard Request/Response via a default `fetch` export. API routing precedes the SPA fallback. Verify the bearer token with Supabase `getUser`, deny anonymous users, then verify an active buyer/admin access row; all authorization reads use the caller's JWT, not service-role credentials. Authorization/input/model failures fail closed with sanitized errors and no raw content logging.

No model SDK/gateway was configured in this Black Betty repository. Use Vercel AI Gateway's OpenAI-compatible JSON-schema endpoint through ordinary bounded fetch, without a new agent framework or runtime dependency. `AI_GATEWAY_API_KEY` and `PROMOTION_EXTRACTION_MODEL` are server-only. The entire pasted communication is a user data field under a fixed system instruction; it has no tools, browser or executable path. Output is validated against the schema and exact source excerpts/literal values. Grounding prevents unsupported numeric/date/SKU invention; human review still must check attribution and semantic interpretation. Failure does not save a partial opportunity; retries converge through source fingerprints.

Without server credentials, shared mode fails closed. Demo mode uses an explicitly labelled deterministic parser for labelled source lines. It is not presented as natural-language model intelligence. No live model request was executed in this engineering run.

### Product/campaign handoff

The buyer saves approval and exact reconciliation first. `addPromotionToCampaign` uses existing `createCampaign` and `addCampaignProducts` against an isolated in-memory transaction and commits the final planning snapshot once. Only draft campaigns are eligible; canonical physical data and releases are not touched. Existing release validators remain authoritative.

Shared mode re-reads saved approval from the access-controlled promotion document and freshly resolves the SKU through the existing authoritative Product Master adapter. It rejects revoked/unapproved/ambiguous/inactive/mismatched products. A stable opportunity ID on the campaign product makes add retries recover the original campaign, including after campaign success but promotion acknowledgement failure. Multiple approved opportunities for a product can retain multiple link IDs without duplicate assortment membership.

Planning and promotion workspaces are separate commits, not a distributed transaction. A failure after planning acknowledgement leaves the opportunity approved until retry recovers and stores its campaign link. No publication/notification follows. Concurrent distinct buyers still use existing coarse planning CAS; stale writes fail. A simultaneous approval revocation between the saved approval read and planning commit remains a narrow cross-document race, requiring a transaction/RPC/outbox follow-up before high-contention automation.

### Commercial evidence

Schema inspection confirmed `productdailysales`, `lto_promotion`, inventory and dated inventory-cost objects. Table existence is not proof of reliable, complete buyer-readable promotion attribution. Initial adapter reads only caller-authorized daily observations, validates numeric/non-null scope, caps results and rejects duplicates. It does not widen any sales grants or add service-role access.

Arithmetic is deterministic. Gross margin dollars = recorded net revenue − recorded total cost. Unknown dates, missing days, return units, cost completeness, store mix and classified promo/regular coverage remain material caveats. The default adapter supplies no promotion labels; no observed lift, post-promo benefit, trend forecast or inventory feasibility is fabricated. Configurable weights default to zero; a missing selected signal gives Insufficient Evidence. Per-opportunity utility is descriptive and comparable only on consistent periods/scopes, not a business-approved ranking model.

### Privacy and operations

Manual source redaction removes inbox correspondence and derivative feedback across associated claims; replay fingerprints and campaign links remain. Campaign/release history and backups have separate retention requirements. No automatic legal compliance assertion, mailbox ingestion, recording, external message, offer acceptance, purchasing, price mutation, publish or floorplan edit is introduced. Model processing and retention policy approval are rollout prerequisites.

## Alternatives and consequences

Putting transcripts into physical/planning snapshots was rejected because it mixes authorization, retention and independent version boundaries. An entire agent framework adds no necessary orchestration for this slice. A separate app or campaign model would create re-entry and lifecycle divergence. Normalized row tables and a transactional handoff are desirable at scale but are deferred explicitly; dedicated bounded CAS provides a testable additive starting point with the existing persistence vocabulary.

## Rollback

Revert application commits to remove the feature; leave the promotion table inaccessible to the old UI while deciding retention/export. Do not drop stored correspondence as part of ordinary code rollback. If the reviewed migration is being rolled back in a disposable staging database, export any required records first, then drop `public.black_betty_promotion_intelligence` (its policy/trigger follow the table). No existing planning/physical table, role, private function, release or floorplan should be dropped/changed.

## References checked

- [Supabase RLS](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [Supabase getUser](https://supabase.com/docs/reference/javascript/auth-getuser)
- [Vercel Functions standalone fetch routing](https://vercel.com/docs/functions/quickstart)
- [AI Gateway OpenAI-compatible API](https://vercel.com/docs/ai-gateway/sdks-and-apis/openai-chat-completions)

The Supabase markdown changelog endpoint was unavailable in this environment (HTTP 403); current product documentation and the installed client types were checked instead. No production schema change was used to test this design.
