-- Phase 7: private immutable records, exact authorization and explicit household cleanup.
create table public.professional_summaries (
 id uuid primary key default gen_random_uuid(), household_id uuid not null references public.households(id),
 case_id uuid not null, created_by uuid not null references public.profiles(id),
 body jsonb not null, source_event_ids uuid[] not null, scope jsonb not null,
 digest text not null check(digest ~ '^[a-f0-9]{64}$'), content_text text not null,
 format text not null check(format in ('text','html')), purpose text not null check(purpose in ('export','share')),
 recipient_address text, recipient_id uuid references public.profiles(id), expires_at timestamptz not null,
 state_version integer not null, safety_epoch integer not null, created_at timestamptz not null default now(),
 unique(household_id,id), foreign key(household_id,case_id) references public.cases(household_id,id),
 check((purpose='export' and recipient_address is null and recipient_id is null) or (purpose='share' and recipient_address is not null and recipient_id is not null))
);
create index summaries_household on public.professional_summaries(household_id,created_at);
create table public.action_authorizations (
 id uuid primary key default gen_random_uuid(), household_id uuid not null, summary_id uuid not null,
 owner_id uuid not null references public.profiles(id), action_kind text not null check(action_kind in ('share','export')),
 payload_digest text not null, expires_at timestamptz not null, consumed_at timestamptz not null,
 idempotency_key text not null, created_at timestamptz not null default now(),
 unique(household_id,id), unique(household_id,summary_id), unique(household_id,owner_id,idempotency_key),
 foreign key(household_id,summary_id) references public.professional_summaries(household_id,id)
);
create table public.private_exports (
 id uuid primary key default gen_random_uuid(), household_id uuid not null, summary_id uuid not null,
 authorization_id uuid not null, owner_id uuid not null references public.profiles(id),
 mime_type text not null check(mime_type in ('text/plain','text/html')), content_text text not null,
 digest text not null, expires_at timestamptz not null, created_at timestamptz not null default now(),
 unique(household_id,id), unique(authorization_id),
 foreign key(household_id,summary_id) references public.professional_summaries(household_id,id),
 foreign key(household_id,authorization_id) references public.action_authorizations(household_id,id)
);
create index exports_household on public.private_exports(household_id,expires_at);
create table public.share_grants (
 id uuid primary key default gen_random_uuid(), household_id uuid not null, summary_id uuid not null,
 authorization_id uuid not null, recipient_id uuid not null references public.profiles(id), recipient_address text not null,
 scope jsonb not null, expires_at timestamptz not null, revoked_at timestamptz, created_at timestamptz not null default now(),
 unique(household_id,id), unique(authorization_id),
 foreign key(household_id,summary_id) references public.professional_summaries(household_id,id),
 foreign key(household_id,authorization_id) references public.action_authorizations(household_id,id)
);
create index shares_household on public.share_grants(household_id,expires_at);
create index shares_recipient on public.share_grants(recipient_id,expires_at);
-- No bearer token exists: the grant ID is only a locator, verified account identity is mandatory.
create table private.record_view_sessions (
 grant_id uuid not null references public.share_grants(id), session_id uuid not null,
 expires_at timestamptz not null, primary key(grant_id,session_id)
);
alter table private.record_view_sessions enable row level security;
create table private.deletion_requests (
 id uuid primary key default gen_random_uuid(), household_id uuid not null unique,
 owner_id uuid not null references public.profiles(id), idempotency_key text not null, body_hash text not null,
 status text not null check(status in ('pending','processing','failed','completed')) default 'pending',
 last_error_code text, primary_cleanup_verified boolean not null default false,
 attempts integer not null default 0, processing_at timestamptz, created_at timestamptz not null default now(), completed_at timestamptz,
 unique(owner_id,idempotency_key)
);
alter table private.deletion_requests enable row level security;
revoke all on private.deletion_requests,private.record_view_sessions from public,anon,authenticated;
-- Only the server endpoint can read these exact snapshots. Data API is denied even to members.
do $$ declare t text; begin
 foreach t in array array['professional_summaries','action_authorizations','private_exports','share_grants'] loop
 execute format('alter table public.%I enable row level security',t);
 execute format('revoke all on public.%I from public,anon,authenticated',t);
 execute format('grant select on public.%I to authenticated',t);
 end loop;
end $$;
create function private.immutable_private_record() returns trigger language plpgsql set search_path='' as $$
begin
 if tg_op='DELETE' and current_user not in ('authenticated','anon','authenticator')
 and current_setting('denlumi.deleting_household',true)=old.household_id::text
 and exists(select 1 from public.households where id=old.household_id and status='deleting') then return old; end if;
 if tg_table_name='share_grants' and tg_op='UPDATE' and old.revoked_at is null and new.revoked_at is not null
 and to_jsonb(old)-'revoked_at'=to_jsonb(new)-'revoked_at' then return new; end if;
 raise exception 'private record is immutable' using errcode='23514';
end $$;
do $$ declare t text; begin
 foreach t in array array['professional_summaries','action_authorizations','private_exports','share_grants'] loop
 execute format('create trigger immutable_private_record before update or delete on public.%I for each row execute function private.immutable_private_record()',t);
 end loop;
end $$;
revoke all on function private.immutable_private_record() from public,anon,authenticated;
-- Explicit deletion permits the server job to remove append-only tenant history, never ordinary edits.
-- Preserve the existing trigger bodies verbatim, adding only this narrowly scoped DELETE exception.
do $$ declare n text; definition text; begin
 foreach n in array array['immutable_reviewed_plan','immutable_phase3_history','immutable_observation_history','session_transition_guard','immutable_task_history'] loop
 select pg_get_functiondef(p.oid) into definition from pg_proc p join pg_namespace ns on ns.oid=p.pronamespace where ns.nspname='private' and p.proname=n;
 if definition is null then raise exception 'missing history guard %',n; end if;
 definition:=regexp_replace(definition,'\mbegin\M',E'begin\n if tg_op=''DELETE'' and current_user not in (''authenticated'',''anon'',''authenticator'') and current_setting(''denlumi.deleting_household'',true)=old.household_id::text and exists(select 1 from public.households where id=old.household_id and status=''deleting'') then return old; end if;', 'i');
 execute definition;
 end loop;
end $$;
-- A disabled household may have every membership revoked before the asynchronous deletion job.
create or replace function private.check_owner() returns trigger language plpgsql set search_path='' as $$
declare h uuid; begin
 h:=case when tg_table_name='households' then (to_jsonb(new)->>'id')::uuid when tg_op='DELETE' then (to_jsonb(old)->>'household_id')::uuid else (to_jsonb(new)->>'household_id')::uuid end;
 if exists(select 1 from public.households where id=h and status<>'deleting') and not exists(select 1 from public.households x join public.memberships m on m.household_id=x.id and m.profile_id=x.owner_id where x.id=h and m.role='owner' and m.revoked_at is null and m.expires_at is null and m.pet_scope is null and m.case_scope is null) then
 raise exception 'household requires matching unrestricted owner' using errcode='23514'; end if;
 return null; end $$;
