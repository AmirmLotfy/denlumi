-- Phase 4: explicit human session lifecycle and append-only observations.
-- Session content remains fictional/demo_only; no elapsed-time progression exists.

create table public.sessions (
 id uuid primary key default gen_random_uuid(), household_id uuid not null,
 case_id uuid not null, plan_revision_id uuid not null, protocol_version_id uuid not null,
 started_by uuid not null, state text not null check(state in ('preflight','active','paused','interrupted','finished','canceled')),
 safety_epoch integer not null check(safety_epoch>=0), home_version integer not null check(home_version>=0),
 plan_digest text not null check(plan_digest ~ '^[a-f0-9]{64}$'),
 last_checkpoint_at timestamptz, ended_at timestamptz, interruption_reason text,
 idempotency_key text not null check(length(idempotency_key) between 16 and 100),
 created_at timestamptz not null default now(), unique(household_id,id),
 foreign key(household_id,case_id) references public.cases(household_id,id),
 foreign key(household_id,plan_revision_id) references public.plan_revisions(household_id,id),
 foreign key(household_id,started_by) references public.memberships(household_id,profile_id),
 foreign key(protocol_version_id) references public.protocol_versions(id),
 unique(household_id,started_by,idempotency_key)
);
create unique index one_unresolved_session_per_household on public.sessions(household_id)
 where state in ('preflight','active','paused','interrupted');
create index sessions_case_history on public.sessions(household_id,case_id,created_at desc);
create index sessions_checkpoint on public.sessions(state,last_checkpoint_at);

create table public.session_pets (
 id uuid primary key default gen_random_uuid(), household_id uuid not null,
 session_id uuid not null, case_id uuid not null, pet_id uuid not null,
 created_at timestamptz not null default now(), unique(household_id,id), unique(session_id,pet_id),
 foreign key(household_id,session_id) references public.sessions(household_id,id),
 foreign key(household_id,case_id,pet_id) references public.case_pets(household_id,case_id,pet_id)
);
create index session_pet_reference on public.session_pets(household_id,pet_id);

create function private.require_session_pet() returns trigger language plpgsql set search_path='' as $$
declare s uuid; begin
 s:=case when tg_table_name='sessions' then (to_jsonb(new)->>'id')::uuid when tg_op='DELETE' then (to_jsonb(old)->>'session_id')::uuid else (to_jsonb(new)->>'session_id')::uuid end;
 if exists(select 1 from public.sessions where id=s) and not exists(select 1 from public.session_pets where session_id=s)
 then raise exception 'session requires participant' using errcode='23514'; end if;
 return null;
end $$;
create constraint trigger session_has_pet after insert on public.sessions deferrable initially deferred for each row execute function private.require_session_pet();
create constraint trigger last_session_pet after delete or update on public.session_pets deferrable initially deferred for each row execute function private.require_session_pet();

alter table public.observations
 add column session_id uuid,
 add column behavior_code text,
 add column normalized_observation jsonb not null default '{"schema_version":"1","values":{},"unknowns":[]}',
 add column context_snapshot jsonb not null default '{"schema_version":"1","context_key":"home"}',
 add column supersedes_id uuid,
 add column correction_reason text;
alter table public.observations drop constraint observations_status_check;
alter table public.observations add check(status in ('draft','confirmed','corrected'));
alter table public.observations drop constraint observations_source_kind_check;
alter table public.observations add check(source_kind in ('typed','structured','voice','professional_note'));
alter table public.observations add check(jsonb_typeof(normalized_observation)='object');
alter table public.observations add check(jsonb_typeof(context_snapshot)='object');
alter table public.observations add check(status='draft' or actor_pet_id is not null);
alter table public.observations add unique(household_id,case_id,id);
alter table public.observations add foreign key(household_id,session_id) references public.sessions(household_id,id);
alter table public.observations add foreign key(household_id,case_id,supersedes_id) references public.observations(household_id,case_id,id);
create index observations_session on public.observations(household_id,session_id,reported_at desc);
create unique index one_correction_per_observation on public.observations(supersedes_id) where supersedes_id is not null;

alter table public.safety_holds
 add column pet_id uuid,
 add column pair_id uuid,
 add column reason_code text not null default 'LEGACY_RESTRICTION',
 add column state text not null default 'active' check(state in ('active','resolved')),
 add column resolution_note text,
 add column resolved_by uuid references public.profiles(id),
 add column resolved_at timestamptz;
alter table public.safety_holds drop constraint safety_holds_policy_level_check;
alter table public.safety_holds add check(policy_level in ('clarification','professional','urgent'));
alter table public.safety_holds add foreign key(household_id,pet_id) references public.pets(household_id,id);
alter table public.safety_holds add foreign key(household_id,pair_id) references public.pet_pairs(household_id,id);
create index active_holds_scope on public.safety_holds(household_id,case_id,state);

alter table public.audit_events alter column actor_id drop not null;
alter table public.handovers alter column actor_id drop not null;
alter table public.audit_events
 add column entity_type text,
 add column entity_id uuid,
 add column metadata jsonb not null default '{}';
alter table public.audit_events add check(jsonb_typeof(metadata)='object');

create function private.immutable_observation_history() returns trigger language plpgsql set search_path='' as $$
begin
 if tg_op='DELETE' then raise exception 'observations are append-only' using errcode='23514'; end if;
 if to_jsonb(old)-'status'-'confirmed_at' is distinct from to_jsonb(new)-'status'-'confirmed_at'
 then raise exception 'observation content is immutable' using errcode='23514'; end if;
 if not ((old.status='draft' and new.status in ('draft','confirmed')) or (old.status='confirmed' and new.status in ('confirmed','corrected')) or old.status=new.status)
 then raise exception 'invalid observation transition' using errcode='23514'; end if;
 return new;
end $$;
create trigger immutable_observation_history before update or delete on public.observations for each row execute function private.immutable_observation_history();

create function private.session_transition_guard() returns trigger language plpgsql set search_path='' as $$
begin
 if tg_op='DELETE' then raise exception 'session history is append-only' using errcode='23514'; end if;
 if to_jsonb(old)-'state'-'last_checkpoint_at'-'ended_at'-'interruption_reason' is distinct from to_jsonb(new)-'state'-'last_checkpoint_at'-'ended_at'-'interruption_reason'
 then raise exception 'session binding is immutable' using errcode='23514'; end if;
 if (old.state='preflight' and new.state not in ('preflight','active','canceled'))
 or (old.state='active' and new.state not in ('active','paused','interrupted','finished','canceled'))
 or (old.state='paused' and new.state not in ('paused','active','interrupted','finished','canceled'))
 or (old.state='interrupted' and new.state not in ('interrupted','active','canceled'))
 or (old.state in ('finished','canceled') and new.state<>old.state)
 then raise exception 'invalid session transition' using errcode='23514'; end if;
 return new;
end $$;
create trigger session_transition_guard before update or delete on public.sessions for each row execute function private.session_transition_guard();

alter table public.sessions enable row level security;
alter table public.session_pets enable row level security;
revoke all on public.sessions,public.session_pets from anon,authenticated;
grant select on public.sessions,public.session_pets to authenticated;
create policy session_read on public.sessions for select to authenticated using(private.can_read_case(household_id,case_id));
create policy session_pet_read on public.session_pets for select to authenticated using(private.can_read_case(household_id,case_id) and private.can_read_pet(household_id,pet_id));
revoke all on function private.require_session_pet(),private.immutable_observation_history(),private.session_transition_guard() from public;
