update public.black_betty_planning_snapshot
set planning = jsonb_build_object(
  'displayAssignments', '[]'::jsonb,
  'displayAssignmentProducts', '[]'::jsonb,
  'programs', '[]'::jsonb,
  'programStores', '[]'::jsonb,
  'campaigns', '[]'::jsonb,
  'campaignImports', '[]'::jsonb,
  'campaignStoreProductAllocations', '[]'::jsonb,
  'campaignDisplays', '[]'::jsonb,
  'campaignDisplayProducts', '[]'::jsonb,
  'campaignStores', '[]'::jsonb,
  'campaignDisplayAssignments', '[]'::jsonb,
  'campaignDisplayAssignmentProducts', '[]'::jsonb,
  'campaignReleases', '[]'::jsonb,
  'storeReleaseNotices', '[]'::jsonb,
  'assignments', '[]'::jsonb,
  'executions', '[]'::jsonb,
  'complianceReviews', '[]'::jsonb,
  'history', '[]'::jsonb,
  'campaignProducts', '[]'::jsonb
) || planning
where singleton;
