create table public.black_betty_physical_snapshot (
  singleton boolean primary key default true check (singleton),
  physical jsonb not null,
  version bigint not null default 1 check (version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  updated_by uuid references auth.users(id)
);

comment on table public.black_betty_physical_snapshot is
  'Canonical physical store layouts and geometry. Black Betty buyers may read; only admins may update.';

alter table public.black_betty_physical_snapshot enable row level security;

create or replace function private.set_black_betty_physical_snapshot_audit_fields()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.version = old.version + 1;
  new.updated_at = now();
  new.updated_by = (select auth.uid());
  return new;
end;
$$;

revoke all on function private.set_black_betty_physical_snapshot_audit_fields() from public, anon, authenticated;

create trigger set_black_betty_physical_snapshot_audit_fields
before update on public.black_betty_physical_snapshot
for each row execute function private.set_black_betty_physical_snapshot_audit_fields();

revoke all on public.black_betty_physical_snapshot from anon;
revoke all on public.black_betty_physical_snapshot from authenticated;
grant select on public.black_betty_physical_snapshot to authenticated;
grant update (physical) on public.black_betty_physical_snapshot to authenticated;

create policy "Black Betty users can view canonical physical data"
on public.black_betty_physical_snapshot
for select to authenticated
using ((select private.black_betty_role()) in ('buyer', 'admin'));

create policy "Black Betty admins can update canonical physical data"
on public.black_betty_physical_snapshot
for update to authenticated
using ((select private.black_betty_role()) = 'admin')
with check ((select private.black_betty_role()) = 'admin');

insert into public.black_betty_physical_snapshot (singleton, physical)
select
  true,
  jsonb_build_object(
    'storeLayouts', planning -> 'storeLayouts',
    'categorySpaces', planning -> 'categorySpaces',
    'categorySpaceSections', planning -> 'categorySpaceSections',
    'zones', planning -> 'zones',
    'fixtures', planning -> 'fixtures',
    'displayAreas', planning -> 'displayAreas',
    'displayAreaSections', planning -> 'displayAreaSections'
  )
from public.black_betty_planning_snapshot
where singleton = true;

update public.black_betty_planning_snapshot
set planning = planning - array[
  'storeLayouts',
  'categorySpaces',
  'categorySpaceSections',
  'zones',
  'fixtures',
  'displayAreas',
  'displayAreaSections'
]::text[]
where singleton = true;

alter table public.black_betty_planning_snapshot
add constraint black_betty_planning_snapshot_excludes_physical_reference
check (not (planning ?| array[
  'storeLayouts',
  'categorySpaces',
  'categorySpaceSections',
  'zones',
  'fixtures',
  'displayAreas',
  'displayAreaSections'
]::text[]));

revoke update on public.black_betty_planning_snapshot from authenticated;
grant update (planning) on public.black_betty_planning_snapshot to authenticated;
revoke all on function private.set_black_betty_planning_snapshot_audit_fields() from public, anon, authenticated;
