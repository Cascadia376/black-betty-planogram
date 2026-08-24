import { BrowserRouter, Route, Routes } from "react-router-dom";
import { AppShell } from "./components/AppShell";
import { EmptyState } from "./components/ui";
import { CompliancePage } from "./features/compliance/CompliancePage";
import { CampaignBuilderPage } from "./features/campaigns/CampaignBuilderPage";
import { CampaignAssignmentPage, CampaignDetailPage, DisplayDesignerPage } from "./features/campaigns/CampaignDetailPages";
import { CampaignsPage } from "./features/campaigns/CampaignsPage";
import { DashboardPage } from "./features/dashboard/DashboardPage";
import { ExecutionPage } from "./features/execution/ExecutionPage";
import { DisplayAreaProfilePage, PerformancePage } from "./features/performance/PerformancePages";
import { ProgramWorkspacePage } from "./features/programs/ProgramWorkspacePage";
import { AllocationPlannerPage } from "./features/programs/AllocationPlannerPage";
import { StoreFloorplanPage, StoreOverviewPage, StoreWorkspacePage } from "./features/stores/StorePages";
import { PlatformProvider } from "./services/PlatformProvider";

export function App() {
  return <PlatformProvider><BrowserRouter><Routes><Route element={<AppShell />}>
    <Route index element={<DashboardPage />} />
    <Route path="campaigns" element={<CampaignsPage />} />
    <Route path="campaigns/new" element={<CampaignBuilderPage />} />
    <Route path="campaigns/:campaignId" element={<CampaignDetailPage />} />
    <Route path="campaigns/:campaignId/display" element={<DisplayDesignerPage />} />
    <Route path="campaigns/:campaignId/assign" element={<CampaignAssignmentPage />} />
    <Route path="programs/:programId" element={<ProgramWorkspacePage />} />
    <Route path="programs/:programId/allocations" element={<AllocationPlannerPage />} />
    <Route path="stores/:storeId" element={<StoreOverviewPage />} />
    <Route path="stores/:storeId/floorplan" element={<StoreFloorplanPage />} />
    <Route path="stores/:storeId/workspace" element={<StoreWorkspacePage />} />
    <Route path="executions/:executionId" element={<ExecutionPage />} />
    <Route path="compliance/:executionId" element={<CompliancePage />} />
    <Route path="performance" element={<PerformancePage />} />
    <Route path="display-areas/:displayAreaId" element={<DisplayAreaProfilePage />} />
    <Route path="*" element={<EmptyState title="Page not found" message="This merchandising route does not exist." />} />
  </Route></Routes></BrowserRouter></PlatformProvider>;
}
