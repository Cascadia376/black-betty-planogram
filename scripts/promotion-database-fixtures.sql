-- Synthetic authorization and planning fixtures for isolated tests only.
-- Never apply this file to an existing/shared Supabase project.

    create role anon; create role authenticated; create role service_role bypassrls;
    create schema auth; create schema private;
    create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    create table public.black_betty_user_access(id uuid primary key, role text, is_active boolean);
    create function private.black_betty_role() returns text language sql stable security definer set search_path='' as $$ select role from public.black_betty_user_access where id=auth.uid() and is_active $$;
    grant usage on schema private,auth to authenticated;
    grant execute on function private.black_betty_role() to authenticated;
    create function private.set_black_betty_planning_snapshot_audit_fields() returns trigger language plpgsql security definer set search_path='' as $$ begin new.version=old.version+1; new.updated_at=now(); new.updated_by=auth.uid(); return new; end $$;
    insert into auth.users values ('00000000-0000-4000-8000-000000000001'), ('00000000-0000-4000-8000-000000000002'), ('00000000-0000-4000-8000-000000000003');
    insert into public.black_betty_user_access values ('00000000-0000-4000-8000-000000000001','buyer',true), ('00000000-0000-4000-8000-000000000002','admin',true), ('00000000-0000-4000-8000-000000000003','buyer',false);
  
    create table public.product(sku text primary key,is_active boolean);
    insert into public.product values ('LIVE-123',true);
    grant select on public.product to authenticated;
    create table public.black_betty_planning_snapshot(singleton boolean primary key,planning jsonb not null,version bigint not null default 1,updated_at timestamptz default now(),updated_by uuid references auth.users(id));
    insert into public.black_betty_planning_snapshot(singleton,planning) values (true,'{"campaigns":[],"campaignProducts":[],"campaignReleases":[]}'::jsonb);
    alter table public.black_betty_planning_snapshot enable row level security;
    grant select on public.black_betty_planning_snapshot to authenticated;
    grant update(planning) on public.black_betty_planning_snapshot to authenticated;
    create policy planning_select on public.black_betty_planning_snapshot for select to authenticated using (private.black_betty_role() in ('buyer','admin'));
    create policy planning_update on public.black_betty_planning_snapshot for update to authenticated using (private.black_betty_role() in ('buyer','admin')) with check (private.black_betty_role() in ('buyer','admin'));
    create trigger planning_audit before update on public.black_betty_planning_snapshot for each row execute function private.set_black_betty_planning_snapshot_audit_fields();
  