-- Local-only performance change. Keep every existing detailed policy predicate.
-- One statement-local household set avoids evaluating those predicates for foreign rows.
create function private.accessible_household_ids() returns uuid[]
language sql stable security definer set search_path='' as $$
 select coalesce(array_agg(m.household_id),'{}'::uuid[])
 from public.memberships m join public.households h on h.id=m.household_id
 join public.profiles p on p.id=m.profile_id
 where m.profile_id=(select auth.uid()) and p.status='active' and h.status='active'
 and m.revoked_at is null and (m.expires_at is null or m.expires_at>now())
 and (h.expires_at is null or h.expires_at>now())
 and (select private.active_identity());
$$;
revoke all on function private.accessible_household_ids() from public,anon;
grant execute on function private.accessible_household_ids() to authenticated;

-- Explicit allowlist of existing read policies: missing/changed policies fail migration.
do $$
declare item record; predicate text;
begin
 for item in select * from (values
  ('case_pets','case_pet_read'),('cases','case_read'),('deliveries','delivery_read'),
  ('handover_acks','handover_ack_read'),('handovers','handover_read'),
  ('home_responsibilities','responsibility_read'),('home_zones','zone_read'),
  ('memberships','own_membership'),('observations','observation_read'),
  ('pair_contexts','context_read'),('pet_pairs','pair_read'),
  ('pet_resource_access','resource_access_read'),('pets','pet_read'),
  ('plan_reviews','plan_review_read'),('plan_revisions','plan_read'),('plan_steps','plan_step_read'),
  ('resources','resource_read'),('routine_rules','routine_read'),('safety_holds','hold_read'),
  ('session_pets','session_pet_read'),('sessions','session_read'),('task_claims','task_claim_read'),
  ('task_occurrences','occurrence_read'),('task_reports','task_report_read')
 ) as policies(table_name,policy_name) loop
  select pg_get_expr(p.polqual,p.polrelid) into predicate from pg_catalog.pg_policy p
  where p.polrelid=format('public.%I',item.table_name)::regclass
    and p.polname=item.policy_name and p.polcmd='r';
  if predicate is null then raise exception 'Expected read policy %.% missing',item.table_name,item.policy_name;end if;
  execute format('alter policy %I on public.%I using (household_id = any((select private.accessible_household_ids())::uuid[]) and (%s))',item.policy_name,item.table_name,predicate);
 end loop;
end;
$$;
alter policy household_read on public.households using (
 id=any((select private.accessible_household_ids())::uuid[]) and private.has_membership(id)
);
