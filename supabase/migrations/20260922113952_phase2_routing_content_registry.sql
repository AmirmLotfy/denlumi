-- Phase 2: structured routing and an immutable content registry.
-- This migration creates no professional approval and contains no practical guidance.

create table public.scenario_definitions (
 id text primary key check(id ~ '^SC(0[1-9]|1[0-7])$'),
 title text not null,
 expected_demo_route text not null check(expected_demo_route in ('guided_preparation','coordination_only','clarification_required','professional_required','urgent_help')),
 demo_protocol_slug text not null,
 live_protocol_approval_required boolean not null,
 release_boundary text not null,
 species_fixture text[] not null,
 created_at timestamptz not null default now()
);

insert into public.scenario_definitions(id,title,expected_demo_route,demo_protocol_slug,live_protocol_approval_required,release_boundary,species_fixture) values
 ('SC01','First cat at home','guided_preparation','demo-solo-cat-v1',true,'R0 demo; reviewed R1',array['cat']),
 ('SC02','First dog at home','guided_preparation','demo-solo-dog-v1',true,'R0 demo; reviewed R1',array['dog']),
 ('SC03','New cat with resident cat','guided_preparation','demo-cc-v1',true,'R0 demo; reviewed R1',array['cat','cat']),
 ('SC04','New dog with resident dog','guided_preparation','demo-dd-v1',true,'R0 demo; reviewed R1',array['dog','dog']),
 ('SC05','New cat with resident dog','guided_preparation','demo-dc-new-cat-v1',true,'R0 demo; reviewed R1',array['dog','cat']),
 ('SC06','New dog with resident cat','guided_preparation','demo-dc-new-dog-v1',true,'R0 demo; reviewed R1',array['cat','dog']),
 ('SC07','Three-pet home','coordination_only','demo-care-v1',false,'R0 coordination; reviewed pair guidance',array['cat','cat','dog']),
 ('SC08','Young newcomer and senior resident','clarification_required','demo-care-v1',false,'R0 route; relevant reviewed R1 module',array['dog','dog']),
 ('SC09','Return after vet stay','clarification_required','demo-care-v1',false,'R0 coordination; reviewed R1',array['cat','cat']),
 ('SC10','Move or home-layout change','coordination_only','demo-care-v1',false,'R0 coordination; reviewed R1 module',array['dog','cat']),
 ('SC11','Temporary sitter','coordination_only','demo-care-v1',false,'R0',array['cat','dog']),
 ('SC12','Everyday care reports','coordination_only','demo-care-v1',false,'R0',array['cat','dog']),
 ('SC13','Persistent conflict or chase concern','professional_required','demo-care-v1',false,'R0 routing',array['dog','cat']),
 ('SC14','Alone-time distress concern','professional_required','demo-care-v1',false,'R0 routing; later reviewed education',array['dog']),
 ('SC15','Visitor or child-related household change','coordination_only','demo-care-v1',false,'R0 routing; later reviewed education',array['dog']),
 ('SC16','Reported injury or severe distress','urgent_help','demo-care-v1',false,'R0 routing',array['cat']),
 ('SC17','Pet leaves or dies','coordination_only','demo-care-v1',false,'R1 coordination',array['cat']);

create table public.protocols (
 id uuid primary key default gen_random_uuid(),
 slug text not null unique,
 scenario_family text not null,
 pairing text not null check(pairing in ('cat_cat','dog_dog','cat_dog','single_cat','single_dog','coordination')),
 created_at timestamptz not null default now()
);

insert into public.protocols(slug,scenario_family,pairing)
select regexp_replace(slug,'-v[0-9]+$',''),
 case when pairing in ('single_cat','single_dog') then 'settling'
      when pairing='coordination' then 'coordination' else 'introduction' end,
 pairing
from public.protocol_versions;

alter table public.protocol_versions
 add column protocol_id uuid,
 add column content_schema_version text not null default '1',
 add column authored_by uuid references public.profiles(id),
 add column created_at timestamptz not null default now();

update public.protocol_versions v set protocol_id=p.id
from public.protocols p where p.slug=regexp_replace(v.slug,'-v[0-9]+$','');
alter table public.protocol_versions alter column protocol_id set not null;
alter table public.protocol_versions add foreign key(protocol_id) references public.protocols(id);
alter table public.protocol_versions add unique(protocol_id,version,locale);
alter table public.protocol_versions add check(digest ~ '^[a-f0-9]{64}$');

-- Phase 0 deliberately made approval impossible. Phase 2 models the lifecycle,
-- while an approval remains impossible unless an exact verified review exists.
alter table public.protocol_versions drop constraint protocol_versions_status_check;
alter table public.protocol_versions drop constraint protocol_versions_check;
alter table public.protocol_versions add check(status in ('demo_only','draft','in_review','approved','revoked','expired'));
alter table public.protocol_versions add check((status='demo_only' and reviewer_id is null and reviewed_digest is null) or status<>'demo_only');
alter table public.protocol_versions add check((status<>'approved') or (review_due_at is not null and review_due_at>created_at and revoked_at is null));

create table public.protocol_reviews (
 id uuid primary key default gen_random_uuid(),
 protocol_version_id uuid not null references public.protocol_versions(id),
 reviewer_id uuid not null references public.profiles(id),
 reviewed_digest text not null check(reviewed_digest ~ '^[a-f0-9]{64}$'),
 decision text not null check(decision in ('changes_requested','approved','rejected')),
 scope_note text not null check(length(btrim(scope_note)) between 1 and 1000),
 evidence_ref text not null check(length(btrim(evidence_ref)) between 1 and 500),
 created_at timestamptz not null default now(),
 unique(protocol_version_id,reviewer_id,reviewed_digest,decision)
);
create index protocol_review_reviewer on public.protocol_reviews(reviewer_id);

create table public.source_references (
 id uuid primary key default gen_random_uuid(),
 source_key text not null unique,
 title text not null,
 url text not null check(url ~ '^https://'),
 checked_at date not null,
 license_note text not null,
 created_at timestamptz not null default now()
);
create table public.protocol_sources (
 id uuid primary key default gen_random_uuid(),
 protocol_version_id uuid not null references public.protocol_versions(id),
 source_id uuid not null references public.source_references(id),
 use_note text not null,
 created_at timestamptz not null default now(),
 unique(protocol_version_id,source_id)
);
create index protocol_source_source on public.protocol_sources(source_id);
create table public.protocol_scenarios (
 protocol_version_id uuid not null references public.protocol_versions(id),
 scenario_id text not null references public.scenario_definitions(id),
 newcomer_species text check(newcomer_species in ('cat','dog') or newcomer_species is null),
 created_at timestamptz not null default now(),
 primary key(protocol_version_id,scenario_id)
);
create index protocol_scenario_definition on public.protocol_scenarios(scenario_id);

alter table public.cases
 add column intake jsonb not null default '{"schema_version":"1","answers":{}}',
 add column intake_schema_version text not null default '1',
 add column support_reason_code text not null default 'INTAKE_NOT_SUBMITTED',
 add column routed_at timestamptz,
 add foreign key(scenario_code) references public.scenario_definitions(id);
alter table public.cases drop constraint cases_support_level_check;
alter table public.cases add check(support_level in ('guided_preparation','coordination_only','clarification_required','professional_required','urgent_help'));
alter table public.cases drop constraint cases_status_check;
alter table public.cases add check(status in ('draft','active','paused','archived'));
alter table public.cases add check(
 jsonb_typeof(intake)='object' and intake->>'schema_version'=intake_schema_version
 and jsonb_typeof(intake->'answers')='object'
);

create function private.validate_protocol_approval() returns trigger language plpgsql set search_path='' as $$
begin
 if new.status='approved' and (new.reviewer_id is null or new.reviewed_digest is distinct from new.digest or not exists(
   select 1 from public.protocol_reviews r join public.profiles p on p.id=r.reviewer_id
   where r.protocol_version_id=new.id and r.decision='approved'
     and r.reviewer_id=new.reviewer_id and r.reviewed_digest=new.digest and p.status='active'
     and p.reviewer_scope->'scopes' ? new.pairing
 )) then raise exception 'approved version requires exact verified in-scope review' using errcode='23514'; end if;
 return new;
end $$;
create constraint trigger protocol_approval_gate after insert or update on public.protocol_versions
deferrable initially deferred for each row execute function private.validate_protocol_approval();

create function private.immutable_registry() returns trigger language plpgsql set search_path='' as $$
begin
 if tg_op='DELETE' then raise exception 'registry records are append-only' using errcode='23514'; end if;
 if tg_table_name<>'protocol_versions' then
   raise exception 'registry records are immutable' using errcode='23514'; end if;
 if to_jsonb(old)-'status'-'review_due_at'-'revoked_at'-'reviewer_id'-'reviewed_digest'
    is distinct from to_jsonb(new)-'status'-'review_due_at'-'revoked_at'-'reviewer_id'-'reviewed_digest'
 then raise exception 'registry content is immutable' using errcode='23514'; end if;
 if old.status in ('demo_only','approved','revoked','expired') and new.status not in (old.status,'revoked','expired')
 then raise exception 'terminal content lifecycle cannot reopen' using errcode='23514'; end if;
 if old.status='demo_only' and new.status<>old.status then
   raise exception 'demo content cannot become live content' using errcode='23514'; end if;
 if old.status='draft' and new.status not in ('draft','in_review','revoked','expired') then
   raise exception 'draft content must enter review before approval' using errcode='23514'; end if;
 if old.status='in_review' and new.status not in ('in_review','draft','approved','revoked','expired') then
   raise exception 'invalid content lifecycle transition' using errcode='23514'; end if;
 return new;
end $$;
create trigger immutable_protocol_versions before update or delete on public.protocol_versions for each row execute function private.immutable_registry();
create trigger immutable_protocols before update or delete on public.protocols for each row execute function private.immutable_registry();
create trigger immutable_scenarios before update or delete on public.scenario_definitions for each row execute function private.immutable_registry();
create trigger immutable_protocol_reviews before update or delete on public.protocol_reviews for each row execute function private.immutable_registry();
create trigger immutable_source_references before update or delete on public.source_references for each row execute function private.immutable_registry();
create trigger immutable_protocol_sources before update or delete on public.protocol_sources for each row execute function private.immutable_registry();
create trigger immutable_protocol_scenarios before update or delete on public.protocol_scenarios for each row execute function private.immutable_registry();

create function private.prevent_support_override() returns trigger language plpgsql set search_path='' as $$
begin
 if old.support_level='urgent_help' and new.support_level<>'urgent_help' then
   raise exception 'urgent restriction cannot be owner-overridden' using errcode='23514'; end if;
 if old.support_level='professional_required' and new.support_level not in ('professional_required','urgent_help') then
   raise exception 'professional restriction cannot be owner-overridden' using errcode='23514'; end if;
 return new;
end $$;
create trigger prevent_support_override before update of support_level on public.cases for each row execute function private.prevent_support_override();

-- Public registry tables remain server-authored. Household members may only read
-- versions actually bound to an authorized case plan.
do $$ declare t text; begin
 foreach t in array array['scenario_definitions','protocols','protocol_reviews','source_references','protocol_sources','protocol_scenarios'] loop
  execute format('alter table public.%I enable row level security',t);
  execute format('revoke all on public.%I from anon,authenticated',t);
 end loop;
end $$;
grant select on public.scenario_definitions to authenticated;
create policy scenario_read on public.scenario_definitions for select to authenticated using((select private.active_identity()));
grant select on public.protocols,public.source_references,public.protocol_sources to authenticated;
create policy protocol_identity_read on public.protocols for select to authenticated using(exists(
 select 1 from public.protocol_versions v join public.plan_revisions p on p.protocol_version_id=v.id
 where v.protocol_id=protocols.id and private.can_read_case(p.household_id,p.case_id)));
create policy source_read on public.source_references for select to authenticated using(exists(
 select 1 from public.protocol_sources ps join public.plan_revisions p on p.protocol_version_id=ps.protocol_version_id
 where ps.source_id=source_references.id and private.can_read_case(p.household_id,p.case_id)));
create policy protocol_source_read on public.protocol_sources for select to authenticated using(exists(
 select 1 from public.plan_revisions p where p.protocol_version_id=protocol_sources.protocol_version_id
 and private.can_read_case(p.household_id,p.case_id)));
grant select on public.protocol_scenarios to authenticated;
create policy protocol_scenario_read on public.protocol_scenarios for select to authenticated using(exists(
 select 1 from public.plan_revisions p where p.protocol_version_id=protocol_scenarios.protocol_version_id
 and private.can_read_case(p.household_id,p.case_id)));
-- Review evidence and reviewer identity stay server-only.

revoke all on function private.validate_protocol_approval(),private.immutable_registry(),private.prevent_support_override() from public;
