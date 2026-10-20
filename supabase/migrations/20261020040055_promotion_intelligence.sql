-- Additive, separate from planning/physical documents. Review in isolated staging first.
create table public.black_betty_promotion_intelligence (
  singleton boolean primary key default true check (singleton),
  workspace jsonb not null default '{"sources":[],"opportunities":[],"priorities":{"volume":0,"margin":0,"lift":0}}'::jsonb,
  version bigint not null default 0 check (version >= 0),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id),
  constraint promotion_workspace_shape check (
    jsonb_typeof(workspace) = 'object'
    and workspace ?& array['sources','opportunities','priorities']
    and jsonb_typeof(workspace->'sources') = 'array'
    and jsonb_typeof(workspace->'opportunities') = 'array'
    and jsonb_typeof(workspace->'priorities') = 'object'
    and octet_length(workspace::text) <= 3000000
  )
);
alter table public.black_betty_promotion_intelligence enable row level security;
-- This caller-JWT feature does not use service_role; clear legacy automatic
-- grants too, so old and explicit-opt-in databases have the same inbox ACL.
revoke all on public.black_betty_promotion_intelligence from public, anon, authenticated, service_role;
grant select on public.black_betty_promotion_intelligence to authenticated;
grant update (workspace) on public.black_betty_promotion_intelligence to authenticated;
create policy "Active Black Betty buyers can read promotion intelligence"
on public.black_betty_promotion_intelligence for select to authenticated
using ((select private.black_betty_role()) in ('buyer', 'admin'));
create policy "Active Black Betty buyers can update promotion intelligence"
on public.black_betty_promotion_intelligence for update to authenticated
using ((select private.black_betty_role()) in ('buyer', 'admin'))
with check ((select private.black_betty_role()) in ('buyer', 'admin'));
-- Reuse the existing audit trigger that increments version and stamps auth.uid().
create trigger set_black_betty_promotion_intelligence_audit_fields
before update on public.black_betty_promotion_intelligence
for each row execute function private.set_black_betty_planning_snapshot_audit_fields();
insert into public.black_betty_promotion_intelligence (singleton) values (true);
comment on table public.black_betty_promotion_intelligence is
  'Buyer-only promotion sources, opportunities, evidence, feedback and ranking priorities. Not physical geometry or campaign releases. Bounded CAS workspace; source deletion via reviewed application controls.';
