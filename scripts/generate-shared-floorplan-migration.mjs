import { readFile, writeFile } from "node:fs/promises";

const [exportPath, migrationPath] = process.argv.slice(2);
if (!exportPath || !migrationPath) {
  throw new Error("Usage: node scripts/generate-shared-floorplan-migration.mjs <floorplan-export.json> <migration.sql>");
}

const exported = JSON.parse(await readFile(exportPath, "utf8"));
if (exported.format !== "black-betty-floorplans" || exported.version !== 1 || !exported.floorplans) {
  throw new Error("The input must be a Black Betty floorplan export.");
}

const payload = JSON.stringify(exported.floorplans);
if (payload.includes("$floorplans$")) {
  throw new Error("Export contains the SQL dollar-quote delimiter.");
}

const sql = `create table public.black_betty_floorplan_snapshot (
  singleton boolean primary key default true check (singleton),
  floorplans jsonb not null,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id)
);

alter table public.black_betty_floorplan_snapshot enable row level security;

create or replace function private.set_black_betty_floorplan_snapshot_audit_fields()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.updated_at = now();
  new.updated_by = auth.uid();
  return new;
end;
$$;

create trigger set_black_betty_floorplan_snapshot_audit_fields
before update on public.black_betty_floorplan_snapshot
for each row execute function private.set_black_betty_floorplan_snapshot_audit_fields();

grant select, update on public.black_betty_floorplan_snapshot to authenticated;

create policy "Black Betty users can view the shared floorplans"
on public.black_betty_floorplan_snapshot
for select to authenticated
using (private.black_betty_role() in ('buyer', 'admin'));

create policy "Black Betty users can update the shared floorplans"
on public.black_betty_floorplan_snapshot
for update to authenticated
using (private.black_betty_role() in ('buyer', 'admin'))
with check (private.black_betty_role() in ('buyer', 'admin'));

insert into public.black_betty_floorplan_snapshot (singleton, floorplans)
values (true, $floorplans$${payload}$floorplans$);
`;

await writeFile(migrationPath, sql);
