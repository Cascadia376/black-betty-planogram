comment on table public.black_betty_physical_snapshot is
  'Canonical physical store layouts and geometry. Black Betty buyers and admins may read and update.';

drop policy if exists "Black Betty admins can update canonical physical data"
on public.black_betty_physical_snapshot;

create policy "Black Betty buyers and admins can update canonical physical data"
on public.black_betty_physical_snapshot
for update to authenticated
using ((select private.black_betty_role()) in ('buyer', 'admin'))
with check ((select private.black_betty_role()) in ('buyer', 'admin'));
