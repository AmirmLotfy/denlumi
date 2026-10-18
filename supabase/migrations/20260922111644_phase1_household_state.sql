-- Phase 1: identity and household graph. No content approval or live guidance.
create table public.profiles (
 id uuid primary key references auth.users(id), auth_subject text not null unique,
 display_name text not null default '' check(length(display_name)<=80),
 status text not null default 'active' check(status in ('active','disabled')),
 reviewer_scope jsonb check(reviewer_scope is null or jsonb_typeof(reviewer_scope)='object'),
 created_at timestamptz not null default now(), check(auth_subject=id::text)
);
insert into public.profiles(id,auth_subject) select id,id::text from auth.users;
create function private.create_profile() returns trigger language plpgsql security definer set search_path='' as $$
begin insert into public.profiles(id,auth_subject) values(new.id,new.id::text); return new; end $$;
revoke all on function private.create_profile() from public;
create trigger identity_profile after insert on auth.users for each row execute function private.create_profile();
create table private.operator_roles (
 profile_id uuid not null references public.profiles(id), role text not null check(role in ('support','content_admin')),
 primary key(profile_id,role)
);
alter table private.operator_roles enable row level security;
revoke all on private.operator_roles from public,anon,authenticated;
-- A profile UUID intentionally equals the verified Supabase subject. Existing attribution remains stable.
alter table public.households drop constraint households_owner_id_fkey;
alter table public.households add foreign key(owner_id) references public.profiles(id);
alter table public.memberships drop constraint memberships_profile_id_fkey;
alter table public.memberships add foreign key(profile_id) references public.profiles(id);
alter table public.households add column status text not null default 'active' check(status in ('active','suspended','deleting')),
 add column state_version integer not null default 1 check(state_version>0),
 add column adult_acknowledged_at timestamptz,
 add column notification_preferences jsonb not null default '{"internal_inbox":true,"email":false}' check(notification_preferences = '{"internal_inbox":true,"email":false}'::jsonb),
 add constraint positive_home_version check(home_version>=0);
create index households_owner on public.households(owner_id);
alter table public.memberships add column created_at timestamptz not null default now(),
 add column invited_by uuid references public.profiles(id), add unique(household_id,id);
create index membership_inviter on public.memberships(invited_by);
alter table public.pets add column age_band text check(length(age_band)<=80),
 add column approx_birth_date date, add column arrival_date date,
 add column context_notes jsonb not null default '{"schema_version":1,"reported_history":null,"accessibility_notes":null}'
 check(jsonb_typeof(context_notes)='object' and context_notes->>'schema_version'='1'),
 add column archived_at timestamptz, add column created_at timestamptz not null default now(),
 add column version integer not null default 1 check(version>0),
 add constraint pet_name_length check(length(btrim(nickname)) between 1 and 80);
alter table public.cases add column created_at timestamptz not null default now();
alter table public.case_pets add column id uuid not null default gen_random_uuid() unique,
 add column created_at timestamptz not null default now();
alter table public.case_pets drop constraint case_pets_role_check;
alter table public.case_pets add check(role in ('resident','newcomer','returning','affected'));
create index cases_status on public.cases(household_id,status);

-- Normalized mirrors give scope arrays real composite foreign keys. Arrays remain the API contract.
create table private.membership_pet_scopes (
 household_id uuid not null, membership_id uuid not null, pet_id uuid not null,
 primary key(household_id,membership_id,pet_id),
 foreign key(household_id,membership_id) references public.memberships(household_id,id) on delete cascade,
 foreign key(household_id,pet_id) references public.pets(household_id,id)
);
create index membership_pet_reference on private.membership_pet_scopes(household_id,pet_id);
create table private.membership_case_scopes (
 household_id uuid not null, membership_id uuid not null, case_id uuid not null,
 primary key(household_id,membership_id,case_id),
 foreign key(household_id,membership_id) references public.memberships(household_id,id) on delete cascade,
 foreign key(household_id,case_id) references public.cases(household_id,id)
);
create index membership_case_reference on private.membership_case_scopes(household_id,case_id);
alter table private.membership_pet_scopes enable row level security;
alter table private.membership_case_scopes enable row level security;
revoke all on private.membership_pet_scopes,private.membership_case_scopes from public,anon,authenticated;
create function private.sync_member_scopes() returns trigger language plpgsql set search_path='' as $$
begin
 if (new.pet_scope is not null and (array_position(new.pet_scope,null) is not null or cardinality(new.pet_scope)<>(select count(distinct x) from unnest(new.pet_scope) x)))
 or (new.case_scope is not null and (array_position(new.case_scope,null) is not null or cardinality(new.case_scope)<>(select count(distinct x) from unnest(new.case_scope) x))) then
 raise exception 'invalid scope array' using errcode='23514'; end if;
 delete from private.membership_pet_scopes where membership_id=new.id;
 delete from private.membership_case_scopes where membership_id=new.id;
 insert into private.membership_pet_scopes select new.household_id,new.id,x from unnest(new.pet_scope) x;
 insert into private.membership_case_scopes select new.household_id,new.id,x from unnest(new.case_scope) x;
 return new;
end $$;
create trigger membership_scopes after insert or update of pet_scope,case_scope,household_id on public.memberships for each row execute function private.sync_member_scopes();
update public.memberships set pet_scope=pet_scope;

create table public.pet_pairs (
 id uuid primary key default gen_random_uuid(), household_id uuid not null references public.households(id),
 pet_a_id uuid not null, pet_b_id uuid not null, created_at timestamptz not null default now(),
 check(pet_a_id<pet_b_id), unique(household_id,pet_a_id,pet_b_id), unique(household_id,id),
 unique(household_id,id,pet_a_id,pet_b_id),
 foreign key(household_id,pet_a_id) references public.pets(household_id,id),
 foreign key(household_id,pet_b_id) references public.pets(household_id,id)
);
create index pairs_pet_b on public.pet_pairs(household_id,pet_b_id);
create table public.pair_contexts (
 id uuid primary key default gen_random_uuid(), household_id uuid not null, case_id uuid not null, pair_id uuid not null,
 -- Copied endpoints are constrained to the exact canonical pair and case participants.
 pet_a_id uuid not null, pet_b_id uuid not null,
 context_key text not null check(length(btrim(context_key)) between 1 and 120),
 status text not null default 'unreviewed' check(status in ('unreviewed','in_progress','paused','management_plan')),
 last_observation_at timestamptz, created_at timestamptz not null default now(),
 unique(household_id,case_id,pair_id,context_key),
 foreign key(household_id,pair_id,pet_a_id,pet_b_id) references public.pet_pairs(household_id,id,pet_a_id,pet_b_id),
 foreign key(household_id,case_id,pet_a_id) references public.case_pets(household_id,case_id,pet_id),
 foreign key(household_id,case_id,pet_b_id) references public.case_pets(household_id,case_id,pet_id)
);
create index context_pair on public.pair_contexts(household_id,pair_id,pet_a_id,pet_b_id);
create index context_pet_a on public.pair_contexts(household_id,case_id,pet_a_id);
create index context_pet_b on public.pair_contexts(household_id,case_id,pet_b_id);
create function private.context_endpoints() returns trigger language plpgsql set search_path='' as $$
begin
 select pet_a_id,pet_b_id into new.pet_a_id,new.pet_b_id from public.pet_pairs where household_id=new.household_id and id=new.pair_id;
 if not found then raise exception 'pair outside scope' using errcode='23503'; end if;
 return new;
end $$;
create trigger context_endpoints before insert or update on public.pair_contexts for each row execute function private.context_endpoints();

-- Deferred so household/case and their mandatory children can be created atomically.
create function private.require_case_pet() returns trigger language plpgsql set search_path='' as $$
declare c uuid; begin
 c:=case when tg_table_name='cases' then (to_jsonb(new)->>'id')::uuid when tg_op='DELETE' then (to_jsonb(old)->>'case_id')::uuid else (to_jsonb(new)->>'case_id')::uuid end;
 if exists(select 1 from public.cases where id=c) and not exists(select 1 from public.case_pets where case_id=c) then
 raise exception 'case requires participant' using errcode='23514'; end if;
 
 return null; end $$;
create constraint trigger case_has_pet after insert or update on public.cases deferrable initially deferred for each row execute function private.require_case_pet();
create constraint trigger last_case_pet after delete or update on public.case_pets deferrable initially deferred for each row execute function private.require_case_pet();
-- Serialize participant removal to avoid concurrent deletes leaving an empty case.
create function private.lock_participant_case() returns trigger language plpgsql set search_path='' as $$
begin perform 1 from public.cases where id=old.case_id for update; return old; end $$;
create trigger lock_case_participant before delete on public.case_pets for each row execute function private.lock_participant_case();
create function private.check_owner() returns trigger language plpgsql set search_path='' as $$
declare h uuid; begin
 h:=case when tg_table_name='households' then (to_jsonb(new)->>'id')::uuid when tg_op='DELETE' then (to_jsonb(old)->>'household_id')::uuid else (to_jsonb(new)->>'household_id')::uuid end;
 if exists(select 1 from public.households where id=h) and not exists(select 1 from public.households x join public.memberships m on m.household_id=x.id and m.profile_id=x.owner_id where x.id=h and m.role='owner' and m.revoked_at is null and m.expires_at is null and m.pet_scope is null and m.case_scope is null) then
 raise exception 'household requires matching unrestricted owner' using errcode='23514'; end if;
 return null; end $$;
create constraint trigger household_owner after insert or update on public.households deferrable initially deferred for each row execute function private.check_owner();
create constraint trigger member_owner after insert or update or delete on public.memberships deferrable initially deferred for each row execute function private.check_owner();
create function private.valid_timezone() returns trigger language plpgsql set search_path='' as $$
begin if not exists(select 1 from pg_catalog.pg_timezone_names where name=new.timezone) then raise exception 'invalid timezone' using errcode='23514'; end if; return new; end $$;
create trigger household_timezone before insert or update of timezone on public.households for each row execute function private.valid_timezone();

create or replace function private.has_membership(h uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.memberships m join public.households x on x.id=m.household_id join public.profiles p on p.id=m.profile_id
 where m.household_id=h and m.profile_id=auth.uid() and p.status='active' and x.status='active'
 and m.revoked_at is null and (m.expires_at is null or m.expires_at>now()) and x.expires_at>now()
 and exists(select 1 from auth.sessions s where s.id::text=auth.jwt()->>'session_id' and s.user_id=auth.uid() and (s.not_after is null or s.not_after>now())));
$$;
create function private.active_identity() returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.profiles p join auth.sessions s on s.user_id=p.id where p.id=auth.uid() and p.status='active' and s.id::text=auth.jwt()->>'session_id' and (s.not_after is null or s.not_after>now()));
$$;
revoke all on function private.active_identity() from public;
grant execute on function private.active_identity() to authenticated;
alter table public.profiles enable row level security;
alter table public.pet_pairs enable row level security;
alter table public.pair_contexts enable row level security;
revoke all on public.profiles,public.pet_pairs,public.pair_contexts from anon,authenticated;
-- Reviewer scope is privileged metadata, never returned to clients via SELECT *.
grant select(id,auth_subject,display_name,status,created_at) on public.profiles to authenticated;
grant select on public.pet_pairs,public.pair_contexts to authenticated;
create policy own_profile on public.profiles for select to authenticated using(id=auth.uid() and private.active_identity());
create policy pair_read on public.pet_pairs for select to authenticated using(private.can_read_pet(household_id,pet_a_id) and private.can_read_pet(household_id,pet_b_id));
create policy context_read on public.pair_contexts for select to authenticated using(private.can_read_case(household_id,case_id));
-- Functions called only by triggers never need client execution grants.
revoke all on function private.sync_member_scopes(),private.context_endpoints(),private.require_case_pet(),private.lock_participant_case(),private.check_owner(),private.valid_timezone() from public;

-- Live household records are coordination-only; demo expiry is still mandatory.
alter table public.households alter column expires_at drop not null;
alter table public.households add check(mode<>'demo' or expires_at is not null);
create table private.household_creations (
 actor_id uuid not null references public.profiles(id), key text not null, body_hash text not null,
 household_id uuid not null references public.households(id), created_at timestamptz not null default now(),
 primary key(actor_id,key)
);
create index creation_household on private.household_creations(household_id);
alter table private.household_creations enable row level security;
revoke all on private.household_creations from public,anon,authenticated;
create or replace function private.has_membership(h uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.memberships m join public.households x on x.id=m.household_id join public.profiles p on p.id=m.profile_id
 where m.household_id=h and m.profile_id=auth.uid() and p.status='active' and x.status='active'
 and m.revoked_at is null and (m.expires_at is null or m.expires_at>now()) and (x.expires_at is null or x.expires_at>now())
 and exists(select 1 from auth.sessions s where s.id::text=auth.jwt()->>'session_id' and s.user_id=auth.uid() and (s.not_after is null or s.not_after>now())));
$$;

create function private.immutable_identity() returns trigger language plpgsql set search_path='' as $$
begin
 if to_jsonb(old)->'id' is distinct from to_jsonb(new)->'id'
 or to_jsonb(old)->'household_id' is distinct from to_jsonb(new)->'household_id'
 or (tg_table_name='case_pets' and (to_jsonb(old)->'case_id' is distinct from to_jsonb(new)->'case_id' or to_jsonb(old)->'pet_id' is distinct from to_jsonb(new)->'pet_id'))
 or (tg_table_name='memberships' and to_jsonb(old)->'profile_id' is distinct from to_jsonb(new)->'profile_id') then
 raise exception 'identity and tenant references are immutable' using errcode='23514'; end if;
 return new;
end $$;
revoke all on function private.immutable_identity() from public;
do $$ declare t text; begin
 foreach t in array array['households','memberships','pets','cases','case_pets','pet_pairs','pair_contexts'] loop
 execute format('create trigger immutable_identity before update on public.%I for each row execute function private.immutable_identity()',t);
 end loop;
end $$;

-- Upgrade existing fictional cases without claiming a reviewed relationship.
insert into public.pet_pairs(household_id,pet_a_id,pet_b_id)
 select distinct a.household_id,a.pet_id,b.pet_id from public.case_pets a
 join public.case_pets b on b.household_id=a.household_id and b.case_id=a.case_id and a.pet_id<b.pet_id
 on conflict(household_id,pet_a_id,pet_b_id) do nothing;
insert into public.pair_contexts(household_id,case_id,pair_id,context_key)
 select a.household_id,a.case_id,p.id,'home' from public.case_pets a
 join public.case_pets b on b.household_id=a.household_id and b.case_id=a.case_id and a.pet_id<b.pet_id
 join public.pet_pairs p on p.household_id=a.household_id and p.pet_a_id=a.pet_id and p.pet_b_id=b.pet_id
 on conflict(household_id,case_id,pair_id,context_key) do nothing;
-- Preserve attribution while binding every human reference to the identity registry.
alter table public.observations drop constraint observations_reporter_id_fkey;
alter table public.observations add foreign key(reporter_id) references public.profiles(id);
alter table public.handovers drop constraint handovers_actor_id_fkey;
alter table public.handovers add foreign key(actor_id) references public.profiles(id);
alter table public.audit_events drop constraint audit_events_actor_id_fkey;
alter table public.audit_events add foreign key(actor_id) references public.profiles(id);
create index observation_reporter on public.observations(reporter_id);
create index handover_actor on public.handovers(actor_id);
create index audit_actor on public.audit_events(actor_id);

alter policy own_membership on public.memberships using(profile_id=(select auth.uid()) and private.has_membership(household_id));
alter policy own_profile on public.profiles using(id=(select auth.uid()) and (select private.active_identity()));
-- Verify upgraded rows against mandatory-child/owner constraints as well as new inserts.
update public.cases set title=title;
update public.households set nickname=nickname;

create index idempotency_actor on private.idempotency(actor_id);
create index provider_actor on private.provider_calls(actor_id);
create index handover_case on public.handovers(household_id,case_id);
create index handover_observation on public.handovers(household_id,source_observation_id);
create index observation_actor_pet on public.observations(household_id,case_id,actor_pet_id);
create index observation_target_pet on public.observations(household_id,case_id,target_pet_id);
create index hold_observation on public.safety_holds(household_id,origin_observation_id);
drop index public.cases_household; -- cases_status has the same leading household key.
create function private.monotonic_household() returns trigger language plpgsql set search_path='' as $$
begin
 if new.safety_epoch<old.safety_epoch or new.home_version<old.home_version or new.state_version<old.state_version then
 raise exception 'household versions cannot decrease' using errcode='23514'; end if;
 return new;
end $$;
revoke all on function private.monotonic_household() from public;
create trigger monotonic_household before update on public.households for each row execute function private.monotonic_household();
