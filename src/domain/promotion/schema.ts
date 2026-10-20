import { z } from "zod";
import type { PromotionOpportunity } from "../types";

export const sourceInputSchema = z.object({
  kind: z.enum(["email", "transcript", "notes", "observation", "offer"]),
  text: z.string().trim().min(1).max(30000),
  title: z.string().trim().max(200).default("Untitled source"),
  supplier: z.string().trim().max(200).default(""),
  representative: z.string().trim().max(200).default(""),
  date: z.union([z.iso.date(), z.literal("")]).default(""),
}).strict();
export type SourceInput = z.infer<typeof sourceInputSchema>;
export const claimFields = ["supplier", "representative", "productName", "sku", "brand", "format", "price", "cost", "discount", "dates", "quantity", "support", "buyerComment", "question", "action"] as const;
export const claimSchema = z.object({
  field: z.enum(claimFields),
  value: z.string().trim().min(1).max(1500),
  kind: z.enum(["source_fact", "supplier_claim", "buyer_judgement", "inference"]),
  excerpt: z.string().trim().min(1).max(2000),
}).strict();
export const extractionSchema = z.object({
  opportunities: z.array(z.object({ claims: z.array(claimSchema).min(1).max(60), missing: z.array(z.string().max(200)).max(30) }).strict()).min(1).max(20),
}).strict();
export type Extraction = z.infer<typeof extractionSchema>;
export type Claim = z.infer<typeof claimSchema> & { sourceId: string };
export interface PromotionSource extends SourceInput { id: string; fingerprint: string; createdAt: string; deletedAt?: string; mode: "model" | "demo" }
export type ReviewStatus = "NEW" | "NEEDS_REVIEW" | "UNDER_CONSIDERATION" | "APPROVED" | "REJECTED" | "ADDED_TO_CAMPAIGN";
export interface ReviewEvent { at: string; actor: string; action: string; before?: string; after?: string }
export interface IntelligenceOpportunity extends PromotionOpportunity {
  intelligence: {
    productEvidence?: { description: string; checkedAt: string };
    claims: Claim[]; missing: string[]; owner: string; corrections?: Partial<Record<Claim["field"], string>>; history: ReviewEvent[];
    linkedCampaignId?: string; associatedWith?: string;
    resolution: "UNMATCHED" | "AMBIGUOUS" | "INACTIVE" | "PENDING" | "MATCHED";
  };
}
export interface RankingPriorities { volume: number; margin: number; lift: number }
export interface IntelligenceWorkspace { sources: PromotionSource[]; opportunities: IntelligenceOpportunity[]; priorities: RankingPriorities }
export interface WorkspaceRevision { version: number; workspace: IntelligenceWorkspace }
export const emptyWorkspace = (): IntelligenceWorkspace => ({ sources: [], opportunities: [], priorities: { volume: 0, margin: 0, lift: 0 } });

/** Exact excerpts and literal values are required, including for numeric terms and dates.
 * Inferences can explain an excerpt but never become commercial terms or SKU identities. */
export function validateExtraction(output: unknown, text: string): Extraction {
  const result = extractionSchema.parse(output);
  for (const opportunity of result.opportunities) {
    for (const claim of opportunity.claims) {
      if (!text.includes(claim.excerpt)) throw new Error("Extraction cited text absent from the source.");
      if (claim.kind !== "inference" && !claim.excerpt.includes(claim.value)) throw new Error("Extracted value is not a literal source value.");
      if (claim.kind === "inference" && !["question", "action", "buyerComment"].includes(claim.field)) throw new Error("Inferences cannot supply commercial terms or product identities.");
      if (claim.kind === "buyer_judgement" && claim.field !== "buyerComment") throw new Error("Buyer judgement must remain separate from commercial terms.");
    }
  }
  return result;
}

// Runtime validation of stored envelopes prevents a damaged document being reseeded.
export function validateWorkspace(value: unknown): IntelligenceWorkspace {
  const envelope = z.object({ sources: z.array(z.unknown()), opportunities: z.array(z.unknown()), priorities: z.object({ volume: z.number().min(0).max(100), margin: z.number().min(0).max(100), lift: z.number().min(0).max(100) }).strict() }).strict().parse(value);
  for (const source of envelope.sources) {
    const s = z.object({ id: z.string().uuid(), fingerprint: z.string().length(64), createdAt: z.string(), deletedAt: z.string().optional(), mode: z.enum(["demo", "model"]), ...sourceInputSchema.shape, text: z.string().max(30000) }).strict().parse(source);
    if (s.deletedAt && s.text !== "") throw new Error("Invalid deleted source.");
  }
  for (const item of envelope.opportunities) {
    z.object({ id: z.string().uuid(), productName: z.string(), supplier: z.string(), status: z.string(), intelligence: z.object({ claims: z.array(claimSchema.extend({ sourceId: z.string().uuid() })), missing: z.array(z.string()), owner: z.string(), history: z.array(z.object({ at: z.string(), actor: z.string(), action: z.string(), before: z.string().optional(), after: z.string().optional() })), productEvidence: z.object({ description: z.string(), checkedAt: z.string() }).optional(), corrections: z.partialRecord(z.enum(claimFields), z.string().max(1500)).optional(), resolution: z.enum(["UNMATCHED", "AMBIGUOUS", "INACTIVE", "PENDING", "MATCHED"]), linkedCampaignId: z.string().optional(), associatedWith: z.string().optional() }) }).parse(item);
  }
  return value as IntelligenceWorkspace;
}
