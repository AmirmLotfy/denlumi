-- A withdrawn protocol must pause an interrupted software session as well as
-- an active one. Preserve the disabled-household deletion exception.
create or replace function private.session_transition_guard() returns trigger language plpgsql set search_path='' as $$
begin
 if tg_op='DELETE' and current_user not in ('authenticated','anon','authenticator')
   and current_setting('denlumi.deleting_household',true)=old.household_id::text
   and exists(select 1 from public.households where id=old.household_id and status='deleting') then return old; end if;
 if tg_op='DELETE' then raise exception 'session history is append-only' using errcode='23514'; end if;
 if to_jsonb(old)-'state'-'last_checkpoint_at'-'ended_at'-'interruption_reason' is distinct from to_jsonb(new)-'state'-'last_checkpoint_at'-'ended_at'-'interruption_reason'
 then raise exception 'session binding is immutable' using errcode='23514'; end if;
 if (old.state='preflight' and new.state not in ('preflight','active','canceled'))
 or (old.state='active' and new.state not in ('active','paused','interrupted','finished','canceled'))
 or (old.state='paused' and new.state not in ('paused','active','interrupted','finished','canceled'))
 or (old.state='interrupted' and new.state not in ('interrupted','active','paused','canceled'))
 or (old.state in ('finished','canceled') and new.state<>old.state)
 then raise exception 'invalid session transition' using errcode='23514'; end if;
 return new;
end $$;
