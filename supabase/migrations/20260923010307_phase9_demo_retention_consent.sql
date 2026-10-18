-- Local-only fictional demo retention. Existing sample rows have no consent and
-- are deliberately excluded from the cleanup worker.
alter table public.households
 add column demo_retention_acknowledged_at timestamptz,
 add column demo_purge_at timestamptz,
 add constraint demo_retention_scope check (
  (demo_retention_acknowledged_at is null and demo_purge_at is null)
  or (mode='demo' and fictional and demo_retention_acknowledged_at is not null
      and demo_purge_at is not null and demo_purge_at>expires_at)
 );
create index households_consented_demo_purge
 on public.households(demo_purge_at)
 where mode='demo' and fictional and demo_retention_acknowledged_at is not null;
