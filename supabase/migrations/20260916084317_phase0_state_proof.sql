-- Phase 0 only. No live content approval path or customer onboarding.
create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated;

create table public.households (
 id uuid primary key default gen_random_uuid(), owner_id uuid not null references auth.users(id),
 nickname text not null, mode text not null default 'demo' check (mode in ('demo','live')),
 fictional boolean not null default true, timezone text not null default 'Africa/Cairo', locale text not null default 'en',
 safety_epoch integer not null default 1 check (safety_epoch >= 0), home_version integer not null default 1,
 expires_at timestamptz not null default now()+interval '24 hours', created_at timestamptz not null default now(),
 check (mode <> 'demo' or fictional)
);
create table public.memberships (
 id uuid primary key default gen_random_uuid(), household_id uuid not null references public.households(id),
 profile_id uuid not null references auth.users(id), role text not null check(role in ('owner','caregiver','sitter','reader')),
 case_scope uuid[], pet_scope uuid[], expires_at timestamptz, revoked_at timestamptz,
 check (role <> 'sitter' or expires_at is not null), unique(household_id,profile_id)
);
create unique index single_owner on public.memberships(household_id) where role='owner' and revoked_at is null;
create index membership_actor on public.memberships(profile_id,household_id,expires_at,revoked_at);

create table public.protocol_versions (
 id uuid primary key default gen_random_uuid(), slug text unique not null,
 pairing text not null check(pairing in ('cat_cat','dog_dog','cat_dog','single_cat','single_dog','coordination')),
 newcomer_species text, version text not null, locale text not null default 'en',
 status text not null check(status in ('demo_only','draft','in_review','approved','revoked','expired')),
 content jsonb not null, digest text not null, reviewer_id uuid, reviewed_digest text, review_due_at timestamptz,
 revoked_at timestamptz, source_ids text[] not null,
 -- This phase has no genuine review workflow. Approval cannot be seeded or forged.
 check(status <> 'approved'), check(reviewer_id is null and reviewed_digest is null)
);
create table public.pets (
 id uuid primary key default gen_random_uuid(), household_id uuid not null references public.households(id),
 nickname text not null, species text not null check(species in ('cat','dog')), unique(household_id,id)
);
create index pets_household on public.pets(household_id);
create table public.cases (
 id uuid primary key default gen_random_uuid(), household_id uuid not null references public.households(id),
 title text not null, scenario_code text not null,
 support_level text not null default 'coordination_only' check(support_level in ('coordination_only','clarification_required','professional_required')),
 status text not null default 'active' check(status in ('active','paused')), unique(household_id,id)
);
create index cases_household on public.cases(household_id);
create table public.case_pets (
 household_id uuid not null, case_id uuid not null, pet_id uuid not null,
 role text not null check(role in ('resident','newcomer','affected')),
 primary key(household_id,case_id,pet_id),
 foreign key(household_id,case_id) references public.cases(household_id,id),
 foreign key(household_id,pet_id) references public.pets(household_id,id)
);
create index case_pets_pet on public.case_pets(household_id,pet_id);
create table public.plan_revisions (
 id uuid primary key default gen_random_uuid(), household_id uuid not null, case_id uuid not null,
 protocol_version_id uuid not null references public.protocol_versions(id),
 revision_number integer not null default 1, safety_epoch integer not null, home_version integer not null,
 participant_digest text not null, digest text not null,
 status text not null default 'demo_ready' check(status in ('demo_ready','paused','stale')),
 current_step text not null default 'view-context',
 unique(household_id,id), unique(household_id,case_id,revision_number),
 foreign key(household_id,case_id) references public.cases(household_id,id)
);
create index plans_protocol on public.plan_revisions(protocol_version_id);
create table public.observations (
 id uuid primary key default gen_random_uuid(), household_id uuid not null, case_id uuid not null,
 reporter_id uuid not null references auth.users(id), raw_report text not null check(length(raw_report) between 1 and 1500),
 actor_pet_id uuid, target_pet_id uuid, assertion text not null check(assertion in ('affirmed','negated','uncertain')),
 source_kind text not null check(source_kind in ('typed','structured','voice')),
 status text not null default 'draft' check(status in ('draft','confirmed')),
 observed_at timestamptz, reported_at timestamptz not null default now(), confirmed_at timestamptz,
 digest text not null, unique(household_id,id),
 check(target_pet_id is null or target_pet_id <> actor_pet_id),
 foreign key(household_id,case_id) references public.cases(household_id,id),
 foreign key(household_id,case_id,actor_pet_id) references public.case_pets(household_id,case_id,pet_id),
 foreign key(household_id,case_id,target_pet_id) references public.case_pets(household_id,case_id,pet_id)
);
create index observations_case on public.observations(household_id,case_id,reported_at desc);
create table public.safety_holds (
 id uuid primary key default gen_random_uuid(), household_id uuid not null, case_id uuid not null,
 origin_observation_id uuid, policy_level text not null check(policy_level in ('clarification','professional')),
 reason text not null, created_epoch integer not null, created_at timestamptz not null default now(),
 foreign key(household_id,case_id) references public.cases(household_id,id),
 foreign key(household_id,origin_observation_id) references public.observations(household_id,id)
);
create index holds_case on public.safety_holds(household_id,case_id);
create table public.handovers (
 id uuid primary key default gen_random_uuid(), household_id uuid not null, case_id uuid not null,
 safety_epoch integer not null, body text not null, actor_id uuid not null references auth.users(id),
 source_observation_id uuid, created_at timestamptz not null default now(),
 foreign key(household_id,case_id) references public.cases(household_id,id),
 foreign key(household_id,source_observation_id) references public.observations(household_id,id)
);
create index handovers_epoch on public.handovers(household_id,safety_epoch desc);
create table public.audit_events (
 id uuid primary key default gen_random_uuid(), household_id uuid not null references public.households(id),
 actor_id uuid not null references auth.users(id), event_type text not null,
 safety_epoch integer not null, created_at timestamptz not null default now()
);
create index audit_household on public.audit_events(household_id);
create table public.outbox_events (
 id uuid primary key default gen_random_uuid(), household_id uuid not null references public.households(id),
 event_type text not null, expected_safety_epoch integer not null, state text not null default 'pending',
 created_at timestamptz not null default now()
);
create index outbox_household on public.outbox_events(household_id,state);
create table private.idempotency (
 household_id uuid not null references public.households(id), actor_id uuid not null references auth.users(id),
 key text not null, body_hash text not null, result jsonb not null, created_at timestamptz not null default now(),
 primary key(household_id,actor_id,key)
);
create table private.provider_calls (
 id uuid primary key default gen_random_uuid(), household_id uuid not null references public.households(id),
 actor_id uuid not null references auth.users(id), provider text not null,
 outcome text not null default 'reserved', request_id text, error_code text, usage jsonb,
 created_at timestamptz not null default now()
);
create index provider_budget on private.provider_calls(household_id,actor_id,created_at);

create function private.has_membership(h uuid) returns boolean language sql stable security definer
set search_path = '' as $$
 select exists(select 1 from public.memberships m join public.households h1 on h1.id=m.household_id
 where m.household_id=h and m.profile_id=auth.uid() and m.revoked_at is null
 and (m.expires_at is null or m.expires_at>now()) and h1.expires_at>now()
 and exists(select 1 from auth.sessions s where s.id::text=auth.jwt()->>'session_id' and s.user_id=auth.uid() and (s.not_after is null or s.not_after>now())));
$$;
create function private.can_read_case(h uuid,c uuid) returns boolean language sql stable security definer
set search_path = '' as $$
 select exists(select 1 from public.memberships m where m.household_id=h and m.profile_id=auth.uid()
 and private.has_membership(h) and (m.case_scope is null or c=any(m.case_scope))
 and (m.pet_scope is null or not exists(select 1 from public.case_pets cp where cp.household_id=h and cp.case_id=c and not(cp.pet_id=any(m.pet_scope)))));
$$;
create function private.can_read_pet(h uuid,p uuid) returns boolean language sql stable security definer
set search_path = '' as $$
 select exists(select 1 from public.memberships m where m.household_id=h and m.profile_id=auth.uid()
 and private.has_membership(h) and (m.pet_scope is null or p=any(m.pet_scope))
 and (m.case_scope is null or exists(select 1 from public.case_pets cp where cp.household_id=h and cp.pet_id=p and cp.case_id=any(m.case_scope))));
$$;
revoke all on function private.has_membership(uuid), private.can_read_case(uuid,uuid), private.can_read_pet(uuid,uuid) from public;
grant execute on function private.has_membership(uuid), private.can_read_case(uuid,uuid), private.can_read_pet(uuid,uuid) to authenticated;

-- Data API and direct actor-scoped SQL are read only. Mutations have a single
-- server-only transaction boundary with rechecked live membership under lock.
do $$ declare t text; begin
 foreach t in array array['households','memberships','protocol_versions','pets','cases','case_pets','plan_revisions','observations','safety_holds','handovers','audit_events','outbox_events'] loop
  execute format('alter table public.%I enable row level security',t);
  execute format('revoke all on public.%I from anon,authenticated',t);
  execute format('grant select on public.%I to authenticated',t);
 end loop;
end $$;
alter table private.idempotency enable row level security;
alter table private.provider_calls enable row level security;
revoke all on private.idempotency,private.provider_calls from public,anon,authenticated;
create policy household_read on public.households for select to authenticated using(private.has_membership(id));
create policy own_membership on public.memberships for select to authenticated using(profile_id=auth.uid() and private.has_membership(household_id));
create policy pet_read on public.pets for select to authenticated using(private.can_read_pet(household_id,id));
create policy case_read on public.cases for select to authenticated using(private.can_read_case(household_id,id));
create policy case_pet_read on public.case_pets for select to authenticated using(private.can_read_case(household_id,case_id));
create policy plan_read on public.plan_revisions for select to authenticated using(private.can_read_case(household_id,case_id));
create policy observation_read on public.observations for select to authenticated using(private.can_read_case(household_id,case_id));
create policy hold_read on public.safety_holds for select to authenticated using(private.can_read_case(household_id,case_id));
create policy handover_read on public.handovers for select to authenticated using(private.can_read_case(household_id,case_id));
create policy protocol_read on public.protocol_versions for select to authenticated using(exists(select 1 from public.plan_revisions p where p.protocol_version_id=protocol_versions.id));
-- Audit/outbox have no user SELECT policies: internal metadata stays private.
