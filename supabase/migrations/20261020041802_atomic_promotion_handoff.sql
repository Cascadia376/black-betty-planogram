-- Additive guard on the established planning-write boundary. No data/backfill or
-- existing policy/function change. Apply only after review in isolated staging.
create function private.validate_black_betty_promotion_handoff()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  additions jsonb;
  link jsonb;
  promotion_workspace jsonb;
  opportunity jsonb;
  projection jsonb;
  opportunity_sku text;
  matches bigint;
  active_matches bigint;
begin
  -- Compare campaign/product/opportunity identity, not just the opportunity ID:
  -- copying an old ID into a different campaign must be validated as a new add.
  with incoming as (
    select c->>'id' campaign_id, c->>'status' campaign_status,
           p->>'productId' product_id, o #>> '{}' opportunity_id
    from jsonb_array_elements(coalesce(new.planning->'campaigns','[]'::jsonb)) c
    cross join lateral jsonb_array_elements(coalesce(c->'products','[]'::jsonb)) p
    cross join lateral jsonb_array_elements(coalesce(p->'promotionOpportunityIds','[]'::jsonb)) o
  ), prior as (
    select c->>'id' campaign_id, p->>'productId' product_id,
           o #>> '{}' opportunity_id
    from jsonb_array_elements(coalesce(old.planning->'campaigns','[]'::jsonb)) c
    cross join lateral jsonb_array_elements(coalesce(c->'products','[]'::jsonb)) p
    cross join lateral jsonb_array_elements(coalesce(p->'promotionOpportunityIds','[]'::jsonb)) o
  )
  select jsonb_agg(to_jsonb(i)) into additions from incoming i
  where not exists (
    select 1 from prior p where p.campaign_id=i.campaign_id
      and p.product_id=i.product_id and p.opportunity_id=i.opportunity_id
  );
  if additions is null then return new; end if;

  if (select private.black_betty_role()) is null
     or (select private.black_betty_role()) not in ('buyer','admin') then
    raise exception 'Active buyer/admin access required for promotion handoff' using errcode='42501';
  end if;

  -- Planning's UPDATE already owns its row lock. Lock promotion second, holding
  -- it through the planning commit. Ordinary approval/revocation UPDATEs own the
  -- same promotion lock: a revocation committed first is observed and rejected;
  -- a later revocation waits until this approved add has committed. Invoker/RLS
  -- apply; this function grants no service-role or broader table privileges.
  select workspace into promotion_workspace
  from public.black_betty_promotion_intelligence
  where singleton=true for update;
  if not found then
    raise exception 'Promotion approval unavailable; nothing added' using errcode='42501';
  end if;

  -- Every opportunity can occur on only one campaign product in the resulting
  -- document, including attempts to duplicate it within one input array.
  if exists (
    select o #>> '{}' from jsonb_array_elements(new.planning->'campaigns') c
    cross join lateral jsonb_array_elements(coalesce(c->'products','[]'::jsonb)) p
    cross join lateral jsonb_array_elements(coalesce(p->'promotionOpportunityIds','[]'::jsonb)) o
    group by o #>> '{}' having count(*) > 1
  ) then
    raise exception 'Promotion opportunity is already linked; reload before retrying' using errcode='23505';
  end if;

  for link in select value from jsonb_array_elements(additions) loop
    if link->>'campaign_status' is distinct from 'draft' or exists (
      select 1 from jsonb_array_elements(old.planning->'campaigns') c
      where c->>'id'=link->>'campaign_id' and c->>'status' is distinct from 'draft'
    ) then
      raise exception 'Promotion handoff requires an editable draft campaign' using errcode='23514';
    end if;
    select o into opportunity
    from jsonb_array_elements(promotion_workspace->'opportunities') o
    where o->>'id'=link->>'opportunity_id';
    if opportunity is null or opportunity->>'status' is distinct from 'APPROVED'
       or opportunity->'intelligence'->>'associatedWith' is not null
       or opportunity->'intelligence'->>'resolution' is distinct from 'MATCHED'
       or opportunity->>'productId' is distinct from link->>'product_id' then
      raise exception 'Promotion approval changed; reload and review before adding' using errcode='23514';
    end if;
    select p into projection from jsonb_array_elements(new.planning->'campaignProducts') p
    where p->>'id'=link->>'product_id';
    opportunity_sku := upper(trim(opportunity->>'supplierSku'));
    if projection is null or opportunity_sku is null or opportunity_sku=''
       or upper(trim(projection->>'sku')) is distinct from opportunity_sku
       or projection->>'masterStatus' is distinct from 'verified'
       or projection->>'active' is distinct from 'true'
       or projection->>'synthetic' is distinct from 'false' then
      raise exception 'Promotion Product Master identity must be active and verified' using errcode='23514';
    end if;
    select count(*),count(*) filter(where is_active is not false)
    into matches,active_matches from public.product where upper(trim(product.sku::text))=opportunity_sku;
    if matches<>1 or active_matches<>1 then
      raise exception 'Promotion SKU is inactive, ambiguous or unavailable' using errcode='23514';
    end if;
  end loop;
  return new;
end;
$$;
revoke all on function private.validate_black_betty_promotion_handoff() from public, anon;
grant execute on function private.validate_black_betty_promotion_handoff() to authenticated;
create trigger validate_black_betty_promotion_handoff
before update of planning on public.black_betty_planning_snapshot
for each row execute function private.validate_black_betty_promotion_handoff();

-- Capability marker is read-only to application users (only workspace is writable).
-- New clients fail closed when only the initial inbox migration is installed.
alter table public.black_betty_promotion_intelligence
  add column handoff_protocol smallint not null default 1 check (handoff_protocol=1);
