import { calculateUncoveredNeed, selectSupplierForRequiredDate, type SupplierSelection } from "../../domain/ordering";
import type { OrderRecommendation, OrderRecommendationType, PlatformSnapshot } from "../../domain/types";
import type { DemandForecastResult, DemandForecastService } from "../demand/contracts";

export interface GenerateOrderRecommendationInput {
  id: string;
  storeId: string;
  productId: string;
  category: string;
  displayAssignmentId: string;
  recommendationDate: string;
  requiredByDate?: string;
  recommendationType: OrderRecommendationType;
}

export interface GeneratedOrderRecommendation {
  recommendation: OrderRecommendation;
  forecast: DemandForecastResult;
  supplierSelection: SupplierSelection;
  coverage: ReturnType<typeof calculateUncoveredNeed>;
}

export interface OrderRecommendationService {
  generate(input: GenerateOrderRecommendationInput, data: PlatformSnapshot): Promise<GeneratedOrderRecommendation>;
}

export class RuleBasedOrderRecommendationService implements OrderRecommendationService {
  constructor(private readonly demandService: DemandForecastService) {}

  async generate(input: GenerateOrderRecommendationInput, data: PlatformSnapshot): Promise<GeneratedOrderRecommendation> {
    const assignment = data.displayAssignments.find((item) => item.id === input.displayAssignmentId && item.storeId === input.storeId);
    const assignmentProduct = data.displayAssignmentProducts.find((item) => item.assignmentId === assignment?.id && item.productId === input.productId);
    if (!assignment || !assignmentProduct) throw new Error("A display assignment product is required to generate an order recommendation.");
    const requiredByDate = input.requiredByDate ?? assignment.startDate;
    if (requiredByDate < input.recommendationDate) throw new Error("The required-by date cannot be before the recommendation date.");
    const forecastStartDate = assignment.startDate > input.recommendationDate ? assignment.startDate : input.recommendationDate;
    const forecast = await this.demandService.forecast({ storeId: input.storeId, productId: input.productId, category: input.category, startDate: forecastStartDate, endDate: requiredByDate });
    const forecastCases = Math.ceil(forecast.dailyDemand.reduce((total, day) => total + day.expectedCases, 0));
    const requiredCases = assignmentProduct.caseQuantity + forecastCases;
    const inventory = data.inventoryPositions.find((item) => item.storeId === input.storeId && item.productId === input.productId);
    const inbound = data.inboundOrders.filter((item) => item.storeId === input.storeId && item.productId === input.productId);
    const coverage = calculateUncoveredNeed(requiredCases, inventory, inbound, requiredByDate);
    const supplierSelection = selectSupplierForRequiredDate(input.productId, data.supplierProductOptions, input.recommendationDate, requiredByDate);
    if (!supplierSelection) throw new Error("No configured supplier can satisfy the recommendation required-by date.");
    const recommendation: OrderRecommendation = {
      id: input.id,
      storeId: input.storeId,
      productId: input.productId,
      displayAssignmentId: input.displayAssignmentId,
      supplierId: supplierSelection.option.supplierId,
      recommendationDate: input.recommendationDate,
      requiredByDate,
      recommendedCases: Math.ceil(coverage.uncoveredCases),
      recommendationType: input.recommendationType,
      rationale: `${assignmentProduct.caseQuantity} display cases plus ${forecastCases} forecast cases are required through ${requiredByDate}. ${coverage.usableOnHandCases} usable cases are on hand and ${coverage.inboundCases} qualifying inbound cases arrive by then. Recommend ${Math.ceil(coverage.uncoveredCases)} cases. ${supplierSelection.rationale} Forecast confidence is ${forecast.confidence} using ${forecast.source.replaceAll("_", " ")}.`,
      status: "pending",
    };
    return { recommendation, forecast, supplierSelection, coverage };
  }
}
