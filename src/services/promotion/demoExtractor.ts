import { validateExtraction, claimFields, type Extraction } from "../../domain/promotion/schema";
/** Deliberately limited literal parser. No model execution or semantic claims in demo mode. */
export function demoExtract(text: string): Extraction {
  const aliases: Record<string, typeof claimFields[number]> = { product: "productName", sku: "sku", supplier: "supplier", representative: "representative", brand: "brand", format: "format", price: "price", cost: "cost", discount: "discount", dates: "dates", quantity: "quantity", support: "support", jeremy: "buyerComment", question: "question", action: "action" };
  const blocks = text.split(/\n\s*---\s*\n/);
  const opportunities = blocks.map((block) => ({ claims: block.split("\n").flatMap((excerpt) => {
    const match = excerpt.match(/^\s*([A-Za-z]+):\s*(.+)$/);
    const field = match && aliases[match[1].toLowerCase()];
    if (!field) return [];
    return [{ field, value: match![2].trim(), kind: field === "buyerComment" ? "buyer_judgement" as const : "supplier_claim" as const, excerpt }];
  }), missing: ["Demo literal parser; review source for details not captured"] })).filter((o) => o.claims.length);
  if (!opportunities.length) throw new Error("Demo extractor uses labelled lines, e.g. Product: Coastal Lager and SKU: MOCK-1001. Use authenticated model extraction for natural language.");
  return validateExtraction({ opportunities }, text);
}
export const DEMO_SOURCE = `Supplier: Synthetic Supplier\nRepresentative: Demo Rep\nProduct: Coastal Lager\nSKU: MOCK-1001\nFormat: 6 x 355 mL\nPrice: $12.99 proposed retail\nDates: November, exact dates not supplied\nSupport: Supplier offers a tasting, subject to confirmation\nJeremy: Sells well on discount; weak at regular price\nQuestion: Confirm cost and exact promotional dates\nAction: Jeremy to follow up before October 28`;
