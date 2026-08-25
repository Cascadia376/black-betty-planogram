import type { InboundOrder, InventoryPosition, SupplierProductOption } from "./types";

export interface SupplierSelection {
  option: SupplierProductOption;
  isAlternate: boolean;
  canMeetRequiredDate: boolean;
  rationale: string;
  expectedArrivalDate: string;
}

function addDays(date: string, days: number) {
  const value = new Date(`${date}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

function expectedArrival(option: SupplierProductOption, recommendationDate: string) {
  const leadTimeArrival = addDays(recommendationDate, option.leadTimeDays ?? 0);
  return option.availableFrom && option.availableFrom > leadTimeArrival ? option.availableFrom : leadTimeArrival;
}

function canMeetRequiredDate(option: SupplierProductOption, recommendationDate: string, requiredByDate: string) {
  if (option.availability === "unavailable") return false;
  return expectedArrival(option, recommendationDate) <= requiredByDate;
}

export function selectSupplierForRequiredDate(
  productId: string,
  options: SupplierProductOption[],
  recommendationDate: string,
  requiredByDate: string,
): SupplierSelection | undefined {
  const productOptions = options.filter((option) => option.productId === productId);
  const preferred = productOptions.find((option) => option.preferred);
  if (preferred && canMeetRequiredDate(preferred, recommendationDate, requiredByDate)) {
    return {
      option: preferred,
      isAlternate: false,
      canMeetRequiredDate: true,
      expectedArrivalDate: expectedArrival(preferred, recommendationDate),
      rationale: `${preferred.supplierName} is preferred and can arrive by the required date.`,
    };
  }

  const alternate = productOptions.find((option) => !option.preferred && canMeetRequiredDate(option, recommendationDate, requiredByDate));
  if (!alternate && preferred) return {
    option: preferred,
    isAlternate: false,
    canMeetRequiredDate: false,
    expectedArrivalDate: expectedArrival(preferred, recommendationDate),
    rationale: `${preferred.supplierName} is preferred but cannot satisfy the required date. Buying review is required.`,
  };
  if (!alternate) return undefined;
  const preferredReason = preferred?.availability === "unavailable"
    ? `${preferred.supplierName} is marked unavailable`
    : preferred
      ? `${preferred.supplierName} cannot arrive by ${requiredByDate}`
      : "No preferred supplier is configured";
  return {
    option: alternate,
    isAlternate: true,
    canMeetRequiredDate: true,
    expectedArrivalDate: expectedArrival(alternate, recommendationDate),
    rationale: `${preferredReason}; ${alternate.supplierName} is suggested as an alternate that can meet the required date.`,
  };
}

export function calculateUncoveredNeed(
  requiredCases: number,
  inventory: InventoryPosition | undefined,
  inboundOrders: InboundOrder[],
  requiredByDate: string,
) {
  const usableOnHandCases = Math.max(0, (inventory?.onHandCases ?? 0) - (inventory?.reservedCases ?? 0));
  const inboundCases = inventory ? inboundOrders
    .filter((order) => order.storeId === inventory.storeId && order.productId === inventory.productId)
    .filter((order) => ["submitted", "confirmed"].includes(order.status) && order.expectedArrivalDate <= requiredByDate)
    .reduce((total, order) => total + order.cases, 0) : 0;
  return {
    requiredCases,
    usableOnHandCases,
    inboundCases,
    uncoveredCases: Math.max(0, requiredCases - usableOnHandCases - inboundCases),
  };
}
