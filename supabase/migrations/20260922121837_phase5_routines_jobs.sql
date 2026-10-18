-- Phase 5: owner-entered routines, deterministic occurrences and local internal delivery.
-- No email or external provider is configured by this migration.

create table public.routine_rules (
 id uuid primary key default gen_random_uuid(), household_id uuid not null, pet_id uuid not null,
 created_by uuid not null, kind text not null check(kind in ('meal','water','walk','litter','rest','enrichment','other_nonmedical')),
 instruction text not null check(length(btrim(instruction)) between 1 and 1000),
 schedule_spec jsonb not null, status text not null default 'active' check(status in ('active','paused','archived')),
 version integer not null default 1 check(version>0), created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 unique(household_id,id), foreign key(household_id,pet_id) references public.pets(household_id,id),
 foreign key(household_id,created_by) references public.memberships(household_id,profile_id),
 check(jsonb_typeof(schedule_spec)='object' and schedule_spec->>'schema_version'='1'
   and schedule_spec->>'frequency' in ('daily','weekly') and schedule_spec->>'timezone' is not null
   and schedule_spec->>'local_time' ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$')
);
create index routine_pet on public.routine_rules(household_id,pet_id,status);

create function private.valid_routine_timezone() returns trigger language plpgsql set search_path='' as $$
begin
 if not exists(select 1 from pg_catalog.pg_timezone_names where name=new.schedule_spec->>'timezone')
 then raise exception 'invalid routine timezone' using errcode='23514'; end if;
 return new;
end $$;
create trigger valid_routine_timezone before insert or update of schedule_spec on public.routine_rules for each row execute function private.valid_routine_timezone();

alter table public.plan_steps add unique(household_id,id);

create table public.task_occurrences (
 id uuid primary key default gen_random_uuid(), household_id uuid not null,
 routine_rule_id uuid, plan_step_id uuid, assigned_to uuid,
 due_at timestamptz not null, expected_safety_epoch integer,
 state text not null default 'planned' check(state in ('planned','claimed','reported_done','skipped','uncertain','canceled')),
 occurrence_key text not null, rule_snapshot jsonb,
 created_at timestamptz not null default now(), unique(household_id,id),
 check((routine_rule_id is null)<>(plan_step_id is null)),
 foreign key(household_id,routine_rule_id) references public.routine_rules(household_id,id),
 foreign key(household_id,plan_step_id) references public.plan_steps(household_id,id),
 foreign key(household_id,assigned_to) references public.memberships(household_id,profile_id),
 unique(routine_rule_id,occurrence_key), unique(plan_step_id,occurrence_key)
);
create index occurrence_due on public.task_occurrences(household_id,state,due_at);

create table public.task_claims (
 id uuid primary key default gen_random_uuid(), household_id uuid not null,
 task_occurrence_id uuid not null, profile_id uuid not null,
 state text not null check(state in ('claimed','released')),
 created_at timestamptz not null default now(), released_at timestamptz,
 unique(task_occurrence_id,profile_id,state),
 foreign key(household_id,task_occurrence_id) references public.task_occurrences(household_id,id),
 foreign key(household_id,profile_id) references public.memberships(household_id,profile_id)
);
create index task_claim_occurrence on public.task_claims(household_id,task_occurrence_id,created_at);

create table public.task_reports (
 id uuid primary key default gen_random_uuid(), household_id uuid not null,
 task_occurrence_id uuid not null, reporter_id uuid not null,
 report text not null check(report in ('done','skipped','uncertain','correction')),
 corrected_report text check(corrected_report in ('done','skipped','uncertain')),
 performed_at timestamptz, note text check(note is null or length(note)<=1000),
 supersedes_id uuid, idempotency_key text not null check(length(idempotency_key) between 16 and 100),
 body_hash text not null check(body_hash ~ '^[a-f0-9]{64}$'), created_at timestamptz not null default now(),
 unique(household_id,id), unique(household_id,reporter_id,idempotency_key),
 foreign key(household_id,task_occurrence_id) references public.task_occurrences(household_id,id),
 foreign key(household_id,reporter_id) references public.memberships(household_id,profile_id),
 foreign key(household_id,supersedes_id) references public.task_reports(household_id,id),
 check((report='correction')=(supersedes_id is not null)),
 check((report='correction')=(corrected_report is not null))
);
create unique index one_task_report_correction on public.task_reports(supersedes_id) where supersedes_id is not null;
create index task_report_occurrence on public.task_reports(household_id,task_occurrence_id,created_at);

alter table public.outbox_events
 add column payload jsonb not null default '{"schema_version":"1"}',
 add column idempotency_key text,
 add column not_before timestamptz,
 add column expires_at timestamptz,
 add column attempts integer not null default 0,
 add column locked_at timestamptz;
update public.outbox_events set idempotency_key=id::text where idempotency_key is null;
alter table public.outbox_events alter column idempotency_key set not null;
alter table public.outbox_events alter column idempotency_key set default gen_random_uuid()::text;
alter table public.outbox_events add unique(household_id,idempotency_key);
alter table public.outbox_events add unique(household_id,id);
alter table public.outbox_events add check(state in ('pending','processing','done','canceled','failed','uncertain'));
alter table public.outbox_events add check(jsonb_typeof(payload)='object');
create index outbox_ready on public.outbox_events(state,not_before,created_at);

create table public.deliveries (
 id uuid primary key default gen_random_uuid(), household_id uuid not null,
 outbox_event_id uuid not null, channel text not null check(channel in ('internal','email')),
 recipient_id uuid, provider_message_id text, attempt integer not null check(attempt>0),
 status text not null check(status in ('queued','provider_accepted','delivered','failed','uncertain','canceled')),
 last_error_code text, created_at timestamptz not null default now(), unique(household_id,id),
 foreign key(household_id,outbox_event_id) references public.outbox_events(household_id,id),
 foreign key(household_id,recipient_id) references public.memberships(household_id,profile_id),
 unique(outbox_event_id,channel,recipient_id)
);
create index delivery_recipient on public.deliveries(household_id,recipient_id,status,created_at desc);

create function private.immutable_task_history() returns trigger language plpgsql set search_path='' as $$
begin raise exception 'history is append-only' using errcode='23514'; end $$;
create trigger immutable_task_reports before update or delete on public.task_reports for each row execute function private.immutable_task_history();
create trigger immutable_task_claims before update or delete on public.task_claims for each row execute function private.immutable_task_history();
create trigger immutable_deliveries before update or delete on public.deliveries for each row execute function private.immutable_task_history();

do $$ declare t text; begin
 foreach t in array array['routine_rules','task_occurrences','task_claims','task_reports','deliveries'] loop
  execute format('alter table public.%I enable row level security',t);
  execute format('revoke all on public.%I from anon,authenticated',t);
  execute format('grant select on public.%I to authenticated',t);
 end loop;
end $$;
create policy routine_read on public.routine_rules for select to authenticated using(private.can_read_pet(household_id,pet_id));
create policy occurrence_read on public.task_occurrences for select to authenticated using(
 (routine_rule_id is not null and exists(select 1 from public.routine_rules r where r.id=task_occurrences.routine_rule_id and private.can_read_pet(r.household_id,r.pet_id)))
 or (plan_step_id is not null and exists(select 1 from public.plan_steps s join public.plan_revisions p on p.id=s.plan_revision_id where s.id=task_occurrences.plan_step_id and private.can_read_case(p.household_id,p.case_id))));
create policy task_claim_read on public.task_claims for select to authenticated using(exists(
 select 1 from public.task_occurrences o left join public.routine_rules r on r.id=o.routine_rule_id left join public.plan_steps s on s.id=o.plan_step_id left join public.plan_revisions p on p.id=s.plan_revision_id
 where o.id=task_claims.task_occurrence_id and ((r.id is not null and private.can_read_pet(r.household_id,r.pet_id)) or (p.id is not null and private.can_read_case(p.household_id,p.case_id)))));
create policy task_report_read on public.task_reports for select to authenticated using(exists(
 select 1 from public.task_occurrences o left join public.routine_rules r on r.id=o.routine_rule_id left join public.plan_steps s on s.id=o.plan_step_id left join public.plan_revisions p on p.id=s.plan_revision_id
 where o.id=task_reports.task_occurrence_id and ((r.id is not null and private.can_read_pet(r.household_id,r.pet_id)) or (p.id is not null and private.can_read_case(p.household_id,p.case_id)))));
create policy delivery_read on public.deliveries for select to authenticated using(recipient_id=(select auth.uid()) and private.has_membership(household_id));
revoke all on function private.immutable_task_history(),private.valid_routine_timezone() from public;
