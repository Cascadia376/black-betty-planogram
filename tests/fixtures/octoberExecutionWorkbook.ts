import { createWorkbook } from "./cascadiaOndWorkbook";

/** Synthetic products; real consolidated contract and Crown Isle/Port Alberni codes. */
export const octoberExecutionRows: (string | number)[][] = [
  ["Vendor", "Category", "INV_NUM", "Product", "Order From", "LTO Month", "Display", "Display Area", "Oct Flyer", "Nov Flyer", "Dec Flyer", "Notes", "Crown Isle", "Port Alberni", "Total Cases"],
  ["Mock", "WINE", "MOCK-2001", "Harvest Red Blend", "", "", "Y", "W8", "Y", "Y", "Y", "Face labels forward", 6, 3, 9],
  ["Mock", "BEER", "MOCK-1001", "Coastal Lager 12 Pack", "", "", "Y", "BR2", "Y", "Y", "Y", "Keep cases together", 12, 4, 16],
  ["Mock", "SPIRITS", "MOCK-OND-1002", "Mock Cream Liqueur Gift Pack", "", "", "Y", "M1", "Y", "Y", "Y", "Protect gift packaging", 5, 2, 7],
  ["Mock", "RTD", "MOCK-3001", "Citrus Cooler Variety", "", "", "", "", "Y", "Y", "Y", "Shelf promotion only", 4, 1, 5],
  ["Mock", "BEER", "MOCK-1002", "Island IPA 6 Pack", "", "", "Y", "", "Y", "Y", "Y", "Buyer to confirm display code", 2, 1, 3],
  ["Mock", "BEER", "UNKNOWN-EXACT", "Awaiting exact SKU", "", "", "", "", "Y", "Y", "Y", "Do not match by name", 2, 1, 3],
  ["Mock", "GIFTS", "MOCK-OLD-9001", "Mock Retired Seasonal Pack", "", "", "", "", "Y", "Y", "Y", "Inactive product review", 1, 1, 2],
];

export function createOctoberExecutionWorkbook() { return createWorkbook(octoberExecutionRows, "OND Worksheet"); }
