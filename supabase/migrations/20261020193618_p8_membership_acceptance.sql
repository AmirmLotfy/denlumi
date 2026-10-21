-- Local-only P8: pending grants disclose their scope through a recipient-bound
-- server query, never through ordinary household record policies.
create or replace function private.has_membership(h uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.memberships m
 join public.households x on x.id=m.household_id join public.profiles p on p.id=m.profile_id
 where m.household_id=h and m.profile_id=auth.uid() and p.status='active' and x.status='active'
 and m.accepted_at is not null and m.revoked_at is null
 and (m.expires_at is null or m.expires_at>now()) and (x.expires_at is null or x.expires_at>now())
 and exists(select 1 from auth.sessions s where s.id::text=auth.jwt()->>'session_id'
 and s.user_id=auth.uid() and (s.not_after is null or s.not_after>now())));
$$;
create or replace function private.accessible_household_ids() returns uuid[]
language sql stable security definer set search_path='' as $$
 select coalesce(array_agg(m.household_id),'{}'::uuid[])
 from public.memberships m join public.households h on h.id=m.household_id
 join public.profiles p on p.id=m.profile_id
 where m.profile_id=(select auth.uid()) and p.status='active' and h.status='active'
 and m.accepted_at is not null and m.revoked_at is null
 and (m.expires_at is null or m.expires_at>now()) and (h.expires_at is null or h.expires_at>now())
 and (select private.active_identity());
$$;
revoke all on function private.has_membership(uuid),private.accessible_household_ids() from public,anon;
grant execute on function private.has_membership(uuid),private.accessible_household_ids() to authenticated;
