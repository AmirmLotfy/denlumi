alter table public.memberships add column grant_version integer not null default 1 check(grant_version>0);
