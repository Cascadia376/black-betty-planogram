import { extractionHandler, productionDependencies } from "../server/promotionExtraction";
export const maxDuration = 40;
export default { fetch: extractionHandler(productionDependencies(process.env)) };
