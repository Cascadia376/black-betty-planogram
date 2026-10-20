# Promotion Intelligence — first useful slice

Status: implemented for review, 20 October 2026. Buyer: Jeremy. Product: Black Betty, existing campaign planner.

## Problem and outcome

Jeremy receives supplier proposals and his own observations across meetings, calls and correspondence. Re-entering and reconciling this information delays commercial decisions. Betty captures a communication once, preserves its evidence, and turns an approved, exact Product Master identity into an editable campaign product. Jeremy controls correction, approval and handoff.

Workflow: Capture → Structure → Enrich → Evaluate → Recommend → Approve → Draft Campaign. This release provides manual capture, grounded extraction, review, descriptive commercial evidence, configurable utility and an explicit draft handoff. It does not claim forecasting, autonomous commercial negotiation or validated promotion-lift attribution.

## Users and access

Active Black Betty buyers/admins share the inbox under existing application access authorization. Other authenticated users and anonymous callers have no inbox rights. Demo mode is clearly labelled and browser-specific. Model extraction runs only behind server-verified authentication and active buyer/admin lookup; client navigation is not the security boundary.

## Delivered behaviour

- Paste supplier email, transcript, call/meeting notes, observations or offer text. Optional metadata: supplier, representative, source date and title. Up to 30,000 characters per source.
- Server-side schema validation requires literal commercial values and exact excerpts. Facts, supplier claims, buyer judgements and inferences remain separate. Missing/contradictory fields remain explicit; no fabricated exact dates, costs, SKU, price or commitment. An inference cannot supply commercial fields.
- One stable opportunity per extracted offer with sources, raw evidence, product reference, owner, status, review history and resulting campaign link. Source normalization and SHA-256 fingerprinting prevent repeated ingestion; supplier/date metadata distinguish otherwise identical correspondence contexts.
- Buyer corrections change interpretation fields and structured commercial feedback while retaining the supplier's original claim/excerpt. Comments, decision and before/after history survive reload. Rejected records remain available.
- Possible duplicates are suggestions based on SKU/name. No automatic merge of distinct offers. Buyer association retains both records, attaches additional source claims and resets approval; contradictions stay explicit.
- Reuse existing exact-SKU Product Master lookup. Matched description and check time are visible; unmatched, inactive, ambiguous and pending records stay provisional. No authoritative product is created.
- Read authorized `productdailysales` observations for the last 90 complete UTC days. Show units and gross margin dollars (net revenue less recorded total cost), exact period, observed store-day count and missing evidence. Nulls, duplicated store/date observations, query failures and row-limit saturation fail closed. No synthetic fallback.
- Buyer weights configure linear utility for volume, margin and descriptive lift. Defaults are unset. Missing selected evidence yields **Insufficient Evidence**, with reasons. The adapter does not invent promo classification; lift is unavailable until an authoritative classified series exists. These are per-opportunity explanations/utility, not a globally comparable ranked league table across mismatched store scopes.
- Revalidate approval atomically under a database row lock when linking an opportunity to planning; a committed revocation rejects stale adds, while planning CAS and unique link checks protect retries. The shared client requires the guard migration capability marker.
- Add a saved approved, reconciled opportunity to an existing draft or create a named draft with buyer-confirmed dates. Reuse campaign commands and validations; open `/campaigns/:id/products`. Product identity enters once. Opportunity IDs remain on campaign products for traceability and retry recovery. Commercial fields unsupported by the campaign model remain in the opportunity.
- Manual deletion redacts source text/metadata, excerpts, buyer corrections/comments and related inbox review details while retaining replay tombstones and campaign links. Existing campaign/release business records and backups follow their separate retention policies.

## Acceptance

1. Capture a synthetic labelled supplier email in demo mode; see source-linked price/date claims and missing cost.
2. Correct description, SKU interpretation and commercial feedback; save and reload with history intact.
3. Reconcile exact Product Master; show unresolved/inactive/ambiguous records without enabling handoff.
4. Save approval. Create a draft with explicitly confirmed name/dates or choose an existing editable campaign. Open the existing editor with the product already selected.
5. Retry ingestion and campaign-add, including after a simulated inbox acknowledgement failure, without another source/product/campaign.
6. Reject a proposal without losing history; associate conflicting additional evidence only through buyer review.
7. Display Insufficient Evidence when credentials, observations, classification or priorities are missing. No score derived from supplier statements or Jeremy's comments.
8. Preserve released packs and physical references throughout; no shared test writes to a buyer campaign.

## Constraints and rollout requirements

The new dedicated promotion workspace and transactional handoff guard require two additive migrations reviewed/applied in isolated staging, and approved server model credentials/data handling. Existing planning/physical snapshots and RLS remain independent. A 3 MB promotion-document bound intentionally limits the first slice; sustained high-volume ingestion requires row storage and pagination. External Outlook/transcript ingestion is not connected. No mailbox is read, meeting recorded, email sent, price changed, supplier offer accepted, order submitted, display selected or campaign published automatically.

Company privacy/retention and model-processing approval must cover supplier correspondence before live use. BC PIPA applicability is an operational/legal review item; implementation alone does not certify compliance. Minimize personal information in pasted sources, use least privilege, and do not log raw content or model/provider errors.

Success in Jeremy's review means fewer repeated entries and a clear, explainable approval-to-draft path. Measure capture-to-approved-draft time and correction/duplicate rates in a later authorized pilot; no fictional baseline or time-savings claim is made here.
