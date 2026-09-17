do $$
begin
  create type public.black_betty_role as enum ('buyer', 'admin');
exception
  when duplicate_object then null;
end
$$;

create table if not exists public.black_betty_user_access (
  email text primary key,
  auth_user_id uuid unique references auth.users(id) on delete set null,
  role public.black_betty_role not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint black_betty_user_access_email_canonical check (email = lower(trim(email)))
);

comment on table public.black_betty_user_access is
  'Application-specific Black Betty access. This does not provision Ursus Major access.';

alter table public.black_betty_user_access enable row level security;

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create or replace function private.black_betty_role()
returns public.black_betty_role
language sql
stable
security definer
set search_path = ''
as $$
  select access.role
  from public.black_betty_user_access as access
  where access.is_active
    and (
      access.auth_user_id = (select auth.uid())
      or access.email = lower((select auth.jwt() ->> 'email'))
    )
  order by (access.auth_user_id = (select auth.uid())) desc
  limit 1
$$;

revoke all on function private.black_betty_role() from public, anon;
grant usage on schema private to authenticated;
grant execute on function private.black_betty_role() to authenticated;

revoke all on table public.black_betty_user_access from anon;
revoke all on table public.black_betty_user_access from authenticated;
grant select, insert, update, delete on table public.black_betty_user_access to authenticated;

drop policy if exists "Black Betty users can read their access" on public.black_betty_user_access;
create policy "Black Betty users can read their access"
on public.black_betty_user_access
for select
to authenticated
using (
  private.black_betty_role() = 'admin'
  or auth_user_id = (select auth.uid())
  or email = lower((select auth.jwt() ->> 'email'))
);

drop policy if exists "Black Betty admins can create access" on public.black_betty_user_access;
create policy "Black Betty admins can create access"
on public.black_betty_user_access
for insert
to authenticated
with check (private.black_betty_role() = 'admin');

drop policy if exists "Black Betty admins can update access" on public.black_betty_user_access;
create policy "Black Betty admins can update access"
on public.black_betty_user_access
for update
to authenticated
using (private.black_betty_role() = 'admin')
with check (private.black_betty_role() = 'admin');

drop policy if exists "Black Betty admins can delete access" on public.black_betty_user_access;
create policy "Black Betty admins can delete access"
on public.black_betty_user_access
for delete
to authenticated
using (private.black_betty_role() = 'admin');

with requested_access(email, role) as (
  values
    ('ckerwin@cascadialiquor.com', 'buyer'::public.black_betty_role),
    ('jeremy@cascadialiquor.com', 'buyer'::public.black_betty_role),
    ('jay@trufflesgroup.com', 'admin'::public.black_betty_role)
)
insert into public.black_betty_user_access (email, auth_user_id, role)
select
  requested_access.email,
  (
    select users.id
    from auth.users as users
    where lower(users.email) = requested_access.email
    order by users.created_at
    limit 1
  ),
  requested_access.role
from requested_access
on conflict (email) do update
set
  auth_user_id = coalesce(excluded.auth_user_id, black_betty_user_access.auth_user_id),
  role = excluded.role,
  is_active = true,
  updated_at = now();
