-- Local only. Aliases are optional names, never an authorization or automatic identity match.
alter table public.pets add column aliases text[] not null default '{}'
 check(cardinality(aliases)<=10 and array_position(aliases,null) is null and octet_length(aliases::text)<=1000);
