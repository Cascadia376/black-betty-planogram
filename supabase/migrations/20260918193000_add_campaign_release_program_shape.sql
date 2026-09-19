update public.black_betty_planning_snapshot
set planning = planning || jsonb_build_object(
  'programs', coalesce(planning -> 'programs', '[]'::jsonb),
  'programStores', coalesce(planning -> 'programStores', '[]'::jsonb)
)
where singleton = true;
