-- Phase 3: versioned home plans, immutable plan revisions and exact handover acknowledgement.

alter table public.memberships add column accepted_at timestamptz;
update public.memberships m set accepted_at=m.created_at
where m.role='owner' or exists(select 1 from public.households h where h.id=m.household_id and h.mode='demo');

create table public.home_zones (
 id uuid primary key default gen_random_uuid(), household_id uuid not null references public.households(id),
 label text not null check(length(btrim(label)) between 1 and 120),
 home_version integer not null check(home_version>=0),
 arrangement_note text check(arrangement_note is null or length(arrangement_note)<=1500),
 reported_by uuid references public.profiles(id), reported_at timestamptz,
 created_at timestamptz not null default now(), unique(household_id,id),
 unique(household_id,home_version,label)
);
create index home_zone_reporter on public.home_zones(reported_by);

create table public.resources (
 id uuid primary key default gen_random_uuid(), household_id uuid not null, zone_id uuid not null,
 kind text not null check(kind in ('water','food','litter','rest','retreat','enrichment','barrier','other')),
 label text not null check(length(btrim(label)) between 1 and 120),
 status text not null check(status in ('planned','reported_present','unknown','removed')),
 created_at timestamptz not null default now(), unique(household_id,id),
 foreign key(household_id,zone_id) references public.home_zones(household_id,id)
);
create index resources_zone on public.resources(household_id,zone_id);

create table public.pet_resource_access (
 id uuid primary key default gen_random_uuid(), household_id uuid not null,
 pet_id uuid not null, resource_id uuid not null,
 access_plan text not null check(access_plan in ('exclusive','shared','separate_times','unknown')),
 version integer not null check(version>=0), created_at timestamptz not null default now(),
 unique(household_id,pet_id,resource_id,version),
 foreign key(household_id,pet_id) references public.pets(household_id,id),
 foreign key(household_id,resource_id) references public.resources(household_id,id)
);
create index resource_access_resource on public.pet_resource_access(household_id,resource_id);

create table public.home_responsibilities (
 id uuid primary key default gen_random_uuid(), household_id uuid not null,
 home_version integer not null check(home_version>=0), profile_id uuid not null,
 pet_id uuid, label text not null check(length(btrim(label)) between 1 and 160),
 status text not null default 'planned' check(status in ('planned','unknown','removed')),
 note text check(note is null or length(note)<=1000), created_at timestamptz not null default now(),
 unique(household_id,home_version,profile_id,pet_id,label),
 foreign key(household_id,profile_id) references public.memberships(household_id,profile_id),
 foreign key(household_id,pet_id) references public.pets(household_id,id)
);
create index home_responsibility_profile on public.home_responsibilities(household_id,profile_id);
create index home_responsibility_pet on public.home_responsibilities(household_id,pet_id);

alter table public.plan_revisions drop constraint plan_revisions_status_check;
alter table public.plan_revisions add check(status in ('draft','reviewed','active','demo_ready','paused','stale','superseded'));
alter table public.plan_revisions
 add column locale text not null default 'en',
 add column intake_digest text,
 add column home_digest text,
 add column protocol_digest text,
 add column created_at timestamptz not null default now();
alter table public.plan_revisions add check(digest ~ '^[a-f0-9]{64}$');
alter table public.plan_revisions add check(participant_digest ~ '^[a-f0-9]{64}$');
alter table public.plan_revisions add check(protocol_digest is null or protocol_digest ~ '^[a-f0-9]{64}$');

create table public.plan_steps (
 id uuid primary key default gen_random_uuid(), household_id uuid not null,
 plan_revision_id uuid not null, step_key text not null,
 sequence integer not null check(sequence>=0),
 status text not null default 'locked' check(status in ('locked','available','in_progress','review_needed','completed','canceled')),
 prerequisite_snapshot jsonb not null default '{"schema_version":"1","values":{},"unknowns":[]}',
 created_at timestamptz not null default now(),
 unique(plan_revision_id,step_key),
 foreign key(household_id,plan_revision_id) references public.plan_revisions(household_id,id),
 check(jsonb_typeof(prerequisite_snapshot)='object')
);
create index plan_steps_household on public.plan_steps(household_id,plan_revision_id,sequence);

create table public.plan_reviews (
 id uuid primary key default gen_random_uuid(), household_id uuid not null,
 plan_revision_id uuid not null, reviewer_id uuid not null references public.profiles(id),
 reviewed_digest text not null check(reviewed_digest ~ '^[a-f0-9]{64}$'),
 safety_epoch integer not null check(safety_epoch>=0),
 expires_at timestamptz, invalidated_at timestamptz,
 created_at timestamptz not null default now(),
 unique(plan_revision_id,reviewer_id,reviewed_digest),
 foreign key(household_id,plan_revision_id) references public.plan_revisions(household_id,id)
);
create index plan_review_reviewer on public.plan_reviews(reviewer_id);

alter table public.handovers alter column body type jsonb using jsonb_build_object(
 'schema_version','1','summary',body,'physical_state_verified',false
);
alter table public.handovers add column status text not null default 'published' check(status in ('draft','published','superseded')),
 add column plan_revision_id uuid,
 add column digest text,
 add column published_at timestamptz;
update public.handovers set digest=encode(extensions.digest(body::text,'sha256'),'hex'),published_at=created_at;
alter table public.handovers alter column digest set not null;
alter table public.handovers add check(digest ~ '^[a-f0-9]{64}$');
alter table public.handovers add unique(household_id,id);
alter table public.handovers add foreign key(household_id,plan_revision_id) references public.plan_revisions(household_id,id);

create table public.handover_acks (
 id uuid primary key default gen_random_uuid(), household_id uuid not null,
 handover_id uuid not null, profile_id uuid not null references public.profiles(id),
 acknowledged_digest text not null check(acknowledged_digest ~ '^[a-f0-9]{64}$'),
 acknowledged_at timestamptz not null default now(), created_at timestamptz not null default now(),
 unique(handover_id,profile_id,acknowledged_digest),
 foreign key(household_id,handover_id) references public.handovers(household_id,id)
);
create index handover_ack_profile on public.handover_acks(profile_id);

create function private.immutable_reviewed_plan() returns trigger language plpgsql set search_path='' as $$
begin
 if tg_op='DELETE' and old.status<>'draft' then raise exception 'reviewed plan history is immutable' using errcode='23514'; end if;
 if tg_op='UPDATE' and old.status<>'draft' and to_jsonb(old)-'status' is distinct from to_jsonb(new)-'status' then
   raise exception 'reviewed plan content is immutable' using errcode='23514'; end if;
 if tg_op='UPDATE' and old.status in ('reviewed','active','paused','stale','superseded','demo_ready')
    and new.status not in (old.status,'paused','stale','superseded') then
   raise exception 'reviewed plan cannot return to progression' using errcode='23514'; end if;
 return case when tg_op='DELETE' then old else new end;
end $$;
create trigger immutable_reviewed_plan before update or delete on public.plan_revisions for each row execute function private.immutable_reviewed_plan();

create function private.validate_plan_review() returns trigger language plpgsql set search_path='' as $$
declare p public.plan_revisions; h public.households; begin
 select * into p from public.plan_revisions where id=new.plan_revision_id and household_id=new.household_id;
 select * into h from public.households where id=new.household_id;
 if p.id is null or h.owner_id<>new.reviewer_id or p.digest<>new.reviewed_digest
    or p.safety_epoch<>new.safety_epoch or h.safety_epoch<>new.safety_epoch
    or p.home_version<>h.home_version then
   raise exception 'plan review does not match current owner state' using errcode='23514'; end if;
 return new;
end $$;
create trigger validate_plan_review before insert on public.plan_reviews for each row execute function private.validate_plan_review();

create function private.validate_handover_ack() returns trigger language plpgsql set search_path='' as $$
declare d text; accepted timestamptz; begin
 select digest into d from public.handovers where household_id=new.household_id and id=new.handover_id and status='published';
 select m.accepted_at into accepted from public.memberships m
 where m.household_id=new.household_id and m.profile_id=new.profile_id and m.revoked_at is null
 and (m.expires_at is null or m.expires_at>now());
 if d is null or d<>new.acknowledged_digest then
   raise exception 'handover digest changed' using errcode='23514'; end if;
 if accepted is null then raise exception 'adult member acceptance required' using errcode='23514'; end if;
 return new;
end $$;
create trigger validate_handover_ack before insert on public.handover_acks for each row execute function private.validate_handover_ack();

create function private.immutable_phase3_history() returns trigger language plpgsql set search_path='' as $$
begin
 if tg_op='DELETE' then raise exception 'review and handover history is append-only' using errcode='23514'; end if;
 if tg_table_name='plan_reviews' then
   if to_jsonb(old)-'invalidated_at' is distinct from to_jsonb(new)-'invalidated_at'
      or (old.invalidated_at is not null and new.invalidated_at is distinct from old.invalidated_at) then
     raise exception 'plan reviews are immutable except one-way invalidation' using errcode='23514'; end if;
   return new;
 end if;
 if tg_table_name='handovers' then
   if to_jsonb(old)-'status' is distinct from to_jsonb(new)-'status'
      or old.status<>'published' or new.status<>'superseded' then
     raise exception 'published handovers are immutable' using errcode='23514'; end if;
   return new;
 end if;
 raise exception 'acknowledgements are immutable' using errcode='23514';
end $$;
create trigger immutable_plan_reviews before update or delete on public.plan_reviews for each row execute function private.immutable_phase3_history();
create trigger immutable_handovers before update or delete on public.handovers for each row execute function private.immutable_phase3_history();
create trigger immutable_handover_acks before update or delete on public.handover_acks for each row execute function private.immutable_phase3_history();

do $$ declare t text; begin
 foreach t in array array['home_zones','resources','pet_resource_access','home_responsibilities','plan_steps','plan_reviews','handover_acks'] loop
  execute format('alter table public.%I enable row level security',t);
  execute format('revoke all on public.%I from anon,authenticated',t);
  execute format('grant select on public.%I to authenticated',t);
 end loop;
end $$;
create policy zone_read on public.home_zones for select to authenticated using(private.has_membership(household_id));
create policy resource_read on public.resources for select to authenticated using(private.has_membership(household_id));
create policy resource_access_read on public.pet_resource_access for select to authenticated using(private.can_read_pet(household_id,pet_id));
create policy responsibility_read on public.home_responsibilities for select to authenticated using(
 private.has_membership(household_id) and (pet_id is null or private.can_read_pet(household_id,pet_id)));
create policy plan_step_read on public.plan_steps for select to authenticated using(exists(
 select 1 from public.plan_revisions p where p.id=plan_steps.plan_revision_id and private.can_read_case(p.household_id,p.case_id)));
create policy plan_review_read on public.plan_reviews for select to authenticated using(exists(
 select 1 from public.plan_revisions p where p.id=plan_reviews.plan_revision_id and private.can_read_case(p.household_id,p.case_id)));
create policy handover_ack_read on public.handover_acks for select to authenticated using(profile_id=(select auth.uid()) and private.has_membership(household_id));

revoke all on function private.immutable_reviewed_plan(),private.validate_plan_review(),private.validate_handover_ack(),private.immutable_phase3_history() from public;
