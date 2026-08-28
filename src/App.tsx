import { BrowserRouter, Route, Routes } from "react-router-dom";
import { AppShell } from "./components/AppShell";
import { EmptyState } from "./components/ui";
import { CompliancePage } from "./features/compliance/CompliancePage";
import { CampaignBuilderPage } from "./features/campaigns/CampaignBuilderPage";
import { CampaignStoreAllocationPage } from "./features/campaigns/CampaignStoreAllocationPage";
import { CampaignReviewPage } from "./features/campaigns/CampaignReviewPage";
import { CampaignDisplaysPage } from "./features/campaigns/CampaignDisplaysPage";
import { CampaignOverviewPage } from "./features/campaigns/CampaignOverviewPage";
import { CampaignProductsPage } from "./features/campaigns/CampaignProductsPage";
import { CampaignsPage } from "./features/campaigns/CampaignsPage";
import { DashboardPage } from "./features/dashboard/DashboardPage";
import { ExecutionPage } from "./features/execution/ExecutionPage";
import { StoreOrdersPage } from "./features/orders/StoreOrdersPage";
import { ImportsPage } from "./features/imports/ImportsPage";
import { OndImportPage } from "./features/imports/OndImportPage";
import { DisplayAreaProfilePage } from "./features/performance/PerformancePages";
import { PerformancePage } from "./features/performance/OndPerformancePage";
import { ProgramWorkspacePage } from "./features/programs/ProgramWorkspacePage";
import { AllocationPlannerPage } from "./features/programs/AllocationPlannerPage";
import { StoreFloorplanPage, StoreOverviewPage } from "./features/stores/StorePages";
import { StoreWorkspacePage } from "./features/stores/OndStoreWorkspacePage";
import { PlatformProvider } from "./services/PlatformProvider";

export function App() {
  return <PlatformProvider><BrowserRouter><Routes><Route element={<AppShell />}>
    <Route index element={<DashboardPage />} />
    <Route path="campaigns" element={<CampaignsPage />} />
    <Route path="campaigns/new" element={<CampaignBuilderPage />} />
    <Route path="campaigns/:campaignId" element={<CampaignOverviewPage />} />
    <Route path="campaigns/:campaignId/products" element={<CampaignProductsPage />} />
    <Route path="campaigns/:campaignId/display" element={<CampaignDisplaysPage />} />
    <Route path="campaigns/:campaignId/assign" element={<CampaignStoreAllocationPage />} />
    <Route path="campaigns/:campaignId/review" element={<CampaignReviewPage />} />
    <Route path="campaigns/:campaignId/review" element={<CampaignReviewPage />} />
    <Route path="programs/:programId" element={<ProgramWorkspacePage />} />
    <Route path="programs/:programId/allocations" element={<AllocationPlannerPage />} />
    <Route path="programs/:programId/import" element={<OndImportPage />} />
    <Route path="imports" element={<ImportsPage />} />
    <Route path="stores/:storeId" element={<StoreOverviewPage />} />
    <Route path="stores/:storeId/floorplan" element={<StoreFloorplanPage />} />
    <Route path="stores/:storeId/workspace" element={<StoreWorkspacePage />} />
    <Route path="stores/:storeId/orders" element={<StoreOrdersPage />} />
    <Route path="executions/:executionId" element={<ExecutionPage />} />
    <Route path="compliance/:executionId" element={<CompliancePage />} />
    <Route path="performance" element={<PerformancePage />} />
    <Route path="display-areas/:displayAreaId" element={<DisplayAreaProfilePage />} />
    <Route path="*" element={<EmptyState title="Page not found" message="This merchandising route does not exist." />} />
  </Route></Routes></BrowserRouter></PlatformProvider>;
}
