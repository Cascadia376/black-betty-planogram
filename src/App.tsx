import { createBrowserRouter, createRoutesFromElements, Route, RouterProvider } from "react-router-dom";
import { PlanningScopeBoundary, PlanningHome, StorePlanningHome } from "./components/PlanningScopeBoundary";
import { AppShell } from "./components/AppShell";
import { EmptyState } from "./components/ui";
import { CompliancePage } from "./features/compliance/CompliancePage";
import { CampaignBuilderPage } from "./features/campaigns/CampaignBuilderPage";
import { CampaignStoreAllocationPage } from "./features/campaigns/CampaignStoreAllocationPage";
import { CampaignReviewPage } from "./features/campaigns/CampaignReviewPage";
import { StoreExecutionPackPage } from "./features/campaigns/StoreExecutionPackPage";
import { CampaignDisplaysPage } from "./features/campaigns/CampaignDisplaysPage";
import { CampaignOverviewPage } from "./features/campaigns/CampaignOverviewPage";
import { CampaignProductsPage } from "./features/campaigns/CampaignProductsPage";
import { CampaignsPage } from "./features/campaigns/CampaignsPage";
import { DashboardPage } from "./features/dashboard/DashboardPage";
import { ExecutionPage } from "./features/execution/ExecutionPage";
import { StoreOrdersPage } from "./features/orders/StoreOrdersPage";
import { ImportsPage } from "./features/imports/ImportsPage";
import { OndImportPage } from "./features/imports/OndImportPage";
import { FlyerWorkbookImportPage } from "./features/imports/FlyerWorkbookImportPage";
import { StoreDisplayWorkbookImportPage } from "./features/imports/StoreDisplayWorkbookImportPage";
import { SupplierSubmissionImportPage } from "./features/imports/SupplierSubmissionImportPage";
import { PromotionOpportunitiesPage } from "./features/opportunities/PromotionOpportunitiesPage";
import { DisplayAreaProfilePage } from "./features/performance/PerformancePages";
import { PerformancePage } from "./features/performance/OndPerformancePage";
import { ProgramWorkspacePage } from "./features/programs/ProgramWorkspacePage";
import { AllocationPlannerPage } from "./features/programs/AllocationPlannerPage";
import { StoreOverviewPage } from "./features/stores/StorePages";
import { StoreDirectoryPage } from "./features/stores/StoreDirectoryPage";
import { PhysicalStoreFloorplanPage } from "./features/stores/PhysicalStoreFloorplanPage";
import { FloorplanRecoveryPage } from "./features/stores/FloorplanRecoveryPage";
import { DisplayAreaAdminPage } from "./features/stores/DisplayAreaAdminPage";
import { StoreWorkspacePage } from "./features/stores/OndStoreWorkspacePage";
import { PlatformProvider } from "./services/PlatformProvider";

const router = createBrowserRouter(createRoutesFromElements(<><Route path="campaigns/:campaignId/stores/:storeId/pack" element={<StoreExecutionPackPage />} /><Route element={<AppShell />}>
    <Route index element={<PlanningHome><DashboardPage /></PlanningHome>} />
    <Route path="campaigns" element={<CampaignsPage />} />
    <Route path="campaigns/new" element={<CampaignBuilderPage />} />
    <Route path="campaigns/:campaignId/edit" element={<CampaignBuilderPage />} />
    <Route path="campaigns/:campaignId" element={<CampaignOverviewPage />} />
    <Route path="campaigns/:campaignId/products" element={<CampaignProductsPage />} />
    <Route path="campaigns/:campaignId/display" element={<CampaignDisplaysPage />} />
    <Route path="campaigns/:campaignId/assign" element={<CampaignStoreAllocationPage />} />
    <Route path="campaigns/:campaignId/review" element={<CampaignReviewPage />} />
    <Route path="programs/:programId" element={<PlanningScopeBoundary><ProgramWorkspacePage /></PlanningScopeBoundary>} />
    <Route path="programs/:programId/allocations" element={<PlanningScopeBoundary><AllocationPlannerPage /></PlanningScopeBoundary>} />
    <Route path="programs/:programId/import" element={<PlanningScopeBoundary><OndImportPage /></PlanningScopeBoundary>} />
    <Route path="imports" element={<ImportsPage />} />
    <Route path="imports/flyer" element={<FlyerWorkbookImportPage />} />
    <Route path="imports/store-displays" element={<StoreDisplayWorkbookImportPage />} />
    <Route path="imports/supplier" element={<PlanningScopeBoundary><SupplierSubmissionImportPage /></PlanningScopeBoundary>} />
    <Route path="opportunities" element={<PlanningScopeBoundary><PromotionOpportunitiesPage /></PlanningScopeBoundary>} />
    <Route path="stores" element={<StoreDirectoryPage />} />
    <Route path="stores/floorplan-recovery" element={<FloorplanRecoveryPage />} />
    <Route path="stores/:storeId" element={<StorePlanningHome><StoreOverviewPage /></StorePlanningHome>} />
    <Route path="stores/:storeId/floorplan" element={<PhysicalStoreFloorplanPage />} />
    <Route path="stores/:storeId/display-areas/new" element={<DisplayAreaAdminPage />} />
    <Route path="display-areas/:displayAreaId/edit" element={<DisplayAreaAdminPage />} />
    <Route path="stores/:storeId/workspace" element={<PlanningScopeBoundary><StoreWorkspacePage /></PlanningScopeBoundary>} />
    <Route path="stores/:storeId/orders" element={<PlanningScopeBoundary><StoreOrdersPage /></PlanningScopeBoundary>} />
    <Route path="executions/:executionId" element={<PlanningScopeBoundary><ExecutionPage /></PlanningScopeBoundary>} />
    <Route path="compliance/:executionId" element={<PlanningScopeBoundary><CompliancePage /></PlanningScopeBoundary>} />
    <Route path="performance" element={<PlanningScopeBoundary><PerformancePage /></PlanningScopeBoundary>} />
    <Route path="display-areas/:displayAreaId" element={<PlanningScopeBoundary><DisplayAreaProfilePage /></PlanningScopeBoundary>} />
    <Route path="*" element={<EmptyState title="Page not found" message="This merchandising route does not exist." />} />
  </Route></>));

export function App() {
  return <PlatformProvider><RouterProvider router={router} /></PlatformProvider>;
}
