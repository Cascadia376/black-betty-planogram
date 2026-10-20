// Generates a review artifact only. No credentials, network, SQL execution or
// hosted migration history changes. Never use `supabase db push` for this pilot:
// historical repository seeds contain company access and operational snapshots.
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const directory = new URL('../supabase/migrations/', import.meta.url);
const baseline = [
  '20260916215237_black_betty_access.sql',
  '20260917002512_black_betty_shared_snapshot.sql',
  '20260917164730_harden_physical_reference_boundary.sql',
  '20260917181555_initialize_black_betty_planning_shape.sql',
  '20260917223000_allow_buyers_manage_physical_floorplans.sql',
  '20260918193000_add_campaign_release_program_shape.sql',
];
export const featureMigrations = [
  '20261020040055_promotion_intelligence.sql',
  '20261020041802_atomic_promotion_handoff.sql',
  '20261020062604_explicit_data_api_privileges.sql',
];

function beforeExactlyOnce(sql, marker) {
  if (sql.split(marker).length !== 2) throw new Error('Historical migration boundary changed; review required.');
  return sql.slice(0, sql.indexOf(marker));
}

export async function preparePilot(projectRef) {
  if (!/^[a-z]{20}$/.test(projectRef ?? '') || projectRef === 'wobndqnfqtumbyxxtojl') {
    throw new Error('Provide an explicitly approved isolated project ref; production is forbidden.');
  }
  const sections = [];
  for (const name of baseline) {
    let sql = await readFile(new URL(name, directory), 'utf8');
    if (name === baseline[0]) sql = beforeExactlyOnce(sql, 'with requested_access(email, role) as (');
    if (name === baseline[1]) {
      sql = beforeExactlyOnce(sql, 'insert into public.black_betty_planning_snapshot (singleton, planning)');
      const physicalKeys = ['storeLayouts', 'categorySpaces', 'categorySpaceSections', 'zones', 'fixtures', 'displayAreas', 'displayAreaSections'];
      const empty = JSON.stringify(Object.fromEntries(physicalKeys.map(key => [key, []])));
      sql += `\ninsert into public.black_betty_planning_snapshot(singleton,planning) values(true,'${empty}'::jsonb);\n`;
    }
    sections.push(`-- Baseline schema: ${name}\n${sql}`);
  }
  // Ursus owns Product Master in production. This synthetic contract belongs
  // exclusively to a new isolated pilot project; no production catalog is copied.
  sections.push(`
-- Synthetic Product Master contract for the isolated pilot only.
create table public.product (
  sku text primary key, product_name text not null, category text,
  subcategory text, size text, units_per_case integer, supplier text,
  is_active boolean not null default true
);
alter table public.product enable row level security;
revoke all on public.product from public,anon,authenticated,service_role;
grant select on public.product to authenticated;
create policy pilot_product_reader on public.product for select to authenticated
using ((select private.black_betty_role()) in ('buyer','admin'));
insert into public.product(sku,product_name,category,size,units_per_case,supplier,is_active) values
('PILOT-1001','Synthetic Pilot November Red','Wine','750 mL',12,'Synthetic Pilot Supplier',true),
('PILOT-1002','Synthetic Pilot Inactive White','Wine','750 mL',12,'Synthetic Pilot Supplier',false);
`);
  for (const name of featureMigrations) sections.push(`-- Feature migration: ${name}\n${await readFile(new URL(name, directory), 'utf8')}`);
  return `-- REVIEW ONLY: isolated Promotion Intelligence pilot, project ${projectRef}.
-- Independently verify the management API target/project name before execution.
-- This artifact does NOT authenticate the target or record migration history.
-- No Auth identities or access rows are provisioned. Obtain approval separately.
begin;
do $$ begin
  if exists(select 1 from information_schema.tables where table_schema='public'
    and table_name in ('black_betty_user_access','black_betty_planning_snapshot',
      'black_betty_physical_snapshot','black_betty_promotion_intelligence','product')) then
    raise exception 'Pilot bootstrap requires an empty isolated project; refusing existing application tables';
  end if;
end $$;
${sections.join('\n')}
commit;
`;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [projectRef, output] = process.argv.slice(2);
  if (!output) throw new Error('Usage: node scripts/prepare-promotion-pilot.mjs <approved-isolated-ref> <review.sql>');
  const sql = await preparePilot(projectRef);
  await writeFile(output, sql, { flag: 'wx', mode: 0o600 });
  console.log('Created review-only synthetic pilot SQL. Nothing was applied.');
}
