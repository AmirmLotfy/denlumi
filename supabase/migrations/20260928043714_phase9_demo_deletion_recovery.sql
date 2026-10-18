-- A disclosed one-time secret can request deletion of its exact expired
-- fictional demo. Store only its digest; no Data API role can read this table.
create table private.demo_deletion_codes (
 household_id uuid primary key references public.households(id),
 owner_id uuid not null references auth.users(id),
 code_hash text not null check(code_hash ~ '^[a-f0-9]{64}$'),
 request_id uuid unique references private.deletion_requests(id),
 issued_at timestamptz not null default now(),
 expires_at timestamptz not null,
 redeemed_at timestamptz,
 check(expires_at>issued_at)
);
create index demo_deletion_codes_expiry on private.demo_deletion_codes(expires_at);
alter table private.demo_deletion_codes enable row level security;
revoke all on private.demo_deletion_codes from public,anon,authenticated;
