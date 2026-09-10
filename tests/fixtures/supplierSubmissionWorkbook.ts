import { createWorkbook } from "./cascadiaOndWorkbook";

export const supplierSubmissionHeaders = [
  "Supplier", "Supplier Contact", "SKU", "Product", "Supplier Description", "Vendor", "Category",
  "Promotion Start", "Promotion End", "LTO Amount", "TPR", "Proposed Retail", "Flyer Month",
  "Promotional Mechanic", "Points", "Case Commitment", "Minimum Order", "Preorder", "Display Support",
  "Display Requested", "Display Family", "Display Count", "Placement Notes", "Marketing Support",
  "Supplier-Funded Support", "Assets Available", "Sample/Tasting Support", "Available Quantity",
  "Availability Date", "Distribution Constraints", "Stores/Regions", "Rep Claims", "Additional Notes", "Raw Text",
];

export const supplierSubmissionRows: (string | number)[][] = [
  supplierSubmissionHeaders,
  ["Mock Coast", "Alex Rep", "MOCK-1001", "Supplier Coastal Lager", "Seasonal pack", "Mock Coast", "WINE", "2026-10-01", "2026-10-31", 2, "TPR ON", 18.99, "October", "Price feature", "2X", 12, 4, "Yes", "Header card", "Yes", "Beer/RTD", 2, "Front of store", "Social posts", "$200", "Yes", "Tasting team", 100, "2026-09-20", "Island only", "Vancouver Island", "Strong fall seller", "Preorder by September 15", "Rep email summary"],
];

export function createSupplierSubmissionWorkbook(rows = supplierSubmissionRows) {
  return createWorkbook(rows, "Supplier Submission");
}
