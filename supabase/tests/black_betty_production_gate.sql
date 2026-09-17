-- Run with: supabase db query --linked --file supabase/tests/black_betty_production_gate.sql
-- Every mutation is rolled back. Exceptions indicate a failed production gate.

begin;

select set_config(
  'request.jwt.claims',
  (
    select jsonb_build_object(
      'sub', access.auth_user_id::text,
      'email', access.email,
      'role', 'authenticated'
    )::text
    from public.black_betty_user_access as access
    where access.email = 'jeremy@cascadialiquor.com'
  ),
  true
);

set local role authenticated;

do $buyer_gate$
declare
  affected integer;
  visible integer;
begin
  select count(*) into visible from public.black_betty_planning_snapshot;
  if visible <> 1 then
    raise exception 'Buyer cannot read the shared planning snapshot.';
  end if;

  select count(*) into visible from public.black_betty_physical_snapshot;
  if visible <> 1 then
    raise exception 'Buyer cannot read the canonical physical snapshot.';
  end if;

  update public.black_betty_planning_snapshot
  set planning = planning
  where singleton;
  get diagnostics affected = row_count;
  if affected <> 1 then
    raise exception 'Buyer planning update affected % rows instead of 1.', affected;
  end if;

  update public.black_betty_physical_snapshot
  set physical = physical
  where singleton;
  get diagnostics affected = row_count;
  if affected <> 1 then
    raise exception 'Buyer physical update affected % rows instead of 1.', affected;
  end if;
end
$buyer_gate$;

rollback;

begin;

select set_config(
  'request.jwt.claims',
  (
    select jsonb_build_object(
      'sub', access.auth_user_id::text,
      'email', access.email,
      'role', 'authenticated'
    )::text
    from public.black_betty_user_access as access
    where access.email = 'jay@trufflesgroup.com'
  ),
  true
);

set local role authenticated;

do $admin_gate$
declare
  affected integer;
begin
  update public.black_betty_physical_snapshot
  set physical = physical
  where singleton;
  get diagnostics affected = row_count;
  if affected <> 1 then
    raise exception 'Admin physical update affected % rows instead of 1.', affected;
  end if;
end
$admin_gate$;

rollback;

-- Jeremy saves first; Cherie sees the new version and a stale write affects no rows.
begin;

select set_config(
  'black_betty.gate_base_version',
  (select version::text from public.black_betty_planning_snapshot where singleton),
  true
);
select set_config(
  'request.jwt.claims',
  (
    select jsonb_build_object(
      'sub', access.auth_user_id::text,
      'email', access.email,
      'role', 'authenticated'
    )::text
    from public.black_betty_user_access as access
    where access.email = 'jeremy@cascadialiquor.com'
  ),
  true
);

set local role authenticated;

do $jeremy_save$
declare
  affected integer;
begin
  update public.black_betty_planning_snapshot
  set planning = planning
  where singleton
    and version = current_setting('black_betty.gate_base_version')::bigint;
  get diagnostics affected = row_count;
  if affected <> 1 then
    raise exception 'Jeremy save affected % rows instead of 1.', affected;
  end if;
end
$jeremy_save$;

reset role;

select set_config(
  'request.jwt.claims',
  (
    select jsonb_build_object(
      'sub', access.auth_user_id::text,
      'email', access.email,
      'role', 'authenticated'
    )::text
    from public.black_betty_user_access as access
    where access.email = 'ckerwin@cascadialiquor.com'
  ),
  true
);

set local role authenticated;

do $cherie_conflict$
declare
  affected integer;
  visible_version bigint;
begin
  select version into visible_version
  from public.black_betty_planning_snapshot
  where singleton;
  if visible_version <> current_setting('black_betty.gate_base_version')::bigint + 1 then
    raise exception 'Cherie did not observe Jeremy''s newer version.';
  end if;

  update public.black_betty_planning_snapshot
  set planning = planning
  where singleton
    and version = current_setting('black_betty.gate_base_version')::bigint;
  get diagnostics affected = row_count;
  if affected <> 0 then
    raise exception 'Cherie stale save affected % rows instead of 0.', affected;
  end if;
end
$cherie_conflict$;

rollback;

select 'Black Betty buyer/admin RLS production gate passed.' as result;
