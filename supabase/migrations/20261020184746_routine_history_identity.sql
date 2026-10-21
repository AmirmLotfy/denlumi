-- Local-only A02 correction. The immutable rule pet remains the RLS/authorization
-- binding for both existing and new occurrences. A different pet needs a new rule.
-- No backfill attempts to reconstruct past pet assignments: older snapshots did
-- not record them. Existing snapshots and their instruction/version remain intact.
create function private.immutable_routine_identity() returns trigger
language plpgsql set search_path='' as $$
begin
 if new.household_id is distinct from old.household_id or new.pet_id is distinct from old.pet_id then
  raise exception 'routine household and pet are immutable; create a new routine' using errcode='23514';
 end if;
 return new;
end;
$$;
create trigger immutable_routine_identity before update on public.routine_rules
for each row execute function private.immutable_routine_identity();

-- State/claim/report transitions still work. The occurrence's original source,
-- rule version, and saved owner instruction cannot be rewritten by an update.
-- DELETE is deliberately outside this guard so the existing authorized complete
-- household-deletion workflow can remove the scope coherently.
create function private.immutable_occurrence_context() returns trigger
language plpgsql set search_path='' as $$
begin
 if new.household_id is distinct from old.household_id
    or new.routine_rule_id is distinct from old.routine_rule_id
    or new.plan_step_id is distinct from old.plan_step_id
    or new.rule_snapshot is distinct from old.rule_snapshot then
  raise exception 'task occurrence source and rule snapshot are immutable' using errcode='23514';
 end if;
 return new;
end;
$$;
create trigger immutable_occurrence_context before update on public.task_occurrences
for each row execute function private.immutable_occurrence_context();

revoke all on function private.immutable_routine_identity(),private.immutable_occurrence_context()
from public,anon,authenticated;
