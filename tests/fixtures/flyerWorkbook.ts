import { createWorkbook } from "./cascadiaOndWorkbook";

/** Small sanitized fixture derived from the audited September flyer layout. */
export const flyerWorkbookRows: (string | number)[][] = [
  ["Vendor", "", "SKU", "Product", "Selling Price", "Savings", "Sale Price", "Size", "Points", "LTOs", "Additional Notes"],
  ["Mock Coast", "BEER", "MOCK-1001", "Coastal Lager 12 Pack", 20.99, 2, 18.99, "12x355ml", "2X", 2, "September LTO, Preordered for you"],
  ["Mock Valley", "WINE", "MOCK-2001", "Harvest Red Blend", 24.99, 3, 21.99, "12x750ml", "", 3, "TPR SOND"],
  ["", "", "", "Giveaways", "", "", "", "", "", "", ""],
];

export function createFlyerWorkbook() {
  return createWorkbook(flyerWorkbookRows, "September Flyer");
}
